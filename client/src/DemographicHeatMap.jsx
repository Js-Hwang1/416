import { useState, useMemo, useCallback, useEffect } from "react";
import { Map as MapGL, Source, Layer, NavigationControl } from "react-map-gl/maplibre";

const GROUP_LABELS = {
  hispanic: "Latino",
  black: "Black",
  asian: "Asian",
};

/* Monochromatic GREEN scale - politically neutral, 10 stops light->dark */
const MONO_SCALE = [
  "#f7fcf5",
  "#e5f5e0",
  "#c7e9c0",
  "#a1d99b",
  "#74c476",
  "#41ab5d",
  "#238b45",
  "#006d2c",
  "#00441b",
  "#002d12",
];

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

/**
 * Build a MapLibre GL `step` expression for coloring features by demographic %.
 * Maps [0-10) -> color[0], [10-20) -> color[1], ... [90-100] -> color[9]
 */
function buildFillColorExpr(groupKey) {
  return [
    "step",
    ["coalesce", ["get", groupKey], 0],
    MONO_SCALE[0],       // 0-10%
    10, MONO_SCALE[1],   // 10-20%
    20, MONO_SCALE[2],   // 20-30%
    30, MONO_SCALE[3],   // 30-40%
    40, MONO_SCALE[4],   // 40-50%
    50, MONO_SCALE[5],   // 50-60%
    60, MONO_SCALE[6],   // 60-70%
    70, MONO_SCALE[7],   // 70-80%
    80, MONO_SCALE[8],   // 80-90%
    90, MONO_SCALE[9],   // 90-100%
  ];
}

/* Legend bins (always show all 10) */
const LEGEND_BINS = MONO_SCALE.map((color, i) => ({
  label: `${i * 10}\u2013${(i + 1) * 10}%`,
  color,
}));

/**
 * Build a MapLibre match expression for district party colors.
 * Same logic as StateMap — uses vote margin for color intensity.
 */
function buildDistrictFillExpr(numDistricts, districtParties) {
  const districtInfo = {};
  if (districtParties) {
    for (const rep of districtParties) {
      districtInfo[rep.district] = { party: rep.party, margin: rep.vote_margin_pct ?? 0 };
    }
  }
  const expr = ["match", ["to-number", ["get", "district"]]];
  for (let d = 1; d <= numDistricts; d++) {
    const info = districtInfo[d];
    if (!info) { expr.push(d, "#ccc"); continue; }
    const t = 0.3 + 0.7 * Math.min(info.margin / 60, 1);
    if (info.party === "Democrat") {
      const r = Math.round(220 - 130 * t);
      const g = Math.round(225 - 100 * t);
      const b = Math.round(255 - 40 * t);
      expr.push(d, `rgb(${r},${g},${b})`);
    } else if (info.party === "Republican") {
      const r = Math.round(255 - 40 * t);
      const g = Math.round(225 - 130 * t);
      const b = Math.round(220 - 130 * t);
      expr.push(d, `rgb(${r},${g},${b})`);
    } else {
      expr.push(d, "#ccc");
    }
  }
  expr.push("#ccc");
  return expr;
}

