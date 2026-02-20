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
        backgroundColor: "rgba(54, 162, 235, 0.8)",
        borderColor: "rgba(54, 162, 235, 1)",
        borderWidth: 1
      }
    ]
  };

  const vraChart = {
    labels: allSplits,
    datasets: [
      {
        label: "VRA-Constrained Ensemble",
        data: mapData(vraData),
        backgroundColor: "rgba(255, 99, 132, 0.8)",
        borderColor: "rgba(255, 99, 132, 1)",
        borderWidth: 1
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 2,
    plugins: {
      legend: { 
        position: "top",
        labels: {
          font: { size: 12, family: "'Inter', sans-serif" }
        }
      },
      title: { 
        display: true, 
        text: "Simulated Election Outcomes",
        font: { size: 14, weight: 'bold', family: "'Inter', sans-serif" }
      }
    },
    scales: {
      x: { 
        title: { 
          display: true, 
          text: "Republican / Democrat Wins",
          font: { size: 12, family: "'Inter', sans-serif" }
        },
        ticks: {
          font: { size: 10, family: "'Inter', sans-serif" }
        }
      },
      y: { 
        beginAtZero: true, 
        title: { 
          display: true, 
          text: "Frequency",
          font: { size: 12, family: "'Inter', sans-serif" }
        },
        ticks: {
          font: { size: 10, family: "'Inter', sans-serif" }
        }
      }
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', width: '100%' }}>
      <div style={{ background: '#fff', padding: '20px', border: '1px solid #e0e0e0' }}>
        <Bar
          data={raceBlindChart}
          options={{ 
            ...options, 
            plugins: { 
              ...options.plugins, 
              title: { 
                ...options.plugins.title,
                text: "Race-Blind Ensemble" 
              } 
            } 
          }}
        />
      </div>
      <div style={{ background: '#fff', padding: '20px', border: '1px solid #e0e0e0' }}>
        <Bar
          data={vraChart}
          options={{ 
            ...options, 
            plugins: { 
              ...options.plugins, 
              title: { 
                ...options.plugins.title,
                text: "VRA-Constrained Ensemble" 
              } 
            } 
          }}
        />
      </div>
    </div>
  );
};

export default BarChart;
