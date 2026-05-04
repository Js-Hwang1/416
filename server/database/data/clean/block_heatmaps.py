import gc
import json
import os

import pandas as pd
import pyogrio
from shapely.geometry import mapping

from .helpers import reduce_precision, report, timed
from .paths import CLIENT_DATA_DIR, RAW_FILES


def _read_ma_blocks():
    """MA blocks ship as separate P2 / P4 shapefiles inside one zip; merge them."""
    ma_zip = RAW_FILES["ma_pl2020_b"]
    with timed("MA P2 (geometry + total pop)"):
        ma_p2 = pyogrio.read_dataframe(
            f"zip://{ma_zip}/ma_pl2020_p2_b.shp",
            columns=["GEOID20", "P0020001", "P0020002", "P0020005",
                     "P0020006", "P0020008"],
            read_geometry=True,
        )
    with timed("MA P4 (VAP, no geometry)"):
        ma_p4 = pyogrio.read_dataframe(
            f"zip://{ma_zip}/ma_pl2020_p4_b.shp",
            columns=["GEOID20", "P0040001", "P0040002", "P0040005",
                     "P0040006", "P0040008"],
            read_geometry=False,
        )
    report(f"MA P2: {len(ma_p2):,} rows, P4: {len(ma_p4):,} rows")
    return ma_p2.merge(ma_p4, on="GEOID20", how="left")


def _read_tx_blocks():
    """TX blocks ship as one shapefile with all P2 + P4 columns."""
    tx_zip = RAW_FILES["tx_pl2020_b"]
    cols = [
        "GEOID20",
        "P0020001", "P0020002", "P0020005", "P0020006", "P0020008",
        "P0040001", "P0040002", "P0040005", "P0040006", "P0040008",
    ]
    with timed("TX blocks (all columns in one read)"):
        tx_blocks = pyogrio.read_dataframe(
            f"zip://{tx_zip}", columns=cols, read_geometry=True,
        )
    report(f"TX blocks: {len(tx_blocks):,} rows")
    return tx_blocks


def _fix_invalid_geometries(gdf):
    invalid_mask = ~gdf.geometry.is_valid
    n_invalid = invalid_mask.sum()
    if n_invalid > 0:
        gdf.loc[invalid_mask, "geometry"] = (
            gdf.loc[invalid_mask, "geometry"].buffer(0)
        )
        report(f"  Fixed {n_invalid} invalid geometries")
    return gdf


def _prepare_geojson(gdf, state_label, tolerance, grid_size):
    with timed(f"{state_label} reproject + simplify"):
        gdf = gdf.to_crs(epsg=4326)
        gdf = _fix_invalid_geometries(gdf)
        gdf["geometry"] = gdf["geometry"].simplify(
            tolerance=tolerance, preserve_topology=True
        )
        return reduce_precision(gdf, grid_size=grid_size)


def _block_props(row):
    vap = int(row["P0040001"]) if pd.notna(row["P0040001"]) else 0
    pop = int(row["P0020001"]) if pd.notna(row["P0020001"]) else 0
    return {
        "pop": pop,
        "vap": vap,
        "name": str(row["GEOID20"]),
        "hispanic": round(float(row["P0040002"]) / vap * 100, 1) if vap > 0 else 0,
        "black": round(float(row["P0040006"]) / vap * 100, 1) if vap > 0 else 0,
        "asian": round(float(row["P0040008"]) / vap * 100, 1) if vap > 0 else 0,
        "white": round(float(row["P0040005"]) / vap * 100, 1) if vap > 0 else 0,
    }


def _stream_geojson(gdf, out_path):
    """Stream features one-by-one to keep peak memory low on large datasets."""
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
            feat = {
                "type": "Feature",
                "geometry": mapping(geom),
                "properties": _block_props(row),
            }
            if not first:
                f.write(",")
            json.dump(feat, f, separators=(",", ":"))
            first = False
        f.write("]}")
    return n_features


def _write_block_heatmap(gdf, state_label, out_name, tolerance, grid_size):
    gdf = _prepare_geojson(gdf, state_label, tolerance, grid_size)
    out_path = os.path.join(CLIENT_DATA_DIR, out_name)
    n_features = _stream_geojson(gdf, out_path)
    size_mb = os.path.getsize(out_path) / 1e6
    report(f"{state_label} block heatmap: {size_mb:.1f} MB ({n_features:,} features)")


def _process_ma():
    report("Reading MA census blocks...")
    ma_blocks = _read_ma_blocks()
    _write_block_heatmap(
        ma_blocks, "MA", "ma_blocks_heatmap.geojson",
        tolerance=0.0001, grid_size=1e-5,
    )
    del ma_blocks
    gc.collect()


def _process_tx():
    report("Reading TX census blocks...")
    tx_blocks = _read_tx_blocks()
    _write_block_heatmap(
        tx_blocks, "TX", "tx_blocks_heatmap.geojson",
        tolerance=0.0002, grid_size=1e-5,
    )
    del tx_blocks
    gc.collect()


def run():
    print("\n" + "=" * 70)
    print("STEP 14: Census Block Heatmaps")
    print("=" * 70)
    os.makedirs(CLIENT_DATA_DIR, exist_ok=True)
    _process_ma()
    _process_tx()
