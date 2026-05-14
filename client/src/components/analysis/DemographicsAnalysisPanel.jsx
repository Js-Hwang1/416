import React, { useState } from "react";
import BoxPlotChart from "../charts/BoxAndWhisker";
import BarChart from "../charts/BarChart";
import ProbabilityChart from "../charts/ProbabilityCurve";
import GinglesSection from "./GinglesSection";
import EISupportSummary from "../charts/EISupportSummary";
import EIKDEChart from "../charts/EIKDEChart";
import VoteSeatChart from "../charts/VoteSeatChart";
import MinorityBarsChart from "../charts/MinorityBarsChart";
import EffectivenessHistogram from "../charts/EffectivenessHistogram";
import VraImpactTable from "../analysis/VraImpactTable";
import MinorityEffectivenessBox from "../charts/MinorityEffectivenessBox";

export const RPV_CHART_OPTIONS = [
  { value: "gingles", label: "Gingles Analysis" },
  { value: "ei", label: "Ecological Inference" },
];

export const VRA_CHART_OPTIONS = [
  { value: "seatSplits", label: "Seat Splits" },
  { value: "boxwhisker", label: "Minority Distribution" },
  { value: "fairness", label: "Vote-Seat Curve" },
  { value: "impactTable", label: "VRA Impact Table" },
  { value: "minorityBars", label: "Effectiveness" },
  { value: "effHistogram", label: "Effectiveness Histogram" },
];

const VARIANTS = [
  { value: "robust", label: "Robust" },
  { value: "standard", label: "Standard" },
  { value: "compactness", label: "Compactness" },
];

const EI_SUB_OPTIONS = [
  { value: "curves", label: "EI Curves" },
  { value: "kde", label: "EI KDE" },
  { value: "precinct", label: "Precinct Results" },
];

const BOX_SUB_OPTIONS = [
  { value: "perDistrict", label: "Per-District (GUI-17)" },
  { value: "perGroup", label: "Per-Group Effectiveness (GUI-21)" },
];

const SEAT_SPLIT_THRESHOLDS = [
  { value: "t05", label: "0.50" },
  { value: "t06", label: "0.60" },
  { value: "t07", label: "0.70" },
];

