import React from "react";
import BoxPlotChart from "../charts/BoxAndWhisker";
import BarChart from "../charts/BarChart";
import ProbabilityChart from "../charts/ProbabilityCurve";
import GinglesSection from "./GinglesSection";
import EISupportSummary from "../charts/EISupportSummary";
import EIKDEChart from "../charts/EIKDEChart";
import VoteSeatChart from "../charts/VoteSeatChart";

export const RPV_CHART_OPTIONS = [
  { value: "gingles", label: "Gingles Analysis" },
  { value: "ei", label: "Ecological Inference" },
];

export const VRA_CHART_OPTIONS = [
  { value: "seatSplits", label: "Seat Splits" },
  { value: "boxwhisker", label: "Minority Distribution" },
  { value: "fairness", label: "Vote-Seat Curve" },
];

const EI_SUB_OPTIONS = [
  { value: "curves", label: "EI Curves" },
  { value: "kde", label: "EI KDE" },
  { value: "precinct", label: "Precinct Results" },
];

const SEAT_SPLIT_THRESHOLDS = [
  { value: "t05", label: "0.50" },
  { value: "t06", label: "0.60" },
  { value: "t07", label: "0.70" },
];

const DemographicsAnalysisPanel = ({
  chartOptions,
  demoPanelChart,
  setDemoPanelChart,
  eiSubView,
  setEiSubView,
  demoGroup,
  minorityGroups,
  ginglesPoints,
  regressionData,
  ensembleBoxData,
  enactedDemo,
  eiCurvesData,
  eiSummaryData,
  eiKdeData,
  ensembleBarData,
  voteSeatData,
  seatSplitThreshold,
  setSeatSplitThreshold,
}) => (
  <div className="state-info-panel demographics-info-panel">
    <div className="demo-panel-tabs" role="tablist">
      {chartOptions.map((opt) => (
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
        <GinglesSection
          points={ginglesPoints}
          regressionData={regressionData}
          group={demoGroup}
          minorityGroups={minorityGroups}
        />
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
            {eiSubView === "kde" && <EIKDEChart data={eiKdeData} />}
            {eiSubView === "precinct" && <EISupportSummary data={eiSummaryData} />}
          </div>
        </div>
      )}
      {demoPanelChart === "seatSplits" && (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div className="chart-controls">
            <span className="chart-controls-label">Minority-effectiveness threshold:</span>
            <select
              className="heatmap-group-select"
              value={seatSplitThreshold}
              onChange={(e) => setSeatSplitThreshold(e.target.value)}
            >
              {SEAT_SPLIT_THRESHOLDS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
            <BarChart data={ensembleBarData} />
          </div>
        </div>
      )}
      {demoPanelChart === "fairness" && <VoteSeatChart data={voteSeatData} />}
    </div>
  </div>
);

export default DemographicsAnalysisPanel;
