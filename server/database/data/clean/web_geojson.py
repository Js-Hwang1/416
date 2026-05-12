import os

from .helpers import reduce_precision, report, timed
from .paths import GEOJSON_DIR


def _build_web_geojson(gdf, tolerance):
    web = gdf.to_crs(epsg=4326)
    web["geometry"] = web["geometry"].simplify(
        tolerance=tolerance, preserve_topology=True
    )
    return reduce_precision(web, grid_size=1e-6)


def _write_one(label, gdf, filename, tolerance):
    with timed(f"Simplifying {label}"):
        web = _build_web_geojson(gdf, tolerance)
        out_path = os.path.join(GEOJSON_DIR, filename)
        web.to_file(out_path, driver="GeoJSON")
        size_mb = os.path.getsize(out_path) / 1e6
        report(f"{label} GeoJSON: {size_mb:.1f} MB -> {out_path}")


def run(ma, tx):
    print("\n" + "=" * 70)
    print("STEP 6: Simplified Web GeoJSON")
    print("=" * 70)
    _write_one("MA precincts", ma, "ma_precincts.geojson", 0.0003)
    _write_one("TX VTDs", tx, "tx_vtds.geojson", 0.0008)
