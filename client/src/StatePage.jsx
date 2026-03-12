import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { Map as MapGL, Source, Layer, NavigationControl } from "react-map-gl/maplibre";
import BoxPlotChart from './box_and_whisker';
import BarChart from "./bar_chart";
import ProbabilityChart from "./probability_curve";
import GinglessScatterPlot from "./gingles_scatter";
import DemographicHeatMap from "./DemographicHeatMap";
import VoteSeatChart from "./VoteSeatChart";
import EISupportSummary from "./EISupportSummary";
import EIKDEChart from "./EIKDEChart";
import { apiUrl, tilesUrl } from "./api";

const STATE_CONFIG = {
  texas: {
    name: "Texas",
    abbr: "TX",
    stateId: "TX",
    fips: 48,
    districts: 38,
    districtGeoJson: `${process.env.PUBLIC_URL}/data/tx_districts.geojson`,
    precinctTiles: tilesUrl("tx_precincts.pmtiles"),
    blockTiles: tilesUrl("tx_blocks.pmtiles"),
    mapView: { center: [-99.5, 31.0], zoom: 5.2, minZoom: 4.5, maxZoom: 14 },
    redistrictingAuthority: "Republican Legislature",
    ensembles: [
      { id: 1, type: "Race-Blind", plans: 5000, populationThreshold: "2.0%" },
      { id: 2, type: "VRA-Constrained", plans: 5000, populationThreshold: "2.0%" },
    ],
  },
  massachusetts: {
    name: "Massachusetts",
    abbr: "MA",
    stateId: "MA",
    fips: 25,
    districts: 9,
    districtGeoJson: `${process.env.PUBLIC_URL}/data/ma_districts.geojson`,
    precinctTiles: tilesUrl("ma_precincts.pmtiles"),
    blockTiles: tilesUrl("ma_blocks.pmtiles"),
    mapView: { center: [-71.8, 42.1], zoom: 7.5, minZoom: 6.5, maxZoom: 14 },
    redistrictingAuthority: "Democratic Legislature",
    ensembles: [
      { id: 1, type: "Race-Blind", plans: 5000, populationThreshold: "2.0%" },
      { id: 2, type: "VRA-Constrained", plans: 5000, populationThreshold: "2.0%" },
    ],
  },
};

const VIEWS = [
  { id: "planExplorer", label: "Plan Explorer" },
  { id: "demographics", label: "Analysis" },
];

const INTERESTING_PLAN_OPTIONS = [
  { value: "enacted", label: "Enacted" },
  { value: "max_d", label: "Max Democrat" },
  { value: "min_d", label: "Max Republican" },
  { value: "median", label: "Median" },
  { value: "most_competitive", label: "Most Competitive" },
  { value: "least_competitive", label: "Least Competitive" },
  { value: "fewest_county_splits", label: "Fewest County Splits" },
  { value: "most_county_splits", label: "Most County Splits" },
  { value: "max_minority_districts", label: "Max Minority Districts" },
  { value: "min_minority_districts", label: "Min Minority Districts" },
];

/**
 * Generate dummy district-level party data for interesting plans.
 * In production, this would come from SeaWulf ensemble results.
 */
function generateDummyPlanData(numDistricts, planType) {
  const seed = planType.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = (i) => {
    const x = Math.sin(seed * 9301 + i * 49297 + 233280) * 49297;
    return x - Math.floor(x);
  };

  const districts = [];
  for (let d = 1; d <= numDistricts; d++) {
    let demLean;
    switch (planType) {
      case "max_d":
        demLean = 0.35 + rng(d) * 0.5; // skew D
        break;
      case "min_d":
        demLean = 0.15 + rng(d) * 0.45; // skew R
        break;
      case "median":
        demLean = 0.3 + rng(d) * 0.4; // centered
        break;
      case "most_competitive":
        demLean = 0.42 + rng(d) * 0.16; // tight around 50%
        break;
      case "least_competitive":
        demLean = rng(d) > 0.5 ? 0.6 + rng(d + 100) * 0.25 : 0.1 + rng(d + 100) * 0.25; // polarized
        break;
      case "fewest_county_splits":
      case "most_county_splits":
        demLean = 0.25 + rng(d) * 0.5;
        break;
      case "max_minority_districts":
        demLean = d <= numDistricts * 0.4 ? 0.55 + rng(d) * 0.3 : 0.2 + rng(d) * 0.35;
        break;
      case "min_minority_districts":
        demLean = 0.2 + rng(d) * 0.55;
        break;
      default:
        demLean = 0.3 + rng(d) * 0.4;
    }
    const isDem = demLean > 0.5;
    const margin = Math.abs(demLean - 0.5) * 100 * 2;
    districts.push({
      district: d,
      party: isDem ? "Democrat" : "Republican",
      vote_margin_pct: Math.round(margin * 10) / 10,
    });
  }
  return districts;
}

