#!/usr/bin/env python3
"""
run_ensemble.py -- Main SeaWulf ensemble runner (one process per core).

Implements SeaWulf use cases 1-9, 11:
  SeaWulf-1  Pre-stage data and dispatch
  SeaWulf-2  Race-blind ReCom ensemble
  SeaWulf-3  VRA-constrained ReCom ensemble
  SeaWulf-4  Multi-core coordination (each core runs this script independently)
  SeaWulf-5  Calculate election winners per district
  SeaWulf-6  Calculate minority effectiveness per district
  SeaWulf-7  Calculate minority population % per district
  SeaWulf-8  Calculate R/D split per plan
  SeaWulf-9  Identify and store interesting plans
  SeaWulf-11 Accumulate box & whisker data (sorted minority % arrays)

Usage:
  python run_ensemble.py --config state_config.json --mode race_blind \
      --core-id 0 --num-cores 28 --total-plans 5000 --output-dir ../results

  python run_ensemble.py --config state_config.json --mode vra \
      --core-id 0 --num-cores 28 --total-plans 5000 --output-dir ../results
"""

import argparse
import json
import math
import os
import random
import sys
import time
from functools import partial

# Force line-buffered output so logs are visible in real-time
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

# Ensure the scripts directory is importable
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
HPC_DIR = os.path.dirname(SCRIPT_DIR)
sys.path.insert(0, SCRIPT_DIR)

import networkx as nx
from gerrychain import Graph, MarkovChain, Partition, Election
from gerrychain.updaters import Tally, cut_edges
from gerrychain.proposals import recom
from gerrychain.constraints import contiguous, within_percent_of_ideal_population
from gerrychain.accept import always_accept
from gerrychain.tree import recursive_tree_part

from config import (
    StateConfig, load_state_config,
    POP_COL, VAP_COL, PRES24D_COL, PRES24R_COL, DISTRICT_COL,
)
from effectiveness import (
    compute_benchmark,
    compute_plan_metrics,
    make_vra_constraint,
    district_effectiveness,
)


# ── Column remapping per state ────────────────────────────────────────
COLUMN_REMAP = {
    "TX": {
        "CONG_DIST": DISTRICT_COL,   # TX uses CONG_DIST instead of CD
        "HISPVAP": "HVAP",           # TX uses HISPVAP instead of HVAP
    },
}

# Numeric columns that must be int (TX GeoJSON has floats)
INT_COLS = [POP_COL, VAP_COL, "BVAP", "HVAP", "ASIANVAP", "WVAP",
            PRES24D_COL, PRES24R_COL]


# ── Graph loading ────────────────────────────────────────────────────

def load_graph(cfg: StateConfig) -> Graph:
    """Load the precinct dual graph from file, fix connectivity issues."""
    path = cfg.graph_path
    if not os.path.isabs(path):
        path = os.path.join(HPC_DIR, path)

    print(f"  Loading graph from {path} ...")
    if path.endswith(".json") and not path.endswith(".geojson"):
        graph = Graph.from_json(path)
    else:
        graph = Graph.from_file(path)

    print(f"  {len(graph.nodes)} nodes, {len(graph.edges)} edges")

    # Remap columns for states with non-canonical names
    remap = COLUMN_REMAP.get(cfg.state_abbr, {})
    if remap:
        print(f"  Remapping columns for {cfg.state_abbr}: {remap}")
        for node in graph.nodes:
            for src, dst in remap.items():
                if src in graph.nodes[node]:
                    graph.nodes[node][dst] = graph.nodes[node].pop(src)

    # Cast numeric columns to int (TX GeoJSON has floats)
    for node in graph.nodes:
        for col in INT_COLS:
            if col in graph.nodes[node]:
                graph.nodes[node][col] = int(graph.nodes[node][col])

    # Fix island nodes (degree-0) — connect to nearest neighbor by geometry
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

    # Fix district connectivity — ensure each district subgraph is connected
    districts_nodes = {}
    for n in graph.nodes:
        districts_nodes.setdefault(graph.nodes[n][DISTRICT_COL], []).append(n)

    edges_added = 0
    for cd, nodes in districts_nodes.items():
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

    if islands or edges_added:
        print(f"  Fixed connectivity: +{len(islands) + edges_added} edges, "
              f"now {len(graph.edges)} edges")

    return graph


# ── Partition setup ──────────────────────────────────────────────────

