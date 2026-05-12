import json
import os

import geopandas as gpd

from .helpers import report
from .paths import (
    ANALYSIS_DIR,
    CLIENT_DATA_DIR,
    GEOJSON_DIR,
    GERRYCHAIN_DIR,
    REPS_FILE,
    SUMMARY_DIR,
)


def _check_gerrychain_shapefiles():
    ok = True
    for name, path, expected_min in [
        ("MA precincts", os.path.join(GERRYCHAIN_DIR, "ma_precincts.shp"), 2100),
        ("TX VTDs", os.path.join(GERRYCHAIN_DIR, "tx_vtds.shp"), 8900),
    ]:
        gdf = gpd.read_file(path)
        report(f"{name}: {len(gdf)} rows, CRS={gdf.crs}")
        if len(gdf) < expected_min:
            report(f"  WARNING: Expected at least {expected_min} rows")
            ok = False
        if gdf.geometry.isna().any():
            report(f"  WARNING: {gdf.geometry.isna().sum()} null geometries")
            ok = False
        invalid = (~gdf.geometry.is_valid).sum()
        if invalid > 0:
            report(f"  WARNING: {invalid} invalid geometries")
            ok = False
        if "G24PREDHAR" in gdf.columns:
            report(f"  G24PREDHAR total votes: {gdf['G24PREDHAR'].sum():,}")
    return ok


def _check_tx_asian():
    tx_gdf = gpd.read_file(os.path.join(GERRYCHAIN_DIR, "tx_vtds.shp"))
    if "ASIAN" not in tx_gdf.columns:
        report("  FAIL: ASIAN column missing from TX shapefile")
        return False
    tx_asian = tx_gdf["ASIAN"].sum()
    report(f"TX Asian total: {tx_asian:,}")
    if tx_asian == 0:
        report("  FAIL: TX Asian is still 0")
        return False
    report("  OK: TX Asian > 0")
    return True


def _check_gcon_columns():
    ok = True
    for name, path in [
        ("MA precincts", os.path.join(GERRYCHAIN_DIR, "ma_precincts.shp")),
        ("TX VTDs", os.path.join(GERRYCHAIN_DIR, "tx_vtds.shp")),
    ]:
        gdf = gpd.read_file(path, rows=1)
        gcon_cols = [c for c in gdf.columns if c.startswith("GCON")]
        report(f"{name} GCON columns: {len(gcon_cols)}")
        if len(gcon_cols) == 0:
            report(f"  WARNING: No GCON columns found in {name}")
            ok = False
    return ok


def _check_geojson_sizes():
    ok = True
    for name, path, max_mb in [
        ("MA precincts GeoJSON", os.path.join(GEOJSON_DIR, "ma_precincts.geojson"), 10),
        ("TX VTDs GeoJSON", os.path.join(GEOJSON_DIR, "tx_vtds.geojson"), 30),
    ]:
        if not os.path.exists(path):
            report(f"{name}: MISSING")
            ok = False
            continue
        size_mb = os.path.getsize(path) / 1e6
        status = "OK" if size_mb <= max_mb else "WARNING: too large"
        report(f"{name}: {size_mb:.1f} MB ({status})")
        if size_mb > max_mb:
            ok = False
    return ok


def _check_block_heatmaps():
    ok = True
    for name, path, min_mb, max_mb in [
        ("MA block heatmap",
         os.path.join(CLIENT_DATA_DIR, "ma_blocks_heatmap.geojson"), 5, 100),
        ("TX block heatmap",
         os.path.join(CLIENT_DATA_DIR, "tx_blocks_heatmap.geojson"), 30, 500),
    ]:
        if not os.path.exists(path):
            report(f"{name}: MISSING")
            ok = False
            continue
        size_mb = os.path.getsize(path) / 1e6
        status = "OK" if min_mb <= size_mb <= max_mb else "WARNING: unexpected size"
        report(f"{name}: {size_mb:.1f} MB ({status})")
        if size_mb < min_mb or size_mb > max_mb:
            ok = False
    return ok


def _check_cd_geojson():
    ok = True
    for name, path in [
        ("MA CD GeoJSON",
         os.path.join(GEOJSON_DIR, "ma_congressional_districts.geojson")),
        ("TX CD GeoJSON",
         os.path.join(GEOJSON_DIR, "tx_congressional_districts.geojson")),
    ]:
        gdf = gpd.read_file(path)
        has_district = "district" in gdf.columns
        report(f"{name}: {len(gdf)} features, has 'district'={has_district}")
        if not has_district:
            report("  FAIL: missing 'district' property")
            ok = False
    return ok


def _check_analysis_files():
    ok = True
    files = [
        "ma_gingles_precinct.json", "tx_gingles_precinct.json",
        "ma_gingles_regression.json", "tx_gingles_regression.json",
        "ma_adjacency.json", "tx_adjacency.json",
        "ma_enacted_demographics.json", "tx_enacted_demographics.json",
    ]
    for fname in files:
        path = os.path.join(ANALYSIS_DIR, fname)
        if os.path.exists(path):
            report(f"  {fname}: {os.path.getsize(path):,} bytes")
        else:
            report(f"  {fname}: MISSING")
            ok = False
    return ok


def _check_vote_margins_in_reps():
    ok = True
    with open(REPS_FILE) as f:
        reps = json.load(f)
    for state_abbr in ["MA", "TX"]:
        has_margins = all(
            "vote_margin_pct" in r for r in reps[state_abbr]["representatives"]
        )
        report(f"{state_abbr} vote margins in reps: "
               f"{'OK' if has_margins else 'MISSING'}")
        if not has_margins:
            ok = False
    return ok


def _check_state_summaries():
    ok = True
    for name, path in [
        ("MA summary", os.path.join(SUMMARY_DIR, "ma_state_summary.json")),
        ("TX summary", os.path.join(SUMMARY_DIR, "tx_state_summary.json")),
    ]:
        with open(path) as f:
            data = json.load(f)
        report(f"{name}: pop={data['total_population']:,}, "
               f"districts={data['num_congressional_districts']}, "
               f"feasible={data['feasible_demographic_groups']}")
        asian_zero = data.get("population_by_group", {}).get("asian", 0) == 0
        if asian_zero and "TX" in name:
            report("  WARNING: TX Asian still 0 in summary")
            ok = False
    return ok


def run():
    print("\n" + "=" * 70)
    print("STEP 13: Verification")
    print("=" * 70)

    checks = [
        _check_gerrychain_shapefiles(),
        _check_tx_asian(),
        _check_gcon_columns(),
        _check_geojson_sizes(),
        _check_block_heatmaps(),
        _check_cd_geojson(),
        _check_analysis_files(),
        _check_vote_margins_in_reps(),
        _check_state_summaries(),
    ]
    ok = all(checks)

    if ok:
        report("\nAll checks passed!")
    else:
        report("\nSome checks had warnings — review above.")
    return ok
