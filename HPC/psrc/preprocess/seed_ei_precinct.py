#!/usr/bin/env python3
"""
Seed synthetic EI precinct estimates into MongoDB for UI development.

Uses group-level EI summary data already in MongoDB to generate plausible
per-precinct estimates. Each precinct gets the group-level mean support
with small precinct-specific noise so the choropleth shows realistic
spatial variation.

Run: python3 seed_ei_precinct.py [--state MA|TX]

Replace with real HPC output by running run_ei.py --update-db.
"""

import argparse
import random
from pymongo import MongoClient

MONGO_URI = "mongodb://localhost:27017/tigers-db"
MONGO_DB = "tigers-db"

# Group-level EI posterior means from actual PyEI runs (fractions 0-1)
# Format: state -> group -> candidate -> mean support
EI_GROUP_MEANS = {
    "MA": {
        "White":    {"Harris (D)": 0.62, "Trump (R)": 0.38},
        "Black":    {"Harris (D)": 0.88, "Trump (R)": 0.12},
        "Hispanic": {"Harris (D)": 0.72, "Trump (R)": 0.28},
        "Asian":    {"Harris (D)": 0.75, "Trump (R)": 0.25},
    },
    "TX": {
        "White":    {"Harris (D)": 0.38, "Trump (R)": 0.62},
        "Black":    {"Harris (D)": 0.86, "Trump (R)": 0.14},
        "Hispanic": {"Harris (D)": 0.58, "Trump (R)": 0.42},
        "Asian":    {"Harris (D)": 0.60, "Trump (R)": 0.40},
    },
}

# Group property names in precinctGeoJson (stored as 0-100 percentages)
GEO_PROP_TO_GROUP = {
    "white": "White",
    "black": "Black",
    "hispanic": "Hispanic",
    "asian": "Asian",
}

CANDIDATES = ["Harris (D)", "Trump (R)"]


def build_precinct_estimates(state: str, features: list) -> list:
    """Generate synthetic EI precinct estimates with spatial noise."""
    means = EI_GROUP_MEANS[state]
    results = []
    rng = random.Random(42)

    for feat in features:
        props = feat.get("properties", {})
        precinct_id = props.get("precinct_id") or props.get("name", "")

        # Add precinct-level noise: same direction for all groups (captures
        # local political lean), plus independent group noise.
        local_shift = rng.gauss(0, 0.04)

        estimates = {}
        for geo_key, group in GEO_PROP_TO_GROUP.items():
            group_means = means[group]
            dem_mean = group_means["Harris (D)"]
            # Clamp to [0.02, 0.98] to stay realistic
            dem_est = max(0.02, min(0.98, dem_mean + local_shift + rng.gauss(0, 0.02)))
            rep_est = 1.0 - dem_est
            estimates[group] = {
                "Harris (D)": round(dem_est, 4),
                "Trump (R)": round(rep_est, 4),
            }

        results.append({"precinct": precinct_id, "estimates": estimates})

    return results


def seed_state(state: str, db) -> None:
    state_upper = state.upper()
    if state_upper not in EI_GROUP_MEANS:
        print(f"  No seed data for {state_upper}, skipping.")
        return

    geo_doc = db["precinctGeoJson"].find_one({"_id": state_upper})
    if not geo_doc:
        print(f"  No precinctGeoJson for {state_upper}, skipping.")
        return

    features = geo_doc.get("features", [])
    print(f"  Building estimates for {len(features)} precincts ...")
    ei_precinct = build_precinct_estimates(state_upper, features)

    result = db["analysisData"].update_one(
        {"_id": state_upper},
        {"$set": {"eiPrecinct": ei_precinct}},
    )
    if result.matched_count == 0:
        print(f"  WARNING: No analysisData document for {state_upper}.")
    else:
        print(f"  Seeded eiPrecinct for {state_upper} ({len(ei_precinct)} precincts).")


def main():
    parser = argparse.ArgumentParser(description="Seed synthetic EI precinct data.")
    parser.add_argument("--state", default="all", help="MA, TX, or all (default: all)")
    args = parser.parse_args()

    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    db = client[MONGO_DB]

    states = ["MA", "TX"] if args.state.lower() == "all" else [args.state.upper()]
    for state in states:
        print(f"\nSeeding {state} ...")
        seed_state(state, db)

    client.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
