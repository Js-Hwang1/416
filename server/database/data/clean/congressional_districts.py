import os

import geopandas as gpd

from .helpers import find_shapefile, report, unzip
from .paths import GEOJSON_DIR, RAW_FILES

_STATES = [("ma", "ma_cd", "25"), ("tx", "tx_cd", "48")]


def _load_districts(state, key, fips):
    cd_dir = unzip(RAW_FILES[key], f"tl_2023_{fips}_cd118")
    shp = find_shapefile(cd_dir)
    gdf = gpd.read_file(shp)
    report(f"{state.upper()} districts loaded: {len(gdf)}, CRS={gdf.crs}")
    return gdf


def _project_and_simplify(gdf, state):
    gdf = gdf.to_crs(epsg=4326)
    # MA is small enough at full resolution (~1.1MB); only simplify TX.
    if state == "tx":
        gdf["geometry"] = gdf["geometry"].simplify(
            tolerance=0.0003, preserve_topology=True
        )
    return gdf


def _select_and_rename(gdf):
    gdf = gdf[["CD118FP", "NAMELSAD", "GEOID", "geometry"]].copy()
    gdf = gdf.rename(columns={
        "CD118FP": "district_num",
        "NAMELSAD": "district_name",
        "GEOID": "geoid",
    })
    gdf["district"] = gdf["district_num"].astype(int).astype(str)
    return gdf.sort_values("district_num").reset_index(drop=True)


def _write_geojson(gdf, state):
    out_path = os.path.join(GEOJSON_DIR, f"{state}_congressional_districts.geojson")
    gdf.to_file(out_path, driver="GeoJSON")
    report(f"{state.upper()} districts GeoJSON written: {out_path}")


def _process_state(state, key, fips):
    gdf = _load_districts(state, key, fips)
    gdf = _project_and_simplify(gdf, state)
    gdf = _select_and_rename(gdf)
    _write_geojson(gdf, state)


def run():
    print("\n" + "=" * 70)
    print("STEP 5: Congressional District GeoJSON")
    print("=" * 70)
    for state, key, fips in _STATES:
        _process_state(state, key, fips)
