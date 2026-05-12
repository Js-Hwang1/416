import os

from .helpers import report
from .paths import GERRYCHAIN_DIR


def run(tx):
    print("\n" + "=" * 70)
    print("STEP 3: Fix Invalid TX Geometries")
    print("=" * 70)

    invalid_mask = ~tx.geometry.is_valid
    n_invalid = invalid_mask.sum()
    report(f"Invalid geometries found: {n_invalid}")

    if n_invalid == 0:
        return tx

    tx.loc[invalid_mask, "geometry"] = tx.loc[invalid_mask, "geometry"].buffer(0)
    still_invalid = (~tx.geometry.is_valid).sum()
    report(f"After buffer(0) fix: {still_invalid} still invalid")

    out_shp = os.path.join(GERRYCHAIN_DIR, "tx_vtds.shp")
    tx.to_file(out_shp)
    report("Shapefile re-written with fixed geometries")
    return tx
