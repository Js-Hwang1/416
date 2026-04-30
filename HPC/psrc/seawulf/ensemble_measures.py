import json
import math
import os
from collections import Counter
from typing import Dict, List

import numpy as np

from common.config import MinorityGroup


# ── Plan-file loader ────────────────────────────────────────────────


def load_plans_for_ensemble(
    results_dir: str,
    state: str,
    mode_dir: str,
) -> List[dict]:
    """Load every plan_*.json under ~/HPC/results/{state}/{mode_dir}/."""
    plan_dir = os.path.join(results_dir, state, mode_dir)
    plans = []
    for fname in sorted(os.listdir(plan_dir)):
        if not fname.endswith(".json"):
            continue
        with open(os.path.join(plan_dir, fname)) as f:
            plans.append(json.load(f))
    return plans


# ── Effective-district distribution (per group) ─────────────────────


def effective_district_distribution(
    plans: List[dict],
    groups: List[MinorityGroup],
) -> Dict:
    """{group_name: {count_value: frequency, ...}} + summary stats."""
    dist, stats = {}, {}
    for g in groups:
        counts = [p["metrics"]["minority_effective"][g.name] for p in plans]
        counter = Counter(counts)
        dist[g.name] = dict(sorted(counter.items()))
        stats[g.name] = {
            "mean": round(float(np.mean(counts)), 2),
            "median": int(np.median(counts)),
            "min": int(min(counts)),
            "max": int(max(counts)),
            "std": round(float(np.std(counts)), 2),
        }
    return {"distribution": dist, "stats": stats}


# ── Opportunity-district distribution (per group) ───────────────────


def opportunity_district_distribution(
    plans: List[dict],
    groups: List[MinorityGroup],
) -> Dict:
    """{group_name: {count_value: frequency}} for majority-minority counts."""
    dist, stats = {}, {}
    for g in groups:
        counts = [p["metrics"]["opportunity_districts"][g.name] for p in plans]
        counter = Counter(counts)
        dist[g.name] = dict(sorted(counter.items()))
        stats[g.name] = {
            "mean": round(float(np.mean(counts)), 2),
            "median": int(np.median(counts)),
            "min": int(min(counts)),
            "max": int(max(counts)),
        }
    return {"distribution": dist, "stats": stats}


# ── VRA impact thresholds (GUI-20) ──────────────────────────────────


def vra_threshold_table(
    rb_plans: List[dict],
    vra_plans: List[dict],
    enacted_benchmark: Dict[str, int],
    groups: List[MinorityGroup],
    num_districts: int,
    state_cvap_share: Dict[str, float] | None = None,
) -> Dict:
    """Side-by-side GUI-20 table for each feasible group.

    Rows: satisfies_enacted, satisfies_rough_proportionality, satisfies_both.
    Columns: race_blind %, vra_constrained %.
    """

    def _pct(plans, predicate):
        if not plans:
            return 0.0
        hits = sum(1 for p in plans if predicate(p))
        return round(100.0 * hits / len(plans), 2)

    def _meets_enacted(p, group):
        return p["metrics"]["minority_effective"][group.name] >= enacted_benchmark.get(
            group.name, 0
        )

    def _meets_rough(p, group):
        if state_cvap_share is None:
            return False
        target = round(state_cvap_share.get(group.name, 0.0) * num_districts)
        return p["metrics"]["minority_effective"][group.name] >= target

    rows = {}
    for g in groups:
        rows[g.name] = {
            "satisfies_enacted": {
                "race_blind": _pct(rb_plans, lambda p, g=g: _meets_enacted(p, g)),
                "vra_constrained": _pct(vra_plans, lambda p, g=g: _meets_enacted(p, g)),
            },
            "satisfies_rough_proportionality": {
                "race_blind": _pct(rb_plans, lambda p, g=g: _meets_rough(p, g)),
                "vra_constrained": _pct(vra_plans, lambda p, g=g: _meets_rough(p, g)),
            },
            "satisfies_both": {
                "race_blind": _pct(
                    rb_plans, lambda p, g=g: _meets_enacted(p, g) and _meets_rough(p, g)
                ),
                "vra_constrained": _pct(
                    vra_plans,
                    lambda p, g=g: _meets_enacted(p, g) and _meets_rough(p, g),
                ),
            },
        }
    return rows


# ── Enacted demographics (GUI-3 / GUI-17 overlay) ───────────────────


def enacted_demographics(
    enacted_minority_pct_sorted: Dict[str, List[float]],
    groups: List[MinorityGroup],
    num_districts: int,
) -> Dict:
    """Build the enacted-plan per-district group-share payload."""
    districts = []
    for i in range(num_districts):
        per_group = {}
        for g in groups:
            vals = enacted_minority_pct_sorted.get(g.name, [])
            pct = round(vals[i] * 100, 2) if i < len(vals) else 0.0
            per_group[g.name.lower()] = {"pct": pct}
        districts.append({"district": i + 1, "groups": per_group})
    return {"districts": districts}


# ── Vote-seat curve (GUI-18 placeholder) ────────────────────────────


def vote_seat_curve(
    rb_plans: List[dict],
    num_districts: int,
) -> Dict | None:
    """Parametric sigmoid centered on the ensemble's mean Dem-seat share.

    NOTE: this is a placeholder. A real vote-seat curve requires perturbing
    precinct vote totals and rerunning ensemble scoring — see Shen software
    referenced in Prepro-10.
    """
    counter = Counter()
    for p in rb_plans:
        counter[p["metrics"]["dem_seats"]] += 1

    total = sum(counter.values())
    if total == 0:
        return None

    mean_d_seats = sum(s * f for s, f in counter.items()) / total
    mean_d_pct = mean_d_seats / num_districts * 100

    unique_splits = len(counter)
    steepness = max(5.0, min(12.0, 15.0 / max(unique_splits, 1) * 3))

    def sigmoid_curve(bias: float, k: float) -> List[dict]:
        out = []
        for v in range(101):
            x = (v - (100 - bias)) * k / 50.0
            s = 100.0 / (1.0 + math.exp(-x))
            s = max(0.0, min(100.0, round(s, 1)))
            out.append({"vote_share": v, "seat_share": s})
        return out

    return {
        "dem_curve": sigmoid_curve(mean_d_pct, steepness),
        "rep_curve": sigmoid_curve(100 - mean_d_pct, steepness + 1.5),
    }
