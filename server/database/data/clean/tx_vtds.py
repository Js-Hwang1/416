import os

import geopandas as gpd

from .helpers import find_shapefile, report, unzip
from .paths import GERRYCHAIN_DIR, RAW_FILES


def _load_mggg_base():
    tx_mggg_dir = unzip(RAW_FILES["tx_mggg"], "TX_vtds")
    shp = find_shapefile(tx_mggg_dir)
    mggg = gpd.read_file(shp)
    report(f"MGGG loaded: {len(mggg)} VTDs, CRS={mggg.crs}")
    return mggg


def _load_2024_election_data():
    tx_2024_dir = unzip(RAW_FILES["tx_2024"], "tx_2024_gen_tx_vtd")
    shp_all = find_shapefile(os.path.join(tx_2024_dir, "tx_2024_gen_all_tx_vtd"))
    elec = gpd.read_file(shp_all)
    report(f"2024 election (all) loaded: {len(elec)} rows, CRS={elec.crs}")

    shp_cong = find_shapefile(os.path.join(tx_2024_dir, "tx_2024_gen_cong_tx_vtd"))
    elec_cong = gpd.read_file(shp_cong)
    report(f"2024 election (cong) loaded: {len(elec_cong)} rows")
    return elec, elec_cong


def _build_join_keys(mggg, elec, elec_cong):
    mggg["_fips_str"] = mggg["FIPS"].astype(str).str.zfill(3)
    mggg["_join_key"] = mggg["_fips_str"] + "|" + mggg["VTD"].str.strip()
    elec["_join_key"] = elec["COUNTYFP"].str.strip() + "|" + elec["TX_VTD"].str.strip()
    elec_cong["_join_key"] = (
        elec_cong["COUNTYFP"].str.strip() + "|" + elec_cong["TX_VTD"].str.strip()
    )


def _aggregate_election(elec, elec_cols):
    """Sum votes for VTDs that appear multiple times (split across leg districts)."""
    if elec.groupby("_join_key").ngroups < len(elec):
        report("Aggregating duplicate VTDs in 'all' data...")
        return elec.groupby("_join_key")[elec_cols].sum().reset_index()
    report("No duplicate VTDs in 'all' data")
    return elec[["_join_key"] + elec_cols].copy()


def _attribute_join(mggg, elec_agg):
    return mggg.join(elec_agg.set_index("_join_key"), on="_join_key", how="left")


def _spatial_fallback(merged, elec, elec_cols, matched_attr):
    unmatched_mask = merged[elec_cols[0]].isna()
    n_unmatched = unmatched_mask.sum()
    if n_unmatched == 0:
        return merged

    report(f"Attempting spatial join for {n_unmatched} unmatched VTDs...")
    elec_reproj = elec.to_crs(merged.crs)
    centroids = merged[unmatched_mask].copy()
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
    return merged


def _join_cong_district(merged, elec_cong):
    cong_dedup = elec_cong.drop_duplicates(subset="_join_key", keep="first")
    cong_lookup = cong_dedup.set_index("_join_key")[["CONG_DIST"]]
    merged = merged.join(cong_lookup, on="_join_key", how="left")
    cong_matched = merged["CONG_DIST"].notna().sum()
    report(f"CONG_DIST matched: {cong_matched}/{len(merged)}")

    if "USCD" in merged.columns:
        no_cong = merged["CONG_DIST"].isna() | (merged["CONG_DIST"] == "")
        merged.loc[no_cong, "CONG_DIST"] = (
            merged.loc[no_cong, "USCD"].astype(str).str.zfill(2)
        )
        report(f"CONG_DIST after USCD fallback: "
               f"{merged['CONG_DIST'].notna().sum()}/{len(merged)}")
    return merged


def _fill_unmatched(merged, elec_cols):
    for col in elec_cols:
        merged[col] = merged[col].fillna(0).astype(int)
    if "CONG_DIST" in merged.columns:
        merged["CONG_DIST"] = merged["CONG_DIST"].fillna("")
    return merged.drop(columns=["_join_key", "_fips_str"])


def _write_shapefile(merged):
    out_shp = os.path.join(GERRYCHAIN_DIR, "tx_vtds.shp")
    merged.to_file(out_shp)
    report(f"Shapefile written: {out_shp}")


def run():
    print("\n" + "=" * 70)
    print("STEP 2: TX Merged VTDs")
    print("=" * 70)

    mggg = _load_mggg_base()
    elec, elec_cong = _load_2024_election_data()
    _build_join_keys(mggg, elec, elec_cong)

    elec_cols = [c for c in elec.columns if c.startswith("G24") or c.startswith("GCON")]
    elec_agg = _aggregate_election(elec, elec_cols)

    merged = _attribute_join(mggg, elec_agg)
    matched_attr = merged[elec_cols[0]].notna().sum()
    report(f"Attribute join: {matched_attr}/{len(mggg)} matched "
           f"({100*matched_attr/len(mggg):.1f}%)")

    merged = _spatial_fallback(merged, elec, elec_cols, matched_attr)
    total_matched = merged[elec_cols[0]].notna().sum()
    report(f"Total matched: {total_matched}/{len(mggg)} "
           f"({100*total_matched/len(mggg):.1f}%)")

    merged = _join_cong_district(merged, elec_cong)
    merged = _fill_unmatched(merged, elec_cols)
    _write_shapefile(merged)
    return merged
