#!/usr/bin/env python3
"""
run_ei.py -- Run Ecological Inference (PyEI) for a state.

Implements:
  Prepro-9   Use PyEI MGGG software to calculate EI data
  GUI-12     EI candidate results (probability density curves)
  GUI-13     EI bar chart data (support % with confidence intervals)
  GUI-14     EI choropleth data (precinct-level estimates)
  GUI-15     EI KDE polarization data

This script:
  1. Loads precinct-level demographic + election data (CSV or GeoJSON)
  2. Runs RxC Ecological Inference (Multinomial-Dirichlet model)
  3. Determines party of choice per racial group + confidence
  4. Computes KDE density curves from posterior samples
  5. Saves results in the exact JSON format the client/MongoDB expects
  6. Optionally updates the MongoDB analysisData collection directly

Usage:
  # From GeoJSON (auto-detects field names for MA/TX):
  python run_ei.py --precinct-data ../data/ma_precincts.geojson \
                   --state MA --update-db

  # From CSV:
  python run_ei.py --precinct-data ../data/ma_precincts.csv \
                   --state MA --output-dir ../results

Expected CSV columns:
  precinct_name, total_vap, pct_black, pct_hispanic, pct_asian, pct_other,
  pct_dem, pct_rep

Output files (placed in output-dir, named {prefix}_ei_*.json):
  {prefix}_ei_curves.json   -- KDE density curves per race/candidate (GUI-12)
  {prefix}_ei_summary.json  -- support % with 95% CIs per group (GUI-13)
  {prefix}_ei_kde.json      -- Democratic-only KDE per race (GUI EIKDEChart)
  {prefix}_ei_results.json  -- full results (party of choice, GerryChain config)
  {prefix}_ei_precinct.json -- precinct-level estimates (GUI-14)
"""

import argparse
import json
import os
import sys
import time
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore", category=FutureWarning)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
HPC_DIR = os.path.dirname(SCRIPT_DIR)


# ── Constants ────────────────────────────────────────────────────────

# Internal model group/candidate names (used with PyEI)
DEMOGRAPHIC_COLS = ["pct_black", "pct_hispanic", "pct_asian", "pct_other"]
VOTE_COLS = ["pct_dem", "pct_rep"]
DEMOGRAPHIC_NAMES = ["Black", "Hispanic", "Asian", "Other"]
CANDIDATE_NAMES = ["Democrat", "Republican"]

# Client-facing labels (must match what the React components expect)
CLIENT_GROUP_RENAME = {"Other": "White"}  # EI model "Other" → client "White"
CLIENT_CANDIDATE_LABELS = {
    "Democrat": "Harris (D)",
    "Republican": "Trump (R)",
}

KDE_NUM_POINTS = 61  # number of points in each KDE curve (for eiCurves)

# GeoJSON field mappings per state
GEOJSON_FIELD_MAP = {
    "MA": {
        "name": "NAME",
        "vap": "VAP",
        "bvap": "BVAP",
        "hvap": "HVAP",
        "asianvap": "ASIANVAP",
        "dem_votes": "G24PREDHAR",
        "rep_votes": "G24PRERTRU",
    },
    "TX": {
        "name": "CNTYVTD",
        "vap": "VAP",
        "bvap": "BVAP",
        "hvap": "HISPVAP",
        "asianvap": "ASIANVAP",
        "dem_votes": "G24PREDHAR",
        "rep_votes": "G24PRERTRU",
    },
}

MONGO_URI = "mongodb://localhost:27017/tigers-db"
MONGO_DB = "tigers-db"


# ── Data loading ─────────────────────────────────────────────────────

