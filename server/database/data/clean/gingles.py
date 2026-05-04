import json
import os

import numpy as np

from .helpers import lowess_or_spline, report
from .paths import ANALYSIS_DIR

MA_GROUPS = {
    "hispanic": "HVAP",
    "black": "BVAP",
    "asian": "ASIANVAP",
}

TX_GROUPS = {
    "hispanic": "HISPVAP",
    "black": "BVAP",
}


def _resolve_names_and_ids(gdf, name_col, id_col):
    if name_col and name_col in gdf.columns:
        names = gdf[name_col].values
    else:
        names = [f"Precinct {i+1}" for i in range(len(gdf))]
    if id_col and id_col in gdf.columns:
        ids = gdf[id_col].astype(str).values
    else:
        ids = [str(n) for n in names]
    return names, ids


def _compute_vote_share(gdf):
    pres_d = gdf["G24PREDHAR"].values.astype(float)
    pres_r = gdf["G24PRERTRU"].values.astype(float)
    total = pres_d + pres_r
    has_votes = total > 0
    d_share = np.zeros(len(gdf))
    d_share[has_votes] = pres_d[has_votes] / total[has_votes]
    return d_share, has_votes


def _scatter_points_for_group(gdf, vap_col, d_share, has_votes, names, ids):
    total_vap = gdf["VAP"].values.astype(float)
    total_pop = gdf["TOTPOP"].values.astype(float)
    has_vap = total_vap > 0

    minority_vap = gdf[vap_col].values.astype(float)
    minority_pct = np.zeros(len(gdf))
    minority_pct[has_vap] = minority_vap[has_vap] / total_vap[has_vap]

    points = []
    for i in np.where(has_votes & has_vap)[0]:
        points.append({
            "precinct_id": ids[i],
            "name": str(names[i]),
            "total_pop": int(total_pop[i]),
            "minority_pop": int(minority_vap[i]),
            "minority_vap_pct": round(float(minority_pct[i]), 4),
            "d_vote_share": round(float(d_share[i]), 4),
        })
    return points


def _compute_state_gingles(gdf, state_abbr, group_cols, name_col, id_col):
    """Per-precinct D vote share + minority VAP % for each feasible group."""
    d_share, has_votes = _compute_vote_share(gdf)
    names, ids = _resolve_names_and_ids(gdf, name_col, id_col)

    result = {}
    for group_name, vap_col in group_cols.items():
        if vap_col not in gdf.columns:
            report(f"  Skipping {group_name}: column {vap_col} not found")
            continue
        points = _scatter_points_for_group(
            gdf, vap_col, d_share, has_votes, names, ids
        )
        result[group_name] = points
        report(f"  {state_abbr} {group_name}: {len(points)} precincts")
    return result


def _tx_groups(tx):
    groups = dict(TX_GROUPS)
    if "ASIANVAP" in tx.columns and tx["ASIANVAP"].sum() > 0:
        groups["asian"] = "ASIANVAP"
    return groups


def _write_precinct(state, data):
    out = os.path.join(ANALYSIS_DIR, f"{state}_gingles_precinct.json")
    with open(out, "w") as f:
        json.dump(data, f)
    report(f"{state.upper()} Gingles precinct data written: {out}")


def run_precinct(ma, tx):
    print("\n" + "=" * 70)
    print("STEP 8: Gingles Precinct Analysis")
    print("=" * 70)

    ma_data = _compute_state_gingles(ma, "MA", MA_GROUPS, "NAME", "NAME")
    _write_precinct("ma", ma_data)

    tx_data = _compute_state_gingles(tx, "TX", _tx_groups(tx), "COUNTY", "CNTYVTD")
    _write_precinct("tx", tx_data)


def _fit_curve(points):
    x = np.array([p["minority_vap_pct"] for p in points])
    y = np.array([p["d_vote_share"] for p in points])
    x_fit, y_fit = lowess_or_spline(x, y, n_points=200)
    return [
        {"x": round(float(xi), 4), "y": round(float(yi), 4)}
        for xi, yi in zip(x_fit, y_fit)
    ]


def _process_state_regression(state):
    precinct_path = os.path.join(ANALYSIS_DIR, f"{state}_gingles_precinct.json")
    if not os.path.exists(precinct_path):
        report(f"Skipping {state.upper()}: no precinct data found")
        return

    with open(precinct_path) as f:
        precinct_data = json.load(f)

    regression_data = {}
    for group_name, points in precinct_data.items():
        if len(points) < 20:
            report(f"  {state.upper()} {group_name}: too few points "
                   f"({len(points)}), skipping")
            continue
        regression_data[group_name] = _fit_curve(points)
        report(f"  {state.upper()} {group_name}: "
               f"{len(regression_data[group_name])} regression points")

    out_path = os.path.join(ANALYSIS_DIR, f"{state}_gingles_regression.json")
    with open(out_path, "w") as f:
        json.dump(regression_data, f)
    report(f"{state.upper()} Gingles regression written: {out_path}")


def run_regression():
    print("\n" + "=" * 70)
    print("STEP 9: Gingles Regression Curves")
    print("=" * 70)
    for state in ["ma", "tx"]:
        _process_state_regression(state)
