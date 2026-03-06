#!/usr/bin/env python3
"""
Populate MongoDB (tigers-db) with redistricting data.

Collections created:
  - states          (2 docs)
  - analysisData    (2 docs)
  - precinctHeatmaps (precinct attributes without geometry)

Usage:
  python populate_database.py            # insert (skip if exists)
  python populate_database.py --drop     # drop all collections first
"""

import argparse
import json
import os
import sys

from pymongo import MongoClient, ASCENDING
from pymongo.errors import BulkWriteError

# ── Paths ────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CLIENT_DATA = os.path.join(BASE_DIR, "..", "..", "client", "public", "data")
CLEANED_DIR = os.path.join(BASE_DIR, "data", "cleaned")
SUMMARY_DIR = os.path.join(CLEANED_DIR, "summary")

MONGO_URI = "mongodb://localhost:27017/tigers-db"
DB_NAME = "tigers-db"

STATES = [
    {
        "abbr": "MA",
        "name": "Massachusetts",
        "summary_file": "ma_state_summary.json",
        "reps_key": "MA",
        "prefix": "ma",
        "heatmap_file": "ma_precincts_heatmap.geojson",
    },
    {
        "abbr": "TX",
        "name": "Texas",
        "summary_file": "tx_state_summary.json",
        "reps_key": "TX",
        "prefix": "tx",
        "heatmap_file": "tx_vtds_heatmap.geojson",
    },
]

ANALYSIS_FILES = {
    "ginglesPrecinct": "{prefix}_gingles_precinct.json",
    "ginglesRegression": "{prefix}_gingles_regression.json",
    "enactedDemographics": "{prefix}_enacted_demographics.json",
    "ensembleBar": "{prefix}_ensemble_bar.json",
    "ensembleBox": "{prefix}_ensemble_box.json",
    "eiCurves": "{prefix}_ei_curves.json",
    "eiKde": "{prefix}_ei_kde.json",
    "eiSummary": "{prefix}_ei_summary.json",
    "voteSeat": "{prefix}_vote_seat.json",
}


def load_json(path):
    with open(path, "r") as f:
        return json.load(f)


def report(msg):
    print(f"  [+] {msg}")


def populate_states(db):
    """Insert state summary + congressional rep data."""
    coll = db["states"]
    if coll.count_documents({}) > 0:
        report("states collection already populated, skipping")
        return

    reps_path = os.path.join(CLIENT_DATA, "congressional_reps.json")
    all_reps = load_json(reps_path)

    docs = []
    for st in STATES:
        summary_path = os.path.join(CLIENT_DATA, st["summary_file"])
        summary = load_json(summary_path)
        reps_data = all_reps.get(st["reps_key"], {})

        doc = {
            "_id": st["abbr"],
            **summary,
            "representatives": reps_data.get("representatives", []),
        }
        docs.append(doc)

    coll.insert_many(docs)
    report(f"states: inserted {len(docs)} documents")


def populate_analysis(db):
    """Insert consolidated analysis data (one doc per state)."""
    coll = db["analysisData"]
    if coll.count_documents({}) > 0:
        report("analysisData collection already populated, skipping")
        return

    docs = []
    for st in STATES:
        doc = {"_id": st["abbr"], "stateAbbr": st["abbr"]}
        for field, pattern in ANALYSIS_FILES.items():
            filename = pattern.format(prefix=st["prefix"])
            filepath = os.path.join(CLIENT_DATA, filename)
            if os.path.exists(filepath):
                doc[field] = load_json(filepath)
            else:
                print(f"  [!] Missing: {filepath}")
                doc[field] = None
        docs.append(doc)

    coll.insert_many(docs)
    report(f"analysisData: inserted {len(docs)} documents")


