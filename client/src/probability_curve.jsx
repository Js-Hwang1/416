import React from "react";
import Plot from "react-plotly.js";
import dataJson from "./dummy_data/dummy_probability_curve.json"; // your JSON file

const ProbabilityChart = () => {
  // Filter two races (example: White and Black)
  const races = ["White", "Black"];
  const filteredData = dataJson.filter(d => races.includes(d.race));

  // Assign colors for each race
  const colorMap = {
    White: "rgba(90, 190, 190, 0.7)", 
    Black: "rgba(255, 127, 14, 0.7)"   
  };

  const fillColorMap = {
    White: "rgba(90, 190, 190, 0.7)", 
    Black: "rgba(255, 127, 14, 0.7)"   
  };

  // Prepare Plotly traces with smooth lines, filled area, and colors
  const traces = filteredData.map(d => ({
    x: d.data.map(point => point.percent),
    y: d.data.map(point => point.probability),
    type: "scatter",
    mode: "lines",        
    name: `${d.candidate} - ${d.race}`,
    fill: "tozeroy",
    line: { color: colorMap[d.race] },
    fillcolor: fillColorMap[d.race]
  }));

  return (
    <Plot
      data={traces}
      layout={{
        title: "Voting Probability by Race",
        xaxis: { title: "Percentage of Group Voting" },
        yaxis: { title: "Probability" },
        hovermode: false
      }}
      style={{ width: "100%", height: "500px" }}
    />
  );
};

export default ProbabilityChart;
