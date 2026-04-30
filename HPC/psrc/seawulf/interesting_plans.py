import json
import os
from typing import List

from common.config import StateConfig


class InterestingPlanTracker:
    """Track plans with max/min minority effectiveness per group."""

    def __init__(self, cfg: StateConfig, max_plans: int = 10):
        self.cfg = cfg
        self.max_plans = max_plans
        self.plans = []  # list of {label, score, step, assignment, metrics}
        self._best = {}  # label → (best_score, index_into_plans | None)
        self._worst = {}  # label → (worst_score, index_into_plans | None)

        for g in cfg.minority_groups:
            self._best[f"max_{g.name}_effective"] = (-1, None)
            self._worst[f"min_{g.name}_effective"] = (float("inf"), None)

    def update(self, partition, metrics: dict, step: int) -> None:
        """Check whether this plan sets a new best or worst per group."""
        for g in self.cfg.minority_groups:
            eff = metrics["minority_effective"][g.name]

            key_max = f"max_{g.name}_effective"
            if eff > self._best[key_max][0]:
                self._best[key_max] = (eff, len(self.plans))
                self._add_plan(key_max, eff, partition, metrics, step)

            key_min = f"min_{g.name}_effective"
            if eff < self._worst[key_min][0]:
                self._worst[key_min] = (eff, len(self.plans))
                self._add_plan(key_min, eff, partition, metrics, step)

    def _add_plan(self, label, score, partition, metrics, step) -> None:
        assignment = {str(k): int(v) for k, v in partition.assignment.items()}
        self.plans.append(
            {
                "label": label,
                "score": score,
                "step": step,
                "assignment": assignment,
                "metrics": metrics,
            }
        )
        if len(self.plans) > self.max_plans * 2:
            self._prune()

    def _prune(self) -> None:
        """Keep only referenced + most-recent entries; cap at max_plans."""
        keep = set()
        for v in self._best.values():
            if v[1] is not None:
                keep.add(v[1])
        for v in self._worst.values():
            if v[1] is not None:
                keep.add(v[1])
        recent = set(range(max(0, len(self.plans) - 2), len(self.plans)))
        keep |= recent

        pruned = [self.plans[i] for i in sorted(keep) if i < len(self.plans)]
        self.plans = pruned[-self.max_plans :]

    def get_results(self) -> list:
        """Dedup by label; max_* keeps highest score, min_* keeps lowest."""
        seen = {}
        for p in self.plans:
            label = p["label"]
            if (
                label not in seen
                or ("max" in label and p["score"] > seen[label]["score"])
                or ("min" in label and p["score"] < seen[label]["score"])
            ):
                seen[label] = p
        return list(seen.values())


# ── Cross-core consolidation ────────────────────────────────────────


def consolidate_interesting_plans(core_data: List[dict]) -> list:
    """Merge per-core tracker outputs; keep the best plan per label globally."""
    all_interesting = []
    for core in core_data:
        all_interesting.extend(core.get("interesting_plans", []))

    best = {}
    for plan in all_interesting:
        label = plan["label"]
        if label not in best:
            best[label] = plan
        elif "max" in label and plan["score"] > best[label]["score"]:
            best[label] = plan
        elif "min" in label and plan["score"] < best[label]["score"]:
            best[label] = plan

    return list(best.values())


# ── Post-hoc scanner (alternative path) ─────────────────────────────


def scan_results_for_extremes(
    results_dir: str,
    state: str,
    mode_dir: str,
    groups: List,
) -> list:
    """Load every plan_*.json under {results_dir}/{state}/{mode_dir} and
    return the max/min-effectiveness plan per group.

    Redundant with InterestingPlanTracker when per-plan files already carry
    full assignments (current shipping pipeline). Prefer this when the chain
    did not run with a tracker attached.
    """
    plan_dir = os.path.join(results_dir, state, mode_dir)
    extremes = {}  # label → plan dict

    for fname in sorted(os.listdir(plan_dir)):
        if not fname.endswith(".json"):
            continue
        with open(os.path.join(plan_dir, fname)) as f:
            p = json.load(f)
        eff_by_group = p["metrics"]["minority_effective"]

        for g in groups:
            key_max = f"max_{g.name}_effective"
            key_min = f"min_{g.name}_effective"
            eff = eff_by_group[g.name]

            cur_max = extremes.get(key_max)
            if cur_max is None or eff > cur_max["score"]:
                extremes[key_max] = {"label": key_max, "score": eff, **p}
            cur_min = extremes.get(key_min)
            if cur_min is None or eff < cur_min["score"]:
                extremes[key_min] = {"label": key_min, "score": eff, **p}

    return list(extremes.values())