def populate_precinct_heatmaps(db):
    """Insert precinct attributes (without geometry) from heatmap GeoJSON."""
    coll = db["precinctHeatmaps"]
    if coll.count_documents({}) > 0:
        report("precinctHeatmaps collection already populated, skipping")
        return

    total = 0
    for st in STATES:
        filepath = os.path.join(CLIENT_DATA, st["heatmap_file"])
        if not os.path.exists(filepath):
            print(f"  [!] Missing: {filepath}")
            continue

        geojson = load_json(filepath)
        features = geojson.get("features", [])
        batch = []
        for feat in features:
            props = feat.get("properties", {})
            doc = {
                "stateAbbr": st["abbr"],
                "name": props.get("name", ""),
                "pop": props.get("pop", 0),
                "vap": props.get("vap", 0),
                "hispanic": props.get("hispanic", 0),
                "black": props.get("black", 0),
                "asian": props.get("asian", 0),
                "white": props.get("white", 0),
            }
            batch.append(doc)

            if len(batch) >= 5000:
                try:
                    coll.insert_many(batch, ordered=False)
                except BulkWriteError:
                    pass
                total += len(batch)
                batch = []

        if batch:
            try:
                coll.insert_many(batch, ordered=False)
            except BulkWriteError:
                pass
            total += len(batch)

        report(f"precinctHeatmaps ({st['abbr']}): {len(features)} features")

    report(f"precinctHeatmaps total: {total} documents")


def populate_census_blocks(db):
    """Insert census block attributes (without geometry) from block heatmap GeoJSON."""
    coll = db["censusBlocks"]
    if coll.count_documents({}) > 0:
        report("censusBlocks collection already populated, skipping")
        return

    block_files = {
        "MA": os.path.join(CLIENT_DATA, "ma_blocks_heatmap.geojson"),
        "TX": os.path.join(CLIENT_DATA, "tx_blocks_heatmap.geojson"),
    }

    total = 0
    for abbr, filepath in block_files.items():
        if not os.path.exists(filepath):
            print(f"  [!] Block heatmap not found: {filepath} (run clean_data.py step14 first)")
            continue

        # Stream-parse large GeoJSON to avoid loading entire file into memory
        geojson = load_json(filepath)
        features = geojson.get("features", [])
        batch = []
        for feat in features:
            props = feat.get("properties", {})
            doc = {
                "stateAbbr": abbr,
                "geoid": props.get("geoid", props.get("GEOID20", "")),
                "pop": props.get("pop", 0),
                "vap": props.get("vap", 0),
                "hispanic": props.get("hispanic", 0),
                "black": props.get("black", 0),
                "asian": props.get("asian", 0),
                "white": props.get("white", 0),
            }
            batch.append(doc)

            if len(batch) >= 5000:
                try:
                    coll.insert_many(batch, ordered=False)
                except BulkWriteError:
                    pass
                total += len(batch)
                batch = []

        if batch:
            try:
                coll.insert_many(batch, ordered=False)
            except BulkWriteError:
                pass
            total += len(batch)

        report(f"censusBlocks ({abbr}): {len(features)} features")

    if total > 0:
        report(f"censusBlocks total: {total} documents")
    else:
        report("censusBlocks: no block heatmap files found (optional)")


def create_indexes(db):
    """Create indexes for query performance."""
    db["states"].create_index("abbreviation", unique=True, sparse=True)
    db["analysisData"].create_index("stateAbbr", unique=True)
    db["precinctHeatmaps"].create_index("stateAbbr")
    db["precinctHeatmaps"].create_index("name")
    db["censusBlocks"].create_index("stateAbbr")
    db["censusBlocks"].create_index("geoid", sparse=True)
    report("indexes created")


def main():
    parser = argparse.ArgumentParser(description="Populate MongoDB for redistricting app")
    parser.add_argument("--drop", action="store_true", help="Drop all collections first")
    args = parser.parse_args()

    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]

    if args.drop:
        for name in ["states", "analysisData", "precinctHeatmaps", "censusBlocks"]:
            db[name].drop()
        print("[*] Dropped all collections")

    print("[*] Populating MongoDB...")
    populate_states(db)
    populate_analysis(db)
    populate_precinct_heatmaps(db)
    populate_census_blocks(db)
    create_indexes(db)

    print("[*] Done!")
    print(f"    states:           {db['states'].count_documents({})} docs")
    print(f"    analysisData:     {db['analysisData'].count_documents({})} docs")
    print(f"    precinctHeatmaps: {db['precinctHeatmaps'].count_documents({})} docs")
    print(f"    censusBlocks:     {db['censusBlocks'].count_documents({})} docs")

    client.close()


if __name__ == "__main__":
    main()
