import React, { useState, useMemo, useCallback } from "react";
import { Map as MapGL, Source, Layer, NavigationControl } from "react-map-gl/maplibre";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

function StateMap({ geojson, cfg, selectedDistrict, onDistrictSelect, districtParties }) {
  const [hoveredDistrict, setHoveredDistrict] = useState(null);

  const districtInfo = useMemo(() => {
    const map = {};
    if (districtParties) {
      for (const rep of districtParties) {
        map[rep.district] = { party: rep.party, margin: rep.vote_margin_pct ?? 0 };
      }
    }
    return map;
  }, [districtParties]);

  const fillColorExpr = useMemo(() => {
    const expr = ["match", ["to-number", ["get", "district"]]];
    for (let d = 1; d <= cfg.districts; d++) {
      const info = districtInfo[d];
      if (!info) {
        expr.push(d, "#ccc");
        continue;
      }
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
  }, [districtInfo, cfg.districts]);

  const onMapClick = useCallback((e) => {
    const features = e.features;
    if (features && features.length > 0) {
      const d = features[0].properties.district;
      const districtNumber = typeof d === "number" ? d : parseInt(d, 10);
      if (Number.isFinite(districtNumber)) {
        onDistrictSelect((prev) => prev === districtNumber ? null : districtNumber);
      }
    }
  }, [onDistrictSelect]);

  const onMouseMove = useCallback((e) => {
    if (e.features && e.features.length > 0) {
      const d = e.features[0].properties.district;
      setHoveredDistrict(typeof d === "number" ? d : parseInt(d, 10));
    } else {
      setHoveredDistrict(null);
    }
  }, []);

  const onMouseLeave = useCallback(() => setHoveredDistrict(null), []);

  const selectedFilter = useMemo(
    () => selectedDistrict !== null
      ? ["==", ["to-number", ["get", "district"]], selectedDistrict]
      : ["==", 1, 0],
    [selectedDistrict]
  );

  const hoverFilter = useMemo(
    () => hoveredDistrict !== null
      ? ["==", ["to-number", ["get", "district"]], hoveredDistrict]
      : ["==", 1, 0],
    [hoveredDistrict]
  );

  if (!geojson) return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      Loading map…
    </div>
  );

  return (
    <MapGL
      key={cfg.stateId}
      initialViewState={{
        longitude: cfg.mapView.center[0],
        latitude: cfg.mapView.center[1],
        zoom: cfg.mapView.zoom,
      }}
      minZoom={cfg.mapView.minZoom}
      maxZoom={cfg.mapView.maxZoom}
      style={{ width: "100%", height: "100%" }}
      mapStyle={MAP_STYLE}
      interactiveLayerIds={["district-fill"]}
      onClick={onMapClick}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      cursor={hoveredDistrict ? "pointer" : ""}
    >
      <NavigationControl position="top-right" />
      <Source id="districts" type="geojson" data={geojson}>
        <Layer
          id="district-fill"
          type="fill"
          paint={{ "fill-color": fillColorExpr, "fill-opacity": 0.72 }}
        />
        <Layer
          id="district-line"
          type="line"
          paint={{ "line-color": "#1a1a1a", "line-width": 1.5 }}
        />
        <Layer
          id="district-hover"
          type="line"
          filter={hoverFilter}
          paint={{ "line-color": "#f97316", "line-width": 3, "line-opacity": 0.7 }}
        />
        <Layer
          id="district-selected"
          type="line"
          filter={selectedFilter}
          paint={{ "line-color": "#f97316", "line-width": 4 }}
        />
      </Source>
    </MapGL>
  );
}

export default StateMap;
