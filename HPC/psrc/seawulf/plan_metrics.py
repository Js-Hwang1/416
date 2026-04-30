from common.config import StateConfig
from seawulf.box_whisker import plan_minority_rank_sort
from seawulf.minority_effectiveness import count_effective_districts
from seawulf.minority_share import count_opportunity_districts
from seawulf.seat_split import plan_seat_split


def compose_plan_metrics(
    partition,
    cfg: StateConfig,
    election_key: str = "PRES24",
) -> dict:
    """Compose the per-plan metrics dict written to each plan_NNNN.json."""
    dem_seats, rep_seats = plan_seat_split(partition, election_key)

    minority_effective = count_effective_districts(
        partition, cfg.minority_groups, cfg.effectiveness_threshold, election_key
    )

    minority_pct_sorted = {
        g.name: [round(v, 6) for v in plan_minority_rank_sort(partition, g)]
        for g in cfg.minority_groups
    }

    opportunity = count_opportunity_districts(
        partition, cfg.minority_groups, cfg.opportunity_threshold
    )

    return {
        "dem_seats": dem_seats,
        "rep_seats": rep_seats,
        "minority_effective": minority_effective,
        "minority_pct_sorted": minority_pct_sorted,
        "opportunity_districts": opportunity,
    }
