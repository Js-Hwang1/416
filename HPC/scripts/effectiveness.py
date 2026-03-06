"""
effectiveness.py -- Minority effectiveness scoring and VRA constraint.

Implements the *simplified* Becker-et-al. effectiveness methodology for
the CSE 416 project:

  Simplifications vs. the full paper
  -----------------------------------
  1. Only the 2024 Presidential election is used (no primaries, no
     multi-election weighting).
  2. Only statewide effectiveness (s^state) is computed -- we do NOT
     re-run EI at the district level during the chain.
  3. "Candidate of choice" is replaced by "party of choice" per group,
     determined once from EI before the run.

  Effectiveness score for district D and minority group G
  -------------------------------------------------------
  Let:
    poc_wins  = 1 if G's party of choice wins district D, else 0
    k         = G's share of VAP in district D
    c         = min(2k, 1)          (group-control factor from Becker)
    conf      = EI confidence that G's party of choice is correct

    effectiveness(D, G) = poc_wins * c * conf

  A district is *effective* for G when effectiveness >= threshold (e.g. 0.5).
  A district is an *opportunity district* (majority-minority) when
    G's VAP share >= 0.5.

  VRA constraint
  --------------
  The enacted plan sets a *benchmark*: the number of effective districts
  per minority group.  A random plan is accepted into the VRA-constrained
  ensemble only if it meets or exceeds this benchmark for every feasible
  group.
"""

from typing import Callable, Dict, List, Tuple

from config import StateConfig, MinorityGroup, VAP_COL


# ── Per-district computations ────────────────────────────────────────

def district_minority_pct(partition, group: MinorityGroup) -> Dict:
    """Return {district_id: group_VAP / total_VAP} for every district."""
    group_vap = partition[group.vap_col]
    total_vap = partition[VAP_COL]
    return {
        d: (group_vap[d] / total_vap[d]) if total_vap[d] > 0 else 0.0
        for d in partition.parts
    }


def district_effectiveness(
    partition,
    group: MinorityGroup,
    election_key: str = "PRES24",
) -> Dict:
    """Return {district_id: effectiveness_score} for one minority group.

    Uses simplified s^state: poc_wins * group_control * ei_confidence.
    """
    election = partition[election_key]
    group_vap = partition[group.vap_col]
    total_vap = partition[VAP_COL]

    scores = {}
    for d in partition.parts:
        # Does the party of choice win this district?
        poc_wins = election.won(group.party_of_choice, d)
        if not poc_wins:
            scores[d] = 0.0
            continue

        # Group-control factor  c = min(2k, 1)
        vap = total_vap[d]
        k = (group_vap[d] / vap) if vap > 0 else 0.0
        c = min(2.0 * k, 1.0)

        scores[d] = c * group.ei_confidence

    return scores


# ── Counting helpers ─────────────────────────────────────────────────

def count_effective_districts(
    partition,
    groups: List[MinorityGroup],
    threshold: float,
    election_key: str = "PRES24",
) -> Dict[str, int]:
    """For each minority group, count districts whose effectiveness >= threshold."""
    counts = {}
    for g in groups:
        scores = district_effectiveness(partition, g, election_key)
        counts[g.name] = sum(1 for s in scores.values() if s >= threshold)
    return counts


def count_opportunity_districts(
    partition,
    groups: List[MinorityGroup],
    threshold: float = 0.5,
) -> Dict[str, int]:
    """Count majority-minority (opportunity) districts per group.

    A district is an opportunity district if the group's VAP share >= threshold.
    """
    counts = {}
    for g in groups:
        pcts = district_minority_pct(partition, g)
        counts[g.name] = sum(1 for p in pcts.values() if p >= threshold)
    return counts


# ── Benchmark computation ────────────────────────────────────────────

def compute_benchmark(
    partition,
    cfg: StateConfig,
    election_key: str = "PRES24",
) -> Tuple[Dict[str, int], int]:
    """Compute the VRA benchmark from the enacted plan.

    Returns:
        per_group: {group_name: num_effective_districts}
        total:     total effective districts (across all groups, no double-count)
    """
    per_group = count_effective_districts(
        partition, cfg.minority_groups, cfg.effectiveness_threshold, election_key
    )

    # Total: count districts effective for *any* group (avoid double-count)
    effective_any = set()
    for g in cfg.minority_groups:
        scores = district_effectiveness(partition, g, election_key)
        for d, s in scores.items():
            if s >= cfg.effectiveness_threshold:
                effective_any.add(d)

    return per_group, len(effective_any)


# ── VRA constraint factory ───────────────────────────────────────────

def make_vra_constraint(
    cfg: StateConfig,
    election_key: str = "PRES24",
) -> Callable:
    """Return a constraint function for VRA-constrained ReCom.

    The constraint checks that a proposed plan has at least as many
    effective districts as the enacted plan (benchmark) for every
    feasible minority group.

    The benchmark must already be stored in cfg.benchmark_effective.
    """
    benchmark = cfg.benchmark_effective
    threshold = cfg.effectiveness_threshold
    groups = cfg.minority_groups

    def vra_constraint(partition) -> bool:
        for g in groups:
            scores = district_effectiveness(partition, g, election_key)
            effective = sum(1 for s in scores.values() if s >= threshold)
            required = benchmark.get(g.name, 0)
            if effective < required:
                return False
        return True

    vra_constraint.__name__ = "vra_effectiveness_constraint"
    return vra_constraint


# ── Full per-plan metrics ────────────────────────────────────────────

def compute_plan_metrics(
    partition,
    cfg: StateConfig,
    election_key: str = "PRES24",
) -> dict:
    """Compute all required per-plan metrics for one partition.

    Returns a dict suitable for JSON serialization with:
      - dem_seats / rep_seats  (SeaWulf-5, SeaWulf-8)
      - minority_effective     (SeaWulf-6)
      - minority_pct_sorted    (SeaWulf-7, SeaWulf-11)
      - opportunity_districts  (SeaWulf-10)
    """
    election = partition[election_key]

    # ── SeaWulf-5 & 8: election winners and R/D split ────────────────
    dem_seats = election.wins("Democratic")
    rep_seats = election.wins("Republican")

    # ── SeaWulf-6: minority effectiveness per group ──────────────────
    minority_effective = count_effective_districts(
        partition, cfg.minority_groups, cfg.effectiveness_threshold, election_key
    )

    # ── SeaWulf-7 & 11: sorted minority VAP percentages per group ────
    # (sorted ascending -- needed for box & whisker)
    minority_pct_sorted = {}
    for g in cfg.minority_groups:
        pcts = district_minority_pct(partition, g)
        minority_pct_sorted[g.name] = sorted(pcts.values())

    # ── SeaWulf-10: opportunity districts ────────────────────────────
    opportunity = count_opportunity_districts(
        partition, cfg.minority_groups, cfg.opportunity_threshold
    )

    return {
        "dem_seats": dem_seats,
        "rep_seats": rep_seats,
        "minority_effective": minority_effective,
        "minority_pct_sorted": {
            k: [round(v, 6) for v in vals]
            for k, vals in minority_pct_sorted.items()
        },
        "opportunity_districts": opportunity,
    }
