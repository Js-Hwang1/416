#!/usr/bin/env python3
import argparse
import json
import os
import random
import sys
import time
from functools import partial

_PSRC_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PSRC_ROOT not in sys.path:
    sys.path.insert(0, _PSRC_ROOT)

# Force line-buffered output so logs are visible in real-time
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

# Imports below follow ``sys.path`` bootstrap for runnable SeaWulf scripts (PEP 8 E402).
from gerrychain import Graph, MarkovChain, Partition  # noqa: E402
from gerrychain.accept import always_accept  # noqa: E402
from gerrychain.constraints import (  # noqa: E402
    contiguous,
    within_percent_of_ideal_population,
)
from gerrychain.proposals import recom  # noqa: E402
from gerrychain.tree import recursive_tree_part  # noqa: E402
from gerrychain.updaters import Tally, cut_edges  # noqa: E402

from common.config import (  # noqa: E402
    DISTRICT_COL,
    POP_COL,
    PRES24D_COL,
    PRES24R_COL,
    StateConfig,
    VAP_COL,
    load_state_config,
)

from seawulf.election_winners import build_election_updater  # noqa: E402
from seawulf.graph_io import load_graph  # noqa: E402
from seawulf.minority_effectiveness import (  # noqa: E402
    compute_benchmark,
    make_vra_constraint,
)
from seawulf.plan_metrics import compose_plan_metrics  # noqa: E402

_HPC_ROOT = os.path.dirname(_PSRC_ROOT)


def build_updaters(cfg: StateConfig) -> dict:
    """Create the updater dictionary for Partition.

    Registers: population, state VAP, cut_edges, PRES24 Election, plus one
    Tally per feasible minority group's VAP column. The Election updater is
    built via election_winners.build_election_updater (SeaWulf-5).
    """
    updaters = {
        "population": Tally(POP_COL, alias="population"),
        VAP_COL: Tally(VAP_COL, alias=VAP_COL),
        "cut_edges": cut_edges,
        "PRES24": build_election_updater("PRES24", PRES24D_COL, PRES24R_COL),
    }

    for g in cfg.minority_groups:
        updaters[g.vap_col] = Tally(g.vap_col, alias=g.vap_col)

    return updaters


