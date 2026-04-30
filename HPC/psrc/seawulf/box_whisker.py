from typing import Dict, List

import numpy as np

from common.config import MinorityGroup
from seawulf.minority_share import district_minority_share


# ── Per-plan phase ──────────────────────────────────────────────────


def plan_minority_rank_sort(partition, group: MinorityGroup) -> List[float]:
    """Return the plan's district VAP shares for `group`, ascending."""
    pcts = district_minority_share(partition, group)
    return sorted(pcts.values())


# ── Post-join phase ─────────────────────────────────────────────────


def ensemble_box_whisker(
    plans: List[dict],
    group_name: str,
    num_districts: int,
) -> List[Dict]:
    """Columnwise percentiles over the rank-sorted minority shares.

    Reads each plan's pre-sorted vector from
        plans[i]["metrics"]["minority_pct_sorted"][group_name]
    (populated during the chain run by plan_minority_rank_sort + plan_metrics),
    stacks into an (N_plans, N_districts) matrix, converts fractions to
    percentages, and emits the 5-number summary per district rank.
    """
    all_sorted = []
    for p in plans:
        pct_sorted = p["metrics"]["minority_pct_sorted"].get(group_name)
        if pct_sorted and len(pct_sorted) == num_districts:
            all_sorted.append(pct_sorted)

    if not all_sorted:
        return []

    arr = np.array(all_sorted)  # shape (N_plans, N_districts)
    out = []
    for i in range(num_districts):
        col = arr[:, i] * 100  # fraction → percentage
        out.append(
            {
                "district": i + 1,
                "min": round(float(np.min(col)), 2),
                "lqr": round(float(np.percentile(col, 25)), 2),
                "median": round(float(np.median(col)), 2),
                "hqr": round(float(np.percentile(col, 75)), 2),
                "max": round(float(np.max(col)), 2),
            }
        )
    return out
