import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import BoxPlotChart from './box_and_whisker';
import BarChart from "./bar_chart";
import ProbabilityChart from "./probability_curve";
import GinglessScatterPlot from "./gingles_scatter";
import DemographicHeatMap from "./DemographicHeatMap";
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

const STATE_CONFIG = {
  texas: {
    name: "Texas",
    abbr: "TX",
    fips: 48,
    districts: 38,
    geojson: `${process.env.PUBLIC_URL}/data/tx_districts.geojson`,
    summaryFile: `${process.env.PUBLIC_URL}/data/tx_state_summary.json`,
    repsFile: `${process.env.PUBLIC_URL}/data/congressional_reps.json`,
    ginglesFile: `${process.env.PUBLIC_URL}/data/tx_gingles_precinct.json`,
    regressionFile: `${process.env.PUBLIC_URL}/data/tx_gingles_regression.json`,
    enactedDemoFile: `${process.env.PUBLIC_URL}/data/tx_enacted_demographics.json`,
    heatmapGeojson: `${process.env.PUBLIC_URL}/data/tx_vtds_heatmap.geojson`,
    repsKey: "TX",
    mapView: {
      fitPadding: [18, 18],
      zoomOffset: 0,
      panBoundsPad: 0.08,
    },
    redistrictingAuthority: "Republican Legislature",
    ensembles: [
      { id: 1, type: "Race-Blind", plans: 5000, populationThreshold: "2.0%" },
      { id: 2, type: "VRA-Constrained", plans: 5000, populationThreshold: "2.0%" },
    ],
  },
  massachusetts: {
    name: "Massachusetts",
    abbr: "MA",
    fips: 25,
    districts: 9,
    geojson: `${process.env.PUBLIC_URL}/data/ma_districts.geojson`,
    summaryFile: `${process.env.PUBLIC_URL}/data/ma_state_summary.json`,
    repsFile: `${process.env.PUBLIC_URL}/data/congressional_reps.json`,
    ginglesFile: `${process.env.PUBLIC_URL}/data/ma_gingles_precinct.json`,
    regressionFile: `${process.env.PUBLIC_URL}/data/ma_gingles_regression.json`,
    enactedDemoFile: `${process.env.PUBLIC_URL}/data/ma_enacted_demographics.json`,
    heatmapGeojson: `${process.env.PUBLIC_URL}/data/ma_precincts_heatmap.geojson`,
    repsKey: "MA",
    mapView: {
      fitPadding: [18, 18],
      zoomOffset: 0,
      panBoundsPad: 0.08,
    },
    redistrictingAuthority: "Democratic Legislature",
    ensembles: [
      { id: 1, type: "Race-Blind", plans: 5000, populationThreshold: "2.0%" },
      { id: 2, type: "VRA-Constrained", plans: 5000, populationThreshold: "2.0%" },
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

const INTERESTING_PLAN_OPTIONS = [
  { value: "enacted", label: "Enacted" },
  { value: "max_d", label: "Max D" },
  { value: "min_d", label: "Min D" },
  { value: "median", label: "Median" },
  { value: "most_competitive", label: "Most Competitive" },
  { value: "least_competitive", label: "Least Competitive" },
  { value: "fewest_county_splits", label: "Fewest County Splits" },
  { value: "most_county_splits", label: "Most County Splits" },
  { value: "max_minority_districts", label: "Max Minority Districts" },
  { value: "min_minority_districts", label: "Min Minority Districts" },
];

const ENSEMBLES_SUBTABS = [
  { id: "seatSplits", label: "Seat Splits" },
  { id: "minorityDistribution", label: "Minority Distribution" },
];

const DEMOGRAPHICS_SUBTABS = [
  { id: "precinct", label: "Precinct" },
  { id: "censusBlock", label: "Census Block" },
];

const ECOLOGICAL_INFERENCE_SUBTABS = [
  { id: "probabilityCurves", label: "Probability Curves" },
  { id: "supportSummary", label: "Support Summary" },
  { id: "precinctMap", label: "Precinct Map" },
  { id: "groupComparison", label: "Group Comparison" },
];

const GINGLES_GROUPS = [
  { key: "hispanic", label: "Hispanic" },
  { key: "black", label: "Black" },
  { key: "asian", label: "Asian" },
];

function formatNumber(value) {
  return Number(value).toLocaleString();
}

function formatPercent(value, total) {
  if (!total) return "0.00%";
  const pct = (value / total) * 100;
  return `${pct.toFixed(2)}%`;
}

function formatPct1(value) {
  return `${Number(value).toFixed(1)}%`;
}

function parseDistrictNumber(feature) {
  const rawDistrict =
    feature?.properties?.district ??
    feature?.properties?.DISTRICT ??
    feature?.properties?.District;
  const districtNumber = Number.parseInt(String(rawDistrict), 10);
  return Number.isFinite(districtNumber) ? districtNumber : null;
}

/* ---------- helper: fetch JSON with abort support ---------- */
function useFetchJson(url) {
  const [data, setData] = useState(null);
  useEffect(() => {
    setData(null);              // reset immediately so stale data is cleared
    if (!url) return;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then((r) => r.json())
      .then(setData)
      .catch((err) => {
        if (err.name !== "AbortError") console.error("fetch error", url, err);
      });
    return () => controller.abort();
  }, [url]);
  return data;
}

/* ---------- StateMap ---------- */
function StateMap({ geojsonPath, mapView, selectedDistrict, onDistrictSelect }) {
  const [geojson, setGeojson] = useState(null);
  const hasFittedBoundsRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    hasFittedBoundsRef.current = false;
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
    const districtNumber = parseDistrictNumber(feature);
    const colorIndex = Number.isFinite(districtNumber)
      ? Math.abs(districtNumber - 1) % DISTRICT_COLORS.length
      : 0;

    return {
      weight: 1.5,
      color: "#1a1a1a",
      fillColor: DISTRICT_COLORS[colorIndex],
      fillOpacity: 0.82,
      smoothFactor: 0,
    };
  };

  const selectedDistrictStyle = (feature) => {
    const districtNumber = parseDistrictNumber(feature);
    const colorIndex = Number.isFinite(districtNumber)
      ? Math.abs(districtNumber - 1) % DISTRICT_COLORS.length
      : 0;

    return {
      weight: 2.5,
      color: "#999",
      fillColor: DISTRICT_COLORS[colorIndex],
      fillOpacity: 0.82,
      smoothFactor: 0,
    };
  };

  const onEachFeature = (feature, layer) => {
    /* Disable Leaflet's built-in rendering simplification */
    if (layer.options) layer.options.smoothFactor = 0;

    layer.on({
      mouseover: () => {
        layer.setStyle({ weight: 2.5 });
      },
      mouseout: () => {
        layer.setStyle({ weight: 1.5 });
      },
      click: () => {
        const clickedDistrictNumber = parseDistrictNumber(feature);
        if (clickedDistrictNumber !== null) {
          onDistrictSelect((prevSelected) =>
            prevSelected === clickedDistrictNumber ? null : clickedDistrictNumber
          );
        }
      },
    });
  };

  const geoJsonKey = useMemo(
    () => `${geojsonPath}-${geojson?.features?.length ?? 0}`,
    [geojsonPath, geojson]
  );

  const selectedDistrictGeojson = useMemo(() => {
    if (!geojson || selectedDistrict === null) return null;
    const selectedFeatures = (geojson.features ?? []).filter(
      (feature) => parseDistrictNumber(feature) === selectedDistrict
    );
    if (selectedFeatures.length === 0) return null;
    return {
      ...geojson,
      features: selectedFeatures,
    };
  }, [geojson, selectedDistrict]);

  function FitGeoJsonBounds({ data, view }) {
    const map = useMap();

    useEffect(() => {
      if (!data) return;
      if (hasFittedBoundsRef.current) return;

      const bounds = L.geoJSON(data).getBounds();
      if (bounds.isValid()) {
        const fitPadding = view?.fitPadding ?? [18, 18];
        const zoomOffset = view?.zoomOffset ?? 0;
        const panBoundsPad = view?.panBoundsPad ?? 0.08;
        const paddingPoint = L.point(fitPadding[0], fitPadding[1]);

        map.setMinZoom(0);
        map.setMaxBounds(null);

        const fittedZoom = map.getBoundsZoom(bounds, false, paddingPoint);
        const targetZoom = fittedZoom + zoomOffset;
        map.setView(bounds.getCenter(), targetZoom, { animate: false });

        map.setMinZoom(targetZoom);
        map.setMaxBounds(bounds.pad(panBoundsPad));
        hasFittedBoundsRef.current = true;
      }
    }, [map, data, view]);

    return null;
  }

  return (
    <MapContainer
      key={geojsonPath}
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
            smoothFactor={0}
          />
          {selectedDistrictGeojson && (
            <GeoJSON
              key={`selected-${selectedDistrict}`}
              data={selectedDistrictGeojson}
              style={selectedDistrictStyle}
              interactive={false}
              smoothFactor={0}
            />
          )}
          <FitGeoJsonBounds data={geojson} view={mapView} />
        </>
      )}
    </MapContainer>
  );
}

