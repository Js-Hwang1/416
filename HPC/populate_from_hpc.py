#!/usr/bin/env python3

import argparse
import json
import os
import sys

HPC_DIR = os.path.dirname(os.path.abspath(__file__))
PSRC_DIR = os.path.join(HPC_DIR, "psrc")
sys.path.insert(0, PSRC_DIR)

from seawulf.box_whisker import ensemble_box_whisker                                 # SeaWulf-11
from seawulf.ensemble_measures import (                                              # SeaWulf-10
    enacted_demographics,
    load_plans_for_ensemble,
    vote_seat_curve,
)
from seawulf.seat_split import ensemble_seat_split_distribution                      # SeaWulf-8


# ── Configuration ────────────────────────────────────────────────────

DEFAULT_RESULTS_DIR = os.path.expanduser("~/HPC/results")
CLIENT_DATA = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "client", "public", "data",
)

MONGO_URI = "mongodb://localhost:27017/tigers-db"
DB_NAME = "tigers-db"

STATES = {
    "MA": {"num_districts": 9,  "prefix": "ma"},
    "TX": {"num_districts": 38, "prefix": "tx"},
}

GROUPS = [("black", "Black"), ("hispanic", "Hispanic"), ("asian", "Asian")]


# ── Helpers ──────────────────────────────────────────────────────────

def save_json(path: str, data) -> None:
    with open(path, "w") as f:
        json.dump(data, f)
    print(f"  [+] Wrote {path}")


def _build_box_payload(plans, num_districts):
    """Run ensemble_box_whisker for every group; returns {group_key: [...]}."""
    out = {}
    for group_key, group_name in GROUPS:
        out[group_key] = ensemble_box_whisker(plans, group_name, num_districts)
    return out


def _enacted_from_first_plan(plans, num_districts):
    """Build the enacted-plan demographics dict from the first plan's metrics.

    The chain run embeds the enacted plan's sorted minority percentages into
    every plan file's header metadata (see run_ensemble.run), so we don't need
    a separate ensemble-summary file.
    """
    if not plans:
        return None
    pct_sorted = plans[0]["metrics"].get("minority_pct_sorted", {})
    # Emulate the MinorityGroup surface area used by enacted_demographics.
    class _GroupView:
        def __init__(self, name): self.name = name
    groups = [_GroupView(name) for _, name in GROUPS]
    return enacted_demographics(pct_sorted, groups, num_districts)


# ── Main ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Populate MongoDB + JSON with HPC ensemble results")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print summary without updating DB or writing JSON")
    parser.add_argument("--json-only", action="store_true",
                        help="Write JSON files only; skip DB update")
    parser.add_argument("--results-dir", default=DEFAULT_RESULTS_DIR,
                        help=f"Root of per-plan result files (default: {DEFAULT_RESULTS_DIR})")
    args = parser.parse_args()

    print(f"[*] Results dir: {args.results_dir}")
    updates = {}

    for state, cfg in STATES.items():
        prefix = cfg["prefix"]
        num_districts = cfg["num_districts"]
        print(f"\n[*] Processing {state}...")

        rb_plans  = load_plans_for_ensemble(args.results_dir, state, "RB")
        vra_plans = load_plans_for_ensemble(args.results_dir, state, "VRA")
        print(f"  Loaded {len(rb_plans)} RB plans, {len(vra_plans)} VRA plans")

        # ── SeaWulf-8: seat-split distribution ──
        rb_splits  = ensemble_seat_split_distribution(rb_plans)
        vra_splits = ensemble_seat_split_distribution(vra_plans)
        bar_data = {"raceBlindData": rb_splits, "vraData": vra_splits}
        print(f"  ensembleBar: RB={len(rb_splits)} splits, VRA={len(vra_splits)} splits")

        # ── SeaWulf-11: box & whisker ──
        box_data = _build_box_payload(rb_plans, num_districts)
        for grp_key, _ in GROUPS:
            print(f"    {grp_key}: {len(box_data.get(grp_key, []))} districts")

        # ── SeaWulf-10: enacted demographics + vote-seat curve ──
        enacted_data = _enacted_from_first_plan(rb_plans, num_districts)
        if enacted_data:
            print(f"  enactedDemographics: {len(enacted_data['districts'])} districts")

        vote_seat = vote_seat_curve(rb_plans, num_districts)
        if vote_seat:
            print(f"  voteSeat: dem={len(vote_seat['dem_curve'])} pts, "
                  f"rep={len(vote_seat['rep_curve'])} pts")

        updates[state] = {
            "ensembleBar": bar_data,
            "ensembleBox": box_data,
            "enactedDemographics": enacted_data,
            "voteSeat": vote_seat,
        }

        # ── Write JSON payloads for the frontend ──
        if not args.dry_run:
            save_json(os.path.join(CLIENT_DATA, f"{prefix}_ensemble_bar.json"), bar_data)
            save_json(os.path.join(CLIENT_DATA, f"{prefix}_ensemble_box.json"), box_data)
            if enacted_data:
                save_json(os.path.join(CLIENT_DATA, f"{prefix}_enacted_demographics.json"), enacted_data)
            if vote_seat:
                save_json(os.path.join(CLIENT_DATA, f"{prefix}_vote_seat.json"), vote_seat)

    if args.dry_run or args.json_only:
        print("\n[*] Dry run / JSON-only — MongoDB not updated.")
        return

    # ── Update MongoDB ──
    print("\n[*] Updating MongoDB...")
    from pymongo import MongoClient
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]

    for state, data in updates.items():
        set_fields = {k: v for k, v in data.items() if v is not None}
        if set_fields:
            result = db.analysisData.update_one(
                {"_id": state},
                {"$set": set_fields},
            )
            print(f"  {state}: matched={result.matched_count}, "
                  f"modified={result.modified_count}, "
                  f"fields={list(set_fields.keys())}")

    client.close()
    print("\n[*] Done!")


if __name__ == "__main__":
    main()
