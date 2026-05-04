#!/usr/bin/env python3

import json
import os
import random
import time
from functools import partial

import networkx as nx
from gerrychain import Graph, Partition, MarkovChain, Election
from gerrychain.updaters import Tally, cut_edges
from gerrychain.proposals import recom
from gerrychain.constraints import contiguous
from gerrychain.accept import always_accept

# ── Configuration ──────────────────────────────────────────────────────
SEED = 42
NUM_STEPS = 250
EPSILON = 0.05  # ±5% population deviation allowed

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
SHP_PATH = os.path.join(
    PROJECT_DIR, "server", "database", "data", "cleaned",
    "gerrychain", "ma_precincts.shp"
)
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "demo_results.json")


# ── Graph loading + connectivity fix ───────────────────────────────────

def load_graph():
    """Load the MA precinct graph from disk."""
    print("Loading MA precinct graph...")
    graph = Graph.from_file(SHP_PATH)
    print(f"  {len(graph.nodes)} nodes, {len(graph.edges)} edges")
    return graph


def connect_islands(graph):
    """Attach degree-zero nodes to their nearest neighbor by geometry."""
    islands = [n for n in graph.nodes if graph.degree(n) == 0]
    if not islands:
        return 0
    print(f"  Connecting {len(islands)} island node(s)...")
    for island in islands:
        best_dist, best_n = float("inf"), None
        for n in graph.nodes:
            if n == island:
                continue
            d = graph.nodes[island]["geometry"].distance(graph.nodes[n]["geometry"])
            if d < best_dist:
                best_dist, best_n = d, n
        if best_n is not None:
            graph.add_edge(island, best_n)
    return len(islands)


def heal_district_fragments(graph):
    """Stitch disconnected components within each district by nearest geometry."""
    districts_nodes = {}
    for n in graph.nodes:
        districts_nodes.setdefault(graph.nodes[n]["CD"], []).append(n)

    edges_added = 0
    for _cd, nodes in districts_nodes.items():
        sub = graph.subgraph(nodes)
        components = list(nx.connected_components(sub))
        if len(components) <= 1:
            continue
        main = max(components, key=len)
        for comp in components:
            if comp is main:
                continue
            best_dist, best_a, best_b = float("inf"), None, None
            for a in comp:
                for b in main:
                    d = graph.nodes[a]["geometry"].distance(graph.nodes[b]["geometry"])
                    if d < best_dist:
                        best_dist, best_a, best_b = d, a, b
            if best_a is not None:
                graph.add_edge(best_a, best_b)
                edges_added += 1
    return edges_added


def fix_connectivity(graph):
    """Connect islands and heal fragmented districts in-place."""
    islands_added = connect_islands(graph)
    fragment_edges = heal_district_fragments(graph)
    print(f"  Fixed connectivity: added {islands_added + fragment_edges} edge(s), "
          f"graph now has {len(graph.edges)} edges")


def compute_population_targets(graph):
    """Return (num_districts, total_pop, ideal_pop) for the loaded graph."""
    districts = set(graph.nodes[n]["CD"] for n in graph.nodes)
    num_districts = len(districts)
    total_pop = sum(graph.nodes[n]["TOTPOP"] for n in graph.nodes)
    ideal_pop = total_pop / num_districts
    print(f"  {num_districts} districts, ideal pop = {ideal_pop:,.0f}")
    return num_districts, total_pop, ideal_pop


# ── Chain construction ────────────────────────────────────────────────

def build_updaters():
    """Updaters for population, cut edges, two elections, and minority VAP."""
    return {
        "population": Tally("TOTPOP", alias="population"),
        "cut_edges": cut_edges,
        "PRES24": Election(
            "2024 Presidential",
            {"Democratic": "G24PREDHAR", "Republican": "G24PRERTRU"},
            alias="PRES24",
        ),
        "SEN24": Election(
            "2024 Senate",
            {"Democratic": "G24USSDWAR", "Republican": "G24USSRDEA"},
            alias="SEN24",
        ),
        "VAP": Tally("VAP", alias="VAP"),
        "WVAP": Tally("WVAP", alias="WVAP"),
        "BVAP": Tally("BVAP", alias="BVAP"),
        "HVAP": Tally("HVAP", alias="HVAP"),
        "ASIANVAP": Tally("ASIANVAP", alias="ASIANVAP"),
    }


def build_initial_partition(graph):
    """Create the seed Partition from enacted CD assignments."""
    print("Creating initial partition from CD assignments...")
    initial = Partition(graph, assignment="CD", updaters=build_updaters())
    print(f"  Initial cut edges: {len(initial['cut_edges'])}")
    return initial


def build_chain(initial, ideal_pop):
    """Build the MarkovChain configured for ReCom."""
    proposal = partial(
        recom,
        pop_col="TOTPOP",
        pop_target=ideal_pop,
        epsilon=EPSILON,
        node_repeats=2,
    )
    print(f"Running {NUM_STEPS} steps of ReCom (epsilon={EPSILON})...")
    return MarkovChain(
        proposal=proposal,
        constraints=[contiguous],
        accept=always_accept,
        initial_state=initial,
        total_steps=NUM_STEPS,
    )


