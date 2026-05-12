import os

import geopandas as gpd

from .helpers import find_shapefile, report, unzip
from .paths import GERRYCHAIN_DIR, RAW_FILES


def _load_mggg_base():
    ma_mggg_dir = unzip(RAW_FILES["ma_mggg"], "MA_precincts_12_16")
    shp = find_shapefile(ma_mggg_dir)
    mggg = gpd.read_file(shp)
    report(f"MGGG loaded: {len(mggg)} precincts, CRS={mggg.crs}")
    return mggg


def _load_2024_election():
    ma_2024_dir = unzip(RAW_FILES["ma_2024"], "ma_2024_gen_prec")
    shp_2024 = find_shapefile(os.path.join(ma_2024_dir, "ma_2024_gen_all_prec"))
    elec = gpd.read_file(shp_2024)
    report(f"2024 election loaded: {len(elec)} precincts, CRS={elec.crs}")
    return elec


def _build_join_keys(mggg, elec):
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


def _select_transfer_columns(elec):
    elec_cols = [c for c in elec.columns if c.startswith("G24") or c.startswith("GCON")]
    transfer_cols = elec_cols.copy()
    if "CONG_DIST" in elec.columns:
        transfer_cols.append("CONG_DIST")
    return elec_cols, transfer_cols


def _attribute_join(mggg, elec, transfer_cols):
    elec_dedup = elec.drop_duplicates(subset="_join_key", keep="first")
    elec_lookup = elec_dedup.set_index("_join_key")[transfer_cols]
    return mggg.join(elec_lookup, on="_join_key", how="left")


def _spatial_fallback(merged, elec, transfer_cols, elec_cols, matched_attr):
    unmatched_mask = merged[elec_cols[0]].isna()
    n_unmatched = unmatched_mask.sum()
    if n_unmatched == 0:
        return merged

    report(f"Attempting spatial join for {n_unmatched} unmatched precincts...")
    elec_reproj = elec.to_crs(merged.crs)
    centroids = merged[unmatched_mask].copy()
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
    return merged


def _fill_unmatched(merged, elec_cols):
    for col in elec_cols:
        merged[col] = merged[col].fillna(0).astype(int)
    if "CONG_DIST" in merged.columns:
        merged["CONG_DIST"] = merged["CONG_DIST"].fillna("")
    return merged.drop(columns=["_join_key"])


def _write_shapefile(merged):
    out_shp = os.path.join(GERRYCHAIN_DIR, "ma_precincts.shp")
    merged.to_file(out_shp)
    report(f"Shapefile written: {out_shp}")


def run():
    print("\n" + "=" * 70)
    print("STEP 1: MA Merged Precincts")
    print("=" * 70)

    mggg = _load_mggg_base()
    elec = _load_2024_election()

    _build_join_keys(mggg, elec)
    elec_cols, transfer_cols = _select_transfer_columns(elec)

    merged = _attribute_join(mggg, elec, transfer_cols)
    matched_attr = merged[elec_cols[0]].notna().sum()
    report(f"Attribute join: {matched_attr}/{len(mggg)} matched "
           f"({100*matched_attr/len(mggg):.1f}%)")

    merged = _spatial_fallback(merged, elec, transfer_cols, elec_cols, matched_attr)

    total_matched = merged[elec_cols[0]].notna().sum()
    report(f"Total matched: {total_matched}/{len(mggg)} "
           f"({100*total_matched/len(mggg):.1f}%)")

    merged = _fill_unmatched(merged, elec_cols)
    _write_shapefile(merged)
    return merged
