import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as d3 from "d3";
import BoxPlotChart from './box_and_whisker';
import BarChart from "./bar_chart";
import ProbabilityChart from "./probability_curve";
import box_data from "./dummy_data/dummy_box_and_whisker.json";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";

const DISTRICT_COLORS = [
  "#e8e8e8", "#d4d4d4", "#c0c0c0", "#acacac",
  "#e0dcd0", "#ccc8bc", "#d8d4c8", "#c4c0b4",
  "#dcdcdc", "#c8c8c8", "#b4b4b4", "#e4e0d8",
  "#d0ccc0", "#bcb8ac", "#d4d0c4", "#c0bcb0",
  "#e0e0e0", "#cccccc", "#b8b8b8", "#a8a8a8",
  "#dcd8cc", "#c8c4b8", "#d4d0c8", "#c0bcb4",
  "#d8d8d8", "#c4c4c4", "#b0b0b0", "#e8e4dc",
  "#d4d0c4", "#c0bcb0", "#dcd8d0", "#c8c4bc",
  "#e4e4e4", "#d0d0d0", "#bcbcbc", "#d8d4cc",
  "#c4c0b8", "#b0aca4",
];

const STATE_DATA = {
  texas: {
    name: "Texas",
    abbr: "TX",
    fips: 48,
    districts: 38,
    population: "30,503,340",
    geojson: "/data/tx_districts.geojson",
    mapView: {
      fitPadding: [18, 18],
      zoomOffset: 0,
      panBoundsPad: 0.08,
    },
    ensembles: [
      {
        id: 1,
        type: "Race-Blind",
        plans: 5000,
        populationThreshold: "2.0%",
      },
      {
        id: 2,
        type: "VRA-Constrained",
        plans: 5000,
        populationThreshold: "2.0%",
      },
    ],
  },
  massachusetts: {
    name: "Massachusetts",
    abbr: "MA",
    fips: 25,
    districts: 9,
    population: "7,029,917",
    geojson: "/data/ma_districts.geojson",
    mapView: {
      fitPadding: [18, 18],
      zoomOffset: 0,
      panBoundsPad: 0.08,
    },
    ensembles: [
      {
        id: 1,
        type: "Race-Blind",
        plans: 5000,
        populationThreshold: "2.0%",
      },
      {
        id: 2,
        type: "VRA-Constrained",
        plans: 5000,
        populationThreshold: "2.0%",
      },
    ],
  },
};

const VIEWS = [
  { id: "planExplorer", label: "Plan Explorer" },
  { id: "demographics", label: "Demographics" },
  { id: "ginglesAnalysis", label: "Gingles Analysis" },
  { id: "ecologicalInference", label: "Ecological Inference" },
  { id: "ensembles", label: "Ensembles" },
  { id: "fairness", label: "Fairness" },
];

function StateMap({ geojsonPath, mapView }) {
  const [geojson, setGeojson] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    setGeojson(null);
    fetch(geojsonPath, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setGeojson(data))
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("geojson fetch error", err);
        }
      });

    return () => {
      controller.abort();
    };
  }, [geojsonPath]);

  const styleFeature = (feature) => {
    const rawDistrict =
      feature?.properties?.district ??
      feature?.properties?.DISTRICT ??
      feature?.properties?.District;
    const districtNumber = Number.parseInt(String(rawDistrict), 10);
    const colorIndex = Number.isFinite(districtNumber)
      ? Math.abs(districtNumber - 1) % DISTRICT_COLORS.length
      : 0;

    return {
      weight: 1.5,
      color: "#1a1a1a",
      fillColor: DISTRICT_COLORS[colorIndex],
      fillOpacity: 0.82,
    };
  };

  const onEachFeature = (feature, layer) => {
    const label =
      feature?.properties?.name ??
      feature?.properties?.DISTRICT ??
      feature?.properties?.district ??
      "district";
    layer.bindTooltip(String(label), { sticky: true });
    layer.on({
      mouseover: () => {
        layer.setStyle({ weight: 2.2, fillOpacity: 0.92 });
        layer.bringToFront();
      },
      mouseout: () => {
        layer.setStyle(styleFeature(feature));
      },
    });
  };

  const geoJsonKey = useMemo(
    () => `${geojsonPath}-${geojson?.features?.length ?? 0}`,
    [geojsonPath, geojson]
  );

  function FitGeoJsonBounds({ data, view }) {
    const map = useMap();

    useEffect(() => {
      if (!data) return;

      const bounds = L.geoJSON(data).getBounds();
      if (bounds.isValid()) {
        const fitPadding = view?.fitPadding ?? [18, 18];
        const zoomOffset = view?.zoomOffset ?? 0;
        const panBoundsPad = view?.panBoundsPad ?? 0.08;
        const paddingPoint = L.point(fitPadding[0], fitPadding[1]);

        // Reset min zoom before fitting in case previous state had a higher lock.
        map.setMinZoom(0);

        const fittedZoom = map.getBoundsZoom(bounds, false, paddingPoint);
        const targetZoom = fittedZoom + zoomOffset;
        map.setView(bounds.getCenter(), targetZoom, { animate: false });

        // Lock zoom-out so the initial fitted/offset view is the maximum zoom-out.
        map.setMinZoom(targetZoom);
        // Keep panning near the selected state's extent.
        map.setMaxBounds(bounds.pad(panBoundsPad));
      }
    }, [map, data, view]);

    return null;
  }

  return (
    <MapContainer
      className="leaflet-map"
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
      {geojson && (
        <>
          <GeoJSON
            key={geoJsonKey}
            data={geojson}
            style={styleFeature}
            onEachFeature={onEachFeature}
          />
          <FitGeoJsonBounds data={geojson} view={mapView} />
        </>
      )}
    </MapContainer>
  );
}

