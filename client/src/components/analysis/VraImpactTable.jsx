import React from "react";

// GUI-20: VRA Impact Threshold Table.
// For each feasible minority group, displays the % of plans in each ensemble
// (Race-Blind vs VRA-Constrained) that meet each of three legal-threshold
// metrics: enacted-effectiveness floor, rough proportionality, and both.

const GROUP_LABEL = { Black: "Black", Hispanic: "Latino", Asian: "Asian" };
const DEFAULT_GROUPS = ["Black", "Hispanic", "Asian"];

const formatPct = (v) =>
  v == null ? "—" : `${(v * 100).toFixed(1)}%`;

export default function VraImpactTable({ data, threshold }) {
  if (!data) return <div className="placeholder-card">Loading VRA impact table…</div>;

  const groups = Object.keys(data).length ? Object.keys(data) : DEFAULT_GROUPS;

  return (
    <div className="vra-impact-table-wrapper">
      <h3 className="vra-impact-title">VRA Impact (threshold {threshold})</h3>
      <table className="vra-impact-table" aria-label="VRA impact threshold table">
        <thead>
          <tr>
            <th>Group</th>
            <th>Metric</th>
            <th>Race-Blind</th>
            <th>VRA-Constrained</th>
          </tr>
        </thead>
        <tbody>
          {groups.flatMap((g) => {
            const row = data[g] || {};
            const label = GROUP_LABEL[g] || g;
            return [
              <tr key={`${g}-effect`}>
                <td rowSpan={3} className="vra-impact-group"><strong>{label}</strong></td>
                <td>Meets enacted effectiveness floor</td>
                <td>{formatPct(row.meetsEnacted?.raceBlind)}</td>
                <td>{formatPct(row.meetsEnacted?.vra)}</td>
              </tr>,
              <tr key={`${g}-prop`}>
                <td>Achieves rough proportionality</td>
                <td>{formatPct(row.roughProportional?.raceBlind)}</td>
                <td>{formatPct(row.roughProportional?.vra)}</td>
              </tr>,
              <tr key={`${g}-both`}>
                <td>Satisfies both</td>
                <td>{formatPct(row.both?.raceBlind)}</td>
                <td>{formatPct(row.both?.vra)}</td>
              </tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