def load_from_geojson(path: str, state: str) -> pd.DataFrame:
    """Load precinct data from a GeoJSON file and convert to the expected format.

    Handles field name differences between states (e.g. MA uses HVAP, TX uses HISPVAP).
    """
    print(f"Loading GeoJSON from {path} ...")

    state_upper = state.upper()
    if state_upper not in GEOJSON_FIELD_MAP:
        raise ValueError(
            f"No GeoJSON field mapping for state '{state}'. "
            f"Known states: {list(GEOJSON_FIELD_MAP.keys())}. "
            f"Use a CSV with standard columns instead."
        )

    fmap = GEOJSON_FIELD_MAP[state_upper]

    with open(path) as f:
        gj = json.load(f)

    features = gj.get("features", [])
    print(f"  {len(features)} features found")

    rows = []
    for feat in features:
        props = feat.get("properties", {})

        vap = float(props.get(fmap["vap"], 0))
        if vap <= 0:
            continue

        bvap = float(props.get(fmap["bvap"], 0))
        hvap = float(props.get(fmap["hvap"], 0))
        asianvap = float(props.get(fmap["asianvap"], 0))

        dem = float(props.get(fmap["dem_votes"], 0))
        rep = float(props.get(fmap["rep_votes"], 0))
        total_votes = dem + rep

        if total_votes <= 0:
            continue

        # Filter out tiny precincts that cause numerical issues
        if vap < 50 or total_votes < 10:
            continue

        rows.append({
            "precinct_name": str(props.get(fmap["name"], "")),
            "total_vap": int(vap),
            "total_votes": int(total_votes),
            "pct_black": bvap / vap,
            "pct_hispanic": hvap / vap,
            "pct_asian": asianvap / vap,
            "pct_other": max(0, 1.0 - (bvap + hvap + asianvap) / vap),
            "pct_dem": dem / total_votes,
            "pct_rep": rep / total_votes,
        })

    df = pd.DataFrame(rows)
    print(f"  {len(df)} precincts with valid data")
    return df


def load_precinct_data(path: str, state: str) -> pd.DataFrame:
    """Load precinct data from CSV or GeoJSON (auto-detected by extension)."""
    ext = os.path.splitext(path)[1].lower()

    if ext in (".geojson", ".json"):
        df = load_from_geojson(path, state)
    elif ext == ".csv":
        print(f"Loading CSV from {path} ...")
        df = pd.read_csv(path)
        required = ["precinct_name", "total_vap"] + DEMOGRAPHIC_COLS + VOTE_COLS
        missing = [c for c in required if c not in df.columns]
        if missing:
            raise ValueError(f"Missing columns: {missing}")
    else:
        raise ValueError(f"Unsupported file extension: {ext}. Use .csv or .geojson")

    # Normalize demographic fractions to sum to 1.0
    demo_sum = df[DEMOGRAPHIC_COLS].sum(axis=1)
    bad_demo = (demo_sum - 1.0).abs() > 0.02
    if bad_demo.any():
        print(f"  WARNING: {bad_demo.sum()} precincts have demographic fractions not summing to 1.0")
        print(f"  Normalizing ...")
        for col in DEMOGRAPHIC_COLS:
            df[col] = df[col] / demo_sum

    # Normalize vote fractions to sum to 1.0
    vote_sum = df[VOTE_COLS].sum(axis=1)
    bad_vote = (vote_sum - 1.0).abs() > 0.02
    if bad_vote.any():
        print(f"  WARNING: {bad_vote.sum()} precincts have vote fractions not summing to 1.0")
        print(f"  Normalizing ...")
        for col in VOTE_COLS:
            df[col] = df[col] / vote_sum

    # Drop precincts with zero population
    zero_pop = df["total_vap"] <= 0
    if zero_pop.any():
        print(f"  Dropping {zero_pop.sum()} precincts with zero population")
        df = df[~zero_pop].reset_index(drop=True)

    # Clamp small values to avoid numerical issues in PyEI
    for col in DEMOGRAPHIC_COLS + VOTE_COLS:
        df[col] = df[col].clip(lower=1e-6, upper=1.0 - 1e-6)

    print(f"  {len(df)} precincts ready for EI")
    return df


# ── EI model fitting ─────────────────────────────────────────────────

