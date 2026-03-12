#!/usr/bin/env python3
"""
Data cleaning pipeline for redistricting project.

Produces:
  - GerryChain shapefiles (MA precincts, TX VTDs) with demographics + 2024 elections
  - GeoJSON files for GUI display (precincts, VTDs, congressional districts)
  - State summary JSON for GUI dashboard
  - Gingles precinct analysis + regression curves (JSON)
  - Precinct adjacency graphs (JSON)
  - Enacted plan district demographics (JSON)
  - Congressional vote margins (updates congressional_reps.json)

Usage:
    python clean_data.py
"""

import gc
import json
import math
import os
import re
import shutil
import sys
import time
import warnings
import zipfile

import geopandas as gpd
import numpy as np
import pandas as pd
import pyogrio
from shapely import set_precision
from shapely.geometry import mapping, shape
from shapely.strtree import STRtree

warnings.filterwarnings("ignore")

# Optional dependencies
try:
    from scipy.interpolate import UnivariateSpline
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

try:
    from statsmodels.nonparametric.smoothers_lowess import lowess as sm_lowess
    HAS_LOWESS = True
except ImportError:
    HAS_LOWESS = False

try:
    import libpysal
    HAS_LIBPYSAL = True
except ImportError:
    HAS_LIBPYSAL = False


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RAW_DIR = os.path.join(BASE_DIR, "raw")
CLEANED_DIR = os.path.join(BASE_DIR, "cleaned")
TMP_DIR = os.path.join(BASE_DIR, "_tmp_unzip")

GERRYCHAIN_DIR = os.path.join(CLEANED_DIR, "gerrychain")
GEOJSON_DIR = os.path.join(CLEANED_DIR, "geojson")
SUMMARY_DIR = os.path.join(CLEANED_DIR, "summary")
ANALYSIS_DIR = os.path.join(CLEANED_DIR, "analysis")

CLIENT_DATA_DIR = os.path.normpath(
    os.path.join(BASE_DIR, "..", "..", "..", "client", "public", "data")
)

for d in [GERRYCHAIN_DIR, GEOJSON_DIR, SUMMARY_DIR, ANALYSIS_DIR, TMP_DIR]:
    os.makedirs(d, exist_ok=True)

# Raw zip files
RAW_FILES = {
    "ma_mggg": os.path.join(RAW_DIR, "MA_precincts_12_16.zip"),
    "ma_2024": os.path.join(RAW_DIR, "ma_2024_gen_prec.zip"),
    "tx_mggg": os.path.join(RAW_DIR, "TX_vtds.zip"),
    "tx_2024": os.path.join(RAW_DIR, "tx_2024_gen_tx_vtd.zip"),
    "ma_cd": os.path.join(RAW_DIR, "tl_2023_25_cd118.zip"),
    "tx_cd": os.path.join(RAW_DIR, "tl_2023_48_cd118.zip"),
    "tx_pl2020_b": os.path.join(RAW_DIR, "tx_pl2020_b.zip"),
    "ma_pl2020_b": os.path.join(RAW_DIR, "ma_pl2020_b.zip"),
}

REPS_FILE = os.path.join(BASE_DIR, "congressional_reps.json")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def unzip(zip_path, dest_name):
    """Unzip a file into TMP_DIR/dest_name and return the directory path."""
    dest = os.path.join(TMP_DIR, dest_name)
    if not os.path.exists(dest):
        os.makedirs(dest, exist_ok=True)
        with zipfile.ZipFile(zip_path, "r") as z:
            z.extractall(dest)
    return dest


def find_shapefile(directory):
    """Find the first .shp file inside a directory tree."""
    for root, _, files in os.walk(directory):
        for f in files:
            if f.endswith(".shp"):
                return os.path.join(root, f)
    raise FileNotFoundError(f"No .shp file found in {directory}")


def report(msg):
    print(f"  {msg}")


def timed(label):
    """Context manager to time a block of code."""
    class Timer:
        def __enter__(self):
            self.t0 = time.time()
            return self
        def __exit__(self, *args):
            elapsed = time.time() - self.t0
            report(f"{label}: {elapsed:.1f}s")
    return Timer()


def reduce_precision(gdf, grid_size=1e-6):
    """Snap coordinates to grid for smaller file sizes (~11cm accuracy)."""
    gdf = gdf.copy()
    gdf["geometry"] = gdf["geometry"].apply(
        lambda g: set_precision(g, grid_size) if g is not None else g
    )
    return gdf


def lowess_or_spline(x, y, n_points=200):
    """Fit a smooth curve through (x, y) scatter data.

    Returns arrays (x_fit, y_fit) of length n_points.
    Tries statsmodels LOWESS first, then scipy UnivariateSpline.
    """
    # Sort by x
    order = np.argsort(x)
    xs, ys = x[order], y[order]

    x_fit = np.linspace(xs.min(), xs.max(), n_points)

    if HAS_LOWESS:
        result = sm_lowess(ys, xs, frac=0.3, return_sorted=True)
        x_smooth, y_smooth = result[:, 0], result[:, 1]
        y_fit = np.interp(x_fit, x_smooth, y_smooth)
    elif HAS_SCIPY:
        # Use UnivariateSpline as fallback
        try:
            spl = UnivariateSpline(xs, ys, s=len(xs) * 0.1, k=3)
            y_fit = spl(x_fit)
        except Exception:
            # Simple moving average fallback
            y_fit = np.interp(x_fit, xs, ys)
    else:
        # No smoothing available — just interpolate
        y_fit = np.interp(x_fit, xs, ys)

    # Clamp to [0, 1]
    y_fit = np.clip(y_fit, 0, 1)
    return x_fit, y_fit


