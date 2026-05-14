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

// Plugin: draw a vertical dashed line + "Enacted" label at the bar
// position whose label matches the given count.
const enactedMarkerPlugin = {
  id: "enactedMarker",
  afterDatasetsDraw(chart, _args, opts) {
    if (opts == null || opts.value == null) return;
    const value = opts.value;
    const labels = chart.data.labels || [];
    const idx = labels.indexOf(String(value));
    if (idx < 0) return;
    const x = chart.scales.x.getPixelForValue(idx);
    const yTop = chart.scales.y.top;
    const yBot = chart.scales.y.bottom;
    const ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = "#c0392b";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(x, yTop);
    ctx.lineTo(x, yBot);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#c0392b";
    ctx.font = "700 10px 'Verdana', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Enacted (${value})`, x, yTop - 4);
    ctx.restore();
  },
};

ChartJS.register(BarElement, CategoryScale, LinearScale, Title, Tooltip, Legend, enactedMarkerPlugin);

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

function makeOptions(title, enactedValue) {
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
      enactedMarker: { value: enactedValue ?? null },
    },
    scales: {
      x: {
        title: { display: true, text: "Number of districts", font: { size: 11, weight: "700", family: "'Verdana', sans-serif" }, color: "#000" },
        ticks: { font: { size: 10, weight: "700", family: "'Verdana', sans-serif" }, color: "#000" },
        grid: { display: false },
        offset: true,
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
        maxBarThickness: 60,
        categoryPercentage: 0.6,
        barPercentage: 0.85,
      },
      {
        label: "VRA-Constrained",
        data: fillBy(counts, vraArr),
        backgroundColor: VRA_COLOR,
        borderColor: VRA_COLOR.replace("0.75", "1"),
        borderWidth: 1,
        maxBarThickness: 60,
        categoryPercentage: 0.6,
        barPercentage: 0.85,
      },
    ],
  };
}

// True if the only non-zero category is count=0, meaning across the entire
// ensemble no plan produced even one effective/majority-minority district
// for this group. Renders cleaner as a placeholder than a single fat bar.
function isTrivialZero(rbArr, vraArr) {
  const both = [...(rbArr || []), ...(vraArr || [])];
  return both.length > 0 && both.every((r) => r.count === 0);
}

const DISPLAY = { Hispanic: "Latino", Black: "Black", Asian: "Asian", White: "White" };

const EMPTY_DATA = { labels: [], datasets: [] };

const TrivialPanel = ({ title }) => (
  <div className="bar-chart-panel">
    <Bar data={EMPTY_DATA} options={makeOptions(title, null)} />
  </div>
);

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

  const display = DISPLAY[groupKey] || groupKey;
  const effRb = groupData.effective?.raceBlindData;
  const effVra = groupData.effective?.vraData;
  const oppRb = groupData.opportunity?.raceBlindData;
  const oppVra = groupData.opportunity?.vraData;

  const effTrivial = isTrivialZero(effRb, effVra);
  const oppTrivial = isTrivialZero(oppRb, oppVra);

  const enactedEffective = groupData.effective?.enacted;
  const enactedOpportunity = groupData.opportunity?.enacted;

  return (
    <div className="bar-chart-wrapper">
      {effTrivial ? (
        <TrivialPanel title={`Minority-Effective Districts (${display})`} />
      ) : (
        <div className="bar-chart-panel">
          <Bar
            data={makeChartData(effRb, effVra)}
            options={makeOptions(`Minority-Effective Districts (${display})`, enactedEffective)}
          />
        </div>
      )}
      {oppTrivial ? (
        <TrivialPanel title={`Majority-Minority Districts (${display})`} />
      ) : (
        <div className="bar-chart-panel">
          <Bar
            data={makeChartData(oppRb, oppVra)}
            options={makeOptions(`Majority-Minority Districts (${display})`, enactedOpportunity)}
          />
        </div>
      )}
    </div>
  );
};

export default MinorityBarsChart;
