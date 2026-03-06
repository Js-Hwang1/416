import React from "react";
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Title, Tooltip, Legend } from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(BarElement, CategoryScale, LinearScale, Title, Tooltip, Legend);

const BarChart = ({ data }) => {
  const { raceBlindData = [], vraData = [] } = data || {};

  if (raceBlindData.length === 0 && vraData.length === 0) {
    return <div className="placeholder-card">No ensemble data available</div>;
  }

  // Combine all unique splits for x-axis
  const allSplits = Array.from(
    new Set([
      ...raceBlindData.map(d => `${d.republican}R / ${d.democrat}D`),
      ...vraData.map(d => `${d.republican}R / ${d.democrat}D`)
    ])
  ).sort((a, b) => {
    const aR = parseInt(a);
    const bR = parseInt(b);
    return aR - bR;
  });

  const mapData = (arr) =>
    allSplits.map(split => {
      const [r, d] = split.replace(/[RD]/g, '').split('/').map(s => Number(s.trim()));
      const item = arr.find(datum => datum.republican === r && datum.democrat === d);
      return item ? item.freq : 0;
    });

  const raceBlindChart = {
    labels: allSplits,
    datasets: [
      {
        label: "Frequency",
        data: mapData(raceBlindData),
        backgroundColor: "rgba(100, 170, 160, 0.7)",
        borderColor: "rgba(100, 170, 160, 1)",
        borderWidth: 1
      }
    ]
  };

  const vraChart = {
    labels: allSplits,
    datasets: [
      {
        label: "Frequency",
        data: mapData(vraData),
        backgroundColor: "rgba(200, 170, 80, 0.7)",
        borderColor: "rgba(200, 170, 80, 1)",
        borderWidth: 1
      }
    ]
  };

  const makeOptions = (title) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: title,
        font: { size: 12, weight: '600', family: "'Verdana', sans-serif" },
        color: '#333',
        padding: { bottom: 12 }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "Republican / Democrat Wins",
          font: { size: 11, family: "'Verdana', sans-serif" },
          color: '#888'
        },
        ticks: {
          font: { size: 10, family: "'Verdana', sans-serif" },
          color: '#666'
        },
        grid: { display: false }
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Frequency",
          font: { size: 11, family: "'Verdana', sans-serif" },
          color: '#888'
        },
        ticks: {
          font: { size: 10, family: "'Verdana', sans-serif" },
          color: '#666'
        },
        grid: { color: '#f0f0f0' }
      }
    }
  });

  return (
    <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, border: '1px solid #e8e8e8', padding: '16px', position: 'relative', minHeight: 0 }}>
        <Bar data={raceBlindChart} options={makeOptions("Race-Blind Ensemble")} />
      </div>
      <div style={{ flex: 1, border: '1px solid #e8e8e8', padding: '16px', position: 'relative', minHeight: 0 }}>
        <Bar data={vraChart} options={makeOptions("VRA-Constrained Ensemble")} />
      </div>
    </div>
  );
};

export default BarChart;
