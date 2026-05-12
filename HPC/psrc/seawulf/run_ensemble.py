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


def print_run_header(cfg: StateConfig, args) -> None:
    print(f"=== {cfg.state_name} ({cfg.state_abbr}) ===")
    print(f"  Mode:        {args.mode}")
    print(f"  Core:        {args.core_id} / {args.num_cores}")
    print(f"  Districts:   {cfg.num_districts}")
    print(f"  Minority groups: {cfg.feasible_group_names()}")


def _read_plan_list_for_core(path: str, num_cores: int, core_id: int) -> list:
    """Round-robin assign plan numbers from a backfill file to this core."""
    with open(path) as plan_f:
        all_plan_nums = sorted(
            int(line.strip())
            for line in plan_f
            if line.strip()
        )
    return [
        all_plan_nums[i]
        for i in range(len(all_plan_nums))
        if i % num_cores == core_id
    ]


def _contiguous_plan_range(args) -> list:
    """Compute the contiguous slice of plan numbers assigned to this core."""
    base = args.total_plans // args.num_cores
    remainder = args.total_plans % args.num_cores
    if args.core_id < remainder:
        plans_per_core = base + 1
        start_plan = args.core_id * (base + 1)
    else:
        plans_per_core = base
        start_plan = remainder * (base + 1) + (args.core_id - remainder) * base
    if plans_per_core == 0:
        return []
    start_plan += args.plan_offset
    return list(range(start_plan + 1, start_plan + plans_per_core + 1))


def assign_plan_numbers(args) -> list:
    """Return the plan numbers this core is responsible for (or [] for none)."""
    if args.plan_list:
        my_plan_nums = _read_plan_list_for_core(
            args.plan_list, args.num_cores, args.core_id
        )
        if not my_plan_nums:
            return my_plan_nums
        preview = my_plan_nums[:5]
        ellip = "..." if len(my_plan_nums) > 5 else ""
        print(
            f"  Plans for this core: {len(my_plan_nums)} "
            f"(specific: {preview}{ellip})"
        )
        return my_plan_nums

    my_plan_nums = _contiguous_plan_range(args)
    if not my_plan_nums:
        return my_plan_nums
    first, last = my_plan_nums[0], my_plan_nums[-1]
    print(
        f"  Plans for this core: {len(my_plan_nums)} "
        f"(global index {first}..{last})"
    )
    return my_plan_nums


def seed_random(cfg: StateConfig, core_id: int, first_plan: int) -> int:
    seed = (cfg.random_seed or 0) + core_id + first_plan
    random.seed(seed)
    print(f"  Random seed: {seed}")
    return seed


def build_enacted_partition(graph, cfg: StateConfig) -> Partition:
    """Build the enacted Partition and log basic population stats."""
    enacted = Partition(graph, assignment=DISTRICT_COL, updaters=build_updaters(cfg))
    total_pop = sum(enacted["population"].values())
    ideal_pop = total_pop / cfg.num_districts
    print(f"  Total pop: {total_pop:,}  Ideal: {ideal_pop:,.0f}")
    return enacted


def populate_benchmark(enacted: Partition, cfg: StateConfig) -> None:
    """Compute and attach the VRA benchmark to cfg from the enacted plan."""
    benchmark_per_group, benchmark_total = compute_benchmark(
        enacted, cfg, election_key="PRES24"
    )
    cfg.benchmark_effective = benchmark_per_group
    cfg.benchmark_total_effective = benchmark_total
    print(f"  Enacted plan benchmark (effective districts): {benchmark_per_group}")
    print(f"  Enacted plan total effective: {benchmark_total}")

    enacted_metrics = compose_plan_metrics(enacted, cfg, election_key="PRES24")
    print(
        f"  Enacted plan: {enacted_metrics['dem_seats']}D / "
        f"{enacted_metrics['rep_seats']}R"
    )


def make_output_dir(args, cfg: StateConfig) -> str:
    mode_dir = "RB" if args.mode == "race_blind" else "VRA"
    plan_dir = os.path.join(args.output_dir, cfg.state_abbr, mode_dir)
    os.makedirs(plan_dir, exist_ok=True)
    return plan_dir


