import React, { useState } from "react";
import GinglesScatterPlot from "../charts/GinglesScatterPlot";
import GinglesPrecinctTable from "../charts/GinglesPrecinctTable";

const GinglesSection = ({ points, regressionData, group, minorityGroups }) => {
  const [tableOpen, setTableOpen] = useState(true);

  return (
    <div className="demo-gingles-combined">
      <div className={`demo-gingles-scatter${tableOpen ? "" : " gingles-scatter-full"}`}>
        <GinglesScatterPlot
          points={points}
          regression={regressionData}
          group={group}
        />
      </div>
      <div className="demo-gingles-table">
        <button
          type="button"
          className="gingles-table-toggle"
          onClick={() => setTableOpen((o) => !o)}
        >
          {tableOpen ? "Hide Precinct Table ▼" : "Show Precinct Table ▲"}
        </button>
        {tableOpen && (
          <GinglesPrecinctTable
            points={points}
            group={group}
            minorityGroups={minorityGroups}
          />
        )}
      </div>
    </div>
  );
};

export default GinglesSection;
