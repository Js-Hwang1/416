import React from "react";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(BarElement, CategoryScale, LinearScale, Title, Tooltip, Legend);

const RB_COLOR = "rgba(100, 170, 160, 0.75)";
const VRA_COLOR = "rgba(200, 170, 80, 0.75)";

function unionCounts(...series) {
  const set = new Set();
  for (const arr of series) for (const r of arr || []) set.add(r.count);
  return [...set].sort((a, b) => a - b);
}

function fillBy(counts, arr) {
  return counts.map((c) => {
    const r = (arr || []).find((d) => d.count === c);
    return r ? r.freq : 0;
  });
}

function makeOptions(title) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: "top", labels: { font: { size: 10, weight: "700", family: "'Verdana', sans-serif" }, color: "#000" } },
      title: {
        display: true,
        text: title,
        font: { size: 12, weight: "700", family: "'Verdana', sans-serif" },
        color: "#000",
        padding: { bottom: 8 },
      },
    },
    scales: {
      x: {
        title: { display: true, text: "Number of districts", font: { size: 11, weight: "700", family: "'Verdana', sans-serif" }, color: "#000" },
        ticks: { font: { size: 10, weight: "700", family: "'Verdana', sans-serif" }, color: "#000" },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        title: { display: true, text: "Frequency (plans)", font: { size: 11, weight: "700", family: "'Verdana', sans-serif" }, color: "#000" },
        ticks: { font: { size: 10, weight: "700", family: "'Verdana', sans-serif" }, color: "#000" },
        grid: { color: "#f0f0f0" },
      },
    },
  };
}

function makeChartData(rbArr, vraArr) {
  const counts = unionCounts(rbArr, vraArr);
  return {
    labels: counts.map(String),
    datasets: [
      {
        label: "Race-Blind",
        data: fillBy(counts, rbArr),
        backgroundColor: RB_COLOR,
        borderColor: RB_COLOR.replace("0.75", "1"),
        borderWidth: 1,
      },
      {
        label: "VRA-Constrained",
        data: fillBy(counts, vraArr),
        backgroundColor: VRA_COLOR,
        borderColor: VRA_COLOR.replace("0.75", "1"),
        borderWidth: 1,
      },
    ],
  };
}

const DISPLAY = { Hispanic: "Latino", Black: "Black", Asian: "Asian", White: "White" };

const MinorityBarsChart = ({ data, group }) => {
  if (!data) return <div className="placeholder-card">Loading minority bar data…</div>;

  const groupKey = group ? group.charAt(0).toUpperCase() + group.slice(1).toLowerCase() : null;
  const groupData = groupKey ? data[groupKey] : null;

  if (!groupData) {
    const available = Object.keys(data).join(", ");
    return (
      <div className="placeholder-card">
        No data for "{group}" — available groups: {available}
      </div>
    );
  }

  const effectiveData = makeChartData(
    groupData.effective?.raceBlindData,
    groupData.effective?.vraData
  );
  const opportunityData = makeChartData(
    groupData.opportunity?.raceBlindData,
    groupData.opportunity?.vraData
  );

  const display = DISPLAY[groupKey] || groupKey;

  return (
    <div className="bar-chart-wrapper">
      <div className="bar-chart-panel">
        <Bar data={effectiveData} options={makeOptions(`Minority-Effective Districts (${display})`)} />
      </div>
      <div className="bar-chart-panel">
        <Bar data={opportunityData} options={makeOptions(`Majority-Minority Districts (${display})`)} />
      </div>
    </div>
  );
};

export default MinorityBarsChart;
