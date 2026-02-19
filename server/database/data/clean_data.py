#!/usr/bin/env python3
"""
Data cleaning pipeline for redistricting project.

Produces:
  - GerryChain shapefiles (MA precincts, TX VTDs) with demographics + 2024 elections
  - GeoJSON files for GUI display (precincts, VTDs, congressional districts)
  - State summary JSON for GUI dashboard

Usage:
    python clean_data.py
"""

import json
import os
import sys
import warnings
import zipfile

import geopandas as gpd
import pandas as pd

warnings.filterwarnings("ignore")

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

for d in [GERRYCHAIN_DIR, GEOJSON_DIR, SUMMARY_DIR, TMP_DIR]:
    os.makedirs(d, exist_ok=True)

# Raw zip files
RAW_FILES = {
    "ma_mggg": os.path.join(RAW_DIR, "MA_precincts_12_16.zip"),
    "ma_2024": os.path.join(RAW_DIR, "ma_2024_gen_prec.zip"),
    "tx_mggg": os.path.join(RAW_DIR, "TX_vtds.zip"),
    "tx_2024": os.path.join(RAW_DIR, "tx_2024_gen_tx_vtd.zip"),
    "ma_cd": os.path.join(RAW_DIR, "tl_2023_25_cd118.zip"),
    "tx_cd": os.path.join(RAW_DIR, "tl_2023_48_cd118.zip"),
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
    # MGGG: TOWN, WARD, PRECINCT
    # 2024: City/Town, Ward, Pct
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

    # Columns to transfer from 2024 election data
    elec_cols = [c for c in elec.columns if c.startswith("G24")]
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
        # Reproject 2024 data to MGGG CRS for spatial join
        elec_reproj = elec.to_crs(mggg.crs)

        unmatched = merged[unmatched_mask].copy()
        # Use centroid of MGGG precinct to find containing 2024 precinct
        centroids = unmatched.copy()
        centroids["geometry"] = centroids.geometry.centroid

        spatial = gpd.sjoin(
            centroids[["geometry"]],
            elec_reproj[["geometry"] + transfer_cols],
            how="left",
            predicate="within",
        )
        # Remove duplicates from spatial join (keep first match)
        spatial = spatial[~spatial.index.duplicated(keep="first")]

        for col in transfer_cols:
            if col in spatial.columns:
                merged.loc[unmatched_mask, col] = spatial[col].values

        matched_spatial = merged[elec_cols[0]].notna().sum() - matched_attr
        report(f"Spatial join: {matched_spatial} additional matches")

    total_matched = merged[elec_cols[0]].notna().sum()
    report(f"Total matched: {total_matched}/{len(mggg)} ({100*total_matched/len(mggg):.1f}%)")

    # Fill unmatched election columns with 0
    for col in elec_cols:
        merged[col] = merged[col].fillna(0).astype(int)
    if "CONG_DIST" in merged.columns:
        merged["CONG_DIST"] = merged["CONG_DIST"].fillna("")

    # Drop join key
    merged = merged.drop(columns=["_join_key"])

    # --- Output shapefile (keep original CRS for GerryChain) ---
    out_shp = os.path.join(GERRYCHAIN_DIR, "ma_precincts.shp")
    merged.to_file(out_shp)
    report(f"Shapefile written: {out_shp}")

    # --- Output GeoJSON (reproject to EPSG:4326) ---
    merged_4326 = merged.to_crs(epsg=4326)
    out_geojson = os.path.join(GEOJSON_DIR, "ma_precincts.geojson")
    merged_4326.to_file(out_geojson, driver="GeoJSON")
    report(f"GeoJSON written: {out_geojson}")

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

    # Load 2024 election data (use tx_2024_gen_all_tx_vtd subfolder)
    tx_2024_dir = unzip(RAW_FILES["tx_2024"], "tx_2024_gen_tx_vtd")
    shp_2024 = find_shapefile(os.path.join(tx_2024_dir, "tx_2024_gen_all_tx_vtd"))
    elec = gpd.read_file(shp_2024)
    report(f"2024 election loaded: {len(elec)} rows, CRS={elec.crs}")

    # Build join keys
    # MGGG: FIPS (int32, e.g. 1), VTD (str, e.g. '0001')
    # 2024: COUNTYFP (str, e.g. '001'), TX_VTD (str, e.g. '0001')
    # Normalize: zero-pad FIPS to 3 digits
    mggg["_fips_str"] = mggg["FIPS"].astype(str).str.zfill(3)
    mggg["_join_key"] = mggg["_fips_str"] + "|" + mggg["VTD"].str.strip()

    elec["_join_key"] = elec["COUNTYFP"].str.strip() + "|" + elec["TX_VTD"].str.strip()

    # Columns to transfer from 2024
    elec_cols = [c for c in elec.columns if c.startswith("G24")]
    transfer_cols = elec_cols.copy()

    # Aggregate if there are duplicate VTDs (VTDs split across legislative districts)
    if elec.groupby("_join_key").ngroups < len(elec):
        report("Aggregating duplicate VTDs...")
        elec_agg = elec.groupby("_join_key")[elec_cols].sum().reset_index()
    else:
        elec_agg = elec[["_join_key"] + elec_cols].copy()
        report("No duplicate VTDs found — no aggregation needed")

    # Attribute join
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

    # Fill unmatched election columns with 0
    for col in elec_cols:
        merged[col] = merged[col].fillna(0).astype(int)

    # Drop temp columns
    merged = merged.drop(columns=["_join_key", "_fips_str"])

    # --- Output shapefile (keep original CRS) ---
    out_shp = os.path.join(GERRYCHAIN_DIR, "tx_vtds.shp")
    merged.to_file(out_shp)
    report(f"Shapefile written: {out_shp}")

    # --- Output GeoJSON (reproject to EPSG:4326) ---
    merged_4326 = merged.to_crs(epsg=4326)
    out_geojson = os.path.join(GEOJSON_DIR, "tx_vtds.geojson")
    merged_4326.to_file(out_geojson, driver="GeoJSON")
    report(f"GeoJSON written: {out_geojson}")

    return merged


# =========================================================================
# STEP 3: Congressional District GeoJSON
# =========================================================================
def step3_congressional_districts():
    print("\n" + "=" * 70)
    print("STEP 3: Congressional District GeoJSON")
    print("=" * 70)

    for state, key, fips in [("ma", "ma_cd", "25"), ("tx", "tx_cd", "48")]:
        cd_dir = unzip(RAW_FILES[key], f"tl_2023_{fips}_cd118")
        shp = find_shapefile(cd_dir)
        gdf = gpd.read_file(shp)
        report(f"{state.upper()} districts loaded: {len(gdf)}, CRS={gdf.crs}")

        # Reproject to 4326 (already 4269 which is very close, but be explicit)
        gdf = gdf.to_crs(epsg=4326)

        # Simplify geometry for web performance
        gdf["geometry"] = gdf["geometry"].simplify(tolerance=0.001, preserve_topology=True)

        # Keep relevant columns
        gdf = gdf[["CD118FP", "NAMELSAD", "GEOID", "geometry"]].copy()
        gdf = gdf.rename(columns={
            "CD118FP": "district_num",
            "NAMELSAD": "district_name",
            "GEOID": "geoid",
        })

        # Sort by district number
        gdf = gdf.sort_values("district_num").reset_index(drop=True)

        out_path = os.path.join(GEOJSON_DIR, f"{state}_congressional_districts.geojson")
        gdf.to_file(out_path, driver="GeoJSON")
        report(f"{state.upper()} districts GeoJSON written: {out_path} ({len(gdf)} districts)")


# =========================================================================
# STEP 4: State Summary JSON
# =========================================================================
def step4_state_summaries(ma_merged, tx_merged):
    print("\n" + "=" * 70)
    print("STEP 4: State Summary JSON")
    print("=" * 70)

    with open(REPS_FILE, "r") as f:
        reps = json.load(f)

    # --- MA Summary ---
    ma = ma_merged
    ma_pop = int(ma["TOTPOP"].sum())
    ma_vap = int(ma["VAP"].sum())

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
        "num_congressional_districts": reps["MA"]["total_districts"],
        "party_split": reps["MA"]["party_split"],
        "feasible_demographic_groups": [],
    }
    # Feasible = population > 400,000
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
    tx = tx_merged
    tx_pop = int(tx["TOTPOP"].sum())
    tx_vap = int(tx["VAP"].sum())

    # TX MGGG has: WHITE, BLACK, HISPANIC, TOTPOP, VAP, WVAP, BVAP, HISPVAP, OTHVAP
    # No NH_ASIAN or NH_OTHER breakdown — compute "other" as remainder
    tx_white = int(tx["WHITE"].sum())
    tx_black = int(tx["BLACK"].sum())
    tx_hisp = int(tx["HISPANIC"].sum())
    tx_other = tx_pop - tx_white - tx_black - tx_hisp

    tx_summary = {
        "state": "Texas",
        "state_abbr": "TX",
        "total_population": tx_pop,
        "voting_age_population": tx_vap,
        "population_by_group": {
            "white": tx_white,
            "black": tx_black,
            "hispanic": tx_hisp,
            "asian": 0,  # Not available separately in MGGG TX data
            "other": int(tx_other),
        },
        "vap_by_group": {
            "white": int(tx["WVAP"].sum()),
            "black": int(tx["BVAP"].sum()),
            "hispanic": int(tx["HISPVAP"].sum()),
            "asian": 0,
            "other": int(tx["OTHVAP"].sum()),
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
    report(f"  Feasible groups: {tx_summary['feasible_demographic_groups']}")


# =========================================================================
# STEP 5: Verification
# =========================================================================
def step5_verify():
    print("\n" + "=" * 70)
    print("STEP 5: Verification")
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
        # Check election columns have non-zero totals
        pres_col = "G24PREDHAR"
        if pres_col in gdf.columns:
            total = gdf[pres_col].sum()
            report(f"  {pres_col} total votes: {total:,}")
            if total == 0:
                report(f"  WARNING: Zero total for {pres_col}")
                ok = False

    # Check GeoJSON files
    for name, path in [
        ("MA precincts GeoJSON", os.path.join(GEOJSON_DIR, "ma_precincts.geojson")),
        ("TX VTDs GeoJSON", os.path.join(GEOJSON_DIR, "tx_vtds.geojson")),
        ("MA CD GeoJSON", os.path.join(GEOJSON_DIR, "ma_congressional_districts.geojson")),
        ("TX CD GeoJSON", os.path.join(GEOJSON_DIR, "tx_congressional_districts.geojson")),
    ]:
        gdf = gpd.read_file(path)
        crs_ok = gdf.crs and gdf.crs.to_epsg() == 4326
        report(f"{name}: {len(gdf)} features, CRS=EPSG:{gdf.crs.to_epsg() if gdf.crs else 'None'} {'OK' if crs_ok else 'FAIL'}")
        if not crs_ok:
            ok = False

    # Check summary JSON files
    for name, path in [
        ("MA summary", os.path.join(SUMMARY_DIR, "ma_state_summary.json")),
        ("TX summary", os.path.join(SUMMARY_DIR, "tx_state_summary.json")),
    ]:
        with open(path) as f:
            data = json.load(f)
        report(f"{name}: pop={data['total_population']:,}, districts={data['num_congressional_districts']}, feasible={data['feasible_demographic_groups']}")

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

    # Check all raw files exist
    for key, path in RAW_FILES.items():
        if not os.path.exists(path):
            print(f"ERROR: Missing raw file: {path}")
            sys.exit(1)
    print("All raw files found.")

    ma_merged = step1_ma_precincts()
    tx_merged = step2_tx_vtds()
    step3_congressional_districts()
    step4_state_summaries(ma_merged, tx_merged)
    step5_verify()

    # Clean up temp directory
    import shutil
    shutil.rmtree(TMP_DIR, ignore_errors=True)
    print("\nTemp files cleaned up.")
    print("\nDone!")


if __name__ == "__main__":
    main()
