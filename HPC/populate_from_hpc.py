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

def parse_args():
    parser = argparse.ArgumentParser(description="Populate MongoDB + JSON with HPC ensemble results")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print summary without updating DB or writing JSON")
    parser.add_argument("--json-only", action="store_true",
                        help="Write JSON files only; skip DB update")
    parser.add_argument("--results-dir", default=DEFAULT_RESULTS_DIR,
                        help=f"Root of per-plan result files (default: {DEFAULT_RESULTS_DIR})")
    return parser.parse_args()


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


def load_state_plans(results_dir: str, state: str):
    """Load RB and VRA plans for one state."""
    rb_plans = load_plans_for_ensemble(results_dir, state, "RB")
    vra_plans = load_plans_for_ensemble(results_dir, state, "VRA")
    print(f"  Loaded {len(rb_plans)} RB plans, {len(vra_plans)} VRA plans")
    return rb_plans, vra_plans


def build_ensemble_bar(rb_plans, vra_plans):
    """SeaWulf-8: build ensembleBar payload (RB + VRA seat-split distributions)."""
    rb_splits = ensemble_seat_split_distribution(rb_plans)
    vra_splits = ensemble_seat_split_distribution(vra_plans)
    print(f"  ensembleBar: RB={len(rb_splits)} splits, VRA={len(vra_splits)} splits")
    return {"raceBlindData": rb_splits, "vraData": vra_splits}


def build_ensemble_box(rb_plans, num_districts):
    """SeaWulf-11: build per-group box-and-whisker data."""
    box_data = _build_box_payload(rb_plans, num_districts)
    for grp_key, _ in GROUPS:
        print(f"    {grp_key}: {len(box_data.get(grp_key, []))} districts")
    return box_data


def build_enacted_demographics(rb_plans, num_districts):
    """SeaWulf-10: build enactedDemographics from the first plan's headers."""
    enacted_data = _enacted_from_first_plan(rb_plans, num_districts)
    if enacted_data:
        print(f"  enactedDemographics: {len(enacted_data['districts'])} districts")
    return enacted_data


def build_vote_seat(rb_plans, num_districts):
    """SeaWulf-10: build vote-seat curve payload."""
    vote_seat = vote_seat_curve(rb_plans, num_districts)
    if vote_seat:
        print(f"  voteSeat: dem={len(vote_seat['dem_curve'])} pts, "
              f"rep={len(vote_seat['rep_curve'])} pts")
    return vote_seat


def build_state_payload(state: str, cfg: dict, results_dir: str) -> dict:
    """Compute every payload field for one state."""
    print(f"\n[*] Processing {state}...")
    num_districts = cfg["num_districts"]

    rb_plans, vra_plans = load_state_plans(results_dir, state)

    return {
        "ensembleBar": build_ensemble_bar(rb_plans, vra_plans),
        "ensembleBox": build_ensemble_box(rb_plans, num_districts),
        "enactedDemographics": build_enacted_demographics(rb_plans, num_districts),
        "voteSeat": build_vote_seat(rb_plans, num_districts),
    }


def write_state_json(prefix: str, payload: dict) -> None:
    """Write a state's payload to the client public/data directory."""
    save_json(os.path.join(CLIENT_DATA, f"{prefix}_ensemble_bar.json"), payload["ensembleBar"])
    save_json(os.path.join(CLIENT_DATA, f"{prefix}_ensemble_box.json"), payload["ensembleBox"])
    if payload["enactedDemographics"]:
        save_json(os.path.join(CLIENT_DATA, f"{prefix}_enacted_demographics.json"),
                  payload["enactedDemographics"])
    if payload["voteSeat"]:
        save_json(os.path.join(CLIENT_DATA, f"{prefix}_vote_seat.json"), payload["voteSeat"])


def collect_all_payloads(results_dir: str, write_json: bool) -> dict:
    """Build payloads for every state; optionally write JSON files."""
    print(f"[*] Results dir: {results_dir}")
    updates = {}
    for state, cfg in STATES.items():
        payload = build_state_payload(state, cfg, results_dir)
        updates[state] = payload
        if write_json:
            write_state_json(cfg["prefix"], payload)
    return updates


def update_mongodb(updates: dict) -> None:
    """Push every state's payload into MongoDB analysisData."""
    print("\n[*] Updating MongoDB...")
    from pymongo import MongoClient
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]

    for state, data in updates.items():
        set_fields = {k: v for k, v in data.items() if v is not None}
        if not set_fields:
            continue
        result = db.analysisData.update_one(
            {"_id": state},
            {"$set": set_fields},
        )
        print(f"  {state}: matched={result.matched_count}, "
              f"modified={result.modified_count}, "
              f"fields={list(set_fields.keys())}")

    client.close()


# ── Main ─────────────────────────────────────────────────────────────

def main():
    args = parse_args()
    write_json = not args.dry_run
    updates = collect_all_payloads(args.results_dir, write_json)

    if args.dry_run or args.json_only:
        print("\n[*] Dry run / JSON-only — MongoDB not updated.")
        return

    update_mongodb(updates)
    print("\n[*] Done!")


if __name__ == "__main__":
    main()
