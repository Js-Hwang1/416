import { useState, useMemo, useCallback } from "react";
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

export default function DemographicHeatMap({
  precinctTilesUrl,
  blockTilesUrl,
  mapView,
  selectedGroup,
}) {
  const [hoverInfo, setHoverInfo] = useState(null);

  const fillColorExpr = useMemo(
    () => buildFillColorExpr(selectedGroup),
    [selectedGroup]
  );

  const tilesUrl = precinctTilesUrl;
  const sourceLayer = "precincts";

  const onMouseMove = useCallback((e) => {
    if (e.features && e.features.length > 0) {
      const props = e.features[0].properties;
      setHoverInfo({
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
        name: props.name || "",
        value: props[selectedGroup] ?? 0,
        pop: props.pop || 0,
      });
    }
  }, [selectedGroup]);

  const onMouseLeave = useCallback(() => {
    setHoverInfo(null);
  }, []);

  const label = GROUP_LABELS[selectedGroup] || selectedGroup;

  return (
    <div className="heatmap-container">
      <div className="heatmap-map-wrapper">
        <MapGL
          key={`${tilesUrl}-${selectedGroup}`}
          initialViewState={{
            longitude: mapView.center[0],
            latitude: mapView.center[1],
            zoom: mapView.zoom,
          }}
          minZoom={mapView.minZoom}
          maxZoom={mapView.maxZoom}
          style={{ width: "100%", height: "100%" }}
          mapStyle={MAP_STYLE}
          interactiveLayerIds={["heatmap-fill"]}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
        >
          <NavigationControl position="top-right" />
          <Source id="heatmap-source" type="vector" url={tilesUrl}>
            <Layer
              id="heatmap-fill"
              type="fill"
              source-layer={sourceLayer}
              paint={{
                "fill-color": fillColorExpr,
                "fill-opacity": 0.85,
              }}
            />
            <Layer
              id="heatmap-line"
              type="line"
              source-layer={sourceLayer}
              paint={{
                "line-color": "#666",
                "line-width": 0.3,
              }}
            />
          </Source>

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
              <strong>{hoverInfo.name}</strong><br />
              {label}: {Number(hoverInfo.value).toFixed(1)}%<br />
              Population: {Number(hoverInfo.pop).toLocaleString()}
            </div>
          )}
        </MapGL>

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
      </div>
    </div>
  );
}