# =========================================================================
# STEP 1: MA Merged Precincts
# =========================================================================
def step1_ma_precincts():
    print("\n" + "=" * 70)
    print("STEP 1: MA Merged Precincts")
    print("=" * 70)

    # Load MGGG base geometry
    ma_mggg_dir = unzip(RAW_FILES["ma_mggg"], "MA_precincts_12_16")
    shp = find_shapefile(ma_mggg_dir)
    mggg = gpd.read_file(shp)
    report(f"MGGG loaded: {len(mggg)} precincts, CRS={mggg.crs}")

    # Load 2024 election data
    ma_2024_dir = unzip(RAW_FILES["ma_2024"], "ma_2024_gen_prec")
    # Use the all-races subfolder
    shp_2024 = find_shapefile(os.path.join(ma_2024_dir, "ma_2024_gen_all_prec"))
    elec = gpd.read_file(shp_2024)
    report(f"2024 election loaded: {len(elec)} precincts, CRS={elec.crs}")

    # Build join keys — normalize to match
    mggg["_join_key"] = (
        mggg["TOWN"].str.strip().str.upper()
        + "|"
        + mggg["WARD"].str.strip().str.replace("^0$", "-", regex=True)
        + "|"
        + mggg["PRECINCT"].str.strip().str.upper()
    )

    elec["_join_key"] = (
        elec["City/Town"].str.strip().str.upper()
        + "|"
        + elec["Ward"].str.strip()
        + "|"
        + elec["Pct"].str.strip().str.upper()
    )

    # Columns to transfer: G24* (presidential, senate) + GCON* (congressional)
    elec_cols = [c for c in elec.columns if c.startswith("G24") or c.startswith("GCON")]
    transfer_cols = elec_cols.copy()
    if "CONG_DIST" in elec.columns:
        transfer_cols.append("CONG_DIST")

    # De-duplicate 2024 on join key (keep first if duplicates)
    elec_dedup = elec.drop_duplicates(subset="_join_key", keep="first")

    # Attribute join
    elec_lookup = elec_dedup.set_index("_join_key")[transfer_cols]
    merged = mggg.join(elec_lookup, on="_join_key", how="left")

    matched_attr = merged[elec_cols[0]].notna().sum()
    report(f"Attribute join: {matched_attr}/{len(mggg)} matched ({100*matched_attr/len(mggg):.1f}%)")

    # Spatial fallback for unmatched rows
    unmatched_mask = merged[elec_cols[0]].isna()
    n_unmatched = unmatched_mask.sum()
    if n_unmatched > 0:
        report(f"Attempting spatial join for {n_unmatched} unmatched precincts...")
        elec_reproj = elec.to_crs(mggg.crs)

        unmatched = merged[unmatched_mask].copy()
        centroids = unmatched.copy()
        centroids["geometry"] = centroids.geometry.centroid

        spatial = gpd.sjoin(
            centroids[["geometry"]],
            elec_reproj[["geometry"] + transfer_cols],
            how="left",
            predicate="within",
        )
        spatial = spatial[~spatial.index.duplicated(keep="first")]

        for col in transfer_cols:
            if col in spatial.columns:
                merged.loc[unmatched_mask, col] = spatial[col].values

        matched_spatial = merged[elec_cols[0]].notna().sum() - matched_attr
        report(f"Spatial join: {matched_spatial} additional matches")

    total_matched = merged[elec_cols[0]].notna().sum()
    report(f"Total matched: {total_matched}/{len(mggg)} ({100*total_matched/len(mggg):.1f}%)")

    # Fill unmatched election columns with 0
    vote_cols = [c for c in elec_cols if c.startswith("G24") or c.startswith("GCON")]
    for col in vote_cols:
        merged[col] = merged[col].fillna(0).astype(int)
    if "CONG_DIST" in merged.columns:
        merged["CONG_DIST"] = merged["CONG_DIST"].fillna("")

    # Drop join key
    merged = merged.drop(columns=["_join_key"])

    # --- Output shapefile (keep original CRS for GerryChain) ---
    out_shp = os.path.join(GERRYCHAIN_DIR, "ma_precincts.shp")
    merged.to_file(out_shp)
    report(f"Shapefile written: {out_shp}")

    return merged


# =========================================================================
# STEP 2: TX Merged VTDs
# =========================================================================
def step2_tx_vtds():
    print("\n" + "=" * 70)
    print("STEP 2: TX Merged VTDs")
    print("=" * 70)

    # Load MGGG base geometry
    tx_mggg_dir = unzip(RAW_FILES["tx_mggg"], "TX_vtds")
    shp = find_shapefile(tx_mggg_dir)
    mggg = gpd.read_file(shp)
    report(f"MGGG loaded: {len(mggg)} VTDs, CRS={mggg.crs}")

    # Load 2024 election data — "all" subfolder for G24* + GCON*
    tx_2024_dir = unzip(RAW_FILES["tx_2024"], "tx_2024_gen_tx_vtd")
    shp_2024_all = find_shapefile(os.path.join(tx_2024_dir, "tx_2024_gen_all_tx_vtd"))
    elec = gpd.read_file(shp_2024_all)
    report(f"2024 election (all) loaded: {len(elec)} rows, CRS={elec.crs}")

    # Load "cong" subfolder for CONG_DIST
    shp_2024_cong = find_shapefile(os.path.join(tx_2024_dir, "tx_2024_gen_cong_tx_vtd"))
    elec_cong = gpd.read_file(shp_2024_cong)
    report(f"2024 election (cong) loaded: {len(elec_cong)} rows")

    # Build join keys
    mggg["_fips_str"] = mggg["FIPS"].astype(str).str.zfill(3)
    mggg["_join_key"] = mggg["_fips_str"] + "|" + mggg["VTD"].str.strip()

    elec["_join_key"] = elec["COUNTYFP"].str.strip() + "|" + elec["TX_VTD"].str.strip()
    elec_cong["_join_key"] = (
        elec_cong["COUNTYFP"].str.strip() + "|" + elec_cong["TX_VTD"].str.strip()
    )

    # Columns to transfer: G24* + GCON*
    elec_cols = [c for c in elec.columns if c.startswith("G24") or c.startswith("GCON")]
    transfer_cols = elec_cols.copy()

    # Aggregate if there are duplicate VTDs (VTDs split across legislative districts)
    if elec.groupby("_join_key").ngroups < len(elec):
        report("Aggregating duplicate VTDs in 'all' data...")
        elec_agg = elec.groupby("_join_key")[elec_cols].sum().reset_index()
    else:
        elec_agg = elec[["_join_key"] + elec_cols].copy()
        report("No duplicate VTDs in 'all' data")

    # Get CONG_DIST from cong data (de-dup, keep first)
    cong_dedup = elec_cong.drop_duplicates(subset="_join_key", keep="first")
    cong_lookup = cong_dedup.set_index("_join_key")[["CONG_DIST"]]

    # Attribute join — election data
    elec_lookup = elec_agg.set_index("_join_key")
    merged = mggg.join(elec_lookup, on="_join_key", how="left")

    matched_attr = merged[elec_cols[0]].notna().sum()
    report(f"Attribute join: {matched_attr}/{len(mggg)} matched ({100*matched_attr/len(mggg):.1f}%)")

    # Spatial fallback for unmatched rows
    unmatched_mask = merged[elec_cols[0]].isna()
    n_unmatched = unmatched_mask.sum()
    if n_unmatched > 0:
        report(f"Attempting spatial join for {n_unmatched} unmatched VTDs...")
        elec_reproj = elec.to_crs(mggg.crs)

        unmatched = merged[unmatched_mask].copy()
        centroids = unmatched.copy()
        centroids["geometry"] = centroids.geometry.centroid

        spatial = gpd.sjoin(
            centroids[["geometry"]],
            elec_reproj[["geometry"] + elec_cols],
            how="left",
            predicate="within",
        )
        spatial = spatial[~spatial.index.duplicated(keep="first")]

        for col in elec_cols:
            if col in spatial.columns:
                merged.loc[unmatched_mask, col] = spatial[col].values

        matched_spatial = merged[elec_cols[0]].notna().sum() - matched_attr
        report(f"Spatial join: {matched_spatial} additional matches")

    total_matched = merged[elec_cols[0]].notna().sum()
    report(f"Total matched: {total_matched}/{len(mggg)} ({100*total_matched/len(mggg):.1f}%)")

    # Join CONG_DIST
    merged = merged.join(cong_lookup, on="_join_key", how="left")
    cong_matched = merged["CONG_DIST"].notna().sum()
    report(f"CONG_DIST matched: {cong_matched}/{len(mggg)}")

    # Also try matching CONG_DIST via USCD column from MGGG if available
    if "USCD" in merged.columns:
        no_cong = merged["CONG_DIST"].isna() | (merged["CONG_DIST"] == "")
        merged.loc[no_cong, "CONG_DIST"] = merged.loc[no_cong, "USCD"].astype(str).str.zfill(2)
        report(f"CONG_DIST after USCD fallback: {merged['CONG_DIST'].notna().sum()}/{len(mggg)}")

    # Fill unmatched election columns with 0
    for col in elec_cols:
        merged[col] = merged[col].fillna(0).astype(int)
    if "CONG_DIST" in merged.columns:
        merged["CONG_DIST"] = merged["CONG_DIST"].fillna("")

    # Drop temp columns
    merged = merged.drop(columns=["_join_key", "_fips_str"])

    # --- Output shapefile (keep original CRS) ---
    out_shp = os.path.join(GERRYCHAIN_DIR, "tx_vtds.shp")
    merged.to_file(out_shp)
    report(f"Shapefile written: {out_shp}")

    return merged