def build_updaters(cfg: StateConfig) -> dict:
    """Create the updater dictionary for Partition."""
    updaters = {
        "population": Tally(POP_COL, alias="population"),
        VAP_COL: Tally(VAP_COL, alias=VAP_COL),
        "cut_edges": cut_edges,

        # 2024 Presidential election
        "PRES24": Election(
            "2024 Presidential",
            {"Democratic": PRES24D_COL, "Republican": PRES24R_COL},
            alias="PRES24",
        ),
    }

    # Add a Tally updater for each feasible minority group's VAP
    for g in cfg.minority_groups:
        updaters[g.vap_col] = Tally(g.vap_col, alias=g.vap_col)

    return updaters


def create_initial_partition(graph: Graph, cfg: StateConfig) -> Partition:
    """Create the initial partition from the enacted plan.

    If the enacted plan violates the population tolerance, fall back to
    recursive_tree_part to generate a valid seed partition.
    """
    updaters = build_updaters(cfg)
    enacted = Partition(graph, assignment=DISTRICT_COL, updaters=updaters)

    # Check if enacted plan satisfies population tolerance
    total_pop = sum(enacted["population"].values())
    ideal_pop = total_pop / cfg.num_districts
    lo = ideal_pop * (1 - cfg.pop_tolerance)
    hi = ideal_pop * (1 + cfg.pop_tolerance)
    pops = enacted["population"].values()
    max_dev = max(abs(p - ideal_pop) / ideal_pop for p in pops)

    if all(lo <= p <= hi for p in pops):
        print(f"  Enacted plan satisfies {cfg.pop_tolerance:.0%} tolerance "
              f"(max deviation: {max_dev:.2%})")
        return enacted

    print(f"  Enacted plan violates {cfg.pop_tolerance:.0%} tolerance "
          f"(max deviation: {max_dev:.2%})")
    print(f"  Generating valid seed partition via recursive_tree_part ...")
    assignment = recursive_tree_part(
        graph,
        range(cfg.num_districts),
        ideal_pop,
        POP_COL,
        cfg.pop_tolerance,
        node_repeats=cfg.node_repeats,
    )
    seed_partition = Partition(graph, assignment=assignment, updaters=updaters)
    print(f"  Seed partition generated successfully")
    return seed_partition


# ── Chain construction ───────────────────────────────────────────────

def build_chain(
    initial: Partition,
    cfg: StateConfig,
    mode: str,
    steps: int,
) -> MarkovChain:
    """Build a MarkovChain for race-blind or VRA-constrained ReCom."""
    total_pop = sum(initial["population"].values())
    ideal_pop = total_pop / cfg.num_districts

    # Proposal: standard ReCom
    proposal = partial(
        recom,
        pop_col=POP_COL,
        pop_target=ideal_pop,
        epsilon=cfg.pop_tolerance,
        node_repeats=cfg.node_repeats,
    )

    # Constraints shared by both modes
    pop_constraint = within_percent_of_ideal_population(
        initial, percent=cfg.pop_tolerance, pop_key="population"
    )
    constraints = [contiguous, pop_constraint]

    # VRA mode: add effectiveness constraint
    if mode == "vra":
        vra = make_vra_constraint(cfg, election_key="PRES24")
        constraints.append(vra)

    chain = MarkovChain(
        proposal=proposal,
        constraints=constraints,
        accept=always_accept,
        initial_state=initial,
        total_steps=steps,
    )
    return chain


# ── Interesting-plan tracker ─────────────────────────────────────────

