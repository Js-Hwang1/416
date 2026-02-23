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
      ...raceBlindData.map(d => `${d.republican}R / ${d.democrat}D`),
      ...vraData.map(d => `${d.republican}R / ${d.democrat}D`)
    ])
  ).sort();

  const mapData = (data) =>
    allSplits.map(split => {
      const [r, d] = split.replace(/[RD]/g, '').split('/').map(s => Number(s.trim()));
      const item = data.find(datum => datum.republican === r && datum.democrat === d);
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
    maintainAspectRatio: true,
    aspectRatio: 1.8,
    plugins: {
      legend: { display: false },
      title: { 
        display: true, 
        text: title,
        font: { size: 12, weight: '600', family: "'Inter', sans-serif" },
        color: '#333',
        padding: { bottom: 12 }
      }
    },
    scales: {
      x: { 
        title: { 
          display: true, 
          text: "Republican / Democrat Wins",
          font: { size: 11, family: "'Inter', sans-serif" },
          color: '#888'
        },
        ticks: {
          font: { size: 10, family: "'Inter', sans-serif" },
          color: '#666'
        },
        grid: { display: false }
      },
      y: { 
        beginAtZero: true, 
        title: { 
          display: true, 
          text: "Frequency",
          font: { size: 11, family: "'Inter', sans-serif" },
          color: '#888'
        },
        ticks: {
          font: { size: 10, family: "'Inter', sans-serif" },
          color: '#666'
        },
        grid: { color: '#f0f0f0' }
      }
    }
  });

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', width: '100%' }}>
        <div style={{ border: '1px solid #e8e8e8', padding: '16px' }}>
          <Bar data={raceBlindChart} options={makeOptions("Race-Blind Ensemble")} />
        </div>
        <div style={{ border: '1px solid #e8e8e8', padding: '16px' }}>
          <Bar data={vraChart} options={makeOptions("VRA-Constrained Ensemble")} />
        </div>
      </div>
    </div>
  );
};

export default BarChart;