# =========================================================================
# STEP 3: Fix Invalid TX Geometries
# =========================================================================
def step3_fix_tx_geometries(tx):
    print("\n" + "=" * 70)
    print("STEP 3: Fix Invalid TX Geometries")
    print("=" * 70)

    invalid_mask = ~tx.geometry.is_valid
    n_invalid = invalid_mask.sum()
    report(f"Invalid geometries found: {n_invalid}")

    if n_invalid > 0:
        tx.loc[invalid_mask, "geometry"] = tx.loc[invalid_mask, "geometry"].buffer(0)
        still_invalid = (~tx.geometry.is_valid).sum()
        report(f"After buffer(0) fix: {still_invalid} still invalid")

        # Re-write shapefile with fixed geometries
        out_shp = os.path.join(GERRYCHAIN_DIR, "tx_vtds.shp")
        tx.to_file(out_shp)
        report(f"Shapefile re-written with fixed geometries")

    return tx


# =========================================================================
# STEP 4: Enrich TX with Asian Population from Census PL2020
# =========================================================================
def step4_enrich_tx_asian(tx):
    print("\n" + "=" * 70)
    print("STEP 4: Enrich TX with Asian Population (Census PL2020)")
    print("=" * 70)

    with timed("Reading Census PL2020 block data"):
        # Read block-level data: county, VTD, NH Asian total, NH Asian VAP
        # P0020008 = Not Hispanic, Asian alone (total pop)
        # P0040008 = Not Hispanic, Asian alone (18+ VAP)
        blocks = pyogrio.read_dataframe(
            f"zip://{RAW_FILES['tx_pl2020_b']}",
            columns=["COUNTYFP20", "VTD", "P0020008", "P0040008"],
            read_geometry=False,
        )

    report(f"Loaded {len(blocks):,} census blocks")
    report(f"Statewide NH Asian total: {blocks['P0020008'].sum():,}")
    report(f"Statewide NH Asian VAP: {blocks['P0040008'].sum():,}")

    # Aggregate blocks → Census VTDs (county + 6-char VTD code)
    asian_by_vtd = (
        blocks.groupby(["COUNTYFP20", "VTD"])
        .agg(ASIAN=("P0020008", "sum"), ASIANVAP=("P0040008", "sum"))
        .reset_index()
    )
    report(f"Aggregated to {len(asian_by_vtd)} Census VTDs")

    # Build mapping key for MGGG VTDs
    # MGGG: FIPS (int) → zfill(3), VTD (4-char, may have alpha suffix like '0001A')
    # Census: COUNTYFP20 (3-char), VTD (6-char, e.g. '000001')
    # Mapping: strip alpha suffix from MGGG VTD, zero-pad to 6 chars
    tx["_fips_str"] = tx["FIPS"].astype(str).str.zfill(3)
    tx["_vtd_base"] = tx["VTD"].str.replace(r"[A-Za-z]+$", "", regex=True)
    tx["_census_vtd"] = tx["_vtd_base"].str.zfill(6)
    tx["_asian_key"] = tx["_fips_str"] + "|" + tx["_census_vtd"]

    asian_by_vtd["_asian_key"] = asian_by_vtd["COUNTYFP20"] + "|" + asian_by_vtd["VTD"]
    asian_lookup = asian_by_vtd.set_index("_asian_key")[["ASIAN", "ASIANVAP"]]

    # For MGGG VTDs that share the same Census VTD (split VTDs like 0001A/0001B),
    # allocate Asian proportionally by TOTPOP
    tx = tx.join(asian_lookup, on="_asian_key", how="left", rsuffix="_census")

    # Handle proportional allocation for split VTDs
    vtd_groups = tx.groupby("_asian_key")["TOTPOP"].transform("sum")
    proportion = tx["TOTPOP"] / vtd_groups.replace(0, 1)

    if "ASIAN_census" in tx.columns:
        # Joined with rsuffix — means ASIAN already existed
        tx["ASIAN"] = (tx["ASIAN_census"].fillna(0) * proportion).round().astype(int)
        tx["ASIANVAP"] = (tx["ASIANVAP_census"].fillna(0) * proportion).round().astype(int)
        tx = tx.drop(columns=["ASIAN_census", "ASIANVAP_census"])
    else:
        tx["ASIAN"] = (tx["ASIAN"].fillna(0) * proportion).round().astype(int)
        tx["ASIANVAP"] = (tx["ASIANVAP"].fillna(0) * proportion).round().astype(int)

    # Drop temp columns
    tx = tx.drop(columns=["_fips_str", "_vtd_base", "_census_vtd", "_asian_key"])

    total_asian = tx["ASIAN"].sum()
    total_asian_vap = tx["ASIANVAP"].sum()
    report(f"TX Asian total: {total_asian:,}")
    report(f"TX Asian VAP: {total_asian_vap:,}")

    if total_asian == 0:
        report("WARNING: Asian enrichment produced zero — check VTD code mapping")

    # Re-write shapefile
    out_shp = os.path.join(GERRYCHAIN_DIR, "tx_vtds.shp")
    tx.to_file(out_shp)
    report(f"Shapefile re-written with Asian demographics")

    return tx


