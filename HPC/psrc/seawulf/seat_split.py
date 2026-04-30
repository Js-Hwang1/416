from collections import Counter
from typing import List, Tuple

from seawulf.election_winners import party_seat_count


# ── Per-plan (inside chain loop) ────────────────────────────────────


def plan_seat_split(partition, election_key: str = "PRES24") -> Tuple[int, int]:
    """Return (dem_seats, rep_seats) for one partition."""
    dem_seats = party_seat_count(partition, "Democratic", election_key)
    rep_seats = party_seat_count(partition, "Republican", election_key)
    return dem_seats, rep_seats


# ── Post-join (ensemble aggregation) ────────────────────────────────


def ensemble_seat_split_distribution(plans: List[dict]) -> List[dict]:
    """Bin the ensemble by (dem_seats, rep_seats); sort by Rep asc for GUI-16."""
    counter = Counter()
    for p in plans:
        m = p["metrics"]
        counter[(m["dem_seats"], m["rep_seats"])] += 1

    result = []
    for (dem, rep), freq in sorted(counter.items(), key=lambda x: x[0][1]):
        result.append({"democrat": dem, "republican": rep, "freq": freq})
    return result
