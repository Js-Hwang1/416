import { useState, useMemo, useCallback } from "react";
import { Map as MapGL, Source, Layer, NavigationControl } from "react-map-gl/maplibre";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

const CANDIDATES = ["Harris (D)", "Trump (R)"];
const RACES = ["White", "Black", "Hispanic", "Asian"];

// Blue scale for Harris (D), red scale for Trump (R)
// Softened: top end stops at a medium-dark hue so precinct boundaries remain visible
const COLOR_SCALES = {
  "Harris (D)": ["#f0f7ff", "#d0e5f5", "#aed0ea", "#84b8de", "#5a9fd0", "#3787bf", "#1f6fab", "#115994", "#0a4478", "#053360"],
  "Trump (R)":  ["#fff5f0", "#fdd9cc", "#fab59e", "#f58e72", "#ee6749", "#de3e2b", "#bf2018", "#9b1012", "#710a0d", "#4e0509"],
};

// 10 equal steps 0-100%
const STEPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];

function buildFillExpr(candidate) {
  const colors = COLOR_SCALES[candidate];
  const prop = candidate === "Harris (D)" ? "ei_harris" : "ei_trump";
  return [
    "step",
    ["coalesce", ["get", prop], 0],
    colors[0],
    10, colors[1],
    20, colors[2],
    30, colors[3],
    40, colors[4],
    50, colors[5],
    60, colors[6],
    70, colors[7],
    80, colors[8],
    90, colors[9],
  ];
}

function getBbox(geojson) {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const feat of geojson.features) {
    const coords = feat.geometry?.coordinates;
    if (!coords) continue;
    const flat = feat.geometry.type === "Polygon" ? coords.flat(1) : coords.flat(2);
    for (const [lng, lat] of flat) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return [[minLng, minLat], [maxLng, maxLat]];
}

export default function EIPrecinctMap({ precinctGeoJsonData, eiPrecinctData, mapView }) {
  const [candidate, setCandidate] = useState("Harris (D)");
  const [race, setRace] = useState("Black");
  const [hoverInfo, setHoverInfo] = useState(null);

  // Build lookup: precinct name -> estimates
  const estimatesMap = useMemo(() => {
    if (!eiPrecinctData) return {};
    const map = {};
    for (const entry of eiPrecinctData) {
      map[entry.precinct] = entry.estimates;
    }
    return map;
  }, [eiPrecinctData]);

  // Merge EI estimates into precinct GeoJSON — one value per race+candidate combination
  const enrichedGeoJson = useMemo(() => {
    if (!precinctGeoJsonData || !eiPrecinctData) return null;
    const features = precinctGeoJsonData.features.map((feat) => {
      const props = feat.properties;
      const pid = props.precinct_id ?? props.CNTYVTD ?? props.NAME ?? props.name ?? "";
      const est = estimatesMap[pid];
      if (!est) return feat;

      const newProps = { ...props };
      for (const r of RACES) {
        newProps[`ei_harris_${r}`] = Math.round((est[r]?.["Harris (D)"] ?? 0) * 1000) / 10;
        newProps[`ei_trump_${r}`]  = Math.round((est[r]?.["Trump (R)"]  ?? 0) * 1000) / 10;
      }
      return { ...feat, properties: newProps };
    });
    return { ...precinctGeoJsonData, features };
  }, [precinctGeoJsonData, eiPrecinctData, estimatesMap]);

  const bbox = useMemo(
    () => precinctGeoJsonData ? getBbox(precinctGeoJsonData) : null,
    [precinctGeoJsonData]
  );

  // The active property key changes with both selectors
  const activeProp = candidate === "Harris (D)" ? `ei_harris_${race}` : `ei_trump_${race}`;

  const fillExpr = useMemo(() => {
    const colors = COLOR_SCALES[candidate];
    return [
      "step",
      ["coalesce", ["get", activeProp], 0],
      colors[0],
      10, colors[1],
      20, colors[2],
      30, colors[3],
      40, colors[4],
      50, colors[5],
      60, colors[6],
      70, colors[7],
      80, colors[8],
      90, colors[9],
    ];
  }, [candidate, activeProp]);

  const colors = COLOR_SCALES[candidate];

  const onMouseMove = useCallback((e) => {
    if (!e.features?.length) return;
    const props = e.features[0].properties;
    const name = props.name || props.NAME || props.precinct_id || props.CNTYVTD || "";
    const val = props[activeProp] ?? null;
    setHoverInfo({ name, val });
  }, [activeProp]);

  const onMouseLeave = useCallback(() => setHoverInfo(null), []);

  if (!enrichedGeoJson) {
    return <div className="placeholder-card">Loading EI precinct data…</div>;
  }

  return (
    <div className="heatmap-container">
      <div className="demo-map-toolbar">
        <div className="demo-group-btn-group" role="group" aria-label="Candidate">
          {CANDIDATES.map((c) => (
            <button
              key={c}
              type="button"
              className={`demo-group-btn${candidate === c ? " active" : ""}`}
              onClick={() => setCandidate(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="demo-group-btn-group" role="group" aria-label="Race" style={{ marginLeft: "1rem" }}>
          {RACES.map((r) => (
            <button
              key={r}
              type="button"
              className={`demo-group-btn${race === r ? " active" : ""}`}
              onClick={() => setRace(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="heatmap-map-wrapper">
        <MapGL
          initialViewState={bbox
            ? { bounds: bbox, fitBoundsOptions: { padding: 20 } }
            : { longitude: mapView.center[0], latitude: mapView.center[1], zoom: mapView.zoom }
          }
          minZoom={mapView.minZoom}
          maxZoom={mapView.maxZoom}
          style={{ width: "100%", height: "100%" }}
          mapStyle={MAP_STYLE}
          interactiveLayerIds={["ei-precinct-fill"]}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          attributionControl={false}
        >
          <NavigationControl position="top-right" />

          <Source id="ei-precinct-source" type="geojson" data={enrichedGeoJson}>
            <Layer
              id="ei-precinct-fill"
              type="fill"
              paint={{ "fill-color": fillExpr, "fill-opacity": 0.75 }}
            />
            <Layer
              id="ei-precinct-line"
              type="line"
              paint={{ "line-color": "#ffffff", "line-width": 0.5, "line-opacity": 0.7 }}
            />
          </Source>

          {hoverInfo && (
            <div
              className="maplibre-tooltip"
              style={{
                position: "absolute",
                left: "10px",
                bottom: "10px",
                background: "rgba(255,255,255,0.95)",
                border: "1px solid #ccc",
                padding: "6px 10px",
                fontSize: "0.78rem",
                fontFamily: "Verdana, sans-serif",
                pointerEvents: "none",
                zIndex: 10,
              }}
            >
              <strong>{hoverInfo.name}</strong><br />
              {race} voters — {candidate}:{" "}
              {hoverInfo.val !== null ? `${hoverInfo.val.toFixed(1)}%` : "N/A"}
            </div>
          )}
        </MapGL>

        <div className="heatmap-legend">
          <div className="heatmap-legend-title">{race} voters — {candidate}</div>
          {STEPS.map((step, i) => (
            <div key={step} className="heatmap-legend-item">
              <span className="heatmap-legend-swatch" style={{ background: colors[i] }} />
              <span className="heatmap-legend-label">{step}–{step + 10}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