# =========================================================================
# STEP 5: Congressional District GeoJSON
# =========================================================================
def step5_congressional_districts():
    print("\n" + "=" * 70)
    print("STEP 5: Congressional District GeoJSON")
    print("=" * 70)

    for state, key, fips in [("ma", "ma_cd", "25"), ("tx", "tx_cd", "48")]:
        cd_dir = unzip(RAW_FILES[key], f"tl_2023_{fips}_cd118")
        shp = find_shapefile(cd_dir)
        gdf = gpd.read_file(shp)
        report(f"{state.upper()} districts loaded: {len(gdf)}, CRS={gdf.crs}")

        # Reproject to 4326
        gdf = gdf.to_crs(epsg=4326)

        # Simplify geometry for web performance
        # Only simplify TX districts; MA is small enough at full resolution (~1.1MB)
        if state == "tx":
            gdf["geometry"] = gdf["geometry"].simplify(tolerance=0.0003, preserve_topology=True)

        # Keep relevant columns
        gdf = gdf[["CD118FP", "NAMELSAD", "GEOID", "geometry"]].copy()
        gdf = gdf.rename(columns={
            "CD118FP": "district_num",
            "NAMELSAD": "district_name",
            "GEOID": "geoid",
        })

        # Add `district` property (string of integer, e.g. "1" not "01")
        gdf["district"] = gdf["district_num"].astype(int).astype(str)

        # Sort by district number
        gdf = gdf.sort_values("district_num").reset_index(drop=True)

        # Write to cleaned/geojson/
        out_path = os.path.join(GEOJSON_DIR, f"{state}_congressional_districts.geojson")
        gdf.to_file(out_path, driver="GeoJSON")
        report(f"{state.upper()} districts GeoJSON written: {out_path}")

        # NOTE: client/public/data/{state}_districts.geojson is maintained
        # separately (from a pre-simplified cartographic source).  Do NOT
        # overwrite it from the TIGER/Line data here.


# =========================================================================
# STEP 6: Simplified Web GeoJSON
# =========================================================================
def step6_web_geojson(ma, tx):
    print("\n" + "=" * 70)
    print("STEP 6: Simplified Web GeoJSON")
    print("=" * 70)

    for label, gdf, filename, tolerance in [
        ("MA precincts", ma, "ma_precincts.geojson", 0.0003),
        ("TX VTDs", tx, "tx_vtds.geojson", 0.0008),
    ]:
        with timed(f"Simplifying {label}"):
            web = gdf.to_crs(epsg=4326)

            # Simplify geometries
            web["geometry"] = web["geometry"].simplify(
                tolerance=tolerance, preserve_topology=True
            )

            # Reduce coordinate precision (~11cm accuracy)
            web = reduce_precision(web, grid_size=1e-6)

            out_path = os.path.join(GEOJSON_DIR, filename)
            web.to_file(out_path, driver="GeoJSON")
            size_mb = os.path.getsize(out_path) / 1e6
            report(f"{label} GeoJSON: {size_mb:.1f} MB -> {out_path}")


# =========================================================================
# STEP 7: State Summary JSON
# =========================================================================
def step7_state_summaries(ma, tx):
    print("\n" + "=" * 70)
    print("STEP 7: State Summary JSON")
    print("=" * 70)

    with open(REPS_FILE, "r") as f:
        reps = json.load(f)

    # --- MA Summary ---
    ma_pop = int(ma["TOTPOP"].sum())
    ma_vap = int(ma["VAP"].sum())

    # Compute statewide 2024 Presidential vote shares
    ma_d_pres = int(ma["G24PREDHAR"].sum()) if "G24PREDHAR" in ma.columns else 0
    ma_r_pres = int(ma["G24PRERTRU"].sum()) if "G24PRERTRU" in ma.columns else 0
    ma_total_pres = ma_d_pres + ma_r_pres

    ma_summary = {
        "state": "Massachusetts",
        "state_abbr": "MA",
        "total_population": ma_pop,
        "voting_age_population": ma_vap,
        "population_by_group": {
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
        },
        "vap_by_group": {
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
        },
        "presidential_2024": {
            "dem_votes": ma_d_pres,
            "rep_votes": ma_r_pres,
            "total_votes": ma_total_pres,
            "dem_pct": round(ma_d_pres / ma_total_pres * 100, 1) if ma_total_pres else 0,
            "rep_pct": round(ma_r_pres / ma_total_pres * 100, 1) if ma_total_pres else 0,
        },
        "num_congressional_districts": reps["MA"]["total_districts"],
        "party_split": reps["MA"]["party_split"],
        "feasible_demographic_groups": [],
    }
    for group, pop in ma_summary["population_by_group"].items():
        if pop > 400_000:
            ma_summary["feasible_demographic_groups"].append(group)

    out_ma = os.path.join(SUMMARY_DIR, "ma_state_summary.json")
    with open(out_ma, "w") as f:
        json.dump(ma_summary, f, indent=2)
    report(f"MA summary written: {out_ma}")
    report(f"  Population: {ma_pop:,} | VAP: {ma_vap:,}")
    report(f"  Feasible groups: {ma_summary['feasible_demographic_groups']}")

    # --- TX Summary ---
    tx_pop = int(tx["TOTPOP"].sum())
    tx_vap = int(tx["VAP"].sum())

    tx_white = int(tx["WHITE"].sum())
    tx_black = int(tx["BLACK"].sum())
    tx_hisp = int(tx["HISPANIC"].sum())
    tx_asian = int(tx["ASIAN"].sum()) if "ASIAN" in tx.columns else 0
    tx_other = int(tx["OTHER"].sum()) if "OTHER" in tx.columns else 0

    tx_asian_vap = int(tx["ASIANVAP"].sum()) if "ASIANVAP" in tx.columns else 0

    tx_d_pres = int(tx["G24PREDHAR"].sum()) if "G24PREDHAR" in tx.columns else 0
    tx_r_pres = int(tx["G24PRERTRU"].sum()) if "G24PRERTRU" in tx.columns else 0
    tx_total_pres = tx_d_pres + tx_r_pres

    tx_summary = {
        "state": "Texas",
        "state_abbr": "TX",
        "total_population": tx_pop,
        "voting_age_population": tx_vap,
        "population_by_group": {
            "white": tx_white,
            "black": tx_black,
            "hispanic": tx_hisp,
            "asian": tx_asian,
            "other": int(tx_other),
        },
        "vap_by_group": {
            "white": int(tx["WVAP"].sum()),
            "black": int(tx["BVAP"].sum()),
            "hispanic": int(tx["HISPVAP"].sum()),
            "asian": tx_asian_vap,
            "other": int(tx["OTHVAP"].sum()),
        },
        "presidential_2024": {
            "dem_votes": tx_d_pres,
            "rep_votes": tx_r_pres,
            "total_votes": tx_total_pres,
            "dem_pct": round(tx_d_pres / tx_total_pres * 100, 1) if tx_total_pres else 0,
            "rep_pct": round(tx_r_pres / tx_total_pres * 100, 1) if tx_total_pres else 0,
        },
        "num_congressional_districts": reps["TX"]["total_districts"],
        "party_split": reps["TX"]["party_split"],
        "feasible_demographic_groups": [],
    }
    for group, pop in tx_summary["population_by_group"].items():
        if pop > 400_000:
            tx_summary["feasible_demographic_groups"].append(group)

    out_tx = os.path.join(SUMMARY_DIR, "tx_state_summary.json")
    with open(out_tx, "w") as f:
        json.dump(tx_summary, f, indent=2)
    report(f"TX summary written: {out_tx}")
    report(f"  Population: {tx_pop:,} | VAP: {tx_vap:,}")
    report(f"  Asian: {tx_asian:,} ({tx_asian_vap:,} VAP)")
    report(f"  Feasible groups: {tx_summary['feasible_demographic_groups']}")


