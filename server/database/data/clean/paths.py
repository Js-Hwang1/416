import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
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


def ensure_dirs():
    """Create every output directory if missing."""
    for d in [GERRYCHAIN_DIR, GEOJSON_DIR, SUMMARY_DIR, ANALYSIS_DIR, TMP_DIR]:
        os.makedirs(d, exist_ok=True)
