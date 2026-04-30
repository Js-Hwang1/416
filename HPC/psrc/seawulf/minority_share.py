from typing import Dict, List

from common.config import MinorityGroup, VAP_COL


def district_minority_share(partition, group: MinorityGroup) -> Dict[int, float]:
    """Return {district_id: group_VAP / total_VAP} for every district.

    Division-by-zero guard yields 0.0 for districts with no VAP (unreachable
    with real data, but defensive against malformed inputs).
    """
    group_vap = partition[group.vap_col]
    total_vap = partition[VAP_COL]
    return {
        d: (group_vap[d] / total_vap[d]) if total_vap[d] > 0 else 0.0
        for d in partition.parts
    }


def count_opportunity_districts(
    partition,
    groups: List[MinorityGroup],
    threshold: float = 0.5,
) -> Dict[str, int]:
    """Per-group count of districts whose VAP share ≥ threshold."""
    counts = {}
    for g in groups:
        pcts = district_minority_share(partition, g)
        counts[g.name] = sum(1 for p in pcts.values() if p >= threshold)
    return counts
