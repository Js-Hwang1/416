import os

import pyogrio

from .helpers import report, timed
from .paths import GERRYCHAIN_DIR, RAW_FILES


def _load_census_blocks():
    """Read NH Asian total + VAP from PL2020 block-level data."""
    with timed("Reading Census PL2020 block data"):
        blocks = pyogrio.read_dataframe(
            f"zip://{RAW_FILES['tx_pl2020_b']}",
            columns=["COUNTYFP20", "VTD", "P0020008", "P0040008"],
            read_geometry=False,
        )
    report(f"Loaded {len(blocks):,} census blocks")
    report(f"Statewide NH Asian total: {blocks['P0020008'].sum():,}")
    report(f"Statewide NH Asian VAP: {blocks['P0040008'].sum():,}")
    return blocks


def _aggregate_blocks_to_vtds(blocks):
    """Sum block-level Asian counts up to (county, VTD) pairs."""
    asian_by_vtd = (
        blocks.groupby(["COUNTYFP20", "VTD"])
        .agg(ASIAN=("P0020008", "sum"), ASIANVAP=("P0040008", "sum"))
        .reset_index()
    )
    report(f"Aggregated to {len(asian_by_vtd)} Census VTDs")
    asian_by_vtd["_asian_key"] = asian_by_vtd["COUNTYFP20"] + "|" + asian_by_vtd["VTD"]
    return asian_by_vtd


def _build_mapping_keys(tx):
    """Build the FIPS|CensusVTD key on each MGGG row.

    MGGG VTDs may have alpha suffixes (0001A/0001B) that map to one
    Census VTD, so we strip them before zero-padding to 6 chars.
    """
    tx["_fips_str"] = tx["FIPS"].astype(str).str.zfill(3)
    tx["_vtd_base"] = tx["VTD"].str.replace(r"[A-Za-z]+$", "", regex=True)
    tx["_census_vtd"] = tx["_vtd_base"].str.zfill(6)
    tx["_asian_key"] = tx["_fips_str"] + "|" + tx["_census_vtd"]


def _allocate_proportionally(tx, asian_lookup):
    """Join Asian counts and split proportionally by TOTPOP across split VTDs."""
    tx = tx.join(asian_lookup, on="_asian_key", how="left", rsuffix="_census")
    vtd_groups = tx.groupby("_asian_key")["TOTPOP"].transform("sum")
    proportion = tx["TOTPOP"] / vtd_groups.replace(0, 1)

    if "ASIAN_census" in tx.columns:
        tx["ASIAN"] = (tx["ASIAN_census"].fillna(0) * proportion).round().astype(int)
        tx["ASIANVAP"] = (
            tx["ASIANVAP_census"].fillna(0) * proportion
        ).round().astype(int)
        tx = tx.drop(columns=["ASIAN_census", "ASIANVAP_census"])
    else:
        tx["ASIAN"] = (tx["ASIAN"].fillna(0) * proportion).round().astype(int)
        tx["ASIANVAP"] = (tx["ASIANVAP"].fillna(0) * proportion).round().astype(int)
    return tx


def _drop_temp_columns(tx):
    return tx.drop(columns=["_fips_str", "_vtd_base", "_census_vtd", "_asian_key"])


def _write_shapefile(tx):
    out_shp = os.path.join(GERRYCHAIN_DIR, "tx_vtds.shp")
    tx.to_file(out_shp)
    report("Shapefile re-written with Asian demographics")


def run(tx):
    print("\n" + "=" * 70)
    print("STEP 4: Enrich TX with Asian Population (Census PL2020)")
    print("=" * 70)

    blocks = _load_census_blocks()
    asian_by_vtd = _aggregate_blocks_to_vtds(blocks)
    asian_lookup = asian_by_vtd.set_index("_asian_key")[["ASIAN", "ASIANVAP"]]

    _build_mapping_keys(tx)
    tx = _allocate_proportionally(tx, asian_lookup)
    tx = _drop_temp_columns(tx)

    total_asian = tx["ASIAN"].sum()
    total_asian_vap = tx["ASIANVAP"].sum()
    report(f"TX Asian total: {total_asian:,}")
    report(f"TX Asian VAP: {total_asian_vap:,}")
    if total_asian == 0:
        report("WARNING: Asian enrichment produced zero — check VTD code mapping")

    _write_shapefile(tx)
    return tx
