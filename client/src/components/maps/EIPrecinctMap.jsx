import { useState, useMemo, useCallback } from "react";
import { Map as MapGL, Source, Layer, NavigationControl } from "react-map-gl/maplibre";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

const CANDIDATES = ["Harris (D)", "Trump (R)"];

// Blue scale for Harris (D), red scale for Trump (R)
const COLOR_SCALES = {
  "Harris (D)": ["#f7fbff", "#deebf7", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#08519c", "#08306b", "#041d40"],
  "Trump (R)":  ["#fff5f0", "#fee0d2", "#fcbba1", "#fc9272", "#fb6a4a", "#ef3b2c", "#cb181d", "#a50f15", "#67000d", "#3d0007"],
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

  // Merge EI estimates into precinct GeoJSON as weighted-average support per candidate
  const enrichedGeoJson = useMemo(() => {
    if (!precinctGeoJsonData || !eiPrecinctData) return null;
    const features = precinctGeoJsonData.features.map((feat) => {
      const props = feat.properties;
      // Try multiple possible precinct ID fields (TX uses CNTYVTD, MA uses NAME)
      const pid = props.precinct_id ?? props.CNTYVTD ?? props.NAME ?? props.name ?? "";
      const est = estimatesMap[pid];
      if (!est) return feat;

      // Demographic fractions: prefer pre-normalized 0..1 fractions if present,
      // else compute from the raw VAP counts that ship in the precinct geojson
      // (BVAP, HVAP/HISPVAP, ASIANVAP, WVAP, total VAP).
      let wh, bl, hi, as;
      if (typeof props.white === "number") {
        // Old shape (used by smaller heatmap geojsons): 0..100 percentages.
        wh = (props.white ?? 0) / 100;
        bl = (props.black ?? 0) / 100;
        hi = (props.hispanic ?? 0) / 100;
        as = (props.asian ?? 0) / 100;
      } else {
        const vap = props.VAP || 0;
        if (vap > 0) {
          wh = (props.WVAP || 0) / vap;
          bl = (props.BVAP || 0) / vap;
          // TX uses HISPVAP; MA uses HVAP
          hi = (props.HVAP || props.HISPVAP || 0) / vap;
          as = (props.ASIANVAP || 0) / vap;
        } else {
          wh = bl = hi = as = 0;
        }
      }

      const harris = (
        wh * (est["White"]?.["Harris (D)"] ?? 0) +
        bl * (est["Black"]?.["Harris (D)"] ?? 0) +
        hi * (est["Hispanic"]?.["Harris (D)"] ?? 0) +
        as * (est["Asian"]?.["Harris (D)"] ?? 0)
      ) * 100;

      const trump = (
        wh * (est["White"]?.["Trump (R)"] ?? 0) +
        bl * (est["Black"]?.["Trump (R)"] ?? 0) +
        hi * (est["Hispanic"]?.["Trump (R)"] ?? 0) +
        as * (est["Asian"]?.["Trump (R)"] ?? 0)
      ) * 100;

      return {
        ...feat,
        properties: {
          ...props,
          ei_harris: Math.round(harris * 10) / 10,
          ei_trump: Math.round(trump * 10) / 10,
        },
      };
    });
    return { ...precinctGeoJsonData, features };
  }, [precinctGeoJsonData, eiPrecinctData, estimatesMap]);

  const bbox = useMemo(
    () => precinctGeoJsonData ? getBbox(precinctGeoJsonData) : null,
    [precinctGeoJsonData]
  );

  const fillExpr = useMemo(() => buildFillExpr(candidate), [candidate]);
  const colors = COLOR_SCALES[candidate];

  const onMouseMove = useCallback((e) => {
    if (!e.features?.length) return;
    const props = e.features[0].properties;
    setHoverInfo({
      name: props.name || props.precinct_id || "",
      harris: props.ei_harris ?? null,
      trump: props.ei_trump ?? null,
    });
  }, []);

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
              paint={{ "fill-color": fillExpr, "fill-opacity": 0.85 }}
            />
            <Layer
              id="ei-precinct-line"
              type="line"
              paint={{ "line-color": "#666", "line-width": 0.3 }}
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
              {hoverInfo.harris !== null && <>Harris (D): {hoverInfo.harris.toFixed(1)}%<br /></>}
              {hoverInfo.trump !== null && <>Trump (R): {hoverInfo.trump.toFixed(1)}%</>}
            </div>
          )}
        </MapGL>

        <div className="heatmap-legend">
          <div className="heatmap-legend-title">EI Support — {candidate}</div>
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