export default function DemographicHeatMap({
  precinctTilesUrl,
  blockTilesUrl,
  districtGeoJson,
  districtParties,
  numDistricts,
  mapView,
  selectedGroup,
  heatmapLevel,
  highlightedPrecinct,
}) {
  const [hoverInfo, setHoverInfo] = useState(null);
  const [districtGeojsonData, setDistrictGeojsonData] = useState(null);

  const fillColorExpr = useMemo(
    () => buildFillColorExpr(selectedGroup),
    [selectedGroup]
  );

  const isDistrict = heatmapLevel === "district";
  const isBlock = heatmapLevel === "block";

  /* Fetch district GeoJSON when needed */
  useEffect(() => {
    if (!districtGeoJson) return;
    fetch(districtGeoJson)
      .then((r) => r.json())
      .then(setDistrictGeojsonData)
      .catch((err) => console.error("Failed to load district geojson for heatmap", err));
  }, [districtGeoJson]);

  const districtFillExpr = useMemo(
    () => buildDistrictFillExpr(numDistricts || 0, districtParties),
    [numDistricts, districtParties]
  );

  const onMouseMove = useCallback((e) => {
    if (e.features && e.features.length > 0) {
      const props = e.features[0].properties;
      if (heatmapLevel === "district") {
        const dNum = typeof props.district === "number" ? props.district : parseInt(props.district, 10);
        const rep = districtParties?.find(r => r.district === dNum);
        setHoverInfo({
          lng: e.lngLat.lng,
          lat: e.lngLat.lat,
          name: props.name || `District ${props.district}`,
          districtNum: dNum,
          party: rep?.party || "N/A",
          representative: rep?.representative || "N/A",
        });
      } else {
        setHoverInfo({
          lng: e.lngLat.lng,
          lat: e.lngLat.lat,
          name: props.name || "",
          value: props[selectedGroup] ?? 0,
          pop: props.pop || 0,
        });
      }
    }
  }, [selectedGroup, heatmapLevel, districtParties]);

  const onMouseLeave = useCallback(() => {
    setHoverInfo(null);
  }, []);

  const label = GROUP_LABELS[selectedGroup] || selectedGroup;

  /* Build filter to highlight a specific precinct by unique ID.
     tippecanoe may coerce numeric-looking strings to numbers,
     so compare with to-string to handle both cases. */
  const highlightFilter = useMemo(() => {
    if (!highlightedPrecinct?.precinct_id) return ["==", 1, 0]; // match nothing
    return ["==", ["to-string", ["get", "precinct_id"]], String(highlightedPrecinct.precinct_id)];
  }, [highlightedPrecinct]);

  /* Use both sources always loaded; toggle visibility via layout.
     This avoids full map remount when switching levels. */
  const precinctVisibility = (!isBlock && !isDistrict) ? "visible" : "none";
  const blockVisibility = isBlock ? "visible" : "none";
  const districtVisibility = isDistrict ? "visible" : "none";
  const interactiveIds = isDistrict
    ? ["district-fill"]
    : isBlock
      ? ["block-fill"]
      : ["precinct-fill"];

  return (
    <div className="heatmap-container">
      <div className="heatmap-map-wrapper">
        <MapGL
          initialViewState={{
            longitude: mapView.center[0],
            latitude: mapView.center[1],
            zoom: mapView.zoom,
          }}
          minZoom={mapView.minZoom}
          maxZoom={mapView.maxZoom}
          style={{ width: "100%", height: "100%" }}
          mapStyle={MAP_STYLE}
          interactiveLayerIds={interactiveIds}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
        >
          <NavigationControl position="top-right" />

          {/* Precinct source — always loaded */}
          <Source id="precinct-source" type="vector" url={precinctTilesUrl}>
            <Layer
              id="precinct-fill"
              type="fill"
              source-layer="precincts"
              layout={{ visibility: precinctVisibility }}
              paint={{
                "fill-color": fillColorExpr,
                "fill-opacity": 0.85,
              }}
            />
            <Layer
              id="precinct-line"
              type="line"
              source-layer="precincts"
              layout={{ visibility: precinctVisibility }}
              paint={{
                "line-color": "#666",
                "line-width": 0.3,
              }}
            />
            <Layer
              id="precinct-highlight-fill"
              type="fill"
              source-layer="precincts"
              layout={{ visibility: precinctVisibility }}
              filter={highlightFilter}
              paint={{
                "fill-color": "#f97316",
                "fill-opacity": 0.35,
              }}
            />
            <Layer
              id="precinct-highlight"
              type="line"
              source-layer="precincts"
              layout={{ visibility: precinctVisibility }}
              filter={highlightFilter}
              paint={{
                "line-color": "#f97316",
                "line-width": 3,
              }}
            />
          </Source>

          {/* Block source — always loaded */}
          <Source id="block-source" type="vector" url={blockTilesUrl}>
            <Layer
              id="block-fill"
              type="fill"
              source-layer="blocks"
              layout={{ visibility: blockVisibility }}
              paint={{
                "fill-color": fillColorExpr,
                "fill-opacity": 0.85,
              }}
            />
            <Layer
              id="block-line"
              type="line"
              source-layer="blocks"
              layout={{ visibility: blockVisibility }}
              paint={{
                "line-color": "#666",
                "line-width": 0.2,
              }}
            />
          </Source>

          {/* District source — GeoJSON */}
          {districtGeojsonData && (
            <Source id="district-source" type="geojson" data={districtGeojsonData}>
              <Layer
                id="district-fill"
                type="fill"
                layout={{ visibility: districtVisibility }}
                paint={{
                  "fill-color": districtFillExpr,
                  "fill-opacity": 0.7,
                }}
              />
              <Layer
                id="district-line"
                type="line"
                layout={{ visibility: districtVisibility }}
                paint={{
                  "line-color": "#333",
                  "line-width": 1.5,
                }}
              />
            </Source>
          )}

          {/* Hover tooltip */}
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
              {isDistrict ? (
                <>
                  <strong>{hoverInfo.name}</strong><br />
                  Party: {hoverInfo.party}<br />
                  Rep: {hoverInfo.representative}
                </>
              ) : (
                <>
                  <strong>{hoverInfo.name}</strong><br />
                  {label}: {Number(hoverInfo.value).toFixed(1)}%<br />
                  Population: {Number(hoverInfo.pop).toLocaleString()}
                </>
              )}
            </div>
          )}
        </MapGL>

        {/* Legend — show demographic legend for precinct/block, party legend for district */}
        {isDistrict ? (
          <div className="heatmap-legend">
            <div className="heatmap-legend-title">Party</div>
            <div className="heatmap-legend-item">
              <span className="heatmap-legend-swatch" style={{ background: "rgb(90,125,215)" }} />
              <span className="heatmap-legend-label">Democrat</span>
            </div>
            <div className="heatmap-legend-item">
              <span className="heatmap-legend-swatch" style={{ background: "rgb(215,95,90)" }} />
              <span className="heatmap-legend-label">Republican</span>
            </div>
          </div>
        ) : (
          <div className="heatmap-legend">
            <div className="heatmap-legend-title">
              {label} Population %
            </div>
            {LEGEND_BINS.map((b, i) => (
              <div key={i} className="heatmap-legend-item">
                <span
                  className="heatmap-legend-swatch"
                  style={{ background: b.color }}
                />
                <span className="heatmap-legend-label">{b.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
