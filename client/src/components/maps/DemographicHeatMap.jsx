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
 * Compute which 0\u201310% bins are occupied in the precinct GeoJSON for the given group,
 * spread MONO_SCALE colors evenly across only those bins, and return both the
 * MapLibre step expression and the filtered legend entries.
 */
function buildDynamicScheme(features, groupKey) {
  const counts = Array(10).fill(0);
  for (const feat of features) {
    const val = feat.properties?.[groupKey];
    if (val == null) continue;
    counts[Math.min(Math.floor(val / 10), 9)]++;
  }

  const occupied = counts.reduce((acc, c, i) => { if (c > 0) acc.push(i); return acc; }, []);

  if (!occupied.length) {
    return {
      fillColorExpr: ["literal", MONO_SCALE[0]],
      legendBins: [{ label: "0\u201310%", color: MONO_SCALE[0] }],
    };
  }

  // Spread MONO_SCALE evenly across the occupied bins for maximum color separation
  const last = occupied.length - 1;
  const colors = occupied.map((_, i) =>
    MONO_SCALE[last === 0 ? 0 : Math.round(i * (MONO_SCALE.length - 1) / last)]
  );

  // MapLibre step: default color covers everything below the second occupied bin threshold
  const expr = ["step", ["coalesce", ["get", groupKey], 0], colors[0]];
  for (let i = 1; i < occupied.length; i++) {
    expr.push(occupied[i] * 10, colors[i]);
  }

  const legendBins = occupied.map((binIdx, i) => ({
    label: `${binIdx * 10}\u2013${(binIdx + 1) * 10}%`,
    color: colors[i],
  }));

  return { fillColorExpr: expr, legendBins };
}

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

// Enrich features that ship raw VAP counts (e.g. WVAP / BVAP / HVAP / ASIANVAP
// + total VAP) with normalized 0..100 percentages keyed by `white`/`black`/
// `hispanic`/`asian`. Returns a NEW GeoJSON object so React/maplibre treat
// it as a fresh source.
function enrichWithDemographics(geojson) {
  if (!geojson?.features?.length) return geojson;
  // If first feature already has the lowercase percentage fields we expect,
  // bail — nothing to do.
  const sample = geojson.features[0].properties || {};
  if (typeof sample.hispanic === "number" || typeof sample.black === "number") {
    return geojson;
  }
  const features = geojson.features.map((feat) => {
    const p = feat.properties || {};
    const vap = p.VAP || 0;
    if (vap <= 0) return feat;
    const props = {
      ...p,
      white:    +((p.WVAP || 0) / vap * 100).toFixed(2),
      black:    +((p.BVAP || 0) / vap * 100).toFixed(2),
      hispanic: +((p.HVAP || 0) / vap * 100).toFixed(2),
      asian:    +((p.ASIANVAP || 0) / vap * 100).toFixed(2),
      pop: p.TOTPOP ?? p.pop ?? 0,
      vap,
      name: p.NAME || p.name || "",
    };
    return { ...feat, properties: props };
  });
  return { ...geojson, features };
}

export default function DemographicHeatMap({
  districtGeoJsonData,
  precinctGeoJsonData,
  blockTilesUrl,
  districtParties,
  numDistricts,
  mapView,
  selectedGroup,
  heatmapLevel,
  highlightedPrecinct,
}) {
  const [hoverInfo, setHoverInfo] = useState(null);

  // Hi-res precinct geojson ships WVAP / BVAP / HVAP / ASIANVAP / VAP rather
  // than pre-normalized lowercase percentages. Compute them up front.
  const enrichedPrecincts = useMemo(
    () => enrichWithDemographics(precinctGeoJsonData),
    [precinctGeoJsonData]
  );

  const { fillColorExpr, legendBins } = useMemo(
    () => buildDynamicScheme(enrichedPrecincts?.features ?? [], selectedGroup),
    [enrichedPrecincts, selectedGroup]
  );

  const isDistrict = heatmapLevel === "district";
  const isBlock = heatmapLevel === "block";

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
          representative: rep?.name || "N/A",
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
    : isBlock && blockTilesUrl
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
          attributionControl={false}
        >
          <NavigationControl position="top-right" />

          {/* Precinct source — GeoJSON from API (enriched with derived demo%) */}
          {enrichedPrecincts && (
            <Source id="precinct-source" type="geojson" data={enrichedPrecincts}>
              <Layer
                id="precinct-fill"
                type="fill"
                layout={{ visibility: precinctVisibility }}
                paint={{
                  "fill-color": fillColorExpr,
                  "fill-opacity": 0.85,
                }}
              />
              <Layer
                id="precinct-line"
                type="line"
                layout={{ visibility: precinctVisibility }}
                paint={{
                  "line-color": "#666",
                  "line-width": 0.3,
                }}
              />
              <Layer
                id="precinct-highlight-fill"
                type="fill"
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
                layout={{ visibility: precinctVisibility }}
                filter={highlightFilter}
                paint={{
                  "line-color": "#f97316",
                  "line-width": 3,
                }}
              />
            </Source>
          )}

          {/* Block source — pmtiles vector (775k features; too big as a single
              geojson). Source layer name "blocks" matches what tippecanoe
              baked into the .pmtiles file. Properties already carry
              lowercase hispanic/black/asian/white percentages so the
              same fillColorExpr works. */}
          {blockTilesUrl && (
            <Source id="block-source" type="vector" url={blockTilesUrl}>
              <Layer
                id="block-fill"
                source-layer="blocks"
                type="fill"
                layout={{ visibility: blockVisibility }}
                paint={{
                  "fill-color": fillColorExpr,
                  "fill-opacity": 0.85,
                }}
              />
              <Layer
                id="block-line"
                source-layer="blocks"
                type="line"
                layout={{ visibility: blockVisibility }}
                paint={{
                  "line-color": "#666",
                  "line-width": 0.2,
                }}
              />
            </Source>
          )}

          {/* District source — GeoJSON */}
          {districtGeoJsonData && (
            <Source id="district-source" type="geojson" data={districtGeoJsonData}>
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
            {legendBins.map((b, i) => (
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