def create_initial_partition(
    graph: Graph, cfg: StateConfig, mode: str = "race_blind"
) -> Partition:
    """Create the initial partition from the enacted plan.

    If the enacted plan violates the population tolerance, fall back to
    recursive_tree_part to generate a valid seed partition.
    For VRA mode, retries until the seed also satisfies the VRA constraint.
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
        print(
            f"  Enacted plan satisfies {cfg.pop_tolerance:.0%} tolerance "
            f"(max deviation: {max_dev:.2%})"
        )
        # For VRA, also check the enacted plan meets VRA constraint
        if mode == "vra" and cfg.benchmark_effective:
            vra_fn = make_vra_constraint(cfg, election_key="PRES24")
            if vra_fn(enacted):
                return enacted
            print(f"  Enacted plan fails VRA constraint, generating seed ...")
        else:
            return enacted

    else:
        print(
            f"  Enacted plan violates {cfg.pop_tolerance:.0%} tolerance "
            f"(max deviation: {max_dev:.2%})"
        )

    # Build VRA checker if needed
    vra_fn = None
    if mode == "vra" and cfg.benchmark_effective:
        vra_fn = make_vra_constraint(cfg, election_key="PRES24")

    max_attempts = 200
    print(
        f"  Generating valid seed partition via recursive_tree_part "
        f"(mode={mode}, max_attempts={max_attempts}) ..."
    )
    for attempt in range(max_attempts):
        random.seed(random.randint(0, 2**31))
        assignment = recursive_tree_part(
            graph,
            range(cfg.num_districts),
            ideal_pop,
            POP_COL,
            cfg.pop_tolerance,
            node_repeats=cfg.node_repeats,
        )
        seed_partition = Partition(graph, assignment=assignment, updaters=updaters)

        # Check VRA constraint if in VRA mode
        if vra_fn is not None:
            if vra_fn(seed_partition):
                print(
                    f"  Seed partition satisfies VRA constraint "
                    f"(attempt {attempt + 1})"
                )
                return seed_partition
        else:
            print(f"  Seed partition generated successfully")
            return seed_partition

    # If we exhaust attempts, use the last one anyway and warn
    print(
        f"  WARNING: Could not find VRA-compliant seed in {max_attempts} "
        f"attempts, using last partition"
    )
    return seed_partition


# Chain construction


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


# Main run loop


def run(args):
    t0 = time.time()

    # 1. Load configuration
    cfg = load_state_config(args.config)
    print(f"=== {cfg.state_name} ({cfg.state_abbr}) ===")
    print(f"  Mode:        {args.mode}")
    print(f"  Core:        {args.core_id} / {args.num_cores}")
    print(f"  Districts:   {cfg.num_districts}")
    print(f"  Minority groups: {cfg.feasible_group_names()}")

    # 2. Plans assigned to this core
    if args.plan_list:
        # Targeted backfill: read specific plan numbers from file
        with open(args.plan_list) as plan_f:
            all_plan_nums = sorted(
                int(line.strip())
                for line in plan_f
                if line.strip()
            )
        # Distribute plan numbers across cores round-robin
        my_plan_nums = [
            all_plan_nums[i]
            for i in range(len(all_plan_nums))
            if i % args.num_cores == args.core_id
        ]
        plans_per_core = len(my_plan_nums)
        if plans_per_core == 0:
            print(f"  [{args.core_id}] No plans assigned, exiting.")
            return
        preview = my_plan_nums[:5]
        ellip = "..." if len(my_plan_nums) > 5 else ""
        print(
            f"  Plans for this core: {plans_per_core} "
            f"(specific: {preview}{ellip})"
        )
    else:
        base = args.total_plans // args.num_cores
        remainder = args.total_plans % args.num_cores
        if args.core_id < remainder:
            plans_per_core = base + 1
            start_plan = args.core_id * (base + 1)
        else:
            plans_per_core = base
            start_plan = remainder * (base + 1) + (args.core_id - remainder) * base
        if plans_per_core == 0:
            print(f"  [{args.core_id}] No plans assigned, exiting.")
            return
        start_plan += args.plan_offset
        my_plan_nums = list(range(start_plan + 1, start_plan + plans_per_core + 1))
        first, last = my_plan_nums[0], my_plan_nums[-1]
        print(
            f"  Plans for this core: {plans_per_core} "
            f"(global index {first}..{last})"
        )
    thin = args.recom_steps  # ReCom steps between saved plans
    total_chain_steps = plans_per_core * thin
    print(f"  ReCom steps per plan: {thin}, total chain steps: {total_chain_steps}")

    # 3. Random seed (unique per core)
    seed = (cfg.random_seed or 0) + args.core_id + my_plan_nums[0]
    random.seed(seed)
    print(f"  Random seed: {seed}")

    # 4. Load graph and initial partition
    graph = load_graph(cfg, _HPC_ROOT)
    updaters = build_updaters(cfg)

    # Always compute benchmark from enacted plan
    enacted = Partition(graph, assignment=DISTRICT_COL, updaters=updaters)
    total_pop = sum(enacted["population"].values())
    ideal_pop = total_pop / cfg.num_districts
    print(f"  Total pop: {total_pop:,}  Ideal: {ideal_pop:,.0f}")

    # 5. Benchmark from enacted plan
    benchmark_per_group, benchmark_total = compute_benchmark(
        enacted, cfg, election_key="PRES24"
    )
    cfg.benchmark_effective = benchmark_per_group
    cfg.benchmark_total_effective = benchmark_total
    print(f"  Enacted plan benchmark (effective districts): {benchmark_per_group}")
    print(f"  Enacted plan total effective: {benchmark_total}")

    enacted_metrics = compose_plan_metrics(enacted, cfg, election_key="PRES24")
    dem = enacted_metrics["dem_seats"]
    rep = enacted_metrics["rep_seats"]
    print(f"  Enacted plan: {dem}D / {rep}R")

    # May differ from enacted if population tolerance is violated.
    initial = create_initial_partition(graph, cfg, mode=args.mode)

    # 6. Build Markov chain
    chain = build_chain(initial, cfg, args.mode, total_chain_steps)
    print(
        f"  Chain ready, running {total_chain_steps} ReCom steps "
        f"(saving every {thin}-th as a plan) ..."
    )

    # 7. Output directory: results/{STATE}/{RB|VRA}/
    mode_dir = "RB" if args.mode == "race_blind" else "VRA"
    plan_dir = os.path.join(args.output_dir, cfg.state_abbr, mode_dir)
    os.makedirs(plan_dir, exist_ok=True)

    # 8. Save one JSON file per plan
    # SeaWulf-9 interesting-plan tracker omitted: full metrics are in each
    # plan JSON; use interesting_plans.scan_results_for_extremes post-hoc.
    saved = 0

    # Core 0 gets tqdm progress bar; others log every 1000 steps
    use_tqdm = args.core_id == 0
    if use_tqdm:
        try:
            from tqdm import tqdm

            chain_iter = tqdm(
                enumerate(chain),
                total=total_chain_steps,
                desc=f"[{args.core_id}]",
                file=sys.stderr,
            )
        except ImportError:
            print("  [!] tqdm not installed, using plain logging")
            use_tqdm = False

    if not use_tqdm:
        chain_iter = enumerate(chain)

    log_interval = 1000  # log every 1000 steps for non-tqdm cores

    for step, partition in chain_iter:
        if (step + 1) % thin == 0:
            metrics = compose_plan_metrics(partition, cfg, election_key="PRES24")
            assignment = {str(k): int(v) for k, v in partition.assignment.items()}

            # Write individual plan file using the assigned plan number
            plan_num = my_plan_nums[saved]
            plan_file = os.path.join(plan_dir, f"plan_{plan_num:04d}.json")
            plan_data = {
                "plan_id": plan_num,
                "state": cfg.state_abbr,
                "mode": args.mode,
                "assignment": assignment,
                "num_districts": cfg.num_districts,
                "metrics": metrics,
            }
            with open(plan_file, "w") as f:
                json.dump(plan_data, f)

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
    print(
        f"  [{args.core_id}] Done in {elapsed:.1f}s "
        f"({saved} plans written to {plan_dir}/)"
    )


def parse_args():
    p = argparse.ArgumentParser(
        description="Run GerryChain ReCom ensemble on one HPC core."
    )
    p.add_argument(
        "--config",
        required=True,
        help="Path to state_config.json",
    )
    p.add_argument(
        "--mode",
        choices=["race_blind", "vra"],
        default="race_blind",
        help=(
            "Ensemble type: race_blind (standard ReCom) or "
            "vra (VRA-constrained)."
        ),
    )
    p.add_argument(
        "--core-id",
        type=int,
        default=0,
        help="This core's ID (0-indexed)",
    )
    p.add_argument(
        "--num-cores",
        type=int,
        default=1,
        help="Total number of cores",
    )
    p.add_argument(
        "--total-plans", type=int, default=250, help="Total plans across all cores"
    )
    p.add_argument(
        "--recom-steps",
        type=int,
        default=10000,
        help=(
            "Number of full ReCom Markov steps between each saved plan "
            "(every step is a proposal; none are skipped)."
        ),
    )
    p.add_argument(
        "--output-dir",
        default=os.path.expanduser("~/HPC/results"),
        help="Directory to write output JSON (default: ~/HPC/results)",
    )
    p.add_argument(
        "--plan-offset",
        type=int,
        default=0,
        help="Offset added to plan numbering (for backfill runs)",
    )
    p.add_argument(
        "--plan-list",
        type=str,
        default=None,
        help="File with specific plan numbers to generate (one per line). "
        "Overrides --total-plans and --plan-offset.",
    )
    return p.parse_args()


if __name__ == "__main__":
    run(parse_args())