# =========================================================================
# STEP 8: Gingles Precinct Analysis
# =========================================================================
def step8_gingles_precinct(ma, tx):
    print("\n" + "=" * 70)
    print("STEP 8: Gingles Precinct Analysis")
    print("=" * 70)

    def compute_gingles_data(gdf, state_abbr, group_cols, name_col="NAME", id_col=None):
        """Compute per-precinct D vote share and minority VAP % for each group.

        group_cols: dict mapping group name -> vap column name
        name_col: column with precinct name
        id_col: column with unique precinct identifier (for map highlight)
        """
        result = {}
        pres_d = gdf["G24PREDHAR"].values.astype(float)
        pres_r = gdf["G24PRERTRU"].values.astype(float)
        total_pres = pres_d + pres_r

        # Filter precincts with at least some votes
        has_votes = total_pres > 0
        d_share = np.zeros(len(gdf))
        d_share[has_votes] = pres_d[has_votes] / total_pres[has_votes]

        total_vap = gdf["VAP"].values.astype(float)
        total_pop = gdf["TOTPOP"].values.astype(float)
        has_vap = total_vap > 0

        valid = has_votes & has_vap

        # Get precinct names and unique IDs
        if name_col and name_col in gdf.columns:
            names = gdf[name_col].values
        else:
            names = [f"Precinct {i+1}" for i in range(len(gdf))]

        if id_col and id_col in gdf.columns:
            ids = gdf[id_col].astype(str).values
        else:
            ids = [str(n) for n in names]

        for group_name, vap_col in group_cols.items():
            if vap_col not in gdf.columns:
                report(f"  Skipping {group_name}: column {vap_col} not found")
                continue

            minority_vap = gdf[vap_col].values.astype(float)
            minority_pct = np.zeros(len(gdf))
            minority_pct[has_vap] = minority_vap[has_vap] / total_vap[has_vap]

            # Build scatter data (only for precincts with votes and VAP)
            mask = valid
            data_points = []
            for i in np.where(mask)[0]:
                data_points.append({
                    "precinct_id": ids[i],
                    "name": str(names[i]),
                    "total_pop": int(total_pop[i]),
                    "minority_pop": int(minority_vap[i]),
                    "minority_vap_pct": round(float(minority_pct[i]), 4),
                    "d_vote_share": round(float(d_share[i]), 4),
                })

            result[group_name] = data_points
            report(f"  {state_abbr} {group_name}: {len(data_points)} precincts")

        return result

    # MA groups
    ma_groups = {
        "hispanic": "HVAP",
        "black": "BVAP",
        "asian": "ASIANVAP",
    }
    ma_data = compute_gingles_data(ma, "MA", ma_groups, name_col="NAME", id_col="NAME")
    out_ma = os.path.join(ANALYSIS_DIR, "ma_gingles_precinct.json")
    with open(out_ma, "w") as f:
        json.dump(ma_data, f)
    report(f"MA Gingles precinct data written: {out_ma}")

    # TX groups
    tx_groups = {
        "hispanic": "HISPVAP",
        "black": "BVAP",
    }
    if "ASIANVAP" in tx.columns and tx["ASIANVAP"].sum() > 0:
        tx_groups["asian"] = "ASIANVAP"

    tx_data = compute_gingles_data(tx, "TX", tx_groups, name_col="COUNTY", id_col="CNTYVTD")
    out_tx = os.path.join(ANALYSIS_DIR, "tx_gingles_precinct.json")
    with open(out_tx, "w") as f:
        json.dump(tx_data, f)
    report(f"TX Gingles precinct data written: {out_tx}")


# =========================================================================
# STEP 9: Gingles Regression Curves
# =========================================================================
def step9_gingles_regression():
    print("\n" + "=" * 70)
    print("STEP 9: Gingles Regression Curves")
    print("=" * 70)

    for state in ["ma", "tx"]:
        precinct_path = os.path.join(ANALYSIS_DIR, f"{state}_gingles_precinct.json")
        if not os.path.exists(precinct_path):
            report(f"Skipping {state.upper()}: no precinct data found")
            continue

        with open(precinct_path) as f:
            precinct_data = json.load(f)

        regression_data = {}
        for group_name, points in precinct_data.items():
            if len(points) < 20:
                report(f"  {state.upper()} {group_name}: too few points ({len(points)}), skipping")
                continue

            x = np.array([p["minority_vap_pct"] for p in points])
            y = np.array([p["d_vote_share"] for p in points])

            x_fit, y_fit = lowess_or_spline(x, y, n_points=200)

            curve_points = []
            for xi, yi in zip(x_fit, y_fit):
                curve_points.append({
                    "x": round(float(xi), 4),
                    "y": round(float(yi), 4),
                })
            regression_data[group_name] = curve_points
            report(f"  {state.upper()} {group_name}: {len(curve_points)} regression points")

        out_path = os.path.join(ANALYSIS_DIR, f"{state}_gingles_regression.json")
        with open(out_path, "w") as f:
            json.dump(regression_data, f)
        report(f"{state.upper()} Gingles regression written: {out_path}")


# =========================================================================
# STEP 10: Congressional Vote Margins
# =========================================================================
def step10_vote_margins(ma, tx):
    print("\n" + "=" * 70)
    print("STEP 10: Congressional Vote Margins")
    print("=" * 70)

    with open(REPS_FILE, "r") as f:
        reps = json.load(f)

    def compute_margins(gdf, state_abbr, n_districts):
        """Compute district vote margins from 2024 presidential columns."""
        margins = {}

        if "CONG_DIST" not in gdf.columns:
            report(f"  {state_abbr}: No CONG_DIST column found")
            return margins

        d_cols = [c for c in gdf.columns if c.startswith("G24PRED")]
        r_cols = [c for c in gdf.columns if c.startswith("G24PRER")]
        if not d_cols and not r_cols:
            report(f"  {state_abbr}: No G24PRE D/R columns found")
            return margins

        valid = gdf[gdf["CONG_DIST"].astype(str).str.strip() != ""].copy()
        if valid.empty:
            report(f"  {state_abbr}: No rows with CONG_DIST values")
            return margins

        valid["_cd"] = (
            valid["CONG_DIST"].astype(str).str.strip().str.lstrip("0").replace("", "0")
        )

        for dist_num in range(1, n_districts + 1):
            district_rows = valid[valid["_cd"] == str(dist_num)]
            dem_votes = sum(int(district_rows[c].fillna(0).sum()) for c in d_cols)
            rep_votes = sum(int(district_rows[c].fillna(0).sum()) for c in r_cols)
            total_votes = dem_votes + rep_votes

            if total_votes > 0:
                margin = abs(dem_votes - rep_votes) / total_votes * 100
                winner = "D" if dem_votes > rep_votes else "R"
            else:
                margin = 0
                winner = "N/A"

            margins[dist_num] = {
                "dem_votes": dem_votes,
                "rep_votes": rep_votes,
                "total_votes": total_votes,
                "vote_margin_pct": round(margin, 1),
                "winner": winner,
            }
            report(f"  {state_abbr}-{dist_num:02d}: D={dem_votes:,} R={rep_votes:,} margin={margin:.1f}% ({winner})")

        return margins

    ma_margins = compute_margins(ma, "MA", reps["MA"]["total_districts"])
    tx_margins = compute_margins(tx, "TX", reps["TX"]["total_districts"])

    # Update congressional_reps.json
    for state_abbr, margins in [("MA", ma_margins), ("TX", tx_margins)]:
        for rep_entry in reps[state_abbr]["representatives"]:
            dist = rep_entry["district"]
            if dist in margins:
                m = margins[dist]
                rep_entry["dem_votes"] = m["dem_votes"]
                rep_entry["rep_votes"] = m["rep_votes"]
                rep_entry["total_votes"] = m["total_votes"]
                rep_entry["vote_margin_pct"] = m["vote_margin_pct"]
            else:
                # No district-level senate totals available
                rep_entry["dem_votes"] = 0
                rep_entry["rep_votes"] = 0
                rep_entry["total_votes"] = 0
                rep_entry["vote_margin_pct"] = 0.0
                report(f"  {state_abbr}-{dist:02d}: Missing district totals")

    with open(REPS_FILE, "w") as f:
        json.dump(reps, f, indent=2)
    report(f"Updated {REPS_FILE}")


