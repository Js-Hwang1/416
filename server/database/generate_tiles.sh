#!/usr/bin/env bash
#
# Generate PMTiles from GeoJSON using tippecanoe.
# Prerequisite: brew install tippecanoe
#
# Usage: ./generate_tiles.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TILES_DIR="$SCRIPT_DIR/../tiles"
GEOJSON_DIR="$SCRIPT_DIR/data/cleaned/geojson"
CLIENT_DATA="$SCRIPT_DIR/../../client/public/data"

mkdir -p "$TILES_DIR"

echo "=== Generating PMTiles ==="

# ── Congressional Districts (small, full detail) ─────────────────────
for state in ma tx; do
  src="$GEOJSON_DIR/${state}_congressional_districts.geojson"
  out="$TILES_DIR/${state}_districts.pmtiles"
  if [ -f "$src" ]; then
    echo "[*] ${state} districts..."
    tippecanoe -o "$out" -z12 -Z3 --force \
      --no-tile-size-limit --coalesce-densest-as-needed \
      -l districts "$src"
    echo "    -> $(du -h "$out" | cut -f1)"
  else
    echo "[!] Missing: $src"
  fi
done

# ── Precinct / VTD Heatmaps (medium, ~11K features) ─────────────────
for entry in "ma:ma_precincts_heatmap.geojson:precincts" "tx:tx_vtds_heatmap.geojson:precincts"; do
  IFS=: read -r state filename layer <<< "$entry"
  src="$CLIENT_DATA/$filename"
  out="$TILES_DIR/${state}_precincts.pmtiles"
  if [ -f "$src" ]; then
    echo "[*] ${state} precincts..."
    tippecanoe -o "$out" -z14 -Z4 --force \
      --no-tile-size-limit --coalesce-densest-as-needed \
      --detect-shared-borders -l "$layer" "$src"
    echo "    -> $(du -h "$out" | cut -f1)"
  else
    echo "[!] Missing: $src"
  fi
done

# ── Census Block Heatmaps (large, ~776K features) ───────────────────
for entry in "ma:ma_blocks_heatmap.geojson:blocks" "tx:tx_blocks_heatmap.geojson:blocks"; do
  IFS=: read -r state filename layer <<< "$entry"
  src="$CLIENT_DATA/$filename"
  out="$TILES_DIR/${state}_blocks.pmtiles"
  if [ -f "$src" ]; then
    echo "[*] ${state} blocks..."
    tippecanoe -o "$out" -z14 -Z5 --force \
      --no-tile-size-limit --coalesce-densest-as-needed \
      --extend-zooms-if-still-dropping --detect-shared-borders \
      --drop-densest-as-needed -l "$layer" "$src"
    echo "    -> $(du -h "$out" | cut -f1)"
  else
    echo "[!] Missing: $src (run clean_data.py step14 first)"
  fi
done

echo "=== Done! Tiles in $TILES_DIR ==="
ls -lh "$TILES_DIR"/*.pmtiles 2>/dev/null || echo "(no tiles generated)"
