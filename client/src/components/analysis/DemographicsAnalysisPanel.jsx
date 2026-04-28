import React from "react";
import BoxPlotChart from "../charts/BoxAndWhisker";
import BarChart from "../charts/BarChart";
import ProbabilityChart from "../charts/ProbabilityCurve";
import GinglesSection from "./GinglesSection";
import EISupportSummary from "../charts/EISupportSummary";
import EIKDEChart from "../charts/EIKDEChart";
import VoteSeatChart from "../charts/VoteSeatChart";

const DEMO_CHART_OPTIONS = [
  { value: "gingles", label: "Voter Cohesion" },
  { value: "boxwhisker", label: "Minority Distribution" },
  { value: "ei", label: "Ecological Inference" },
  { value: "seatSplits", label: "Seat Splits" },
  { value: "fairness", label: "Fairness" },
];

const EI_SUB_OPTIONS = [
  { value: "curves", label: "EI Curves" },
  { value: "bar", label: "EI Summary" },
  { value: "kde", label: "EI KDE" },
];

const DemographicsAnalysisPanel = ({
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
}) => (
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
            {eiSubView === "bar" && <EISupportSummary data={eiSummaryData} />}
            {eiSubView === "kde" && <EIKDEChart data={eiKdeData} />}
          </div>
        </div>
      )}
      {demoPanelChart === "seatSplits" && <BarChart data={ensembleBarData} />}
      {demoPanelChart === "fairness" && <VoteSeatChart data={voteSeatData} />}
    </div>
  </div>
);

export default DemographicsAnalysisPanel;
