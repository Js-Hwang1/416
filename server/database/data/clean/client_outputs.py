import json
import os
import shutil

from .helpers import report
from .paths import ANALYSIS_DIR, CLIENT_DATA_DIR, GEOJSON_DIR, REPS_FILE, SUMMARY_DIR

HEATMAP_CONFIGS = [
    (
        "MA precincts",
        "ma_precincts.geojson",
        "ma_precincts_heatmap.geojson",
        {"hispanic": "HVAP", "black": "BVAP", "asian": "ASIANVAP", "white": "WVAP"},
        "NAME",
        "NAME",
    ),
    (
        "TX VTDs",
        "tx_vtds.geojson",
        "tx_vtds_heatmap.geojson",
        {"hispanic": "HISPVAP", "black": "BVAP", "asian": "ASIANVAP", "white": "WVAP"},
        "COUNTY",
        "CNTYVTD",
    ),
]


def _heatmap_props(props, group_cols, name_col, id_col):
    vap = float(props.get("VAP", 0))
    new_props = {"pop": int(props.get("TOTPOP", 0)), "vap": int(vap)}
    if name_col and name_col in props:
        new_props["name"] = props[name_col]
    if id_col and id_col in props:
        new_props["precinct_id"] = str(props[id_col])
    for gk, vc in group_cols.items():
        gv = float(props.get(vc, 0))
        new_props[gk] = round(gv / vap * 100, 1) if vap > 0 else 0
    return new_props


def _build_heatmap_features(src_data, group_cols, name_col, id_col):
    feats = []
    for feat in src_data["features"]:
        feats.append({
            "type": "Feature",
            "geometry": feat["geometry"],
            "properties": _heatmap_props(
                feat["properties"], group_cols, name_col, id_col
            ),
        })
    return feats


def _write_one_heatmap(label, src_name, out_name, group_cols, name_col, id_col):
    src_path = os.path.join(GEOJSON_DIR, src_name)
    with open(src_path) as f:
        src_data = json.load(f)
    feats = _build_heatmap_features(src_data, group_cols, name_col, id_col)

    out_path = os.path.join(CLIENT_DATA_DIR, out_name)
    with open(out_path, "w") as f:
        json.dump(
            {"type": "FeatureCollection", "features": feats},
            f,
            separators=(",", ":"),
        )
    sz = os.path.getsize(out_path) / 1e6
    report(f"{label} heatmap: {sz:.1f} MB -> {out_path}")


def write_precinct_heatmaps():
    """Write the per-precinct/VTD heatmap GeoJSONs to client/public/data/."""
    print("\nGenerating heatmap GeoJSON for client...")
    os.makedirs(CLIENT_DATA_DIR, exist_ok=True)
    for cfg in HEATMAP_CONFIGS:
        _write_one_heatmap(*cfg)


def copy_analysis_to_client():
    """Copy summary + analysis JSON to client/public/data/."""
    print("\nCopying analysis data to client...")
    files = [
        os.path.join(SUMMARY_DIR, "ma_state_summary.json"),
        os.path.join(SUMMARY_DIR, "tx_state_summary.json"),
        REPS_FILE,
        os.path.join(ANALYSIS_DIR, "ma_gingles_precinct.json"),
        os.path.join(ANALYSIS_DIR, "tx_gingles_precinct.json"),
        os.path.join(ANALYSIS_DIR, "ma_gingles_regression.json"),
        os.path.join(ANALYSIS_DIR, "tx_gingles_regression.json"),
        os.path.join(ANALYSIS_DIR, "ma_enacted_demographics.json"),
        os.path.join(ANALYSIS_DIR, "tx_enacted_demographics.json"),
    ]
    for src in files:
        shutil.copy2(src, CLIENT_DATA_DIR)
        report(f"  -> {os.path.basename(src)}")
