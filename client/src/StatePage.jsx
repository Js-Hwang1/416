import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DemographicHeatMap from "./DemographicHeatMap";
import StateMap from "./StateMap";
import StateOverviewCards from "./StateOverviewCards";
import DistrictTable from "./DistrictTable";
import ComparePlansView from "./ComparePlansView";
import DemographicsAnalysisPanel from "./DemographicsAnalysisPanel";
import InterestingPlanDropdown from "./InterestingPlanDropdown";
import { generateDummyPlanData } from "./utils/planData";
import { apiUrl, tilesUrl, useFetchJson } from "./api";

const STATE_CONFIG = {
  texas: {
    name: "Texas",
    abbr: "TX",
    stateId: "TX",
    fips: 48,
    districts: 38,
    districtGeoJson: apiUrl(`/api/states/TX/geojson/districts`),
    precinctGeoJsonUrl: apiUrl(`/api/states/TX/geojson/precincts`),
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
    districtGeoJson: apiUrl(`/api/states/MA/geojson/districts`),
    precinctGeoJsonUrl: apiUrl(`/api/states/MA/geojson/precincts`),
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
  { id: "analysis", label: "Analysis" },
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

export default function StatePage() {
  const { stateSlug } = useParams();
  const navigate = useNavigate();
  const cfg = STATE_CONFIG[stateSlug];

  const [activeView, setActiveView] = useState("planExplorer");
  const [activeDetailPanel, setActiveDetailPanel] = useState("stateOverview");
  const [selectedInterestingPlan, setSelectedInterestingPlan] = useState("enacted");
  const [showCompare, setShowCompare] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [demoGroup, setDemoGroup] = useState("black");
  const [heatmapLevel, setHeatmapLevel] = useState("precinct");
  const [demoPanelChart, setDemoPanelChart] = useState("gingles");
  const [eiSubView, setEiSubView] = useState("curves");

  const isStateOverviewPanel = activeDetailPanel === "stateOverview";

  /* ---- fetch data from API ---- */
  const stateData = useFetchJson(cfg ? apiUrl(`/api/states/${cfg.stateId}`) : null);
  const representativesData = useFetchJson(cfg ? apiUrl(`/api/states/${cfg.stateId}/representatives`) : null);
  const populationByGroupData = useFetchJson(cfg ? apiUrl(`/api/states/${cfg.stateId}/population-by-group`) : null);
  const presidentialResultsData = useFetchJson(cfg ? apiUrl(`/api/states/${cfg.stateId}/presidential-results`) : null);
  const partySplitData = useFetchJson(cfg ? apiUrl(`/api/states/${cfg.stateId}/party-split`) : null);
  const districtGeoJsonData = useFetchJson(cfg ? apiUrl(`/api/states/${cfg.stateId}/geojson/districts`) : null);
  const precinctGeoJsonData = useFetchJson(cfg ? apiUrl(`/api/states/${cfg.stateId}/geojson/precincts`) : null);

  /* ---- lazy-fetch only what the active chart needs ---- */
  const analysisBase = cfg ? apiUrl(`/api/states/${cfg.stateId}/analysis`) : null;
  const isAnalysis = activeView === "analysis";

  const ginglesData = useFetchJson(isAnalysis && demoPanelChart === "gingles" ? `${analysisBase}/gingles-precinct` : null);
  const regressionData = useFetchJson(isAnalysis && demoPanelChart === "gingles" ? `${analysisBase}/gingles-regression` : null);
  const enactedDemo = useFetchJson(isAnalysis && demoPanelChart === "boxwhisker" ? `${analysisBase}/enacted-demographics` : null);
  const ensembleBoxData = useFetchJson(isAnalysis && demoPanelChart === "boxwhisker" ? `${analysisBase}/ensemble-box` : null);
  const ensembleBarData = useFetchJson(isAnalysis && demoPanelChart === "seatSplits" ? `${analysisBase}/ensemble-bar` : null);
  const voteSeatData = useFetchJson(isAnalysis && demoPanelChart === "fairness" ? `${analysisBase}/vote-seat` : null);
  const eiCurvesData = useFetchJson(isAnalysis && demoPanelChart === "ei" && eiSubView === "curves" ? `${analysisBase}/ei-curves` : null);
  const eiSummaryData = useFetchJson(isAnalysis && demoPanelChart === "ei" && eiSubView === "bar" ? `${analysisBase}/ei-summary` : null);
  const eiKdeData = useFetchJson(isAnalysis && demoPanelChart === "ei" && eiSubView === "kde" ? `${analysisBase}/ei-kde` : null);

  const reps = representativesData;

  const activePlanParties = useMemo(() => {
    if (selectedInterestingPlan === "enacted") return reps;
    if (!cfg) return reps;
    return generateDummyPlanData(cfg.districts, selectedInterestingPlan);
  }, [selectedInterestingPlan, reps, cfg]);

  const heatmapMinorityGroups = useMemo(() => {
    if (!populationByGroupData) return [];
    const MINORITY_LABELS = { hispanic: "Latino", black: "Black", asian: "Asian" };
    return Object.entries(populationByGroupData)
      .filter(([g]) => g in MINORITY_LABELS && populationByGroupData[g] > 0)
      .map(([g]) => ({ key: g, label: MINORITY_LABELS[g] }));
  }, [populationByGroupData]);

  const overview = useMemo(() => {
    if (!stateData || !populationByGroupData || !presidentialResultsData || !partySplitData) return null;
    const pop = populationByGroupData || {};
    const pres = presidentialResultsData || {};
    const otherPct = Math.max(0, 100 - (pres.dem_pct || 0) - (pres.rep_pct || 0));
    return {
      totalPopulation: stateData.total_population,
      votingAgePopulation: stateData.voting_age_population,
      populationByGroup: {
        White: pop.white ?? 0,
        Black: pop.black ?? 0,
        Latino: pop.hispanic ?? 0,
        Asian: pop.asian ?? 0,
        Other: pop.other ?? 0,
      },
      voterShare: {
        democratic: pres.dem_pct ?? 0,
        republican: pres.rep_pct ?? 0,
        other: Math.round(otherPct * 10) / 10,
      },
      congressionalByParty: partySplitData ?? {},
    };
  }, [stateData, populationByGroupData, presidentialResultsData, partySplitData]);

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
      voteMargin: r.vote_margin_pct !== undefined ? `${r.vote_margin_pct.toFixed(1)}%` : "--",
    }));
  }, [reps, cfg]);

  const ginglesPoints = ginglesData?.[demoGroup] ?? [];

  useEffect(() => { setSelectedDistrict(null); }, [stateSlug]);

  const handlePlanChange = (value) => {
    setSelectedInterestingPlan(value);
    if (value === "enacted") setShowCompare(false);
  };

  if (!cfg) {
    return (
      <div className="state-page">
        <div className="state-page-inner">
          <h1>State not found</h1>
          <button className="back-button" onClick={() => navigate("/")}>Back to Map</button>
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
          <button className="back-button" onClick={() => navigate("/")}>Reset</button>
        </div>
      </nav>

      <main className={`state-content${activeView === "planExplorer" ? " plan-explorer-content" : ""}${activeView === "analysis" ? " demographics-content" : ""}`}>

        {activeView === "planExplorer" && showCompare && selectedInterestingPlan !== "enacted" && (
          <ComparePlansView
            districtGeoJsonData={districtGeoJsonData}
            cfg={cfg}
            selectedDistrict={selectedDistrict}
            onDistrictSelect={setSelectedDistrict}
            reps={reps}
            activePlanParties={activePlanParties}
            selectedInterestingPlan={selectedInterestingPlan}
            planOptions={INTERESTING_PLAN_OPTIONS}
            onPlanChange={handlePlanChange}
            onExitCompare={() => setShowCompare(false)}
          />
        )}

        {activeView === "planExplorer" && !showCompare && (
          <div className="state-layout">
            <div className="state-map-panel">
              <h2 className="section-title">Congressional Districts</h2>
              <div className="state-map-wrapper">
                <StateMap
                  geojson={districtGeoJsonData}
                  cfg={cfg}
                  selectedDistrict={selectedDistrict}
                  onDistrictSelect={setSelectedDistrict}
                  districtParties={activePlanParties}
                />
              </div>
              <div className="interesting-plan-controls">
                <InterestingPlanDropdown
                  options={INTERESTING_PLAN_OPTIONS}
                  value={selectedInterestingPlan}
                  onChange={handlePlanChange}
                />
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
                  <StateOverviewCards ov={ov} cfg={cfg} />
                ) : (
                  <DistrictTable
                    key={stateSlug}
                    rows={districtTableRows}
                    selectedDistrict={selectedDistrict}
                    onSelectDistrict={setSelectedDistrict}
                  />
                )}
              </section>
            </div>
          </div>
        )}

        {activeView === "analysis" && (
          <div className="state-layout demographics-layout">
            <div className="state-map-panel">
              <div className="demo-map-toolbar">
                <div className="demo-group-btn-group" role="group" aria-label="Map level">
                  {["district", "precinct", "block"].map((level) => (
                    <button
                      key={level}
                      type="button"
                      className={`demo-group-btn${heatmapLevel === level ? " active" : ""}`}
                      onClick={() => setHeatmapLevel(level)}
                    >
                      {level === "block" ? "Census Block" : level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  ))}
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
                  districtGeoJsonData={districtGeoJsonData}
                  precinctGeoJsonData={precinctGeoJsonData}
                  blockTilesUrl={cfg.blockTiles}
                  districtParties={reps}
                  numDistricts={cfg.districts}
                  mapView={cfg.mapView}
                  minorityGroups={heatmapMinorityGroups}
                  selectedGroup={demoGroup}
                  heatmapLevel={heatmapLevel}
                />
              </div>
            </div>

            <DemographicsAnalysisPanel
              demoPanelChart={demoPanelChart}
              setDemoPanelChart={setDemoPanelChart}
              eiSubView={eiSubView}
              setEiSubView={setEiSubView}
              demoGroup={demoGroup}
              minorityGroups={heatmapMinorityGroups}
              ginglesPoints={ginglesPoints}
              regressionData={regressionData?.[demoGroup]}
              ensembleBoxData={ensembleBoxData}
              enactedDemo={enactedDemo}
              eiCurvesData={eiCurvesData}
              eiSummaryData={eiSummaryData}
              eiKdeData={eiKdeData}
              ensembleBarData={ensembleBarData}
              voteSeatData={voteSeatData}
            />
          </div>
        )}

      </main>
    </div>
  );
}
