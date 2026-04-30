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

random.seed(SEED)


def main():
    t0 = time.time()

    # ── 1. Load the dual graph ─────────────────────────────────────────
    print("Loading MA precinct graph...")
    graph = Graph.from_file(SHP_PATH)
    print(f"  {len(graph.nodes)} nodes, {len(graph.edges)} edges")

    # Fix connectivity — connect island nodes and heal district fragments.
    # Some precincts (Gosnold, Nantucket, parts of Boston) aren't adjacent
    # under rook contiguity. We add edges so every district is connected.
    islands = [n for n in graph.nodes if graph.degree(n) == 0]
    if islands:
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

    # Ensure every district subgraph is connected
    districts_nodes = {}
    for n in graph.nodes:
        districts_nodes.setdefault(graph.nodes[n]["CD"], []).append(n)

    edges_added = 0
    for cd, nodes in districts_nodes.items():
        sub = graph.subgraph(nodes)
        components = list(nx.connected_components(sub))
        if len(components) <= 1:
            continue
        # Connect each small component to the largest via nearest geometry
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

    print(f"  Fixed connectivity: added {edges_added + len(islands)} edge(s), "
          f"graph now has {len(graph.edges)} edges")

    # ── 2. Compute ideal population ────────────────────────────────────
    districts = set(graph.nodes[n]["CD"] for n in graph.nodes)
    num_districts = len(districts)
    total_pop = sum(graph.nodes[n]["TOTPOP"] for n in graph.nodes)
    ideal_pop = total_pop / num_districts
    print(f"  {num_districts} districts, ideal pop = {ideal_pop:,.0f}")

    # ── 3. Define updaters ─────────────────────────────────────────────
    updaters = {
        "population": Tally("TOTPOP", alias="population"),
        "cut_edges": cut_edges,

        # 2024 Presidential
        "PRES24": Election(
            "2024 Presidential",
            {"Democratic": "G24PREDHAR", "Republican": "G24PRERTRU"},
            alias="PRES24",
        ),
        # 2024 Senate
        "SEN24": Election(
            "2024 Senate",
            {"Democratic": "G24USSDWAR", "Republican": "G24USSRDEA"},
            alias="SEN24",
        ),

        # Demographics (VAP)
        "VAP": Tally("VAP", alias="VAP"),
        "WVAP": Tally("WVAP", alias="WVAP"),
        "BVAP": Tally("BVAP", alias="BVAP"),
        "HVAP": Tally("HVAP", alias="HVAP"),
        "ASIANVAP": Tally("ASIANVAP", alias="ASIANVAP"),
    }

    # ── 4. Initial partition from enacted congressional districts ──────
    print("Creating initial partition from CD assignments...")
    initial = Partition(graph, assignment="CD", updaters=updaters)
    print(f"  Initial cut edges: {len(initial['cut_edges'])}")

    # ── 5. Configure ReCom proposal ────────────────────────────────────
    proposal = partial(
        recom,
        pop_col="TOTPOP",
        pop_target=ideal_pop,
        epsilon=EPSILON,
        node_repeats=2,
    )

    # ── 6. Build and run the chain ─────────────────────────────────────
    print(f"Running {NUM_STEPS} steps of ReCom (epsilon={EPSILON})...")
    chain = MarkovChain(
        proposal=proposal,
        constraints=[contiguous],
        accept=always_accept,
        initial_state=initial,
        total_steps=NUM_STEPS,
    )

    # ── 7. Collect results ─────────────────────────────────────────────
    steps = []
    dem_seat_counts = []  # for summary histogram

    for i, partition in enumerate(chain):
        pop = dict(partition["population"])

        # Population deviation
        max_dev = max(abs(p - ideal_pop) / ideal_pop for p in pop.values())

        # Election outcomes
        pres_result = partition["PRES24"]
        sen_result = partition["SEN24"]
        pres_dem_seats = pres_result.wins("Democratic")
        sen_dem_seats = sen_result.wins("Democratic")

        # Dem vote share per district
        dem_pcts = pres_result.percents_for_party["Democratic"]

        # Minority VAP shares by district
        vap = dict(partition["VAP"])
        bvap = dict(partition["BVAP"])
        hvap = dict(partition["HVAP"])
        avap = dict(partition["ASIANVAP"])

        minority_vap_shares = {}
        for d in pop:
            v = vap[d] if vap[d] > 0 else 1
            minority_vap_shares[d] = {
                "BVAP_pct": round(100 * bvap[d] / v, 1),
                "HVAP_pct": round(100 * hvap[d] / v, 1),
                "ASIANVAP_pct": round(100 * avap[d] / v, 1),
            }

        step_data = {
            "step": i,
            "max_pop_deviation": round(max_dev, 4),
            "cut_edges": len(partition["cut_edges"]),
            "pres24_dem_seats": pres_dem_seats,
            "sen24_dem_seats": sen_dem_seats,
            "pres24_dem_vote_pct": {
                d: round(v, 4) for d, v in dem_pcts.items()
            },
            "population": pop,
            "minority_vap_shares": minority_vap_shares,
        }
        steps.append(step_data)
        dem_seat_counts.append(pres_dem_seats)

        if (i + 1) % 50 == 0:
            elapsed = time.time() - t0
            print(f"  Step {i+1}/{NUM_STEPS} | "
                  f"Dem seats: {pres_dem_seats} | "
                  f"Max dev: {max_dev:.3f} | "
                  f"{elapsed:.1f}s elapsed")

    # ── 8. Summary statistics ──────────────────────────────────────────
    seat_histogram = {}
    for s in dem_seat_counts:
        seat_histogram[s] = seat_histogram.get(s, 0) + 1

    enacted_dem_seats = steps[0]["pres24_dem_seats"]

    summary = {
        "state": "Massachusetts",
        "num_districts": num_districts,
        "total_population": total_pop,
        "ideal_population": round(ideal_pop),
        "num_steps": NUM_STEPS,
        "epsilon": EPSILON,
        "seed": SEED,
        "enacted_dem_seats_pres24": enacted_dem_seats,
        "dem_seat_histogram_pres24": seat_histogram,
        "avg_cut_edges": round(
            sum(s["cut_edges"] for s in steps) / len(steps), 1
        ),
        "runtime_seconds": round(time.time() - t0, 1),
    }

    # ── 9. Write output ───────────────────────────────────────────────
    output = {"summary": summary, "steps": steps}
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nDone! Results written to {OUTPUT_PATH}")
    print(f"\n── Summary ──")
    print(f"  Enacted plan Dem seats (Pres 2024): {enacted_dem_seats}")
    print(f"  Seat distribution across {NUM_STEPS} plans: {seat_histogram}")
    print(f"  Avg cut edges: {summary['avg_cut_edges']}")
    print(f"  Runtime: {summary['runtime_seconds']}s")


if __name__ == "__main__":
    main()