def make_chain_iterator(chain, total_steps: int, core_id: int):
    """Wrap chain in tqdm for core 0; return (iterator, use_tqdm)."""
    if core_id != 0:
        return enumerate(chain), False
    try:
        from tqdm import tqdm

        return (
            tqdm(
                enumerate(chain),
                total=total_steps,
                desc=f"[{core_id}]",
                file=sys.stderr,
            ),
            True,
        )
    except ImportError:
        print("  [!] tqdm not installed, using plain logging")
        return enumerate(chain), False


def write_plan_file(
    plan_dir: str,
    plan_num: int,
    cfg: StateConfig,
    mode: str,
    partition: Partition,
    metrics: dict,
) -> None:
    plan_file = os.path.join(plan_dir, f"plan_{plan_num:04d}.json")
    plan_data = {
        "plan_id": plan_num,
        "state": cfg.state_abbr,
        "mode": mode,
        "assignment": {str(k): int(v) for k, v in partition.assignment.items()},
        "num_districts": cfg.num_districts,
        "metrics": metrics,
    }
    with open(plan_file, "w") as f:
        json.dump(plan_data, f)


def log_step_progress(
    core_id: int,
    step: int,
    total_chain_steps: int,
    saved: int,
    plans_per_core: int,
    t0: float,
) -> None:
    elapsed = time.time() - t0
    rate = (step + 1) / elapsed if elapsed > 0 else 0
    eta = (total_chain_steps - step - 1) / rate if rate > 0 else 0
    print(
        f"  [{core_id}] Step {step+1}/{total_chain_steps} | "
        f"saved {saved}/{plans_per_core} plans | "
        f"{rate:.1f} steps/s | ETA {eta/3600:.1f}h"
    )


def run_chain_loop(
    chain,
    cfg: StateConfig,
    args,
    my_plan_nums: list,
    plan_dir: str,
    total_chain_steps: int,
    thin: int,
    t0: float,
) -> int:
    """Iterate the chain, save every `thin`-th plan; return number saved."""
    chain_iter, use_tqdm = make_chain_iterator(
        chain, total_chain_steps, args.core_id
    )
    plans_per_core = len(my_plan_nums)
    log_interval = 1000
    saved = 0

    for step, partition in chain_iter:
        if (step + 1) % thin == 0:
            metrics = compose_plan_metrics(partition, cfg, election_key="PRES24")
            write_plan_file(
                plan_dir, my_plan_nums[saved], cfg, args.mode, partition, metrics
            )
            saved += 1

        if not use_tqdm and (step + 1) % log_interval == 0:
            log_step_progress(
                args.core_id, step, total_chain_steps,
                saved, plans_per_core, t0,
            )

    return saved


def run(args):
    t0 = time.time()

    cfg = load_state_config(args.config)
    print_run_header(cfg, args)

    my_plan_nums = assign_plan_numbers(args)
    if not my_plan_nums:
        print(f"  [{args.core_id}] No plans assigned, exiting.")
        return

    thin = args.recom_steps
    total_chain_steps = len(my_plan_nums) * thin
    print(f"  ReCom steps per plan: {thin}, total chain steps: {total_chain_steps}")

    seed_random(cfg, args.core_id, my_plan_nums[0])

    graph = load_graph(cfg, _HPC_ROOT)
    enacted = build_enacted_partition(graph, cfg)
    populate_benchmark(enacted, cfg)

    initial = create_initial_partition(graph, cfg, mode=args.mode)
    chain = build_chain(initial, cfg, args.mode, total_chain_steps)
    print(
        f"  Chain ready, running {total_chain_steps} ReCom steps "
        f"(saving every {thin}-th as a plan) ..."
    )

    plan_dir = make_output_dir(args, cfg)
    saved = run_chain_loop(
        chain, cfg, args, my_plan_nums, plan_dir,
        total_chain_steps, thin, t0,
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