def run_rxc_ei(df: pd.DataFrame, tune: int = 1500, draws: int = 1000):
    """Run RxC Ecological Inference using PyEI.

    Returns the fitted RowByColumnEI object.
    """
    from pyei.r_by_c import RowByColumnEI

    group_fractions = np.array(df[DEMOGRAPHIC_COLS]).T   # (4, p)
    votes_fractions = np.array(df[VOTE_COLS]).T           # (2, p)
    # Use total_votes if available (more accurate for EI), else fall back to VAP
    if "total_votes" in df.columns:
        precinct_pops = np.array(df["total_votes"], dtype=int)
    else:
        precinct_pops = np.array(df["total_vap"], dtype=int)
    precinct_names = list(df["precinct_name"].astype(str))

    print(f"\nRunning RxC EI ({len(DEMOGRAPHIC_NAMES)} groups x {len(CANDIDATE_NAMES)} candidates) ...")
    print(f"  Precincts: {group_fractions.shape[1]}")
    print(f"  Tune: {tune}, Draws: {draws}")

    ei = RowByColumnEI(
        model_name="multinomial-dirichlet-modified",
        pareto_shape=1,
        pareto_scale=5,
    )

    t0 = time.time()
    ei.fit(
        group_fractions,
        votes_fractions,
        precinct_pops,
        demographic_group_names=DEMOGRAPHIC_NAMES,
        candidate_names=CANDIDATE_NAMES,
        precinct_names=precinct_names,
        target_accept=0.99,
        tune=tune,
        draws=draws,
    )
    elapsed = time.time() - t0
    print(f"  EI fitting completed in {elapsed:.0f}s")

    return ei


# ── Result extraction ────────────────────────────────────────────────

def _client_group(name: str) -> str:
    """Rename internal group name to client-facing label."""
    return CLIENT_GROUP_RENAME.get(name, name)


def _client_cand(name: str) -> str:
    """Rename internal candidate name to client-facing label."""
    return CLIENT_CANDIDATE_LABELS.get(name, name)


def extract_party_of_choice(ei) -> dict:
    """Determine party of choice and confidence for each minority group."""
    coc = ei.candidate_of_choice_report()

    result = {}
    for group in DEMOGRAPHIC_NAMES:
        if group == "Other":
            continue

        scores = {}
        for cand in CANDIDATE_NAMES:
            key = (group, cand)
            scores[cand] = coc.get(key, 0.0)

        best_party = max(scores, key=scores.get)
        confidence = scores[best_party]

        result[group] = {
            "party_of_choice": best_party,
            "confidence": round(float(confidence), 4),
            "all_scores": {k: round(float(v), 4) for k, v in scores.items()},
        }

    return result


def build_ei_curves(ei) -> list:
    """Build eiCurves JSON: KDE density curve per race/candidate pair.

    Output format (matches client's ProbabilityChart component):
    [{"race": "White", "candidate": "Harris (D)", "data": [{"percent": ..., "probability": ...}]}]
    """
    from scipy.stats import gaussian_kde

    samples = ei.sampled_voting_prefs  # (num_samples, r, c)

    curves = []
    for g_idx, group in enumerate(DEMOGRAPHIC_NAMES):
        for c_idx, cand in enumerate(CANDIDATE_NAMES):
            samp = samples[:, g_idx, c_idx]

            samp_min = max(0, float(np.min(samp)) - 0.03)
            samp_max = min(1, float(np.max(samp)) + 0.03)
            x_grid = np.linspace(samp_min, samp_max, KDE_NUM_POINTS)

            try:
                kde = gaussian_kde(samp)
                y_vals = kde(x_grid)
            except Exception:
                y_vals = np.zeros_like(x_grid)

            data_points = []
            for x, y in zip(x_grid, y_vals):
                data_points.append({
                    "percent": round(float(x) * 100, 1),
                    "probability": round(float(y), 4),
                })

            curves.append({
                "race": _client_group(group),
                "candidate": _client_cand(cand),
                "data": data_points,
            })

    return curves