/* =================================================================== */
/* StatePage                                                           */
/* =================================================================== */
export default function StatePage() {
  const { stateSlug } = useParams();
  const navigate = useNavigate();
  const cfg = STATE_CONFIG[stateSlug];

  /* ---- view / UI state ---- */
  const [activeView, setActiveView] = useState("planExplorer");
  const [activeDetailPanel, setActiveDetailPanel] = useState("stateOverview");
  const [activeEnsemblesSubtab, setActiveEnsemblesSubtab] = useState("seatSplits");
  const [activeDemographicsSubtab, setActiveDemographicsSubtab] = useState("precinct");
  const [activeEcologicalSubtab, setActiveEcologicalSubtab] = useState("probabilityCurves");
  const [selectedInterestingPlan, setSelectedInterestingPlan] = useState("enacted");
  const [isInterestingPlanOpen, setIsInterestingPlanOpen] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [ginglesGroup, setGinglesGroup] = useState("hispanic");
  const [ginglesPage, setGinglesPage] = useState(0);
  const GINGLES_PAGE_SIZE = 10;

  const interestingPlanRef = useRef(null);
  const districtTableWrapperRef = useRef(null);
  const districtRowRefs = useRef(new Map());
  const isStateOverviewPanel = activeDetailPanel === "stateOverview";

  /* ---- fetch real data ---- */
  const summary = useFetchJson(cfg?.summaryFile);
  const allReps = useFetchJson(cfg?.repsFile);
  const ginglesData = useFetchJson(cfg?.ginglesFile);
  const regressionData = useFetchJson(cfg?.regressionFile);
  const enactedDemo = useFetchJson(cfg?.enactedDemoFile);
  const heatmapGeojson = useFetchJson(cfg?.heatmapGeojson);

  const reps = allReps?.[cfg?.repsKey];

  /* ---- minority groups available for heatmap dropdown ---- */
  const heatmapMinorityGroups = useMemo(() => {
    if (!summary?.population_by_group) return [];
    const MINORITY_LABELS = {
      hispanic: "Hispanic / Latino",
      black: "Black",
      asian: "Asian",
    };
    // Show all minority groups that have nonzero population
    return Object.entries(summary.population_by_group)
      .filter(([g, pop]) => g in MINORITY_LABELS && pop > 0)
      .map(([g]) => ({ key: g, label: MINORITY_LABELS[g] }));
  }, [summary]);

  /* ---- build overview from fetched summary ---- */
  const overview = useMemo(() => {
    if (!summary) return null;
    const pop = summary.population_by_group || {};
    const pres = summary.presidential_2024 || {};
    const otherPct = Math.max(0, 100 - (pres.dem_pct || 0) - (pres.rep_pct || 0));
    return {
      totalPopulation: summary.total_population,
      votingAgePopulation: summary.voting_age_population,
      populationByGroup: {
        White: pop.white ?? 0,
        Black: pop.black ?? 0,
        "Hispanic / Latino": pop.hispanic ?? 0,
        Asian: pop.asian ?? 0,
        Other: pop.other ?? 0,
      },
      voterShare: {
        democratic: pres.dem_pct ?? 0,
        republican: pres.rep_pct ?? 0,
        other: Math.round(otherPct * 10) / 10,
      },
      congressionalByParty: summary.party_split ?? {},
    };
  }, [summary]);

  /* ---- build district table rows from fetched reps ---- */
  const districtTableRows = useMemo(() => {
    if (!reps?.representatives) {
      return Array.from({ length: cfg?.districts ?? 0 }, (_, i) => ({
        districtNumber: String(i + 1),
        representative: "...",
        party: "--",
        racialEthnicGroup: "--",
        voteMargin: "--",
      }));
    }
    return reps.representatives.map((r) => ({
      districtNumber: String(r.district),
      representative: r.name,
      party: r.party,
      racialEthnicGroup: r.race_ethnicity,
      voteMargin:
        r.vote_margin_pct !== undefined
          ? `${r.vote_margin_pct.toFixed(1)}%`
          : "--",
    }));
  }, [reps, cfg]);

  /* ---- gingles table data ---- */
  const ginglesPoints = ginglesData?.[ginglesGroup] ?? [];
  const ginglesTotalPages = Math.ceil(ginglesPoints.length / GINGLES_PAGE_SIZE);
  const ginglesPageRows = ginglesPoints.slice(
    ginglesPage * GINGLES_PAGE_SIZE,
    (ginglesPage + 1) * GINGLES_PAGE_SIZE
  );

  // Reset gingles page when group changes
  useEffect(() => {
    setGinglesPage(0);
  }, [ginglesGroup]);

  /* ---- close dropdown on outside click ---- */
  useEffect(() => {
    const onDocumentMouseDown = (event) => {
      if (!interestingPlanRef.current?.contains(event.target)) {
        setIsInterestingPlanOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => document.removeEventListener("mousedown", onDocumentMouseDown);
  }, []);

  /* ---- reset district selection when switching state ---- */
  useEffect(() => {
    setSelectedDistrict(null);
  }, [stateSlug]);

  /* ---- auto-scroll to selected district row ---- */
  useEffect(() => {
    if (selectedDistrict === null) return;

    const wrapper = districtTableWrapperRef.current;
    const row = districtRowRefs.current.get(selectedDistrict);
    if (!wrapper || !row) return;

    const rowTop = row.offsetTop;
    const rowBottom = rowTop + row.offsetHeight;
    const visibleTop = wrapper.scrollTop;
    const visibleBottom = visibleTop + wrapper.clientHeight;

    if (rowTop < visibleTop) {
      wrapper.scrollTo({ top: rowTop, behavior: "smooth" });
    } else if (rowBottom > visibleBottom) {
      wrapper.scrollTo({ top: rowBottom - wrapper.clientHeight, behavior: "smooth" });
    }
  }, [selectedDistrict, isStateOverviewPanel]);

  if (!cfg) {
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

  /* helper: use real overview or loading fallback */
  const ov = overview || {
    totalPopulation: 0,
    votingAgePopulation: 0,
    populationByGroup: {},
    voterShare: { democratic: 0, republican: 0, other: 0 },
    congressionalByParty: {},
  };

  return (
    <div className="state-page fade-in">
      <nav className="state-nav">
        <div className="nav-left">
          <select
            className="state-nav-dropdown"
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

        <div className="nav-right">
          <button className="back-button" onClick={() => navigate("/")}>
            Reset
          </button>
        </div>
      </nav>

      <main className={`state-content${activeView === "planExplorer" ? " plan-explorer-content" : ""}${activeView === "ginglesAnalysis" ? " gingles-content" : ""}`}>
        {activeView === "planExplorer" && (
          <div className="state-layout">
            <div className="state-map-panel">
              <h2 className="section-title">Congressional Districts</h2>
              <div className="state-map-wrapper">
                <StateMap
                  geojsonPath={cfg.geojson}
                  mapView={cfg.mapView}
                  selectedDistrict={selectedDistrict}
                  onDistrictSelect={setSelectedDistrict}
                />
              </div>
              <div className="interesting-plan-controls">
                <div className="interesting-plan-dropdown" ref={interestingPlanRef}>
                  <button
                    type="button"
                    className="plan-select-dropdown interesting-plan-select"
                    onClick={() => setIsInterestingPlanOpen((prev) => !prev)}
                  >
                    {selectedInterestingPlan
                      ? INTERESTING_PLAN_OPTIONS.find((o) => o.value === selectedInterestingPlan)?.label
                      : "Enacted"}
                  </button>
                  {isInterestingPlanOpen && (
                    <div
                      className="interesting-plan-menu"
                      onWheel={(e) => e.stopPropagation()}
                      onTouchMove={(e) => e.stopPropagation()}
                    >
                      {INTERESTING_PLAN_OPTIONS.map((option) => (
                        <button
                          type="button"
                          key={option.value}
                          className="interesting-plan-option"
                          onClick={() => {
                            setSelectedInterestingPlan(option.value);
                            setIsInterestingPlanOpen(false);
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="compare-enacted-btn"
                  disabled={selectedInterestingPlan === "enacted"}
                >
                  Compare with enacted
                </button>
                <button
                  type="button"
                  className="compare-enacted-btn panel-mode-toggle-btn"
                  onClick={() =>
                    setActiveDetailPanel((prev) =>
                      prev === "stateOverview" ? "districtDetail" : "stateOverview"
                    )
                  }
                >
                  {isStateOverviewPanel ? "District Detail" : "State Overview"}
                </button>
              </div>
            </div>

            <div className="state-info-panel">
              <section className="state-section">
                <h2 className="section-title">{isStateOverviewPanel ? "State Overview" : "District Detail"}</h2>
                {isStateOverviewPanel ? (
                  <div className="overview-cards">
                    <article className="overview-card">
                      <h3 className="overview-card-title">Population</h3>
                      <dl className="overview-kv-list">
                        <div className="overview-kv-row">
                          <dt>Total Population</dt>
                          <dd>{formatNumber(ov.totalPopulation)}</dd>
                        </div>
                        {/* <div className="overview-kv-row">
                          <dt>Voting Age Population</dt>
                          <dd>{formatNumber(ov.votingAgePopulation)}</dd>
                        </div>*/}
                      </dl>
                    </article>

                    <article className="overview-card">
                      <h3 className="overview-card-title">Statewide Voter Distribution</h3>
                      <dl className="overview-kv-list">
                        <div className="overview-kv-row">
                          <dt>Democratic Vote Share</dt>
                          <dd>{formatPct1(ov.voterShare.democratic)}</dd>
                        </div>
                        <div className="overview-kv-row">
                          <dt>Republican Vote Share</dt>
                          <dd>{formatPct1(ov.voterShare.republican)}</dd>
                        </div>
                        {/* <div className="overview-kv-row">
                          <dt>Other</dt>
                          <dd>{formatPct1(ov.voterShare.other)}</dd>
                        </div>*/}
                      </dl>
                    </article>

                    <article className="overview-card">
                      <h3 className="overview-card-title">Racial/Ethnic Population Share</h3>
                      <dl className="overview-kv-list">
                        {Object.entries(ov.populationByGroup).map(([group, value]) => (
                          <div className="overview-kv-row" key={group}>
                            <dt>{group}</dt>
                            <dd>
                              {formatPercent(value, ov.totalPopulation)} ({formatNumber(value)})
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </article>

                    <article className="overview-card">
                      <h3 className="overview-card-title">Redistricting Control</h3>
                      <dl className="overview-kv-list">
                        <div className="overview-kv-row">
                          <dt>Redistricting Authority</dt>
                          <dd>{cfg.redistrictingAuthority}</dd>
                        </div>
                      </dl>
                    </article>

                    <article className="overview-card">
                      <h3 className="overview-card-title">Congressional Representation</h3>
                      <dl className="overview-kv-list">
                        <div className="overview-kv-row">
                          <dt>Democrats</dt>
                          <dd>{ov.congressionalByParty.Democrat ?? 0}</dd>
                        </div>
                        <div className="overview-kv-row">
                          <dt>Republicans</dt>
                          <dd>{ov.congressionalByParty.Republican ?? 0}</dd>
                        </div>
                        <div className="overview-kv-row">
                          <dt>Total Seats</dt>
                          <dd>{(ov.congressionalByParty.Democrat ?? 0) + (ov.congressionalByParty.Republican ?? 0)}</dd>
                        </div>
                      </dl>
                    </article>

                    <article className="overview-card">
                      <h3 className="overview-card-title">Available Ensembles</h3>
                      <dl className="overview-kv-list">
                        {cfg.ensembles.map((ensemble) => (
                          <React.Fragment key={ensemble.id}>
                            <div className="overview-kv-row">
                              <dt style={{ fontWeight: 600 }}>{ensemble.type}</dt>
                              <dd>—</dd>
                            </div>
                            <div className="overview-kv-row">
                              <dt style={{ paddingLeft: "1em" }}>District Plans</dt>
                              <dd>{ensemble.plans.toLocaleString()} <span style={{ color: "#aaa", fontSize: "0.85em" }}></span></dd>
                            </div>
                            <div className="overview-kv-row">
                              <dt style={{ paddingLeft: "1em" }}>Population Threshold</dt>
                              <dd>{ensemble.populationThreshold}</dd>
                            </div>
                          </React.Fragment>
                        ))}
                      </dl>
                    </article>
                  </div>
                ) : (
                  <div className="district-table-wrapper" ref={districtTableWrapperRef}>
                    <table className="district-table" aria-label="Congressional representation table">
                      <colgroup>
                        <col className="district-col-number" />
                        <col className="district-col-representative" />
                        <col className="district-col-party" />
                        <col className="district-col-racial" />
                        <col className="district-col-margin" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Representative</th>
                          <th>Party</th>
                          <th>Race</th>
                          <th>Vote Margin %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {districtTableRows.map((row) => {
                          const districtNumber = Number.parseInt(row.districtNumber, 10);
                          const isSelected = selectedDistrict === districtNumber;
                          return (
                            <tr
                              key={row.districtNumber}
                              ref={(element) => {
                                if (element) {
                                  districtRowRefs.current.set(districtNumber, element);
                                } else {
                                  districtRowRefs.current.delete(districtNumber);
                                }
                              }}
                              className={`district-row-clickable${isSelected ? " district-row-selected" : ""}`}
                              onClick={() =>
                                setSelectedDistrict((prevSelected) =>
                                  prevSelected === districtNumber ? null : districtNumber
                                )
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setSelectedDistrict((prevSelected) =>
                                    prevSelected === districtNumber ? null : districtNumber
                                  );
                                }
                              }}
                              tabIndex={0}
                              role="button"
                              aria-label={`Select district ${row.districtNumber}`}
                            >
                              <td>{row.districtNumber}</td>
                              <td>{row.representative}</td>
                              <td>
                                <span className={`party-badge party-${row.party?.toLowerCase()}`}>
                                  {row.party === "Democrat" ? "D" : row.party === "Republican" ? "R" : row.party}
                                </span>
                              </td>
                              <td>{row.racialEthnicGroup}</td>
                              <td>{row.voteMargin}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {activeView === "ensembles" && (
          <div className="chart-view">
            <div className="chart-toolbar">
              <fieldset className="ensembles-subtab-group" aria-label="Ensembles sub-tabs">
                {ENSEMBLES_SUBTABS.map((subtab) => (
                  <label key={subtab.id} className="ensembles-subtab-option">
                    <input
                      type="radio"
                      name="ensembles-subtab"
                      value={subtab.id}
                      checked={activeEnsemblesSubtab === subtab.id}
                      onChange={(e) => setActiveEnsemblesSubtab(e.target.value)}
                    />
                    <span>{subtab.label}</span>
                  </label>
                ))}
              </fieldset>
              <span className="chart-toolbar-subtitle">
                {activeEnsemblesSubtab === "seatSplits"
                  ? `R/D split frequency across ${cfg.ensembles[0].plans.toLocaleString()} simulated plans`
                  : "Minority group distribution across ensemble district plans"}
              </span>
            </div>
            <div className="chart-body">
              {activeEnsemblesSubtab === "seatSplits" ? (
                <BarChart />
              ) : (
                <BoxPlotChart districts={box_data.districts} enactedData={enactedDemo} />
              )}
            </div>
          </div>
        )}

        {activeView === "demographics" && (
          <div className="chart-view">
              <div className="chart-toolbar">
                <fieldset className="ensembles-subtab-group" aria-label="Demographics sub-tabs">
                  {DEMOGRAPHICS_SUBTABS.map((subtab) => (
                  <label key={subtab.id} className="ensembles-subtab-option">
                    <input
                      type="radio"
                      name="demographics-subtab"
                      value={subtab.id}
                      checked={activeDemographicsSubtab === subtab.id}
                      onChange={(e) => setActiveDemographicsSubtab(e.target.value)}
                    />
                    <span>{subtab.label}</span>
                  </label>
                ))}
              </fieldset>
              <span className="chart-toolbar-subtitle">
                {activeDemographicsSubtab === "precinct"
                  ? "Demographic distribution by precinct / VTD"
                  : "Demographic distribution by census block"}
              </span>
              </div>
              <div className="chart-body chart-body-map">
                {activeDemographicsSubtab === "precinct" ? (
                  <DemographicHeatMap
                    geojson={heatmapGeojson}
                    loading={heatmapGeojson === null && !!cfg?.heatmapGeojson}
                    geojsonPath={cfg.heatmapGeojson}
                    minorityGroups={heatmapMinorityGroups}
                  />
                ) : (
                  <div className="demographics-placeholder">
                    <div className="demographics-placeholder-title">Census Block Heat Map</div>
                    <div className="demographics-placeholder-label">
                      Census block data contains hundreds of thousands of features per state
                      and requires server-side tile rendering. This preferred feature will be
                      available once tile infrastructure is configured.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        {activeView === "ecologicalInference" && (
          <div className="chart-view">
            <div className="chart-toolbar">
              <fieldset className="ensembles-subtab-group" aria-label="Ecological Inference sub-tabs">
                {ECOLOGICAL_INFERENCE_SUBTABS.map((subtab) => (
                  <label key={subtab.id} className="ensembles-subtab-option">
                    <input
                      type="radio"
                      name="ecological-inference-subtab"
                      value={subtab.id}
                      checked={activeEcologicalSubtab === subtab.id}
                      onChange={(e) => setActiveEcologicalSubtab(e.target.value)}
                    />
                    <span>{subtab.label}</span>
                  </label>
                ))}
              </fieldset>
              <span className="chart-toolbar-subtitle">
                Ecological inference of candidate support by racial/ethnic group
              </span>
            </div>
            <div className="chart-body">
              {activeEcologicalSubtab === "probabilityCurves" ? (
                <ProbabilityChart />
              ) : (
                <div className="demographics-placeholder">
                  <div className="demographics-placeholder-title">Coming Soon</div>
                  <div className="demographics-placeholder-label">
                    {activeEcologicalSubtab === "supportSummary" && "GUI-13"}
                    {activeEcologicalSubtab === "precinctMap" && "GUI-14"}
                    {activeEcologicalSubtab === "groupComparison" && "GUI-15"}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeView === "ginglesAnalysis" && (
          <div className="state-layout gingles-layout">
            <div className="state-map-panel">
              <div className="gingles-scatter-section">
                <div className="gingles-scatter-toolbar">
                  <fieldset className="ensembles-subtab-group" aria-label="Gingles group selector">
                    {GINGLES_GROUPS.map((g) => (
                      <label key={g.key} className="ensembles-subtab-option">
                        <input
                          type="radio"
                          name="gingles-group"
                          value={g.key}
                          checked={ginglesGroup === g.key}
                          onChange={(e) => setGinglesGroup(e.target.value)}
                        />
                        <span>{g.label}</span>
                      </label>
                    ))}
                  </fieldset>
                  <span className="chart-toolbar-subtitle">
                    Dem vote share vs. % {GINGLES_GROUPS.find(g => g.key === ginglesGroup)?.label} VAP by precinct
                  </span>
                </div>
                <div className="gingles-scatter-body">
                  <GinglessScatterPlot
                    points={ginglesPoints}
                    regression={regressionData?.[ginglesGroup]}
                    group={ginglesGroup}
                  />
                </div>
              </div>
            </div>

            <div className="state-info-panel gingles-info-panel">
              <div className="gingles-table-section">
                <h2 className="section-title">Precinct Data ({ginglesPoints.length.toLocaleString()} precincts)</h2>
                <table className="district-table" aria-label="Precinct data table">
                  <colgroup>
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "30%" }} />
                    <col style={{ width: "27.5%" }} />
                    <col style={{ width: "27.5%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{GINGLES_GROUPS.find(g => g.key === ginglesGroup)?.label} VAP %</th>
                      <th>Dem Vote %</th>
                      <th>Rep Vote %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ginglesPageRows.map((row, idx) => (
                      <tr key={ginglesPage * GINGLES_PAGE_SIZE + idx}>
                        <td>{(ginglesPage * GINGLES_PAGE_SIZE + idx + 1).toLocaleString()}</td>
                        <td>{(row.minority_vap_pct * 100).toFixed(1)}%</td>
                        <td>{(row.d_vote_share * 100).toFixed(1)}%</td>
                        <td>{((1 - row.d_vote_share) * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="gingles-pagination">
                  <button
                    className="gingles-page-btn"
                    onClick={() => setGinglesPage((p) => p - 1)}
                    disabled={ginglesPage === 0}
                  >
                    ‹
                  </button>
                  <span className="gingles-page-info">
                    {ginglesPage + 1} / {ginglesTotalPages}
                  </span>
                  <button
                    className="gingles-page-btn"
                    onClick={() => setGinglesPage((p) => p + 1)}
                    disabled={ginglesPage === ginglesTotalPages - 1}
                  >
                    ›
                  </button>
                </div>
              </div>
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
