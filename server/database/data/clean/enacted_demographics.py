import json
import os

from .helpers import report
from .paths import ANALYSIS_DIR

MA_GROUP_COLS = {
    "hispanic": "HVAP",
    "black": "BVAP",
    "asian": "ASIANVAP",
    "white": "WVAP",
}

TX_GROUP_COLS = {
    "hispanic": "HISPVAP",
    "black": "BVAP",
    "white": "WVAP",
}


def _district_groups(group_rows, group_cols, total_vap):
    groups = {}
    for group_name, vap_col in group_cols.items():
        if vap_col not in group_rows.columns:
            continue
        vap = int(group_rows[vap_col].sum())
        pct = round(vap / total_vap * 100, 2) if total_vap > 0 else 0
        groups[group_name] = {"vap": vap, "pct": pct}
    return groups


def _district_entry(cd, group_rows, group_cols):
    district_num = int(cd) if cd.isdigit() else cd
    total_vap = int(group_rows["VAP"].sum())
    return {
        "district": district_num,
        "total_vap": total_vap,
        "groups": _district_groups(group_rows, group_cols, total_vap),
    }


def _compute_state_demographics(gdf, state_abbr, group_cols):
    if "CONG_DIST" not in gdf.columns:
        report(f"  {state_abbr}: No CONG_DIST column, skipping")
        return None

    valid = gdf[gdf["CONG_DIST"].astype(str).str.strip() != ""].copy()
    valid["_cd"] = valid["CONG_DIST"].astype(str).str.strip().str.lstrip("0")

    districts = [
        _district_entry(cd, group, group_cols)
        for cd, group in valid.groupby("_cd")
    ]
    districts.sort(key=lambda d: d["district"])
    return {"districts": districts}


def _tx_group_cols(tx):
    cols = dict(TX_GROUP_COLS)
    if "ASIANVAP" in tx.columns and tx["ASIANVAP"].sum() > 0:
        cols["asian"] = "ASIANVAP"
    return cols


def _write(state, payload):
    if not payload:
        return
    out_path = os.path.join(ANALYSIS_DIR, f"{state}_enacted_demographics.json")
    with open(out_path, "w") as f:
        json.dump(payload, f, indent=2)
    report(f"{state.upper()} enacted demographics written: {out_path} "
           f"({len(payload['districts'])} districts)")


def run(ma, tx):
    print("\n" + "=" * 70)
    print("STEP 12: Enacted Plan District Demographics")
    print("=" * 70)
    _write("ma", _compute_state_demographics(ma, "MA", MA_GROUP_COLS))
    _write("tx", _compute_state_demographics(tx, "TX", _tx_group_cols(tx)))