def build_ei_summary(ei) -> list:
    """Build eiSummary JSON: support % with 95% CIs per group.

    Output format: [{"group": "White", "candidates": [{"candidate": "Harris (D)", "support": 60, ...}]}]
    """
    means = ei.posterior_mean_voting_prefs              # (r, c)
    cis = ei.credible_interval_95_mean_voting_prefs     # (r, c, 2)

    summary = []
    for g_idx, group in enumerate(DEMOGRAPHIC_NAMES):
        candidates = []
        for c_idx, cand in enumerate(CANDIDATE_NAMES):
            candidates.append({
                "candidate": _client_cand(cand),
                "support": round(float(means[g_idx, c_idx]) * 100),
                "ci_lower": round(float(cis[g_idx, c_idx, 0]) * 100, 1),
                "ci_upper": round(float(cis[g_idx, c_idx, 1]) * 100, 1),
            })
        summary.append({
            "group": _client_group(group),
            "candidates": candidates,
        })

    return summary


def build_ei_kde(ei) -> dict:
    """Build eiKde JSON: Democratic-only KDE per race at integer x values 0-100.

    Output format: {"White": [{"x": 0, "y": 0.0}, ...], "Black": [...]}
    """
    from scipy.stats import gaussian_kde

    samples = ei.sampled_voting_prefs  # (num_samples, r, c)
    dem_idx = CANDIDATE_NAMES.index("Democrat")
    x_grid = np.arange(0, 101)

    result = {}
    for g_idx, group in enumerate(DEMOGRAPHIC_NAMES):
        samp = samples[:, g_idx, dem_idx]

        try:
            kde = gaussian_kde(samp)
            y_vals = kde(x_grid / 100.0)
        except Exception:
            y_vals = np.zeros_like(x_grid, dtype=float)

        points = []
        for x, y in zip(x_grid, y_vals):
            points.append({
                "x": int(x),
                "y": round(float(y) / 100.0, 5),
            })

        result[_client_group(group)] = points

    return result


def extract_precinct_estimates(ei, df: pd.DataFrame) -> list:
    """Extract precinct-level EI estimates for choropleth maps (GUI-14)."""
    precinct_means, _ = ei.precinct_level_estimates()

    results = []
    for i in range(len(df)):
        entry = {
            "precinct": str(df.iloc[i]["precinct_name"]),
            "estimates": {},
        }
        for g_idx, group in enumerate(DEMOGRAPHIC_NAMES):
            entry["estimates"][_client_group(group)] = {}
            for c_idx, cand in enumerate(CANDIDATE_NAMES):
                entry["estimates"][_client_group(group)][_client_cand(cand)] = round(
                    float(precinct_means[i, g_idx, c_idx]), 4
                )
        results.append(entry)

    return results


def extract_polarization_data(ei) -> dict:
    """Extract polarization data for KDE plots (GUI-15)."""
    samples = ei.sampled_voting_prefs
    other_idx = DEMOGRAPHIC_NAMES.index("Other")
    dem_idx = CANDIDATE_NAMES.index("Democrat")

    result = {}
    for g_idx, group in enumerate(DEMOGRAPHIC_NAMES):
        if group == "Other":
            continue

        diff = samples[:, g_idx, dem_idx] - samples[:, other_idx, dem_idx]

        result[f"{group}_vs_White"] = {
            "mean_difference": round(float(np.mean(diff)) * 100, 1),
            "prob_gt_40pct": round(float(np.mean(diff > 0.40)), 4),
            "samples": [round(float(d), 4) for d in diff],
        }

    return result


# ── GerryChain config bridge ─────────────────────────────────────────

def generate_gerrychain_config(party_of_choice: dict) -> list:
    """Generate the minority_groups section for state_config.json."""
    vap_col_map = {"Black": "BVAP", "Hispanic": "HVAP", "Asian": "ASIANVAP"}

    groups = []
    for group_name, data in party_of_choice.items():
        if group_name not in vap_col_map:
            continue
        groups.append({
            "name": group_name,
            "vap_col": vap_col_map[group_name],
            "party_of_choice": data["party_of_choice"],
            "ei_confidence": data["confidence"],
        })

    return groups