const COL_STYLE = { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 };
const CONTROLS_STYLE = { display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start", padding: "10px 12px 4px" };
const CHART_BODY_STYLE = { flex: 1, minHeight: 0, display: "flex" };

const ChartFrame = ({ controls, children }) => (
  <div style={COL_STYLE}>
    {controls && <div style={CONTROLS_STYLE}>{controls}</div>}
    <div style={CHART_BODY_STYLE}>{children}</div>
  </div>
);

const ThresholdSelect = ({ value, onChange }) => (
  <div className="chart-controls">
    <span className="chart-controls-label">Minority-effectiveness threshold:</span>
    <select className="heatmap-group-select" value={value} onChange={(e) => onChange(e.target.value)}>
      {SEAT_SPLIT_THRESHOLDS.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

const ButtonRow = ({ options, value, onChange, ariaLabel, extraClass = "" }) => (
  <div className={`demo-group-btn-group ${extraClass}`} role="group" aria-label={ariaLabel}>
    {(options || []).map((opt) => (
      <button
        key={opt.value ?? opt.key}
        type="button"
        className={`demo-group-btn${value === (opt.value ?? opt.key) ? " active" : ""}`}
        onClick={() => onChange && onChange(opt.value ?? opt.key)}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

const groupOpts = (minorityGroups) =>
  (minorityGroups || []).map((g) => ({ value: g.key, label: g.label }));

const DemographicsAnalysisPanel = ({
  chartOptions,
  demoPanelChart,
  setDemoPanelChart,
  eiSubView,
  setEiSubView,
  demoGroup,
  setDemoGroup,
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
  minorityBarsData,
  ensembleVariant,
  setEnsembleVariant,
  vraImpactData,
  numDistricts,
}) => {
  const isVRA = chartOptions === VRA_CHART_OPTIONS;
  const [boxSubView, setBoxSubView] = useState("perDistrict");

  const groupRow = (
    <ButtonRow
      options={groupOpts(minorityGroups)}
      value={demoGroup}
      onChange={setDemoGroup}
      ariaLabel="Minority group"
    />
  );
  const thresholdRow = (
    <ThresholdSelect value={seatSplitThreshold} onChange={setSeatSplitThreshold} />
  );

  const variantRow = isVRA && setEnsembleVariant ? (
    <div className="chart-controls" style={{ marginBottom: 0 }}>
      <span className="chart-controls-label">Ensemble:</span>
      <ButtonRow
        options={VARIANTS}
        value={ensembleVariant}
        onChange={setEnsembleVariant}
        ariaLabel="Ensemble variant"
      />
    </div>
  ) : null;

  return (
    <div className="state-info-panel demographics-info-panel">
      {variantRow && <div style={{ padding: "8px 12px 0" }}>{variantRow}</div>}
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

        {demoPanelChart === "ei" && (
          <ChartFrame
            controls={
              <ButtonRow
                options={EI_SUB_OPTIONS}
                value={eiSubView}
                onChange={setEiSubView}
                ariaLabel="EI view"
                extraClass="ei-sub-tabs"
              />
            }
          >
            {eiSubView === "curves" && <ProbabilityChart data={eiCurvesData} />}
            {eiSubView === "kde" && <EIKDEChart data={eiKdeData} candidateName="Harris (D)" republicanCandidateName="Trump (R)" />}
            {eiSubView === "precinct" && <EISupportSummary data={eiSummaryData} />}
          </ChartFrame>
        )}

        {demoPanelChart === "boxwhisker" && (
          <ChartFrame
            controls={
              <>
                <ButtonRow
                  options={BOX_SUB_OPTIONS}
                  value={boxSubView}
                  onChange={setBoxSubView}
                  ariaLabel="Minority distribution view"
                  extraClass="ei-sub-tabs"
                />
                {boxSubView === "perDistrict" ? groupRow : thresholdRow}
              </>
            }
          >
            {boxSubView === "perDistrict" && (
              <BoxPlotChart boxData={ensembleBoxData} enactedData={enactedDemo} selectedGroup={demoGroup} />
            )}
            {boxSubView === "perGroup" && (
              <MinorityEffectivenessBox data={minorityBarsData} numDistricts={numDistricts} />
            )}
          </ChartFrame>
        )}

        {demoPanelChart === "seatSplits" && (
          <ChartFrame controls={thresholdRow}>
            <BarChart data={ensembleBarData} />
          </ChartFrame>
        )}

        {demoPanelChart === "effHistogram" && (
          <ChartFrame
            controls={
              <>
                {thresholdRow}
                {groupRow}
              </>
            }
          >
            <EffectivenessHistogram
              data={minorityBarsData}
              group={demoGroup}
              threshold={(SEAT_SPLIT_THRESHOLDS.find((t) => t.value === seatSplitThreshold) || {}).label}
            />
          </ChartFrame>
        )}

        {demoPanelChart === "impactTable" && (
          <ChartFrame controls={thresholdRow}>
            <VraImpactTable
              data={vraImpactData}
              threshold={(SEAT_SPLIT_THRESHOLDS.find((t) => t.value === seatSplitThreshold) || {}).label}
            />
          </ChartFrame>
        )}

        {demoPanelChart === "minorityBars" && (
          <ChartFrame
            controls={
              <>
                {thresholdRow}
                {groupRow}
              </>
            }
          >
            <MinorityBarsChart data={minorityBarsData} group={demoGroup} />
          </ChartFrame>
        )}

        {demoPanelChart === "fairness" && <VoteSeatChart data={voteSeatData} />}
      </div>
    </div>
  );
};

export default DemographicsAnalysisPanel;
