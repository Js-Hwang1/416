from __future__ import annotations

import os

import networkx as nx
from gerrychain import Graph

from common.config import (
    DISTRICT_COL,
    POP_COL,
    PRES24D_COL,
    PRES24R_COL,
    StateConfig,
    VAP_COL,
)

# Precinct graphs sometimes ship with state-specific attribute names.
COLUMN_REMAP = {
    "TX": {
        "CONG_DIST": DISTRICT_COL,
        "HISPVAP": "HVAP",
    },
}

INT_COLS = [
    POP_COL,
    VAP_COL,
    "BVAP",
    "HVAP",
    "ASIANVAP",
    "WVAP",
    PRES24D_COL,
    PRES24R_COL,
]


def load_graph(cfg: StateConfig, hpc_root: str) -> Graph:
    """Load the precinct dual graph from file and fix connectivity issues."""
    path = cfg.graph_path
    if not os.path.isabs(path):
        path = os.path.join(hpc_root, path)

    print(f"  Loading graph from {path} ...")
    if path.endswith(".json") and not path.endswith(".geojson"):
        graph = Graph.from_json(path)
    else:
        graph = Graph.from_file(path)

    print(f"  {len(graph.nodes)} nodes, {len(graph.edges)} edges")

    remap = COLUMN_REMAP.get(cfg.state_abbr, {})
    if remap:
        print(f"  Remapping columns for {cfg.state_abbr}: {remap}")
        for node in graph.nodes:
            for src, dst in remap.items():
                if src in graph.nodes[node]:
                    graph.nodes[node][dst] = graph.nodes[node].pop(src)

    for node in graph.nodes:
        for col in INT_COLS:
            if col in graph.nodes[node]:
                graph.nodes[node][col] = int(graph.nodes[node][col])

    islands = [n for n in graph.nodes if graph.degree(n) == 0]
    if islands:
        print(f"  Connecting {len(islands)} island node(s)...")
        for island in islands:
            best_dist, best_n = float("inf"), None
            for n in graph.nodes:
                if n == island:
                    continue
                geom_island = graph.nodes[island]["geometry"]
                geom_nbr = graph.nodes[n]["geometry"]
                d = geom_island.distance(geom_nbr)
                if d < best_dist:
                    best_dist, best_n = d, n
            if best_n is not None:
                graph.add_edge(island, best_n)

    districts_nodes = {}
    for n in graph.nodes:
        districts_nodes.setdefault(graph.nodes[n][DISTRICT_COL], []).append(n)

    edges_added = 0
    for _cd, nodes in districts_nodes.items():
        sub = graph.subgraph(nodes)
        components = list(nx.connected_components(sub))
        if len(components) <= 1:
            continue
        main = max(components, key=len)
        for comp in components:
            if comp is main:
                continue
            best_dist, best_a, best_b = float("inf"), None, None
            for a in comp:
                for b in main:
                    geom_a = graph.nodes[a]["geometry"]
                    geom_b = graph.nodes[b]["geometry"]
                    d = geom_a.distance(geom_b)
                    if d < best_dist:
                        best_dist, best_a, best_b = d, a, b
            if best_a is not None:
                graph.add_edge(best_a, best_b)
                edges_added += 1

    if islands or edges_added:
        print(
            f"  Fixed connectivity: +{len(islands) + edges_added} edges, "
            f"now {len(graph.edges)} edges"
        )

    return graph