# ── MongoDB update ────────────────────────────────────────────────────

def update_mongodb(state: str, ei_curves, ei_summary, ei_kde,
                   mongo_uri: str = MONGO_URI):
    """Update the analysisData collection in MongoDB with new EI results.

    Replaces the eiCurves, eiSummary, and eiKde fields for the given state.
    The client reads these via: GET /api/states/{stateId}/analysis
    """
    from pymongo import MongoClient

    print(f"\nUpdating MongoDB ({mongo_uri}) ...")
    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
    db = client[MONGO_DB]
    coll = db["analysisData"]

    result = coll.update_one(
        {"_id": state.upper()},
        {"$set": {
            "eiCurves": ei_curves,
            "eiSummary": ei_summary,
            "eiKde": ei_kde,
        }},
    )

    if result.matched_count == 0:
        print(f"  WARNING: No document found for state '{state.upper()}' in analysisData.")
        print(f"  Creating new document ...")
        coll.insert_one({
            "_id": state.upper(),
            "stateAbbr": state.upper(),
            "eiCurves": ei_curves,
            "eiSummary": ei_summary,
            "eiKde": ei_kde,
        })
        print(f"  Inserted new document for {state.upper()}")
    else:
        print(f"  Updated eiCurves, eiSummary, eiKde for {state.upper()}")
        print(f"  matched={result.matched_count}, modified={result.modified_count}")

    client.close()


# ── Optional: Save PyEI's built-in plots ──────────────────────────────

