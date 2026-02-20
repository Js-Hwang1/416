import React, { useState } from "react";
import Plot from "react-plotly.js";
import dataJson from "./dummy_data/dummy_probability_curve.json";

const ProbabilityChart = () => {
  // Get all unique races from data
  const allRaces = [...new Set(dataJson.map(d => d.race))];
  const [selectedRaces, setSelectedRaces] = useState(["White", "Black"]);

  // Filter data based on selected races
  const filteredData = dataJson.filter(d => selectedRaces.includes(d.race));

  // Assign colors for each race
  const colorMap = {
    White: "rgba(54, 162, 235, 0.8)", 
    Black: "rgba(255, 99, 132, 0.8)",
    Hispanic: "rgba(75, 192, 192, 0.8)",
    Asian: "rgba(255, 206, 86, 0.8)"
  };

  const fillColorMap = {
    White: "rgba(54, 162, 235, 0.3)", 
    Black: "rgba(255, 99, 132, 0.3)",
    Hispanic: "rgba(75, 192, 192, 0.3)",
    Asian: "rgba(255, 206, 86, 0.3)"
  };

  // Handle checkbox changes
  const handleRaceToggle = (race) => {
    setSelectedRaces(prev => {
      if (prev.includes(race)) {
        return prev.filter(r => r !== race);
      } else {
        return [...prev, race];
      }
    });
  };

  // Prepare Plotly traces with smooth lines, filled area, and colors
  const traces = filteredData.map(d => ({
    x: d.data.map(point => point.percent),
    y: d.data.map(point => point.probability),
    type: "scatter",
    mode: "lines",        
    name: `${d.candidate} - ${d.race}`,
    fill: "tozeroy",
    line: { 
      color: colorMap[d.race] || "rgba(128, 128, 128, 0.8)",
      width: 2,
      shape: "spline"
    },
    fillcolor: fillColorMap[d.race] || "rgba(128, 128, 128, 0.3)"
  }));

  return (
    <div style={{ width: "100%" }}>
      <div style={{ 
        marginBottom: "20px", 
        padding: "16px", 
        background: "#f7f8fa", 
        border: "1px solid #e0e0e0",
        borderRadius: "2px"
      }}>
        <div style={{ 
          fontFamily: "'Inter', sans-serif", 
          fontSize: "0.75rem", 
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "1px",
          color: "#333",
          marginBottom: "12px"
        }}>
          Select Racial/Ethnic Groups to Compare:
        </div>
        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
          {allRaces.map(race => (
            <label 
              key={race} 
              style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "8px",
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
                fontSize: "0.85rem",
                color: "#444"
              }}
            >
              <input
                type="checkbox"
                checked={selectedRaces.includes(race)}
                onChange={() => handleRaceToggle(race)}
                style={{ cursor: "pointer" }}
              />
              <span style={{ 
                display: "inline-block",
                width: "12px",
                height: "12px",
                background: colorMap[race] || "rgba(128, 128, 128, 0.8)",
                marginRight: "4px"
              }}></span>
              {race}
            </label>
          ))}
        </div>
      </div>
      <div style={{ background: "#fff", padding: "20px", border: "1px solid #e0e0e0" }}>
        <Plot
          data={traces}
          layout={{
            title: {
              text: "Voting Probability by Race/Ethnicity",
              font: { family: "'Inter', sans-serif", size: 16, weight: "bold" }
            },
            xaxis: { 
              title: {
                text: "Percentage of Group Voting for Candidate (%)",
                font: { family: "'Inter', sans-serif", size: 12 }
              },
              gridcolor: "#e8e8e8"
            },
            yaxis: { 
              title: {
                text: "Probability Density",
                font: { family: "'Inter', sans-serif", size: 12 }
              },
              gridcolor: "#e8e8e8"
            },
            hovermode: "x unified",
            showlegend: true,
            legend: {
              font: { family: "'Inter', sans-serif", size: 11 },
              orientation: "v",
              x: 1.02,
              y: 1
            },
            plot_bgcolor: "#fafafa",
            paper_bgcolor: "#fff",
            margin: { l: 60, r: 120, t: 60, b: 60 }
          }}
          style={{ width: "100%", height: "500px" }}
          config={{ responsive: true, displayModeBar: false }}
        />
      </div>
    </div>
  );
};

export default ProbabilityChart;
