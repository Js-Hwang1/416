from typing import Callable, Dict, List, Tuple

from common.config import MinorityGroup, StateConfig, VAP_COL


# ── Per-district score ──────────────────────────────────────────────


def district_effectiveness(
    partition,
    group: MinorityGroup,
    election_key: str = "PRES24",
) -> Dict[int, float]:
    """Return {district_id: effectiveness_score} for one minority group."""
    election = partition[election_key]
    group_vap = partition[group.vap_col]
    total_vap = partition[VAP_COL]

    scores = {}
    for d in partition.parts:
        if not election.won(group.party_of_choice, d):
            scores[d] = 0.0
            continue
        vap = total_vap[d]
        k = (group_vap[d] / vap) if vap > 0 else 0.0
        c = min(2.0 * k, 1.0)
        scores[d] = c * group.ei_confidence
    return scores


# ── Effective-district counter ──────────────────────────────────────


def count_effective_districts(
    partition,
    groups: List[MinorityGroup],
    threshold: float,
    election_key: str = "PRES24",
) -> Dict[str, int]:
    """Per-group count of districts whose effectiveness ≥ threshold."""
    counts = {}
    for g in groups:
        scores = district_effectiveness(partition, g, election_key)
        counts[g.name] = sum(1 for s in scores.values() if s >= threshold)
    return counts


# ── Enacted-plan benchmark ──────────────────────────────────────────


def compute_benchmark(
    partition,
    cfg: StateConfig,
    election_key: str = "PRES24",
) -> Tuple[Dict[str, int], int]:
    """Compute the VRA benchmark (per-group + total) from the enacted plan.

    Returns:
        per_group: {group_name: num_effective_districts}
        total:     number of districts effective for *any* group (no double-count)
    """
    per_group = count_effective_districts(
        partition, cfg.minority_groups, cfg.effectiveness_threshold, election_key
    )

    effective_any = set()
    for g in cfg.minority_groups:
        scores = district_effectiveness(partition, g, election_key)
        for d, s in scores.items():
            if s >= cfg.effectiveness_threshold:
                effective_any.add(d)

    return per_group, len(effective_any)


# ── VRA constraint factory ──────────────────────────────────────────


def make_vra_constraint(
    cfg: StateConfig,
    election_key: str = "PRES24",
) -> Callable:
    """Return a GerryChain constraint enforcing the enacted VRA benchmark.

    A plan is accepted only if it has ≥ benchmark[g] effective districts for
    every feasible group g. The benchmark must already be populated on
    cfg.benchmark_effective by a prior call to compute_benchmark().
    """
    benchmark = cfg.benchmark_effective
    threshold = cfg.effectiveness_threshold
    groups = cfg.minority_groups

    def vra_constraint(partition) -> bool:
        for g in groups:
            scores = district_effectiveness(partition, g, election_key)
            effective = sum(1 for s in scores.values() if s >= threshold)
            if effective < benchmark.get(g.name, 0):
                return False
        return True

    vra_constraint.__name__ = "vra_effectiveness_constraint"
    return vra_constraint