def save_ei_plots(ei, output_dir: str, state: str):
    """Generate and save PyEI's built-in plots as PNG files."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    plots_dir = os.path.join(output_dir, "ei_plots")
    os.makedirs(plots_dir, exist_ok=True)

    def _save_current_fig(filename):
        fig = plt.gcf()
        if fig.get_axes():
            fig.savefig(
                os.path.join(plots_dir, filename),
                dpi=150, bbox_inches="tight"
            )
        plt.close("all")

    try:
        ei.plot()
        _save_current_fig(f"{state}_ei_kdes.png")
    except Exception as e:
        print(f"  Warning: Could not generate KDE plot: {e}")
        plt.close("all")

    try:
        ei.plot_boxplots()
        _save_current_fig(f"{state}_ei_boxplots.png")
    except Exception as e:
        print(f"  Warning: Could not generate boxplot: {e}")
        plt.close("all")

    for group in DEMOGRAPHIC_NAMES:
        if group == "Other":
            continue
        try:
            ei.plot_polarization_kde(
                groups=[group, "Other"],
                candidate="Democrat",
                threshold=0.40,
                show_threshold=True,
            )
            _save_current_fig(f"{state}_polarization_{group}.png")
        except Exception as e:
            print(f"  Warning: Could not generate polarization plot for {group}: {e}")
            plt.close("all")

    print(f"  Plots saved to {plots_dir}/")


# ── Main ─────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(
        description="Run PyEI Ecological Inference for redistricting analysis."
    )
    p.add_argument("--precinct-data", required=True,
                    help="Path to precinct data (CSV or GeoJSON)")
    p.add_argument("--state", required=True,
                    help="State abbreviation (e.g. MA, TX)")
    p.add_argument("--output-dir", default=os.path.join(HPC_DIR, "results"),
                    help="Output directory for JSON files")
    p.add_argument("--tune", type=int, default=1500,
                    help="MCMC tuning steps (default: 1500)")
    p.add_argument("--draws", type=int, default=1000,
                    help="MCMC posterior draws (default: 1000)")
    p.add_argument("--skip-plots", action="store_true",
                    help="Skip PNG plot generation")
    p.add_argument("--update-db", action="store_true",
                    help="Update MongoDB analysisData collection with results")
    p.add_argument("--mongo-uri", default=MONGO_URI,
                    help=f"MongoDB URI (default: {MONGO_URI})")
    args = p.parse_args()

    prefix = args.state.lower()
    print(f"=== PyEI Ecological Inference: {args.state} ===")
    t0 = time.time()

    # ── 1. Load data ─────────────────────────────────────────────────
    df = load_precinct_data(args.precinct_data, args.state)

    # ── 2. Run RxC EI ────────────────────────────────────────────────
    ei = run_rxc_ei(df, tune=args.tune, draws=args.draws)

    # ── 3. Print summary ─────────────────────────────────────────────
    print("\n── EI Summary ──")
    print(ei.summary())

    # ── 4. Extract party of choice (for GerryChain) ──────────────────
    print("\n── Party of Choice ──")
    poc = extract_party_of_choice(ei)
    for group, data in poc.items():
        print(f"  {group}: {data['party_of_choice']} "
              f"(confidence: {data['confidence']*100:.1f}%)")

    # ── 5. Build client-facing JSON outputs ──────────────────────────
    print("\nBuilding client-facing outputs ...")
    os.makedirs(args.output_dir, exist_ok=True)

    ei_curves = build_ei_curves(ei)
    curves_path = os.path.join(args.output_dir, f"{prefix}_ei_curves.json")
    with open(curves_path, "w") as f:
        json.dump(ei_curves, f)
    print(f"  eiCurves:  {curves_path} ({len(ei_curves)} curves)")

    ei_summary = build_ei_summary(ei)
    summary_path = os.path.join(args.output_dir, f"{prefix}_ei_summary.json")
    with open(summary_path, "w") as f:
        json.dump(ei_summary, f)
    print(f"  eiSummary: {summary_path}")

    ei_kde = build_ei_kde(ei)
    kde_path = os.path.join(args.output_dir, f"{prefix}_ei_kde.json")
    with open(kde_path, "w") as f:
        json.dump(ei_kde, f)
    print(f"  eiKde:     {kde_path}")

    precinct_est = extract_precinct_estimates(ei, df)
    precinct_path = os.path.join(args.output_dir, f"{prefix}_ei_precinct.json")
    with open(precinct_path, "w") as f:
        json.dump(precinct_est, f)
    print(f"  Precinct:  {precinct_path} ({len(precinct_est)} precincts)")

    gc_config = generate_gerrychain_config(poc)
    ei_results = {
        "state": args.state,
        "election": "2024 Presidential",
        "num_precincts": len(df),
        "party_of_choice": poc,
        "polarization": extract_polarization_data(ei),
        "gerrychain_minority_groups": gc_config,
        "runtime_seconds": round(time.time() - t0, 1),
    }
    results_path = os.path.join(args.output_dir, f"{prefix}_ei_results.json")
    with open(results_path, "w") as f:
        json.dump(ei_results, f, indent=2)
    print(f"  Results:   {results_path}")

    # ── 6. Update MongoDB (optional) ──────────────────────────────────
    if args.update_db:
        update_mongodb(args.state, ei_curves, ei_summary, ei_kde,
                       mongo_uri=args.mongo_uri)

    # ── 7. Save EI model (for later reloading) ───────────────────────
    try:
        from pyei.io_utils import to_netcdf
        model_path = os.path.join(args.output_dir, f"{prefix}_ei_model")
        to_netcdf(ei, model_path)
        print(f"\nEI model saved: {model_path}")
    except Exception as e:
        print(f"  Warning: Could not save model via netcdf: {e}")

    # ── 8. Generate PNG plots (optional) ──────────────────────────────
    if not args.skip_plots:
        print("\nGenerating PNG plots ...")
        save_ei_plots(ei, args.output_dir, args.state)

    elapsed = time.time() - t0
    print(f"\nDone! Total time: {elapsed:.0f}s")
    print(f"\n── For state_config.json, use this minority_groups section: ──")
    print(json.dumps(gc_config, indent=2))


if __name__ == "__main__":
    main()
