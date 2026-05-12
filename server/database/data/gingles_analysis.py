#!/usr/bin/env python3
"""
Data cleaning pipeline for redistricting project.

Each step lives in its own module under clean/.  This file just wires them
together — no business logic.

Usage:
    python clean_data.py
"""

import os
import shutil
import sys
import time
import warnings

warnings.filterwarnings("ignore")

from clean import (
    adjacency,
    block_heatmaps,
    client_outputs,
    congressional_districts,
    enacted_demographics,
    gingles,
    ma_precincts,
    state_summaries,
    tx_asian,
    tx_geometry,
    tx_vtds,
    verify,
    vote_margins,
    web_geojson,
)
from clean.deps import HAS_LIBPYSAL, HAS_LOWESS, HAS_SCIPY
from clean.helpers import report
from clean.paths import RAW_FILES, TMP_DIR, ensure_dirs


def check_raw_files():
    for path in RAW_FILES.values():
        if not os.path.exists(path):
            print(f"ERROR: Missing raw file: {path}")
            sys.exit(1)
    print("All raw files found.")


def report_optional_deps():
    report(f"scipy: {'available' if HAS_SCIPY else 'NOT AVAILABLE'}")
    report(f"statsmodels LOWESS: "
           f"{'available' if HAS_LOWESS else 'NOT AVAILABLE (using scipy fallback)'}")
    report(f"libpysal: "
           f"{'available' if HAS_LIBPYSAL else 'NOT AVAILABLE (using STRtree fallback)'}")


def clean_temp_dir():
    shutil.rmtree(TMP_DIR, ignore_errors=True)
    print("\nTemp files cleaned up.")


def main():
    print("=" * 70)
    print("Data Cleaning Pipeline")
    print("=" * 70)
    t_start = time.time()

    ensure_dirs()
    check_raw_files()
    report_optional_deps()

    ma = ma_precincts.run()
    tx = tx_vtds.run()
    tx = tx_geometry.run(tx)
    tx = tx_asian.run(tx)

    congressional_districts.run()
    web_geojson.run(ma, tx)
    state_summaries.run(ma, tx)

    gingles.run_precinct(ma, tx)
    gingles.run_regression()
    vote_margins.run(ma, tx)
    adjacency.run(ma, tx)
    enacted_demographics.run(ma, tx)

    client_outputs.write_precinct_heatmaps()
    block_heatmaps.run()
    client_outputs.copy_analysis_to_client()

    verify.run()
    clean_temp_dir()

    elapsed = time.time() - t_start
    print(f"\nDone! Total time: {elapsed:.0f}s")


if __name__ == "__main__":
    main()