class InterestingPlanTracker:
    """Track plans with max/min minority effectiveness (SeaWulf-9).

    Keeps up to `max_plans` interesting plans with full assignments.
    Criteria: maximum and minimum effective districts for each minority group.
    """

    def __init__(self, cfg: StateConfig, max_plans: int = 10):
        self.cfg = cfg
        self.max_plans = max_plans
        self.plans = []  # list of (label, score, assignment_dict, metrics_dict)
        self._best = {}  # {label: (score, index_in_plans)}
        self._worst = {}

        for g in cfg.minority_groups:
            self._best[f"max_{g.name}_effective"] = (-1, None)
            self._worst[f"min_{g.name}_effective"] = (float("inf"), None)

    def update(self, partition, metrics: dict, step: int):
        """Check if this plan is interesting and store if so."""
        for g in self.cfg.minority_groups:
            eff = metrics["minority_effective"][g.name]

            # Max effective
            key_max = f"max_{g.name}_effective"
            if eff > self._best[key_max][0]:
                self._best[key_max] = (eff, len(self.plans))
                self._add_plan(key_max, eff, partition, metrics, step)

            # Min effective
            key_min = f"min_{g.name}_effective"
            if eff < self._worst[key_min][0]:
                self._worst[key_min] = (eff, len(self.plans))
                self._add_plan(key_min, eff, partition, metrics, step)

    def _add_plan(self, label, score, partition, metrics, step):
        assignment = {str(k): int(v) for k, v in partition.assignment.items()}
        self.plans.append({
            "label": label,
            "score": score,
            "step": step,
            "assignment": assignment,
            "metrics": metrics,
        })
        # Keep only the most recent max_plans
        if len(self.plans) > self.max_plans * 2:
            self._prune()

    def _prune(self):
        """Keep only the best/worst for each group."""
        keep_indices = set()
        for v in self._best.values():
            if v[1] is not None:
                keep_indices.add(v[1])
        for v in self._worst.values():
            if v[1] is not None:
                keep_indices.add(v[1])

        # Also keep last few plans as extras
        recent = set(range(max(0, len(self.plans) - 2), len(self.plans)))
        keep_indices |= recent

        pruned = [self.plans[i] for i in sorted(keep_indices) if i < len(self.plans)]
        self.plans = pruned[-self.max_plans:]

    def get_results(self) -> list:
        """Return the list of interesting plans for serialization."""
        # De-duplicate by label, keep best per label
        seen = {}
        for p in self.plans:
            label = p["label"]
            if label not in seen or (
                "max" in label and p["score"] > seen[label]["score"]
            ) or (
                "min" in label and p["score"] < seen[label]["score"]
            ):
                seen[label] = p

        return list(seen.values())


# ── Main run loop ────────────────────────────────────────────────────

