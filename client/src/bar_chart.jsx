import React from "react";
import electionData from "./dummy_data/dummy_bar_chart.json";
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Title, Tooltip, Legend } from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(BarElement, CategoryScale, LinearScale, Title, Tooltip, Legend);

const BarChart = () => {
  const { raceBlindData = [], vraData = [] } = electionData;

  // Combine all unique splits for x-axis
  const allSplits = Array.from(
    new Set([
      ...raceBlindData.map(d => `${d.republican}/${d.democrat}`),
      ...vraData.map(d => `${d.republican}/${d.democrat}`)
    ])
  ).sort();

  const mapData = (data) =>
    allSplits.map(split => {
      const [r, d] = split.split("/").map(Number);
      const item = data.find(datum => datum.republican === r && datum.democrat === d);
      return item ? item.freq : 0;
    });

  const raceBlindChart = {
    labels: allSplits,
    datasets: [
      {
        label: "Race-Blind Ensemble",
        data: mapData(raceBlindData),
        backgroundColor: "rgba(117, 107, 177, 1)"
      }
    ]
  };

  const vraChart = {
    labels: allSplits,
    datasets: [
      {
        label: "VRA-Constrained Ensemble",
        data: mapData(vraData),
        backgroundColor: "rgba(117, 107, 177, 1)"
      }
    ]
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { position: "top" },
      title: { display: true, text: "Simulated Election Outcomes" }
    },
    scales: {
      x: { title: { display: true, text: "Republican / Democrat Wins" } },
      y: { beginAtZero: true, title: { display: true, text: "Frequency" } }
    }
  };

  return (
    <div>
      <Bar
        data={raceBlindChart}
        options={{ ...options, plugins: { ...options.plugins, title: { text: "Race-Blind Ensemble" } } }}
      />
      <Bar
        data={vraChart}
        options={{ ...options, plugins: { ...options.plugins, title: { text: "VRA-Constrained Ensemble" } } }}
      />
    </div>
  );
};

export default BarChart;
