#!/usr/bin/env python3
"""
aggregate.py -- Combine multi-core results and compute ensemble summaries.

Implements:
  SeaWulf-4   Aggregate data from multiple cores
  SeaWulf-9   Consolidate interesting plans
  SeaWulf-10  Ensemble summary measures (splits, effective districts, opportunity)
  SeaWulf-11  Box & whisker data for each feasible minority group

Usage:
  python aggregate.py --state MA --mode race_blind --results-dir ../results

Output files (in results-dir):
  {STATE}_{MODE}_ensemble.json    -- full ensemble summary for database import
  {STATE}_{MODE}_box_whisker.json -- box & whisker data per minority group
  {STATE}_{MODE}_interesting.json -- interesting plans with full assignments
"""

import argparse
import glob
import json
import os
import sys
from collections import Counter
from typing import Dict, List

import numpy as np

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
HPC_DIR = os.path.dirname(SCRIPT_DIR)


def load_core_files(results_dir: str, state: str, mode: str) -> List[dict]:
    """Load all per-core result files for a given state and mode."""
    pattern = os.path.join(results_dir, f"{state}_{mode}_core*.json")
    files = sorted(glob.glob(pattern))
    if not files:
        print(f"ERROR: No files matching {pattern}")
        sys.exit(1)

    print(f"Found {len(files)} core file(s)")
    data = []
    for f in files:
        with open(f) as fp:
            d = json.load(fp)
            data.append(d)
            print(f"  {os.path.basename(f)}: {d['plans_generated']} plans")
    return data


# ── SeaWulf-10: Ensemble summary measures ────────────────────────────

def compute_ensemble_summary(core_data: List[dict]) -> dict:
    """Compute overall ensemble statistics from all cores.

    Returns:
      - total_plans
      - splits_distribution: {"5D/4R": count, ...}
      - effective_distribution: {group: {count: freq, ...}}
      - opportunity_distribution: {group: {count: freq, ...}}
      - avg / min / max effective per group
    """
    first = core_data[0]
    state = first["state"]
    mode = first["mode"]
    num_districts = first["num_districts"]
    groups = first["feasible_groups"]

    # Collect all plan summaries across cores
    all_plans = []
    for core in core_data:
        all_plans.extend(core["plan_summaries"])

    total_plans = len(all_plans)
    print(f"\nTotal plans across all cores: {total_plans}")

    # ── Splits distribution (R/D) ────────────────────────────────────
    splits = Counter()
    for p in all_plans:
        label = f"{p['dem_seats']}D/{p['rep_seats']}R"
        splits[label] += 1

    # Sort by Dem seats ascending
    splits_sorted = dict(sorted(splits.items(), key=lambda x: x[0]))

    # ── Effective district distribution per group ────────────────────
    effective_dist = {}
    effective_stats = {}
    for g in groups:
        counts = [p["minority_effective"][g] for p in all_plans]
        counter = Counter(counts)
        effective_dist[g] = dict(sorted(counter.items()))
        effective_stats[g] = {
            "mean": round(np.mean(counts), 2),
            "median": int(np.median(counts)),
            "min": min(counts),
            "max": max(counts),
            "std": round(np.std(counts), 2),
        }

    # ── Opportunity district distribution per group ──────────────────
    opportunity_dist = {}
    opportunity_stats = {}
    for g in groups:
        counts = [p["opportunity_districts"][g] for p in all_plans]
        counter = Counter(counts)
        opportunity_dist[g] = dict(sorted(counter.items()))
        opportunity_stats[g] = {
            "mean": round(np.mean(counts), 2),
            "median": int(np.median(counts)),
            "min": min(counts),
            "max": max(counts),
        }

    summary = {
        "state": state,
        "mode": mode,
        "num_districts": num_districts,
        "total_plans": total_plans,
        "total_population": first["total_population"],
        "ideal_population": first["ideal_population"],
        "pop_tolerance": first["pop_tolerance"],
        "effectiveness_threshold": first["effectiveness_threshold"],
        "feasible_groups": groups,
        "benchmark_effective": first["benchmark_effective"],
        "enacted_metrics": first["enacted_metrics"],
        "splits_distribution": splits_sorted,
        "effective_distribution": effective_dist,
        "effective_stats": effective_stats,
        "opportunity_distribution": opportunity_dist,
        "opportunity_stats": opportunity_stats,
    }
    return summary


# ── SeaWulf-11: Box & whisker data ───────────────────────────────────

