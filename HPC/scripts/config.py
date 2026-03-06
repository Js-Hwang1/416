"""
config.py -- State configuration and constants for SeaWulf ensemble generation.

Defines all parameters needed to run GerryChain ensembles:
  - Graph column names (node attributes expected in the dual graph)
  - Feasible minority groups and their party of choice
  - Effectiveness and population thresholds
  - Ensemble sizes

The user creates a StateConfig for their specific state(s) via
  load_state_config(path)   -- from a JSON file, OR
  make_config(state, ...)   -- programmatically.

EXPECTED NODE ATTRIBUTES IN THE DUAL GRAPH
-------------------------------------------
  TOTPOP    : int   total population
  VAP       : int   voting-age population
  BVAP      : int   Black VAP
  HVAP      : int   Hispanic/Latino VAP
  ASIANVAP  : int   Asian VAP
  WVAP      : int   White VAP
  OTHERVAP  : int   Other VAP
  PRES24D   : int   2024 Presidential Democratic votes
  PRES24R   : int   2024 Presidential Republican votes
  CD        : int/str  enacted congressional district assignment
  COUNTY    : str   county identifier (optional, for county-split constraint)
"""

import json
import os
from dataclasses import dataclass, field
from typing import Dict, List, Optional


# ── Column name constants (match your cleaned graph) ─────────────────

POP_COL = "TOTPOP"
VAP_COL = "VAP"
BVAP_COL = "BVAP"
HVAP_COL = "HVAP"
ASIANVAP_COL = "ASIANVAP"
WVAP_COL = "WVAP"
OTHERVAP_COL = "OTHERVAP"

# Election columns -- match the actual GeoJSON field names
PRES24D_COL = "G24PREDHAR"
PRES24R_COL = "G24PRERTRU"

DISTRICT_COL = "CD"
COUNTY_COL = "COUNTY"

# Mapping from minority group name -> VAP column in the graph
MINORITY_VAP_COLS = {
    "Black": BVAP_COL,
    "Hispanic": HVAP_COL,
    "Asian": ASIANVAP_COL,
}


@dataclass
class MinorityGroup:
    """Configuration for a single feasible minority group."""
    name: str               # e.g. "Black", "Hispanic", "Asian"
    vap_col: str            # node attribute for this group's VAP
    party_of_choice: str    # "Democratic" or "Republican"
    ei_confidence: float    # confidence score from EI (0-1)


@dataclass
class StateConfig:
    """All parameters for a single state's ensemble run."""

    # ── Identity ─────────────────────────────────────────────────────
    state_name: str                     # e.g. "Massachusetts"
    state_abbr: str                     # e.g. "MA"
    num_districts: int                  # number of congressional districts

    # ── File paths ───────────────────────────────────────────────────
    graph_path: str                     # path to dual-graph JSON/SHP

    # ── Feasible minority groups ─────────────────────────────────────
    # Groups with statewide population >= 400,000
    minority_groups: List[MinorityGroup] = field(default_factory=list)

    # ── Thresholds ───────────────────────────────────────────────────
    pop_tolerance: float = 0.05         # +/- 5% population deviation
    effectiveness_threshold: float = 0.5  # district effective if score >= this
    opportunity_threshold: float = 0.5  # majority-minority if group VAP >= this

    # ── Ensemble sizing ──────────────────────────────────────────────
    ensemble_size: int = 5000           # plans for final presentation
    test_ensemble_size: int = 250       # plans for testing

    # ── ReCom parameters ─────────────────────────────────────────────
    node_repeats: int = 2               # spanning-tree resampling attempts
    random_seed: Optional[int] = 42     # base random seed (each core offsets)

    # ── Benchmark (filled at runtime from enacted plan) ──────────────
    benchmark_effective: Dict[str, int] = field(default_factory=dict)
    benchmark_total_effective: int = 0

    def feasible_group_names(self) -> List[str]:
        return [g.name for g in self.minority_groups]


def load_state_config(path: str) -> StateConfig:
    """Load a StateConfig from a JSON file.

    Expected JSON structure:
    {
      "state_name": "Massachusetts",
      "state_abbr": "MA",
      "num_districts": 9,
      "graph_path": "../data/ma_precinct_graph.json",
      "pop_tolerance": 0.05,
      "effectiveness_threshold": 0.5,
      "opportunity_threshold": 0.5,
      "ensemble_size": 5000,
      "test_ensemble_size": 250,
      "minority_groups": [
        {
          "name": "Black",
          "vap_col": "BVAP",
          "party_of_choice": "Democratic",
          "ei_confidence": 0.95
        },
        ...
      ]
    }
    """
    with open(path) as f:
        data = json.load(f)

    groups = [
        MinorityGroup(**g) for g in data.pop("minority_groups", [])
    ]

    return StateConfig(minority_groups=groups, **data)


def make_config(
    state_name: str,
    state_abbr: str,
    num_districts: int,
    graph_path: str,
    minority_groups: List[Dict],
    **kwargs,
) -> StateConfig:
    """Build a StateConfig programmatically.

    minority_groups: list of dicts like
        [{"name": "Black", "vap_col": "BVAP",
          "party_of_choice": "Democratic", "ei_confidence": 0.95}, ...]
    """
    groups = [MinorityGroup(**g) for g in minority_groups]
    return StateConfig(
        state_name=state_name,
        state_abbr=state_abbr,
        num_districts=num_districts,
        graph_path=graph_path,
        minority_groups=groups,
        **kwargs,
    )
