import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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


const STATE_DATA = {  // this is dummy data
  texas: {
    name: "Texas",
    abbr: "TX",
    fips: 48,
    districts: 38,
    population: "25,145,561",
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
    overview: {
      totalPopulation: 25145561,
      votingAgePopulation: 18279737,
      populationByGroup: {
        White: 11397345,
        Black: 3168469,
        "Hispanic / Latino": 9460921,
        Asian: 0,
        Other: 1118826,
      },
      voterShare: {
        democratic: 46.5,
        republican: 52.1,
        other: 1.4,
      },
      redistrictingAuthority: "Republican Legislature",
      congressionalByParty: {
        Democrat: 13,
        Republican: 25,
      },
    },
  },
  massachusetts: {
    name: "Massachusetts",
    abbr: "MA",
    fips: 25,
    districts: 9,
    population: "6,547,629",
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
    overview: {
      totalPopulation: 6547629,
      votingAgePopulation: 5128706,
      populationByGroup: {
        White: 4984800,
        Black: 391693,
        "Hispanic / Latino": 627654,
        Asian: 347495,
        Other: 195987,
      },
      voterShare: {
        democratic: 65.6,
        republican: 32.1,
        other: 2.3,
      },
      redistrictingAuthority: "Democratic Legislature",
      congressionalByParty: {
        Democrat: 9,
        Republican: 0,
      },
    },
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
    };
  };

  const onEachFeature = (feature, layer) => {
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

        // Reset min zoom before fitting in case previous state had a higher lock.
        map.setMinZoom(0);

        const fittedZoom = map.getBoundsZoom(bounds, false, paddingPoint);
        const targetZoom = fittedZoom + zoomOffset;
        map.setView(bounds.getCenter(), targetZoom, { animate: false });

        // Lock zoom-out so the initial fitted/offset view is the maximum zoom-out.
        map.setMinZoom(targetZoom);
        // Keep panning near the selected state's extent.
        map.setMaxBounds(bounds.pad(panBoundsPad));
        hasFittedBoundsRef.current = true;
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
          {selectedDistrictGeojson && (
            <GeoJSON
              key={`selected-${selectedDistrict}`}
              data={selectedDistrictGeojson}
              style={selectedDistrictStyle}
              interactive={false}
            />
          )}
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
  const [activeDetailPanel, setActiveDetailPanel] = useState("stateOverview");
  const [activeEnsemblesSubtab, setActiveEnsemblesSubtab] = useState("seatSplits");
  const [activeDemographicsSubtab, setActiveDemographicsSubtab] = useState("precinct");
  const [activeEcologicalSubtab, setActiveEcologicalSubtab] = useState("probabilityCurves");
  const [selectedInterestingPlan, setSelectedInterestingPlan] = useState("enacted");
  const [isInterestingPlanOpen, setIsInterestingPlanOpen] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const interestingPlanRef = useRef(null);
  const districtTableWrapperRef = useRef(null);
  const districtRowRefs = useRef(new Map());
  const isStateOverviewPanel = activeDetailPanel === "stateOverview";
  const districtTableRows = useMemo(
    () =>
      Array.from({ length: stateInfo?.districts ?? 0 }, (_, index) => ({
        districtNumber: String(index + 1),
        representative: "TBD",
        party: "--",
        racialEthnicGroup: "--",
        voteMargin: "--",
      })),
    [stateInfo]
  );

  useEffect(() => {
    const onDocumentMouseDown = (event) => {
      if (!interestingPlanRef.current?.contains(event.target)) {
        setIsInterestingPlanOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => document.removeEventListener("mousedown", onDocumentMouseDown);
  }, []);

  useEffect(() => {
    setSelectedDistrict(null);
  }, [stateSlug]);

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

      <main className={`state-content${activeView === "planExplorer" ? " plan-explorer-content" : ""}`}>
        {activeView === "planExplorer" && (
          <div className="state-layout">
            <div className="state-map-panel">
              <h2 className="section-title">Congressional Districts</h2>
              <div className="state-map-wrapper">
                <StateMap
                  geojsonPath={stateInfo.geojson}
                  mapView={stateInfo.mapView}
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
                          <dd>{formatNumber(stateInfo.overview.totalPopulation)}</dd>
                        </div>
                        <div className="overview-kv-row">
                          <dt>Voting Age Population</dt>
                          <dd>{formatNumber(stateInfo.overview.votingAgePopulation)}</dd>
                        </div>
                      </dl>
                    </article>

                    <article className="overview-card">
                      <h3 className="overview-card-title">Statewide Voter Distribution</h3>
                      <dl className="overview-kv-list">
                        <div className="overview-kv-row">
                          <dt>Democratic Vote Share</dt>
                          <dd>{formatPct1(stateInfo.overview.voterShare.democratic)}</dd>
                        </div>
                        <div className="overview-kv-row">
                          <dt>Republican Vote Share</dt>
                          <dd>{formatPct1(stateInfo.overview.voterShare.republican)}</dd>
                        </div>
                        <div className="overview-kv-row">
                          <dt>Other</dt>
                          <dd>{formatPct1(stateInfo.overview.voterShare.other)}</dd>
                        </div>
                      </dl>
                    </article>

                    <article className="overview-card">
                      <h3 className="overview-card-title">Racial/Ethnic Population Share</h3>
                      <dl className="overview-kv-list">
                        {Object.entries(stateInfo.overview.populationByGroup).map(([group, value]) => (
                          <div className="overview-kv-row" key={group}>
                            <dt>{group}</dt>
                            <dd>
                              {formatPercent(value, stateInfo.overview.totalPopulation)} ({formatNumber(value)})
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
                          <dd>{stateInfo.overview.redistrictingAuthority}</dd>
                        </div>
                      </dl>
                    </article>

                    <article className="overview-card">
                      <h3 className="overview-card-title">Congressional Representation</h3>
                      <dl className="overview-kv-list">
                        <div className="overview-kv-row">
                          <dt>Democrats</dt>
                          <dd>{stateInfo.overview.congressionalByParty.Democrat}</dd>
                        </div>
                        <div className="overview-kv-row">
                          <dt>Republicans</dt>
                          <dd>{stateInfo.overview.congressionalByParty.Republican}</dd>
                        </div>
                        <div className="overview-kv-row">
                          <dt>Total Seats</dt>
                          <dd>{stateInfo.overview.congressionalByParty.Democrat + stateInfo.overview.congressionalByParty.Republican}</dd>
                        </div>
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
                              <td>{row.party}</td>
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
                  ? `R/D split frequency across ${stateInfo.ensembles[0].plans.toLocaleString()} simulated plans`
                  : "Minority group distribution across ensemble district plans"}
              </span>
            </div>
            <div className="chart-body">
              {activeEnsemblesSubtab === "seatSplits" ? (
                <BarChart />
              ) : (
                <BoxPlotChart districts={box_data.districts} />
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
                Minority group distribution across ensemble district plans
              </span>
              </div>
              <div className="chart-body">
                <div className="demographics-placeholder">
                  <div className="demographics-placeholder-title">Coming Soon</div>
                  <div className="demographics-placeholder-label">
                    GUI-4: Demographic Heat Map by Precinct
                  </div>
                  <div className="demographics-placeholder-label">
                    GUI-5: Demographic Heat Map by Census Block
                  </div>
                </div>
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
          <div className="chart-view">
            <div className="chart-toolbar">
              <span className="chart-toolbar-subtitle">
                Gingles analysis visualizations will appear here
              </span>
            </div>
            <div className="chart-body">
              <div className="placeholder-card">
                <div>Coming soon</div>
                <div className="demographics-placeholder-label">GUI-8</div>
                <div className="demographics-placeholder-label">GUI-9</div>
                <div className="demographics-placeholder-label">GUI-10</div>
                <div className="demographics-placeholder-label">Layout is identical to District Detail</div>
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