# =========================================================================
# STEP 11: Precinct Adjacency
# =========================================================================
def step11_adjacency(ma, tx):
    print("\n" + "=" * 70)
    print("STEP 11: Precinct Adjacency")
    print("=" * 70)

    def compute_adjacency_strtree(gdf, buffer_dist=61.0):
        """Compute adjacency using shapely STRtree with buffer for near-neighbors.

        buffer_dist: distance in CRS units for near-neighbor detection.
        """
        geoms = gdf.geometry.values
        n = len(geoms)

        # Build spatial index
        tree = STRtree(geoms)

        adjacency = {}
        for i in range(n):
            if geoms[i] is None:
                adjacency[i] = []
                continue

            # Query with buffered geometry for near-neighbors
            buffered = geoms[i].buffer(buffer_dist)
            candidates = tree.query(buffered)

            neighbors = []
            for j in candidates:
                if j == i:
                    continue
                # Check if geometries touch/intersect or are within buffer distance
                if geoms[i].intersects(geoms[j]) or geoms[i].distance(geoms[j]) <= buffer_dist:
                    neighbors.append(int(j))

            adjacency[i] = sorted(neighbors)

        return adjacency

    def compute_adjacency_libpysal(gdf):
        """Compute Queen contiguity using libpysal."""
        w = libpysal.weights.Queen.from_dataframe(gdf, use_index=False)
        adjacency = {}
        for i in range(len(gdf)):
            adjacency[i] = sorted([int(j) for j in w.neighbors[i]])
        return adjacency

    for state, gdf, label in [("ma", ma, "MA precincts"), ("tx", tx, "TX VTDs")]:
        report(f"Computing adjacency for {label} ({len(gdf)} features)...")

        # Determine buffer distance based on CRS
        crs = gdf.crs
        if crs and crs.is_projected:
            buffer_dist = 61.0  # ~200ft in meters
        else:
            buffer_dist = 0.00055  # ~61m in degrees

        with timed(f"{label} adjacency"):
            if HAS_LIBPYSAL:
                report(f"  Using libpysal Queen contiguity")
                adj = compute_adjacency_libpysal(gdf)
            else:
                report(f"  Using shapely STRtree (buffer={buffer_dist})")
                adj = compute_adjacency_strtree(gdf, buffer_dist)

        # Convert keys to strings for JSON
        adj_json = {str(k): v for k, v in adj.items()}

        # Stats
        n_neighbors = [len(v) for v in adj.values()]
        isolated = sum(1 for v in adj.values() if len(v) == 0)
        avg_neighbors = np.mean(n_neighbors) if n_neighbors else 0
        report(f"  {label}: avg neighbors={avg_neighbors:.1f}, isolated={isolated}")

        out_path = os.path.join(ANALYSIS_DIR, f"{state}_adjacency.json")
        with open(out_path, "w") as f:
            json.dump(adj_json, f)
        report(f"  Written: {out_path}")


# =========================================================================
# STEP 12: Enacted Plan District Demographics
# =========================================================================
def step12_enacted_demographics(ma, tx):
    print("\n" + "=" * 70)
    print("STEP 12: Enacted Plan District Demographics")
    print("=" * 70)

    def compute_district_demographics(gdf, state_abbr, group_cols):
        """Aggregate VAP demographics by CONG_DIST.

        group_cols: dict mapping group name -> vap column name
        """
        if "CONG_DIST" not in gdf.columns:
            report(f"  {state_abbr}: No CONG_DIST column, skipping")
            return None

        # Filter out empty/missing CONG_DIST
        valid = gdf[gdf["CONG_DIST"].astype(str).str.strip() != ""].copy()
        valid["_cd"] = valid["CONG_DIST"].astype(str).str.strip().str.lstrip("0")

        districts = []
        for cd, group in valid.groupby("_cd"):
            district_num = int(cd) if cd.isdigit() else cd
            total_vap = int(group["VAP"].sum())

            groups = {}
            for group_name, vap_col in group_cols.items():
                if vap_col in group.columns:
                    vap = int(group[vap_col].sum())
                    pct = round(vap / total_vap * 100, 2) if total_vap > 0 else 0
                    groups[group_name] = {"vap": vap, "pct": pct}

            districts.append({
                "district": district_num,
                "total_vap": total_vap,
                "groups": groups,
            })

        # Sort by district number
        districts.sort(key=lambda d: d["district"])

        return {"districts": districts}

    # MA demographics
    ma_group_cols = {
        "hispanic": "HVAP",
        "black": "BVAP",
        "asian": "ASIANVAP",
        "white": "WVAP",
    }
    ma_demo = compute_district_demographics(ma, "MA", ma_group_cols)
    if ma_demo:
        out_ma = os.path.join(ANALYSIS_DIR, "ma_enacted_demographics.json")
        with open(out_ma, "w") as f:
            json.dump(ma_demo, f, indent=2)
        report(f"MA enacted demographics written: {out_ma} ({len(ma_demo['districts'])} districts)")

    # TX demographics
    tx_group_cols = {
        "hispanic": "HISPVAP",
        "black": "BVAP",
        "white": "WVAP",
    }
    if "ASIANVAP" in tx.columns and tx["ASIANVAP"].sum() > 0:
        tx_group_cols["asian"] = "ASIANVAP"

    tx_demo = compute_district_demographics(tx, "TX", tx_group_cols)
    if tx_demo:
        out_tx = os.path.join(ANALYSIS_DIR, "tx_enacted_demographics.json")
        with open(out_tx, "w") as f:
            json.dump(tx_demo, f, indent=2)
        report(f"TX enacted demographics written: {out_tx} ({len(tx_demo['districts'])} districts)")


