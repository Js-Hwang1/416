import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";

const GROUP_LABELS = {
  hispanic: "Hispanic / Latino",
  black: "Black",
  asian: "Asian",
};

/* Monochromatic GREEN scale – politically neutral, 10 stops light→dark */
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

const BIN_WIDTH = 10;
const NUM_BINS = 10;

/**
 * Compute equal-width bins with integer bounds, eliminate empty bins,
 * and assign monochromatic colors to the remaining bins.
 */
function computeBinsAndColors(geojson, groupKey) {
  if (!geojson?.features?.length) return { bins: [], getColor: () => "#f0f0f0" };

  /* Create 10 bins: [0–10), [10–20), …, [90–100] */
  const allBins = Array.from({ length: NUM_BINS }, (_, i) => ({
    lo: i * BIN_WIDTH,
    hi: (i + 1) * BIN_WIDTH,
    count: 0,
  }));

  for (const feat of geojson.features) {
    const val = feat.properties[groupKey] ?? 0;
    const idx = Math.min(Math.floor(val / BIN_WIDTH), NUM_BINS - 1);
    allBins[idx].count++;
  }

  /* Keep only non-empty bins and assign labels + colors */
  const nonEmpty = allBins
    .filter((b) => b.count > 0)
    .map((b, i, arr) => {
      const t = arr.length > 1 ? i / (arr.length - 1) : 0;
      const colorIdx = Math.round(t * (MONO_SCALE.length - 1));
      return {
        ...b,
        label: `${b.lo}–${b.hi}%`,
        color: MONO_SCALE[colorIdx],
      };
    });

  /* Fast lookup: original-bin-index → colour */
  const colorByOrigIdx = {};
  for (const b of nonEmpty) {
    const origIdx = b.lo / BIN_WIDTH;
    colorByOrigIdx[origIdx] = b.color;
  }

  function getColor(val) {
    const idx = Math.min(Math.floor(val / BIN_WIDTH), NUM_BINS - 1);
    return colorByOrigIdx[idx] || "#f0f0f0";
  }

  return { bins: nonEmpty, getColor };
}

/* ---- auto-fit map to GeoJSON bounds ---- */
function FitBounds({ data, pathKey }) {
  const map = useMap();
  const lastPathRef = useRef(null);

  useEffect(() => {
    if (!data) return;
    if (lastPathRef.current === pathKey) return;
    lastPathRef.current = pathKey;

    const bounds = L.geoJSON(data).getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [map, data, pathKey]);

  return null;
}

export default function DemographicHeatMap({ geojsonPath, minorityGroups }) {
  const [geojson, setGeojson] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState("");

  /* Set initial group once groups are known */
  useEffect(() => {
    if (
      minorityGroups.length > 0 &&
      !minorityGroups.find((g) => g.key === selectedGroup)
    ) {
      setSelectedGroup(minorityGroups[0].key);
    }
  }, [minorityGroups, selectedGroup]);

  /* Fetch GeoJSON (resets on path change = state switch) */
  useEffect(() => {
    setGeojson(null);
    if (!geojsonPath) return;
    setLoading(true);
    const controller = new AbortController();
    fetch(geojsonPath, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        setGeojson(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("heatmap fetch error", err);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [geojsonPath]);

  /* Compute bins + color function for current group */
  const { bins, getColor } = useMemo(
    () => computeBinsAndColors(geojson, selectedGroup),
    [geojson, selectedGroup],
  );

  const styleFeature = useCallback(
    (feature) => {
      const val = feature.properties[selectedGroup] ?? 0;
      return {
        weight: 0.3,
        color: "#666",
        fillColor: getColor(val),
        fillOpacity: 0.85,
      };
    },
    [selectedGroup, getColor],
  );

  const onEachFeature = useCallback(
    (feature, layer) => {
      const props = feature.properties;
      const val = props[selectedGroup] ?? 0;
      const name = props.name || "";
      const pop = (props.pop || 0).toLocaleString();
      const vap = (props.vap || 0).toLocaleString();
      const label = GROUP_LABELS[selectedGroup] || selectedGroup;
      layer.bindTooltip(
        `<strong>${name}</strong><br/>${label} VAP: ${val.toFixed(1)}%<br/>Pop: ${pop} | VAP: ${vap}`,
        { sticky: true },
      );
    },
    [selectedGroup],
  );

  const geoJsonKey = `${geojsonPath}-${selectedGroup}-${geojson?.features?.length ?? 0}`;

  if (loading) {
    return (
      <div className="demographics-placeholder">
        <div className="demographics-placeholder-title">Loading precinct data...</div>
      </div>
    );
  }

  if (!geojson) {
    return (
      <div className="demographics-placeholder">
        <div className="demographics-placeholder-title">No data available</div>
      </div>
    );
  }

  return (
    <div className="heatmap-container">
      <div className="heatmap-controls">
        <span className="heatmap-controls-label">Minority Group:</span>
        <select
          className="heatmap-group-select"
          value={selectedGroup}
          onChange={(e) => setSelectedGroup(e.target.value)}
        >
          {minorityGroups.map((g) => (
            <option key={g.key} value={g.key}>
              {g.label}
            </option>
          ))}
        </select>
      </div>

      <div className="heatmap-map-wrapper">
        <MapContainer
          className="leaflet-map heatmap-leaflet"
          center={[37.8, -96]}
          zoom={4}
          zoomSnap={0.25}
          scrollWheelZoom={true}
          maxBoundsViscosity={1}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <GeoJSON
            key={geoJsonKey}
            data={geojson}
            style={styleFeature}
            onEachFeature={onEachFeature}
          />
          <FitBounds data={geojson} pathKey={geojsonPath} />
        </MapContainer>

        <div className="heatmap-legend">
          <div className="heatmap-legend-title">
            {GROUP_LABELS[selectedGroup] || selectedGroup} VAP %
          </div>
          {bins.map((b, i) => (
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
