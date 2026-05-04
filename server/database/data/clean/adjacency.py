import json
import os

import numpy as np
from shapely.strtree import STRtree

from .deps import HAS_LIBPYSAL
from .helpers import report, timed
from .paths import ANALYSIS_DIR


def _adjacency_strtree(gdf, buffer_dist):
    """Build a {idx: [neighbor_idx, ...]} map via shapely STRtree + buffer."""
    geoms = gdf.geometry.values
    tree = STRtree(geoms)
    adjacency = {}
    for i in range(len(geoms)):
        if geoms[i] is None:
            adjacency[i] = []
            continue
        candidates = tree.query(geoms[i].buffer(buffer_dist))
        neighbors = []
        for j in candidates:
            if j == i:
                continue
            if (geoms[i].intersects(geoms[j])
                    or geoms[i].distance(geoms[j]) <= buffer_dist):
                neighbors.append(int(j))
        adjacency[i] = sorted(neighbors)
    return adjacency


def _adjacency_libpysal(gdf):
    import libpysal
    w = libpysal.weights.Queen.from_dataframe(gdf, use_index=False)
    return {i: sorted(int(j) for j in w.neighbors[i]) for i in range(len(gdf))}


def _buffer_distance(gdf):
    """Pick a tolerance based on whether the CRS is projected."""
    if gdf.crs and gdf.crs.is_projected:
        return 61.0  # ~200ft in meters
    return 0.00055   # ~61m in degrees


def _compute_adjacency(gdf, label):
    buffer_dist = _buffer_distance(gdf)
    with timed(f"{label} adjacency"):
        if HAS_LIBPYSAL:
            report("  Using libpysal Queen contiguity")
            return _adjacency_libpysal(gdf)
        report(f"  Using shapely STRtree (buffer={buffer_dist})")
        return _adjacency_strtree(gdf, buffer_dist)


def _summarize(adj, label):
    n_neighbors = [len(v) for v in adj.values()]
    isolated = sum(1 for v in adj.values() if len(v) == 0)
    avg_neighbors = np.mean(n_neighbors) if n_neighbors else 0
    report(f"  {label}: avg neighbors={avg_neighbors:.1f}, isolated={isolated}")


def _write_adjacency(state, adj):
    out_path = os.path.join(ANALYSIS_DIR, f"{state}_adjacency.json")
    with open(out_path, "w") as f:
        json.dump({str(k): v for k, v in adj.items()}, f)
    report(f"  Written: {out_path}")


def _process_state(state, gdf, label):
    report(f"Computing adjacency for {label} ({len(gdf)} features)...")
    adj = _compute_adjacency(gdf, label)
    _summarize(adj, label)
    _write_adjacency(state, adj)


def run(ma, tx):
    print("\n" + "=" * 70)
    print("STEP 11: Precinct Adjacency")
    print("=" * 70)
    _process_state("ma", ma, "MA precincts")
    _process_state("tx", tx, "TX VTDs")