# =========================================================================
# STEP 14: Census Block Heatmaps
# =========================================================================
def step14_block_heatmaps():
    print("\n" + "=" * 70)
    print("STEP 14: Census Block Heatmaps")
    print("=" * 70)

    os.makedirs(CLIENT_DATA_DIR, exist_ok=True)

    # --- MA blocks (split across 5 shapefiles — need P2 + P4) ---
    report("Reading MA census blocks...")
    ma_zip = RAW_FILES["ma_pl2020_b"]
    with timed("MA P2 (geometry + total pop)"):
        ma_p2 = pyogrio.read_dataframe(
            f"zip://{ma_zip}/ma_pl2020_p2_b.shp",
            columns=["GEOID20", "P0020001", "P0020002", "P0020005", "P0020006", "P0020008"],
            read_geometry=True,
        )
    with timed("MA P4 (VAP, no geometry)"):
        ma_p4 = pyogrio.read_dataframe(
            f"zip://{ma_zip}/ma_pl2020_p4_b.shp",
            columns=["GEOID20", "P0040001", "P0040002", "P0040005", "P0040006", "P0040008"],
            read_geometry=False,
        )
    report(f"MA P2: {len(ma_p2):,} rows, P4: {len(ma_p4):,} rows")

    ma_blocks = ma_p2.merge(ma_p4, on="GEOID20", how="left")
    del ma_p2, ma_p4

    _write_block_heatmap(
        ma_blocks, "MA", "ma_blocks_heatmap.geojson",
        tolerance=0.0001, grid_size=1e-5,
    )
    del ma_blocks
    gc.collect()

    # --- TX blocks (single shapefile with all tables) ---
    report("Reading TX census blocks...")
    tx_zip = RAW_FILES["tx_pl2020_b"]
    tx_cols = [
        "GEOID20",
        "P0020001", "P0020002", "P0020005", "P0020006", "P0020008",
        "P0040001", "P0040002", "P0040005", "P0040006", "P0040008",
    ]
    with timed("TX blocks (all columns in one read)"):
        tx_blocks = pyogrio.read_dataframe(
            f"zip://{tx_zip}",
            columns=tx_cols,
            read_geometry=True,
        )
    report(f"TX blocks: {len(tx_blocks):,} rows")

    _write_block_heatmap(
        tx_blocks, "TX", "tx_blocks_heatmap.geojson",
        tolerance=0.0002, grid_size=1e-5,
    )
    del tx_blocks
    gc.collect()


def _write_block_heatmap(gdf, state_label, out_name, tolerance, grid_size):
    """Reproject, simplify, and stream-write a block heatmap GeoJSON."""
    with timed(f"{state_label} reproject + simplify"):
        gdf = gdf.to_crs(epsg=4326)

        # Fix invalid geometries
        invalid_mask = ~gdf.geometry.is_valid
        n_invalid = invalid_mask.sum()
        if n_invalid > 0:
            gdf.loc[invalid_mask, "geometry"] = gdf.loc[invalid_mask, "geometry"].buffer(0)
            report(f"  Fixed {n_invalid} invalid geometries")

        # Simplify
        gdf["geometry"] = gdf["geometry"].simplify(tolerance=tolerance, preserve_topology=True)

        # Reduce precision
        gdf = reduce_precision(gdf, grid_size=grid_size)

    out_path = os.path.join(CLIENT_DATA_DIR, out_name)
    n_features = len(gdf)
    report(f"Stream-writing {n_features:,} features to {out_path}...")

    with open(out_path, "w") as f:
        f.write('{"type":"FeatureCollection","features":[')
        first = True
        for idx in range(n_features):
            row = gdf.iloc[idx]
            geom = row.geometry
            if geom is None or geom.is_empty:
                continue

            vap = int(row["P0040001"]) if pd.notna(row["P0040001"]) else 0
            pop = int(row["P0020001"]) if pd.notna(row["P0020001"]) else 0

            props = {
                "pop": pop,
                "vap": vap,
                "name": str(row["GEOID20"]),
                "hispanic": round(float(row["P0040002"]) / vap * 100, 1) if vap > 0 else 0,
                "black": round(float(row["P0040006"]) / vap * 100, 1) if vap > 0 else 0,
                "asian": round(float(row["P0040008"]) / vap * 100, 1) if vap > 0 else 0,
                "white": round(float(row["P0040005"]) / vap * 100, 1) if vap > 0 else 0,
            }

            geojson_geom = mapping(geom)
            feat = {"type": "Feature", "geometry": geojson_geom, "properties": props}

            if not first:
                f.write(",")
            json.dump(feat, f, separators=(",", ":"))
            first = False
        f.write("]}")

    size_mb = os.path.getsize(out_path) / 1e6
    report(f"{state_label} block heatmap: {size_mb:.1f} MB ({n_features:,} features)")


# =========================================================================
# STEP 13: Verification
# =========================================================================
def step13_verify():
    print("\n" + "=" * 70)
    print("STEP 13: Verification")
    print("=" * 70)

    ok = True

    # Check GerryChain shapefiles
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
        pres_col = "G24PREDHAR"
        if pres_col in gdf.columns:
            total = gdf[pres_col].sum()
            report(f"  {pres_col} total votes: {total:,}")

    # Check TX Asian enrichment
    tx_gdf = gpd.read_file(os.path.join(GERRYCHAIN_DIR, "tx_vtds.shp"))
    if "ASIAN" in tx_gdf.columns:
        tx_asian = tx_gdf["ASIAN"].sum()
        report(f"TX Asian total: {tx_asian:,}")
        if tx_asian == 0:
            report("  FAIL: TX Asian is still 0")
            ok = False
        else:
            report("  OK: TX Asian > 0")
    else:
        report("  FAIL: ASIAN column missing from TX shapefile")
        ok = False

    # Check GCON columns exist
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

    # Check GeoJSON file sizes
    for name, path, max_mb in [
        ("MA precincts GeoJSON", os.path.join(GEOJSON_DIR, "ma_precincts.geojson"), 10),
        ("TX VTDs GeoJSON", os.path.join(GEOJSON_DIR, "tx_vtds.geojson"), 30),
    ]:
        if os.path.exists(path):
            size_mb = os.path.getsize(path) / 1e6
            status = "OK" if size_mb <= max_mb else "WARNING: too large"
            report(f"{name}: {size_mb:.1f} MB ({status})")
            if size_mb > max_mb:
                ok = False
        else:
            report(f"{name}: MISSING")
            ok = False

    # Check block heatmap files
    for name, path, min_mb, max_mb in [
        ("MA block heatmap", os.path.join(CLIENT_DATA_DIR, "ma_blocks_heatmap.geojson"), 5, 100),
        ("TX block heatmap", os.path.join(CLIENT_DATA_DIR, "tx_blocks_heatmap.geojson"), 30, 500),
    ]:
        if os.path.exists(path):
            size_mb = os.path.getsize(path) / 1e6
            status = "OK" if min_mb <= size_mb <= max_mb else "WARNING: unexpected size"
            report(f"{name}: {size_mb:.1f} MB ({status})")
            if size_mb < min_mb or size_mb > max_mb:
                ok = False
        else:
            report(f"{name}: MISSING")
            ok = False

    # Check congressional district GeoJSON has `district` property
    for name, path in [
        ("MA CD GeoJSON", os.path.join(GEOJSON_DIR, "ma_congressional_districts.geojson")),
        ("TX CD GeoJSON", os.path.join(GEOJSON_DIR, "tx_congressional_districts.geojson")),
    ]:
        gdf = gpd.read_file(path)
        has_district = "district" in gdf.columns
        report(f"{name}: {len(gdf)} features, has 'district'={has_district}")
        if not has_district:
            report(f"  FAIL: missing 'district' property")
            ok = False

    # Check analysis files exist
    analysis_files = [
        "ma_gingles_precinct.json", "tx_gingles_precinct.json",
        "ma_gingles_regression.json", "tx_gingles_regression.json",
        "ma_adjacency.json", "tx_adjacency.json",
        "ma_enacted_demographics.json", "tx_enacted_demographics.json",
    ]
    for fname in analysis_files:
        path = os.path.join(ANALYSIS_DIR, fname)
        if os.path.exists(path):
            size = os.path.getsize(path)
            report(f"  {fname}: {size:,} bytes")
        else:
            report(f"  {fname}: MISSING")
            ok = False

    # Check vote margins in congressional_reps.json
    with open(REPS_FILE) as f:
        reps = json.load(f)
    for state_abbr in ["MA", "TX"]:
        has_margins = all(
            "vote_margin_pct" in r
            for r in reps[state_abbr]["representatives"]
        )
        report(f"{state_abbr} vote margins in reps: {'OK' if has_margins else 'MISSING'}")
        if not has_margins:
            ok = False

    # Check summary JSON files
    for name, path in [
        ("MA summary", os.path.join(SUMMARY_DIR, "ma_state_summary.json")),
        ("TX summary", os.path.join(SUMMARY_DIR, "tx_state_summary.json")),
    ]:
        with open(path) as f:
            data = json.load(f)
        report(f"{name}: pop={data['total_population']:,}, "
               f"districts={data['num_congressional_districts']}, "
               f"feasible={data['feasible_demographic_groups']}")
        if data.get("population_by_group", {}).get("asian", 0) == 0 and "TX" in name:
            report(f"  WARNING: TX Asian still 0 in summary")
            ok = False

    if ok:
        report("\nAll checks passed!")
    else:
        report("\nSome checks had warnings — review above.")

    return ok


