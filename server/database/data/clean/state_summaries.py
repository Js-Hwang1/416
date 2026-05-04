import json
import os

from .helpers import report
from .paths import REPS_FILE, SUMMARY_DIR

FEASIBLE_GROUP_THRESHOLD = 400_000


def _load_reps():
    with open(REPS_FILE) as f:
        return json.load(f)


def _presidential_block(d_votes, r_votes):
    total = d_votes + r_votes
    return {
        "dem_votes": d_votes,
        "rep_votes": r_votes,
        "total_votes": total,
        "dem_pct": round(d_votes / total * 100, 1) if total else 0,
        "rep_pct": round(r_votes / total * 100, 1) if total else 0,
    }


def _feasible_groups(population_by_group):
    return [
        group for group, pop in population_by_group.items()
        if pop > FEASIBLE_GROUP_THRESHOLD
    ]


def _ma_population(ma):
    return {
        "white": int(ma["NH_WHITE"].sum()),
        "black": int(ma["NH_BLACK"].sum()),
        "hispanic": int(ma["HISP"].sum()),
        "asian": int(ma["NH_ASIAN"].sum()),
        "other": int(
            ma["NH_AMIN"].sum()
            + ma["NH_NHPI"].sum()
            + ma["NH_OTHER"].sum()
            + ma["NH_2MORE"].sum()
        ),
    }


def _ma_vap(ma):
    return {
        "white": int(ma["WVAP"].sum()),
        "black": int(ma["BVAP"].sum()),
        "hispanic": int(ma["HVAP"].sum()),
        "asian": int(ma["ASIANVAP"].sum()),
        "other": int(
            ma["AMINVAP"].sum()
            + ma["NHPIVAP"].sum()
            + ma["OTHERVAP"].sum()
            + ma["2MOREVAP"].sum()
        ),
    }


def _build_ma_summary(ma, reps):
    ma_d = int(ma["G24PREDHAR"].sum()) if "G24PREDHAR" in ma.columns else 0
    ma_r = int(ma["G24PRERTRU"].sum()) if "G24PRERTRU" in ma.columns else 0
    pop_by_group = _ma_population(ma)

    return {
        "state": "Massachusetts",
        "state_abbr": "MA",
        "total_population": int(ma["TOTPOP"].sum()),
        "voting_age_population": int(ma["VAP"].sum()),
        "population_by_group": pop_by_group,
        "vap_by_group": _ma_vap(ma),
        "presidential_2024": _presidential_block(ma_d, ma_r),
        "num_congressional_districts": reps["MA"]["total_districts"],
        "party_split": reps["MA"]["party_split"],
        "feasible_demographic_groups": _feasible_groups(pop_by_group),
    }


def _tx_population(tx):
    return {
        "white": int(tx["WHITE"].sum()),
        "black": int(tx["BLACK"].sum()),
        "hispanic": int(tx["HISPANIC"].sum()),
        "asian": int(tx["ASIAN"].sum()) if "ASIAN" in tx.columns else 0,
        "other": int(tx["OTHER"].sum()) if "OTHER" in tx.columns else 0,
    }


def _tx_vap(tx):
    return {
        "white": int(tx["WVAP"].sum()),
        "black": int(tx["BVAP"].sum()),
        "hispanic": int(tx["HISPVAP"].sum()),
        "asian": int(tx["ASIANVAP"].sum()) if "ASIANVAP" in tx.columns else 0,
        "other": int(tx["OTHVAP"].sum()),
    }


def _build_tx_summary(tx, reps):
    tx_d = int(tx["G24PREDHAR"].sum()) if "G24PREDHAR" in tx.columns else 0
    tx_r = int(tx["G24PRERTRU"].sum()) if "G24PRERTRU" in tx.columns else 0
    pop_by_group = _tx_population(tx)

    return {
        "state": "Texas",
        "state_abbr": "TX",
        "total_population": int(tx["TOTPOP"].sum()),
        "voting_age_population": int(tx["VAP"].sum()),
        "population_by_group": pop_by_group,
        "vap_by_group": _tx_vap(tx),
        "presidential_2024": _presidential_block(tx_d, tx_r),
        "num_congressional_districts": reps["TX"]["total_districts"],
        "party_split": reps["TX"]["party_split"],
        "feasible_demographic_groups": _feasible_groups(pop_by_group),
    }


def _write_summary(filename, summary):
    out = os.path.join(SUMMARY_DIR, filename)
    with open(out, "w") as f:
        json.dump(summary, f, indent=2)
    report(f"{summary['state_abbr']} summary written: {out}")
    report(f"  Population: {summary['total_population']:,} | "
           f"VAP: {summary['voting_age_population']:,}")
    report(f"  Feasible groups: {summary['feasible_demographic_groups']}")


def run(ma, tx):
    print("\n" + "=" * 70)
    print("STEP 7: State Summary JSON")
    print("=" * 70)

    reps = _load_reps()
    _write_summary("ma_state_summary.json", _build_ma_summary(ma, reps))

    tx_summary = _build_tx_summary(tx, reps)
    _write_summary("tx_state_summary.json", tx_summary)
    report(f"  Asian: {tx_summary['population_by_group']['asian']:,} "
           f"({tx_summary['vap_by_group']['asian']:,} VAP)")