const DEMO_CHART_OPTIONS = [
  { value: "gingles", label: "Voter Cohesion", group: "racial" },
  { value: "boxwhisker", label: "Minority Distribution", group: "racial" },
  { value: "ei", label: "Ecological Inference", group: "racial" },
  { value: "seatSplits", label: "Seat Splits", group: "ensemble" },
  { value: "fairness", label: "Fairness", group: "ensemble" },
];

const EI_SUB_OPTIONS = [
  { value: "curves", label: "EI Curves" },
  { value: "bar", label: "EI Summary" },
  { value: "kde", label: "EI KDE" },
];

const GINGLES_PAGE_SIZE = 10;
const DISTRICT_PAGE_SIZE = 10;

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

function formatNumber(value) {
  return Number(value).toLocaleString();
}

function formatPct1(value) {
  return `${Number(value).toFixed(1)}%`;
}

function useFetchJson(url) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!url) return;
    axios.get(url).then((res) => setData(res.data));
  }, [url]);
  return data;
}

/* ---------- StateMap (MapLibre GL + GeoJSON direct) ---------- */
function StateMap({ cfg, selectedDistrict, onDistrictSelect, districtParties }) {
  const [hoveredDistrict, setHoveredDistrict] = useState(null);
  const [geojson, setGeojson] = useState(null);

  /* Fetch district GeoJSON directly (only 9-38 features, no need for tiles) */
  const districtGeoJsonUrl = cfg.districtGeoJson;
  useEffect(() => {
    setGeojson(null);
    if (!districtGeoJsonUrl) return;
    fetch(districtGeoJsonUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        console.log("District GeoJSON loaded:", data.features?.length, "features");
        setGeojson(data);
      })
      .catch((err) => console.error("Failed to load district geojson", err));
  }, [districtGeoJsonUrl]);

  const districtInfo = useMemo(() => {
    const map = {};
    if (districtParties) {
      for (const rep of districtParties) {
        map[rep.district] = { party: rep.party, margin: rep.vote_margin_pct ?? 0 };
      }
    }
    return map;
  }, [districtParties]);

  /* Build MapLibre match expression for district fill colors.
     district property may be "09" or "9" — convert to number for matching. */
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
    expr.push("#ccc"); // fallback
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

  const onMouseLeave = useCallback(() => {
    setHoveredDistrict(null);
  }, []);

  /* Highlight filter for selected district (click) */
  const selectedFilter = useMemo(
    () => selectedDistrict !== null ? ["==", ["to-number", ["get", "district"]], selectedDistrict] : ["==", 1, 0],
    [selectedDistrict]
  );

  /* Highlight filter for hovered district */
  const hoverFilter = useMemo(
    () => hoveredDistrict !== null ? ["==", ["to-number", ["get", "district"]], hoveredDistrict] : ["==", 1, 0],
    [hoveredDistrict]
  );

  if (!geojson) return <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>Loading map…</div>;

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
          paint={{
            "fill-color": fillColorExpr,
            "fill-opacity": 0.72,
          }}
        />
        <Layer
          id="district-line"
          type="line"
          paint={{
            "line-color": "#1a1a1a",
            "line-width": 1.5,
          }}
        />
        <Layer
          id="district-hover"
          type="line"
          filter={hoverFilter}
          paint={{
            "line-color": "#f97316",
            "line-width": 3,
            "line-opacity": 0.7,
          }}
        />
        <Layer
          id="district-selected"
          type="line"
          filter={selectedFilter}
          paint={{
            "line-color": "#f97316",
            "line-width": 4,
          }}
        />
      </Source>
    </MapGL>
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
  const [selectedInterestingPlan, setSelectedInterestingPlan] = useState("enacted");
  const [isInterestingPlanOpen, setIsInterestingPlanOpen] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [demoGroup, setDemoGroup] = useState("black");
  const [heatmapLevel, setHeatmapLevel] = useState("precinct");
  const [demoPanelChart, setDemoPanelChart] = useState("gingles");
  const [eiSubView, setEiSubView] = useState("curves");
  const [ginglesPage, setGinglesPage] = useState(0);
  const [ginglesSort, setGinglesSort] = useState({ key: null, dir: "asc" });
  const [hoveredPrecinct, setHoveredPrecinct] = useState(null);
  const [ginglesTableOpen, setGinglesTableOpen] = useState(true);
  const [districtPage, setDistrictPage] = useState(0);

  const interestingPlanRef = useRef(null);
  const districtTableWrapperRef = useRef(null);
  const districtRowRefs = useRef(new Map());
  const isStateOverviewPanel = activeDetailPanel === "stateOverview";

  /* ---- fetch data from API ---- */
  const stateData = useFetchJson(cfg ? apiUrl(`/api/states/${cfg.stateId}`) : null);

  /* ---- lazy-fetch only what the active chart needs ---- */
  const isDemo = activeView === "demographics";
  const analysisBase = cfg ? apiUrl(`/api/states/${cfg.stateId}/analysis`) : null;

  const ginglesData = useFetchJson(isDemo && demoPanelChart === "gingles" ? `${analysisBase}/gingles-precinct` : null);
  const regressionData = useFetchJson(isDemo && demoPanelChart === "gingles" ? `${analysisBase}/gingles-regression` : null);
  const enactedDemo = useFetchJson(isDemo && demoPanelChart === "boxwhisker" ? `${analysisBase}/enacted-demographics` : null);
  const ensembleBoxData = useFetchJson(isDemo && demoPanelChart === "boxwhisker" ? `${analysisBase}/ensemble-box` : null);
  const ensembleBarData = useFetchJson(isDemo && demoPanelChart === "seatSplits" ? `${analysisBase}/ensemble-bar` : null);
  const voteSeatData = useFetchJson(isDemo && demoPanelChart === "fairness" ? `${analysisBase}/vote-seat` : null);
  const eiCurvesData = useFetchJson(isDemo && demoPanelChart === "ei" && eiSubView === "curves" ? `${analysisBase}/ei-curves` : null);
  const eiSummaryData = useFetchJson(isDemo && demoPanelChart === "ei" && eiSubView === "bar" ? `${analysisBase}/ei-summary` : null);
  const eiKdeData = useFetchJson(isDemo && demoPanelChart === "ei" && eiSubView === "kde" ? `${analysisBase}/ei-kde` : null);

  const reps = stateData?.representatives;

  /* ---- compute district parties for selected plan ---- */
  const activePlanParties = useMemo(() => {
    if (selectedInterestingPlan === "enacted") return reps;
    if (!cfg) return reps;
    return generateDummyPlanData(cfg.districts, selectedInterestingPlan);
  }, [selectedInterestingPlan, reps, cfg]);

  /* ---- minority groups available for heatmap dropdown ---- */
  const heatmapMinorityGroups = useMemo(() => {
    if (!stateData?.population_by_group) return [];
    const MINORITY_LABELS = {
      hispanic: "Latino",
      black: "Black",
      asian: "Asian",
    };
    return Object.entries(stateData.population_by_group)
      .filter(([g, pop]) => g in MINORITY_LABELS && pop > 0)
      .map(([g]) => ({ key: g, label: MINORITY_LABELS[g] }));
  }, [stateData]);

  /* ---- build overview from fetched state data ---- */
  const overview = useMemo(() => {
    if (!stateData) return null;
    const pop = stateData.population_by_group || {};
    const pres = stateData.presidential_2024 || {};
    const otherPct = Math.max(0, 100 - (pres.dem_pct || 0) - (pres.rep_pct || 0));
    return {
      totalPopulation: stateData.total_population,
      votingAgePopulation: stateData.voting_age_population,
      populationByGroup: {
        White: pop.white ?? 0,
        Black: pop.black ?? 0,
        "Latino": pop.hispanic ?? 0,
        Asian: pop.asian ?? 0,
        Other: pop.other ?? 0,
      },
      voterShare: {
        democratic: pres.dem_pct ?? 0,
        republican: pres.rep_pct ?? 0,
        other: Math.round(otherPct * 10) / 10,
      },
      congressionalByParty: stateData.party_split ?? {},
    };
  }, [stateData]);

  /* ---- build district table rows from reps ---- */
  const districtTableRows = useMemo(() => {
    if (!reps?.length) {
      return Array.from({ length: cfg?.districts ?? 0 }, (_, i) => ({
        districtNumber: String(i + 1),
        representative: "...",
        party: "--",
        racialEthnicGroup: "--",
        voteMargin: "--",
      }));
    }
    return reps.map((r) => ({
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

  /* ---- precinct table data (driven by demoGroup) ---- */
  const ginglesPoints = ginglesData?.[demoGroup] ?? [];

  const sortedGinglesPoints = useMemo(() => {
    if (!ginglesSort.key) return ginglesPoints;
    const sorted = [...ginglesPoints];
    const accessor =
      ginglesSort.key === "minority" ? (r) => r.minority_vap_pct
      : ginglesSort.key === "dem" ? (r) => r.d_vote_share
      : (r) => 1 - r.d_vote_share;
    sorted.sort((a, b) => {
      const diff = accessor(a) - accessor(b);
      return ginglesSort.dir === "asc" ? diff : -diff;
    });
    return sorted;
  }, [ginglesPoints, ginglesSort]);

  const ginglesTotalPages = Math.ceil(sortedGinglesPoints.length / GINGLES_PAGE_SIZE);
  const ginglesPageRows = sortedGinglesPoints.slice(
    ginglesPage * GINGLES_PAGE_SIZE,
    (ginglesPage + 1) * GINGLES_PAGE_SIZE
  );

  const toggleGinglesSort = (key) => {
    setGinglesSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
    setGinglesPage(0);
  };

  useEffect(() => { setGinglesPage(0); setGinglesSort({ key: null, dir: "asc" }); }, [demoGroup]);

  /* ---- district table pagination ---- */
  const districtTotalPages = Math.ceil(districtTableRows.length / DISTRICT_PAGE_SIZE);
  const districtPageRows = districtTableRows.slice(
    districtPage * DISTRICT_PAGE_SIZE,
    (districtPage + 1) * DISTRICT_PAGE_SIZE
  );

  useEffect(() => { setDistrictPage(0); }, [stateSlug]);

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
    const rowIndex = districtTableRows.findIndex(
      (r) => Number.parseInt(r.districtNumber, 10) === selectedDistrict
    );
    if (rowIndex !== -1) {
      setDistrictPage(Math.floor(rowIndex / DISTRICT_PAGE_SIZE));
    }
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
  }, [selectedDistrict, isStateOverviewPanel, districtTableRows]);

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

      <main className={`state-content${activeView === "planExplorer" ? " plan-explorer-content" : ""}${activeView === "demographics" ? " demographics-content" : ""}`}>
        {activeView === "planExplorer" && showCompare && selectedInterestingPlan !== "enacted" && (
          <div className="compare-side-by-side">
            <div className="compare-map-col">
              <h2 className="section-title compare-map-title">Enacted</h2>
              <div className="compare-map-wrapper">
                <StateMap
                  cfg={cfg}
                  selectedDistrict={selectedDistrict}
                  onDistrictSelect={setSelectedDistrict}
                  districtParties={reps}
                />
              </div>
              {(() => {
                const enactedD = reps?.filter(r => r.party === "Democrat").length ?? 0;
                const enactedR = reps?.filter(r => r.party === "Republican").length ?? 0;
                return (
                  <div className="compare-seat-summary">
                    <span className="compare-d">D: {enactedD}</span>
                    <span className="compare-r">R: {enactedR}</span>
                  </div>
                );
              })()}
            </div>
            <div className="compare-map-col">
              <h2 className="section-title compare-map-title">
                {INTERESTING_PLAN_OPTIONS.find(o => o.value === selectedInterestingPlan)?.label}
              </h2>
              <div className="compare-map-wrapper">
                <StateMap
                  cfg={cfg}
                  selectedDistrict={selectedDistrict}
                  onDistrictSelect={setSelectedDistrict}
                  districtParties={activePlanParties}
                />
              </div>
              {(() => {
                const planD = activePlanParties?.filter(r => r.party === "Democrat").length ?? 0;
                const planR = activePlanParties?.filter(r => r.party === "Republican").length ?? 0;
                return (
                  <div className="compare-seat-summary">
                    <span className="compare-d">D: {planD}</span>
                    <span className="compare-r">R: {planR}</span>
                  </div>
                );
              })()}
            </div>
            <div className="compare-controls-bar">
              <div className="interesting-plan-dropdown" ref={interestingPlanRef}>
                <button
                  type="button"
                  className="compare-enacted-btn interesting-plan-select"
                  onClick={() => setIsInterestingPlanOpen((prev) => !prev)}
                >
                  {INTERESTING_PLAN_OPTIONS.find((o) => o.value === selectedInterestingPlan)?.label} ▾
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
                          if (option.value === "enacted") setShowCompare(false);
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
                className="compare-enacted-btn compare-active"
                onClick={() => setShowCompare(false)}
              >
                Exit Comparison
              </button>
            </div>
          </div>
        )}

        {activeView === "planExplorer" && !showCompare && (
          <div className="state-layout">
            <div className="state-map-panel">
              <h2 className="section-title">Congressional Districts</h2>
              <div className="state-map-wrapper">
                <StateMap
                  cfg={cfg}
                  selectedDistrict={selectedDistrict}
                  onDistrictSelect={setSelectedDistrict}
                  districtParties={activePlanParties}
                />
              </div>
              <div className="interesting-plan-controls">
                <div className="interesting-plan-dropdown" ref={interestingPlanRef}>
                  <button
                    type="button"
                    className="compare-enacted-btn interesting-plan-select"
                    onClick={() => setIsInterestingPlanOpen((prev) => !prev)}
                  >
                    {selectedInterestingPlan
                      ? INTERESTING_PLAN_OPTIONS.find((o) => o.value === selectedInterestingPlan)?.label
                      : "Enacted"} ▾
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
                            if (option.value === "enacted") setShowCompare(false);
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
                  className={`compare-enacted-btn${showCompare ? " compare-active" : ""}`}
                  disabled={selectedInterestingPlan === "enacted"}
                  onClick={() => setShowCompare(true)}
                >
                  Compare with Enacted
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
                      </dl>
                    </article>

                    <article className="overview-card">
                      <h3 className="overview-card-title">Racial/Ethnic Population Share</h3>
                      <dl className="overview-kv-list">
                        {Object.entries(ov.populationByGroup).map(([group, value]) => {
                          const pct = ov.totalPopulation ? ((value / ov.totalPopulation) * 100).toFixed(1) : "0.0";
                          return (
                            <div className="overview-kv-row" key={group}>
                              <dt>{group}</dt>
                              <dd>{formatNumber(value)} <span className="overview-pct">({pct}%)</span></dd>
                            </div>
                          );
                        })}
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
                              <dt>{ensemble.type} Plans</dt>
                              <dd>{ensemble.plans.toLocaleString()}</dd>
                            </div>
                            <div className="overview-kv-row">
                              <dt>{ensemble.type} Threshold</dt>
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
                        {districtPageRows.map((row) => {
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
                    {districtTotalPages > 1 && (
                      <div className="gingles-pagination">
                        <button
                          className="gingles-page-btn"
                          onClick={() => setDistrictPage((p) => p - 1)}
                          disabled={districtPage === 0}
                        >‹</button>
                        <input
                          type="number"
                          className="gingles-page-input"
                          min={1}
                          max={districtTotalPages}
                          defaultValue={districtPage + 1}
                          key={districtPage}
                          onBlur={(e) => {
                            const v = Number(e.target.value) - 1;
                            if (v >= 0 && v < districtTotalPages) setDistrictPage(v);
                            else e.target.value = districtPage + 1;
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.target.blur();
                          }}
                        />
                        <span className="gingles-page-info">/ {districtTotalPages}</span>
                        <button
                          className="gingles-page-btn"
                          onClick={() => setDistrictPage((p) => p + 1)}
                          disabled={districtPage >= districtTotalPages - 1}
                        >›</button>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {activeView === "demographics" && (
          <div className="state-layout demographics-layout">

            {/* ── LEFT: map ── */}
            <div className="state-map-panel">
              <div className="demo-map-toolbar">
                <div className="demo-group-btn-group" role="group" aria-label="Map level">
                  <button
                    type="button"
                    className={`demo-group-btn${heatmapLevel === "district" ? " active" : ""}`}
                    onClick={() => setHeatmapLevel("district")}
                  >
                    District
                  </button>
                  <button
                    type="button"
                    className={`demo-group-btn${heatmapLevel === "precinct" ? " active" : ""}`}
                    onClick={() => setHeatmapLevel("precinct")}
                  >
                    Precinct
                  </button>
                  <button
                    type="button"
                    className={`demo-group-btn${heatmapLevel === "block" ? " active" : ""}`}
                    onClick={() => setHeatmapLevel("block")}
                  >
                    Census Block
                  </button>
                </div>
                <div className="demo-group-btn-group" role="group" aria-label="Minority group">
                  {heatmapMinorityGroups.map((g) => (
                    <button
                      key={g.key}
                      type="button"
                      className={`demo-group-btn${demoGroup === g.key ? " active" : ""}`}
                      onClick={() => setDemoGroup(g.key)}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="demo-heatmap-wrapper">
                <DemographicHeatMap
                  key={stateSlug}
                  precinctTilesUrl={cfg.precinctTiles}
                  blockTilesUrl={cfg.blockTiles}
                  districtGeoJson={cfg.districtGeoJson}
                  districtParties={reps}
                  numDistricts={cfg.districts}
                  mapView={cfg.mapView}
                  minorityGroups={heatmapMinorityGroups}
                  selectedGroup={demoGroup}
                  heatmapLevel={heatmapLevel}
                  highlightedPrecinct={hoveredPrecinct}
                />
              </div>
            </div>

            {/* ── RIGHT: analysis panel ── */}
            <div className="state-info-panel demographics-info-panel">
              <div className="demo-panel-tabs" role="tablist">
                {DEMO_CHART_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="tab"
                    aria-selected={demoPanelChart === opt.value}
                    className={`demo-tab-btn${demoPanelChart === opt.value ? " active" : ""}`}
                    onClick={() => setDemoPanelChart(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="demo-chart-body">
                {demoPanelChart === "gingles" && (
                  <div className="demo-gingles-combined">
                    <div className={`demo-gingles-scatter${ginglesTableOpen ? "" : " gingles-scatter-full"}`}>
                      <GinglessScatterPlot
                        points={ginglesPoints}
                        regression={regressionData?.[demoGroup]}
                        group={demoGroup}
                      />
                    </div>
                    <div className="demo-gingles-table">
                      <button
                        type="button"
                        className="gingles-table-toggle"
                        onClick={() => setGinglesTableOpen((o) => !o)}
                      >
                        {ginglesTableOpen ? "Hide Precinct Table ▼" : "Show Precinct Table ▲"}
                      </button>
                    {ginglesTableOpen && (<>
                      <table className="district-table" aria-label="Precinct data table">
                        <colgroup>
                          <col style={{ width: "10%" }} />
                          <col style={{ width: "30%" }} />
                          <col style={{ width: "30%" }} />
                          <col style={{ width: "30%" }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th className="sortable-th" onClick={() => toggleGinglesSort("minority")}>
                              % {heatmapMinorityGroups.find((g) => g.key === demoGroup)?.label}
                              {ginglesSort.key === "minority" ? (ginglesSort.dir === "asc" ? " ▲" : " ▼") : ""}
                            </th>
                            <th className="sortable-th" onClick={() => toggleGinglesSort("dem")}>
                              Democratic Vote %
                              {ginglesSort.key === "dem" ? (ginglesSort.dir === "asc" ? " ▲" : " ▼") : ""}
                            </th>
                            <th className="sortable-th" onClick={() => toggleGinglesSort("rep")}>
                              Republican Vote %
                              {ginglesSort.key === "rep" ? (ginglesSort.dir === "asc" ? " ▲" : " ▼") : ""}
                            </th>
                          </tr>
                        </thead>
                        <tbody onMouseLeave={() => setHoveredPrecinct(null)}>
                          {ginglesPageRows.map((row, idx) => {
                            const globalIdx = ginglesPage * GINGLES_PAGE_SIZE + idx;
                            return (
                            <tr
                              key={globalIdx}
                              className={hoveredPrecinct?._idx === globalIdx ? "precinct-row-hovered" : ""}
                              onMouseEnter={() => setHoveredPrecinct({ name: row.name, precinct_id: row.precinct_id, pop: row.total_pop, _idx: globalIdx })}
                            >
                              <td>{(ginglesPage * GINGLES_PAGE_SIZE + idx + 1).toLocaleString()}</td>
                              <td>{(Math.min(row.minority_vap_pct, 1) * 100).toFixed(1)}%</td>
                              <td>{(Math.min(row.d_vote_share, 1) * 100).toFixed(1)}%</td>
                              <td>{(Math.min(1 - row.d_vote_share, 1) * 100).toFixed(1)}%</td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div className="gingles-pagination">
                        <button
                          className="gingles-page-btn"
                          onClick={() => setGinglesPage((p) => p - 1)}
                          disabled={ginglesPage === 0}
                        >‹</button>
                        <input
                          type="number"
                          className="gingles-page-input"
                          min={1}
                          max={ginglesTotalPages || 1}
                          defaultValue={ginglesPage + 1}
                          key={ginglesPage}
                          onBlur={(e) => {
                            const v = Number(e.target.value) - 1;
                            if (v >= 0 && v < (ginglesTotalPages || 1)) setGinglesPage(v);
                            else e.target.value = ginglesPage + 1;
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.target.blur();
                          }}
                        />
                        <span className="gingles-page-info">/ {ginglesTotalPages || 1}</span>
                        <button
                          className="gingles-page-btn"
                          onClick={() => setGinglesPage((p) => p + 1)}
                          disabled={ginglesPage >= ginglesTotalPages - 1}
                        >›</button>
                      </div>
                    </>)}
                    </div>
                  </div>
                )}

                {demoPanelChart === "boxwhisker" && (
                  <BoxPlotChart boxData={ensembleBoxData} enactedData={enactedDemo} selectedGroup={demoGroup} />
                )}
                {demoPanelChart === "ei" && (
                  <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                    <div className="demo-group-btn-group ei-sub-tabs" role="group" aria-label="EI view">
                      {EI_SUB_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className={`demo-group-btn${eiSubView === opt.value ? " active" : ""}`}
                          onClick={() => setEiSubView(opt.value)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
                      {eiSubView === "curves" && <ProbabilityChart data={eiCurvesData} />}
                      {eiSubView === "bar" && <EISupportSummary data={eiSummaryData} />}
                      {eiSubView === "kde" && <EIKDEChart data={eiKdeData} />}
                    </div>
                  </div>
                )}
                {demoPanelChart === "seatSplits" && <BarChart data={ensembleBarData} />}
                {demoPanelChart === "fairness" && <VoteSeatChart data={voteSeatData} />}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