def run(args):
    t0 = time.time()

    # ── 1. Load configuration ────────────────────────────────────────
    cfg = load_state_config(args.config)
    print(f"=== {cfg.state_name} ({cfg.state_abbr}) ===")
    print(f"  Mode:        {args.mode}")
    print(f"  Core:        {args.core_id} / {args.num_cores}")
    print(f"  Districts:   {cfg.num_districts}")
    print(f"  Minority groups: {cfg.feasible_group_names()}")

    # ── 2. Determine how many plans this core generates ──────────────
    plans_per_core = math.ceil(args.total_plans / args.num_cores)
    # Last core may generate fewer to hit exact total
    if args.core_id == args.num_cores - 1:
        plans_per_core = args.total_plans - plans_per_core * (args.num_cores - 1)
    plans_per_core = max(plans_per_core, 1)
    thin = args.recom_steps  # ReCom steps between saved plans
    total_chain_steps = plans_per_core * thin
    print(f"  Plans for this core: {plans_per_core}")
    print(f"  ReCom steps per plan: {thin}, total chain steps: {total_chain_steps}")

    # ── 3. Set random seed (unique per core) ─────────────────────────
    seed = (cfg.random_seed or 0) + args.core_id
    random.seed(seed)
    print(f"  Random seed: {seed}")

    # ── 4. Load graph and create initial partition ───────────────────
    graph = load_graph(cfg)
    updaters = build_updaters(cfg)

    # Always compute benchmark from enacted plan
    enacted = Partition(graph, assignment=DISTRICT_COL, updaters=updaters)
    total_pop = sum(enacted["population"].values())
    ideal_pop = total_pop / cfg.num_districts
    print(f"  Total pop: {total_pop:,}  Ideal: {ideal_pop:,.0f}")

    # ── 5. Compute benchmark from enacted plan ──────────────────────
    benchmark_per_group, benchmark_total = compute_benchmark(
        enacted, cfg, election_key="PRES24"
    )
    cfg.benchmark_effective = benchmark_per_group
    cfg.benchmark_total_effective = benchmark_total
    print(f"  Enacted plan benchmark (effective districts): {benchmark_per_group}")
    print(f"  Enacted plan total effective: {benchmark_total}")

    enacted_metrics = compute_plan_metrics(enacted, cfg, election_key="PRES24")
    print(f"  Enacted plan: {enacted_metrics['dem_seats']}D / {enacted_metrics['rep_seats']}R")

    # Get valid initial partition (may differ from enacted if pop tolerance violated)
    initial = create_initial_partition(graph, cfg)

    # ── 6. Build the Markov chain ────────────────────────────────────
    chain = build_chain(initial, cfg, args.mode, total_chain_steps)
    print(f"  Chain ready, running {total_chain_steps} ReCom steps "
          f"(saving every {thin}-th as a plan) ...")

    # ── 7. Iterate and collect results ───────────────────────────────
    plan_summaries = []
    plan_assignments = []  # full district assignments for each saved plan
    tracker = InterestingPlanTracker(cfg, max_plans=10)
    saved = 0

    # Core 0 gets tqdm progress bar; others log every 1000 steps
    use_tqdm = (args.core_id == 0)
    if use_tqdm:
        try:
            from tqdm import tqdm
            chain_iter = tqdm(enumerate(chain), total=total_chain_steps,
                              desc=f"[{args.core_id}]",
                              file=sys.stderr)
        except ImportError:
            print("  [!] tqdm not installed, using plain logging")
            use_tqdm = False

    if not use_tqdm:
        chain_iter = enumerate(chain)

    log_interval = 1000  # log every 1000 steps for non-tqdm cores

    for step, partition in chain_iter:
        # Only save every thin-th step (thinning for better mixing)
        if (step + 1) % thin == 0:
            metrics = compute_plan_metrics(partition, cfg, election_key="PRES24")
            plan_summaries.append(metrics)
            # Save full district assignment {node_id: district_id}
            assignment = {str(k): int(v) for k, v in partition.assignment.items()}
            plan_assignments.append(assignment)
            tracker.update(partition, metrics, step)
            saved += 1

        if not use_tqdm and (step + 1) % log_interval == 0:
            elapsed = time.time() - t0
            rate = (step + 1) / elapsed
            eta = (total_chain_steps - step - 1) / rate if rate > 0 else 0
            print(
                f"  [{args.core_id}] Step {step+1}/{total_chain_steps} | "
                f"saved {saved}/{plans_per_core} plans | "
                f"{rate:.1f} steps/s | ETA {eta/3600:.1f}h"
            )

    elapsed = time.time() - t0
    print(f"  [{args.core_id}] Done in {elapsed:.1f}s "
          f"({len(plan_summaries)} plans from {total_chain_steps} steps)")

    # ── 8. Save results ──────────────────────────────────────────────
    os.makedirs(args.output_dir, exist_ok=True)
    output_path = os.path.join(
        args.output_dir,
        f"{cfg.state_abbr}_{args.mode}_core{args.core_id}.json",
    )

    output = {
        "state": cfg.state_abbr,
        "mode": args.mode,
        "core_id": args.core_id,
        "num_cores": args.num_cores,
        "seed": seed,
        "plans_generated": len(plan_summaries),
        "pop_tolerance": cfg.pop_tolerance,
        "effectiveness_threshold": cfg.effectiveness_threshold,
        "num_districts": cfg.num_districts,
        "total_population": total_pop,
        "ideal_population": round(ideal_pop),
        "feasible_groups": cfg.feasible_group_names(),
        "benchmark_effective": benchmark_per_group,
        "enacted_metrics": enacted_metrics,
        "runtime_seconds": round(elapsed, 1),
        "plan_summaries": plan_summaries,
        "plan_assignments": plan_assignments,
        "interesting_plans": tracker.get_results(),
    }

    with open(output_path, "w") as f:
        json.dump(output, f)

    print(f"  [{args.core_id}] Results saved to {output_path}")
    print(f"  File size: {os.path.getsize(output_path) / 1024 / 1024:.1f} MB")


# ── CLI ──────────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(
        description="Run GerryChain ReCom ensemble on one HPC core."
    )
    p.add_argument(
        "--config", required=True,
        help="Path to state_config.json",
    )
    p.add_argument(
        "--mode", choices=["race_blind", "vra"], default="race_blind",
        help="Ensemble type: race_blind (standard ReCom) or vra (VRA-constrained)",
    )
    p.add_argument("--core-id", type=int, default=0, help="This core's ID (0-indexed)")
    p.add_argument("--num-cores", type=int, default=1, help="Total number of cores")
    p.add_argument("--total-plans", type=int, default=250, help="Total plans across all cores")
    p.add_argument("--recom-steps", type=int, default=1,
                    help="ReCom steps between saved plans (thinning interval, default 1)")
    p.add_argument(
        "--output-dir", default=os.path.join(HPC_DIR, "results"),
        help="Directory to write output JSON",
    )
    return p.parse_args()


if __name__ == "__main__":
    run(parse_args())