def compute_box_whisker(core_data: List[dict]) -> dict:
    """Compute box & whisker summary for each minority group.

    For each random plan, districts are sorted by ascending minority %
    for the group.  Across all plans, for each sorted position (district
    index), we compute: min, Q1, median, Q3, max.

    Output structure:
    {
      "Black": {
        "num_districts": 9,
        "districts": [
          {"position": 1, "min": 0.02, "q1": 0.04, "median": 0.05, "q3": 0.07, "max": 0.12},
          ...
        ],
        "enacted": [0.03, 0.05, 0.08, ...]  # enacted plan sorted minority %
      },
      ...
    }
    """
    first = core_data[0]
    groups = first["feasible_groups"]
    num_districts = first["num_districts"]

    # Collect all sorted minority % arrays
    all_plans = []
    for core in core_data:
        all_plans.extend(core["plan_summaries"])

    box_whisker = {}
    for g in groups:
        # Build matrix: rows = plans, cols = district positions (sorted)
        matrix = []
        for p in all_plans:
            sorted_pcts = p["minority_pct_sorted"][g]
            matrix.append(sorted_pcts)

        matrix = np.array(matrix)  # shape: (num_plans, num_districts)

        districts = []
        for col in range(num_districts):
            values = matrix[:, col]
            districts.append({
                "position": col + 1,  # 1-indexed for display
                "min": round(float(np.min(values)), 4),
                "q1": round(float(np.percentile(values, 25)), 4),
                "median": round(float(np.median(values)), 4),
                "q3": round(float(np.percentile(values, 75)), 4),
                "max": round(float(np.max(values)), 4),
                "mean": round(float(np.mean(values)), 4),
            })

        # Enacted plan values (from first core's enacted_metrics)
        enacted_sorted = first["enacted_metrics"]["minority_pct_sorted"].get(g, [])

        box_whisker[g] = {
            "num_districts": num_districts,
            "num_plans": len(all_plans),
            "districts": districts,
            "enacted": enacted_sorted,
        }

    return box_whisker


# ── SeaWulf-9: Consolidate interesting plans ─────────────────────────

def consolidate_interesting_plans(core_data: List[dict]) -> list:
    """Merge interesting plans from all cores, keep best per label."""
    all_interesting = []
    for core in core_data:
        all_interesting.extend(core.get("interesting_plans", []))

    # De-dup: keep best per label
    best = {}
    for plan in all_interesting:
        label = plan["label"]
        if label not in best:
            best[label] = plan
        elif "max" in label and plan["score"] > best[label]["score"]:
            best[label] = plan
        elif "min" in label and plan["score"] < best[label]["score"]:
            best[label] = plan

    return list(best.values())


# ── Main ─────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description="Aggregate SeaWulf ensemble results.")
    p.add_argument("--state", required=True, help="State abbreviation (e.g. MA)")
    p.add_argument("--mode", required=True, choices=["race_blind", "vra"])
    p.add_argument(
        "--results-dir", default=os.path.join(HPC_DIR, "results"),
        help="Directory containing per-core JSON files",
    )
    args = p.parse_args()

    print(f"=== Aggregating {args.state} {args.mode} ensemble ===")

    # ── Load core files ──────────────────────────────────────────────
    core_data = load_core_files(args.results_dir, args.state, args.mode)

    # ── Compute ensemble summary (SeaWulf-10) ────────────────────────
    print("\nComputing ensemble summary ...")
    summary = compute_ensemble_summary(core_data)

    print(f"  Splits distribution: {summary['splits_distribution']}")
    for g in summary["feasible_groups"]:
        stats = summary["effective_stats"][g]
        print(f"  {g} effective districts: mean={stats['mean']}, "
              f"min={stats['min']}, max={stats['max']}")

    # ── Compute box & whisker (SeaWulf-11) ───────────────────────────
    print("\nComputing box & whisker data ...")
    bw = compute_box_whisker(core_data)
    for g, data in bw.items():
        print(f"  {g}: {data['num_districts']} districts, {data['num_plans']} plans")

    # ── Consolidate interesting plans (SeaWulf-9) ────────────────────
    print("\nConsolidating interesting plans ...")
    interesting = consolidate_interesting_plans(core_data)
    print(f"  {len(interesting)} interesting plans retained")
    for plan in interesting:
        print(f"    {plan['label']}: score={plan['score']}, "
              f"metrics={plan['metrics']['minority_effective']}")

    # ── Save output files ────────────────────────────────────────────
    prefix = f"{args.state}_{args.mode}"

    ensemble_path = os.path.join(args.results_dir, f"{prefix}_ensemble.json")
    with open(ensemble_path, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"\nEnsemble summary: {ensemble_path}")

    bw_path = os.path.join(args.results_dir, f"{prefix}_box_whisker.json")
    with open(bw_path, "w") as f:
        json.dump(bw, f, indent=2)
    print(f"Box & whisker:    {bw_path}")

    interesting_path = os.path.join(args.results_dir, f"{prefix}_interesting.json")
    with open(interesting_path, "w") as f:
        json.dump(interesting, f, indent=2)
    print(f"Interesting plans: {interesting_path}")

    print("\nDone!")


if __name__ == "__main__":
    main()