export default function StatePage() {
  const { stateSlug } = useParams();
  const navigate = useNavigate();
  const stateInfo = STATE_DATA[stateSlug];
  const [activeView, setActiveView] = useState("planExplorer");

  if (!stateInfo) {
    return (
      <div className="state-page">
        <div className="state-page-inner">
          <h1>State not found</h1>
          <button className="back-button" onClick={() => navigate("/")}>
            Back to Map
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="state-page fade-in">
      <nav className="state-nav">
        <div className="nav-left">
          <select
            className="state-dropdown"
            value={stateSlug}
            onChange={(e) => navigate(`/state/${e.target.value}`)}
          >
            <option value="texas">Texas</option>
            <option value="massachusetts">Massachusetts</option>
          </select>
        </div>

        <div className="nav-views">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              className={`nav-view-btn${activeView === v.id ? " active" : ""}`}
              onClick={() => setActiveView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>

        <span className="nav-title">{}</span>
      </nav>

      <header className="state-header">
        <div className="header-content">
          <span className="state-abbr-badge">{stateInfo.abbr}</span>
          <h1 className="state-name">{stateInfo.name}</h1>
          <div className="state-meta">
            <div className="meta-item">
              <span className="meta-label">Districts</span>
              <span className="meta-value">{stateInfo.districts}</span>
            </div>
            <div className="meta-divider"></div>
            <div className="meta-item">
              <span className="meta-label">Population</span>
              <span className="meta-value">{stateInfo.population}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="state-content">
        {activeView === "planExplorer" && (
          <div className="state-layout">
            <div className="state-map-panel">
              <h2 className="section-title">Congressional Districts</h2>
              <div className="state-map-wrapper">
                <StateMap geojsonPath={stateInfo.geojson} mapView={stateInfo.mapView} />
              </div>
              <button className="compare-enacted-btn" onClick={() => {}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v18M3 12h18" />
                </svg>
                Compare with Enacted
              </button>
            </div>

            <div className="state-info-panel">
              <section className="state-section">
                <h2 className="section-title">Ensemble Summary</h2>
                <table className="ensemble-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Plans</th>
                      <th>Pop. Threshold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stateInfo.ensembles.map((e) => (
                      <tr key={e.id}>
                        <td className="td-label">{e.type}</td>
                        <td className="td-number">{e.plans.toLocaleString()}</td>
                        <td className="td-number">{e.populationThreshold}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          </div>
        )}

        {activeView === "ensembles" && (
          <div className="chart-view">
            <div className="chart-toolbar">
              <span className="chart-toolbar-subtitle">
                R/D split frequency across {stateInfo.ensembles[0].plans.toLocaleString()} simulated plans
              </span>
            </div>
            <div className="chart-body">
              <BarChart />
            </div>
          </div>
        )}

        {activeView === "demographics" && (
          <div className="chart-view">
            <div className="chart-toolbar">
              <span className="chart-toolbar-subtitle">
                Minority group distribution across ensemble district plans
              </span>
            </div>
            <div className="chart-body">
              <BoxPlotChart districts={box_data.districts} />
            </div>
          </div>
        )}

        {activeView === "ecologicalInference" && (
          <div className="chart-view">
            <div className="chart-toolbar">
              <span className="chart-toolbar-subtitle">
                Ecological inference of candidate support by racial/ethnic group
              </span>
            </div>
            <div className="chart-body">
              <ProbabilityChart />
            </div>
          </div>
        )}

        {activeView === "ginglesAnalysis" && (
          <div className="chart-view">
            <div className="chart-toolbar">
              <span className="chart-toolbar-subtitle">
                Gingles analysis visualizations will appear here
              </span>
            </div>
            <div className="chart-body">
              <div className="placeholder-card">Coming soon</div>
            </div>
          </div>
        )}

        {activeView === "fairness" && (
          <div className="chart-view">
            <div className="chart-toolbar">
              <span className="chart-toolbar-subtitle">
                Fairness analysis visualizations will appear here
              </span>
            </div>
            <div className="chart-body">
              <div className="placeholder-card">Coming soon</div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