# ── Per-step metrics ──────────────────────────────────────────────────

def compute_minority_vap_shares(partition):
    """Per-district BVAP/HVAP/ASIANVAP percentages (of VAP)."""
    vap = dict(partition["VAP"])
    bvap = dict(partition["BVAP"])
    hvap = dict(partition["HVAP"])
    avap = dict(partition["ASIANVAP"])
    pop = dict(partition["population"])

    shares = {}
    for d in pop:
        v = vap[d] if vap[d] > 0 else 1
        shares[d] = {
            "BVAP_pct": round(100 * bvap[d] / v, 1),
            "HVAP_pct": round(100 * hvap[d] / v, 1),
            "ASIANVAP_pct": round(100 * avap[d] / v, 1),
        }
    return shares


def step_metrics(partition, step_index, ideal_pop):
    """All metrics for one chain step."""
    pop = dict(partition["population"])
    max_dev = max(abs(p - ideal_pop) / ideal_pop for p in pop.values())

    pres_result = partition["PRES24"]
    sen_result = partition["SEN24"]
    pres_dem_seats = pres_result.wins("Democratic")
    sen_dem_seats = sen_result.wins("Democratic")
    dem_pcts = pres_result.percents_for_party["Democratic"]

    return {
        "step": step_index,
        "max_pop_deviation": round(max_dev, 4),
        "cut_edges": len(partition["cut_edges"]),
        "pres24_dem_seats": pres_dem_seats,
        "sen24_dem_seats": sen_dem_seats,
        "pres24_dem_vote_pct": {d: round(v, 4) for d, v in dem_pcts.items()},
        "population": pop,
        "minority_vap_shares": compute_minority_vap_shares(partition),
    }


def log_progress(step_index, total, dem_seats, max_dev, t0):
    """Periodic progress message every 50 steps."""
    if (step_index + 1) % 50 != 0:
        return
    elapsed = time.time() - t0
    print(f"  Step {step_index+1}/{total} | "
          f"Dem seats: {dem_seats} | "
          f"Max dev: {max_dev:.3f} | "
          f"{elapsed:.1f}s elapsed")


def run_chain(chain, ideal_pop, t0):
    """Run the chain to completion; return (steps, dem_seat_counts)."""
    steps = []
    dem_seat_counts = []
    for i, partition in enumerate(chain):
        data = step_metrics(partition, i, ideal_pop)
        steps.append(data)
        dem_seat_counts.append(data["pres24_dem_seats"])
        log_progress(i, NUM_STEPS, data["pres24_dem_seats"],
                     data["max_pop_deviation"], t0)
    return steps, dem_seat_counts


# ── Output ────────────────────────────────────────────────────────────

def build_summary(steps, dem_seat_counts, num_districts, total_pop, ideal_pop, t0):
    """Aggregate run-level summary from per-step metrics."""
    seat_histogram = {}
    for s in dem_seat_counts:
        seat_histogram[s] = seat_histogram.get(s, 0) + 1

    return {
        "state": "Massachusetts",
        "num_districts": num_districts,
        "total_population": total_pop,
        "ideal_population": round(ideal_pop),
        "num_steps": NUM_STEPS,
        "epsilon": EPSILON,
        "seed": SEED,
        "enacted_dem_seats_pres24": steps[0]["pres24_dem_seats"],
        "dem_seat_histogram_pres24": seat_histogram,
        "avg_cut_edges": round(
            sum(s["cut_edges"] for s in steps) / len(steps), 1
        ),
        "runtime_seconds": round(time.time() - t0, 1),
    }


def write_output(summary, steps):
    """Persist the run output to OUTPUT_PATH."""
    with open(OUTPUT_PATH, "w") as f:
        json.dump({"summary": summary, "steps": steps}, f, indent=2)


def print_final_summary(summary):
    """Console recap of the run."""
    print(f"\nDone! Results written to {OUTPUT_PATH}")
    print(f"\n── Summary ──")
    print(f"  Enacted plan Dem seats (Pres 2024): {summary['enacted_dem_seats_pres24']}")
    print(f"  Seat distribution across {NUM_STEPS} plans: {summary['dem_seat_histogram_pres24']}")
    print(f"  Avg cut edges: {summary['avg_cut_edges']}")
    print(f"  Runtime: {summary['runtime_seconds']}s")


# ── Main ──────────────────────────────────────────────────────────────

def main():
    random.seed(SEED)
    t0 = time.time()

    graph = load_graph()
    fix_connectivity(graph)
    num_districts, total_pop, ideal_pop = compute_population_targets(graph)

    initial = build_initial_partition(graph)
    chain = build_chain(initial, ideal_pop)

    steps, dem_seat_counts = run_chain(chain, ideal_pop, t0)

    summary = build_summary(steps, dem_seat_counts, num_districts,
                            total_pop, ideal_pop, t0)
    write_output(summary, steps)
    print_final_summary(summary)


if __name__ == "__main__":
    main()