# =========================================================================
# Main
# =========================================================================
def main():
    print("=" * 70)
    print("Data Cleaning Pipeline")
    print("=" * 70)

    t_start = time.time()

    # Check all raw files exist
    for key, path in RAW_FILES.items():
        if not os.path.exists(path):
            print(f"ERROR: Missing raw file: {path}")
            sys.exit(1)
    print("All raw files found.")

    # Report optional dependencies
    report(f"scipy: {'available' if HAS_SCIPY else 'NOT AVAILABLE'}")
    report(f"statsmodels LOWESS: {'available' if HAS_LOWESS else 'NOT AVAILABLE (using scipy fallback)'}")
    report(f"libpysal: {'available' if HAS_LIBPYSAL else 'NOT AVAILABLE (using STRtree fallback)'}")

    # --- Core data merging ---
    ma = step1_ma_precincts()
    tx = step2_tx_vtds()

    # --- TX-specific fixes ---
    tx = step3_fix_tx_geometries(tx)
    tx = step4_enrich_tx_asian(tx)

    # --- Output formatting ---
    step5_congressional_districts()
    step6_web_geojson(ma, tx)
    step7_state_summaries(ma, tx)

    # --- Analysis ---
    step8_gingles_precinct(ma, tx)
    step9_gingles_regression()
    step10_vote_margins(ma, tx)
    step11_adjacency(ma, tx)
    step12_enacted_demographics(ma, tx)

    # --- Generate lightweight heatmap GeoJSON for client ---
    print("\nGenerating heatmap GeoJSON for client...")
    os.makedirs(CLIENT_DATA_DIR, exist_ok=True)
    heatmap_configs = [
        ("MA precincts", os.path.join(GEOJSON_DIR, "ma_precincts.geojson"),
         "ma_precincts_heatmap.geojson",
         {"hispanic": "HVAP", "black": "BVAP", "asian": "ASIANVAP", "white": "WVAP"},
         "NAME", "NAME"),
        ("TX VTDs", os.path.join(GEOJSON_DIR, "tx_vtds.geojson"),
         "tx_vtds_heatmap.geojson",
         {"hispanic": "HISPVAP", "black": "BVAP", "asian": "ASIANVAP", "white": "WVAP"},
         "COUNTY", "CNTYVTD"),
    ]
    for label, src_path, out_name, group_cols, name_col, id_col in heatmap_configs:
        with open(src_path) as f:
            src_data = json.load(f)
        new_feats = []
        for feat in src_data["features"]:
            props = feat["properties"]
            vap = float(props.get("VAP", 0))
            new_props = {"pop": int(props.get("TOTPOP", 0)), "vap": int(vap)}
            if name_col and name_col in props:
                new_props["name"] = props[name_col]
            if id_col and id_col in props:
                new_props["precinct_id"] = str(props[id_col])
            for gk, vc in group_cols.items():
                gv = float(props.get(vc, 0))
                new_props[gk] = round(gv / vap * 100, 1) if vap > 0 else 0
            new_feats.append({"type": "Feature", "geometry": feat["geometry"],
                              "properties": new_props})
        out_path = os.path.join(CLIENT_DATA_DIR, out_name)
        with open(out_path, "w") as f:
            json.dump({"type": "FeatureCollection", "features": new_feats},
                      f, separators=(",", ":"))
        sz = os.path.getsize(out_path) / 1e6
        report(f"{label} heatmap: {sz:.1f} MB -> {out_path}")

    # --- Block-level heatmaps from Census PL2020 ---
    step14_block_heatmaps()

    # --- Copy analysis data to client/public/data/ ---
    print("\nCopying analysis data to client...")
    for src_file in [
        os.path.join(SUMMARY_DIR, "ma_state_summary.json"),
        os.path.join(SUMMARY_DIR, "tx_state_summary.json"),
        REPS_FILE,
        os.path.join(ANALYSIS_DIR, "ma_gingles_precinct.json"),
        os.path.join(ANALYSIS_DIR, "tx_gingles_precinct.json"),
        os.path.join(ANALYSIS_DIR, "ma_gingles_regression.json"),
        os.path.join(ANALYSIS_DIR, "tx_gingles_regression.json"),
        os.path.join(ANALYSIS_DIR, "ma_enacted_demographics.json"),
        os.path.join(ANALYSIS_DIR, "tx_enacted_demographics.json"),
    ]:
        shutil.copy2(src_file, CLIENT_DATA_DIR)
        report(f"  -> {os.path.basename(src_file)}")

    # --- Verification ---
    step13_verify()

    # Clean up temp directory
    shutil.rmtree(TMP_DIR, ignore_errors=True)
    print("\nTemp files cleaned up.")

    elapsed = time.time() - t_start
    print(f"\nDone! Total time: {elapsed:.0f}s")


if __name__ == "__main__":
    main()
