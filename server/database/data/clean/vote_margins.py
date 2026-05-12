import json

from .helpers import report
from .paths import REPS_FILE


def _district_vote_columns(gdf):
    d_cols = [c for c in gdf.columns if c.startswith("G24PRED")]
    r_cols = [c for c in gdf.columns if c.startswith("G24PRER")]
    return d_cols, r_cols


def _filter_with_cong_dist(gdf):
    valid = gdf[gdf["CONG_DIST"].astype(str).str.strip() != ""].copy()
    if valid.empty:
        return valid
    valid["_cd"] = (
        valid["CONG_DIST"].astype(str).str.strip().str.lstrip("0").replace("", "0")
    )
    return valid


def _district_margin(district_rows, d_cols, r_cols):
    dem_votes = sum(int(district_rows[c].fillna(0).sum()) for c in d_cols)
    rep_votes = sum(int(district_rows[c].fillna(0).sum()) for c in r_cols)
    total_votes = dem_votes + rep_votes
    if total_votes == 0:
        return {
            "dem_votes": 0, "rep_votes": 0, "total_votes": 0,
            "vote_margin_pct": 0, "winner": "N/A",
        }
    margin = abs(dem_votes - rep_votes) / total_votes * 100
    winner = "D" if dem_votes > rep_votes else "R"
    return {
        "dem_votes": dem_votes,
        "rep_votes": rep_votes,
        "total_votes": total_votes,
        "vote_margin_pct": round(margin, 1),
        "winner": winner,
    }


def _compute_state_margins(gdf, state_abbr, n_districts):
    if "CONG_DIST" not in gdf.columns:
        report(f"  {state_abbr}: No CONG_DIST column found")
        return {}

    d_cols, r_cols = _district_vote_columns(gdf)
    if not d_cols and not r_cols:
        report(f"  {state_abbr}: No G24PRE D/R columns found")
        return {}

    valid = _filter_with_cong_dist(gdf)
    if valid.empty:
        report(f"  {state_abbr}: No rows with CONG_DIST values")
        return {}

    margins = {}
    for dist_num in range(1, n_districts + 1):
        rows = valid[valid["_cd"] == str(dist_num)]
        margins[dist_num] = _district_margin(rows, d_cols, r_cols)
        m = margins[dist_num]
        report(f"  {state_abbr}-{dist_num:02d}: D={m['dem_votes']:,} "
               f"R={m['rep_votes']:,} margin={m['vote_margin_pct']}% ({m['winner']})")
    return margins


def _apply_margins_to_reps(reps, state_abbr, margins):
    for rep_entry in reps[state_abbr]["representatives"]:
        dist = rep_entry["district"]
        if dist in margins:
            m = margins[dist]
            rep_entry["dem_votes"] = m["dem_votes"]
            rep_entry["rep_votes"] = m["rep_votes"]
            rep_entry["total_votes"] = m["total_votes"]
            rep_entry["vote_margin_pct"] = m["vote_margin_pct"]
        else:
            rep_entry["dem_votes"] = 0
            rep_entry["rep_votes"] = 0
            rep_entry["total_votes"] = 0
            rep_entry["vote_margin_pct"] = 0.0
            report(f"  {state_abbr}-{dist:02d}: Missing district totals")


def run(ma, tx):
    print("\n" + "=" * 70)
    print("STEP 10: Congressional Vote Margins")
    print("=" * 70)

    with open(REPS_FILE) as f:
        reps = json.load(f)

    ma_margins = _compute_state_margins(ma, "MA", reps["MA"]["total_districts"])
    tx_margins = _compute_state_margins(tx, "TX", reps["TX"]["total_districts"])

    _apply_margins_to_reps(reps, "MA", ma_margins)
    _apply_margins_to_reps(reps, "TX", tx_margins)

    with open(REPS_FILE, "w") as f:
        json.dump(reps, f, indent=2)
    report(f"Updated {REPS_FILE}")
