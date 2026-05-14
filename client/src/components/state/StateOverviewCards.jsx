import React from "react";

function formatNumber(value) {
  return Number(value).toLocaleString();
}

function formatPct1(value) {
  return `${Number(value).toFixed(1)}%`;
}

const GROUP_LABELS = { black: "Black", hispanic: "Latino", asian: "Asian" };

const StateOverviewCards = ({ ov, cfg, roughProportionality, expectedSeatChange }) => (
  <div className="overview-cards">
    {expectedSeatChange && (
      <article className="overview-card">
        <h3 className="overview-card-title">Expected Seat Change vs Enacted</h3>
        <dl className="overview-kv-list">
          <div className="overview-kv-row">
            <dt>Controlling Party</dt>
            <dd>{expectedSeatChange.controllingParty}</dd>
          </div>
          <div className="overview-kv-row">
            <dt>Enacted Seats ({expectedSeatChange.controllingParty})</dt>
            <dd>{expectedSeatChange.enactedSeats}</dd>
          </div>
          <div className="overview-kv-row">
            <dt>Most Extreme Race-Blind</dt>
            <dd>{expectedSeatChange.mostExtremeRaceBlind}</dd>
          </div>
          <div className="overview-kv-row">
            <dt>Expected Change</dt>
            <dd style={{ fontWeight: 700, color: expectedSeatChange.expectedChange > 0 ? "#c0392b" : expectedSeatChange.expectedChange < 0 ? "#2563eb" : "#444" }}>
              {expectedSeatChange.expectedChange >= 0 ? "+" : ""}{expectedSeatChange.expectedChange}
            </dd>
          </div>
        </dl>
      </article>
    )}
    <article className="overview-card">
      <h3 className="overview-card-title">Population</h3>
      <dl className="overview-kv-list">
        <div className="overview-kv-row">
          <dt>Total Population</dt>
          <dd>{formatNumber(ov.totalPopulation)}</dd>
        </div>
      </dl>
    </article>

    <article className="overview-card">
      <h3 className="overview-card-title">Statewide Voter Distribution</h3>
      <dl className="overview-kv-list">
        <div className="overview-kv-row">
          <dt>Democratic Vote Share</dt>
          <dd>{formatPct1(ov.voterShare.democratic)}</dd>
        </div>
        <div className="overview-kv-row">
          <dt>Republican Vote Share</dt>
          <dd>{formatPct1(ov.voterShare.republican)}</dd>
        </div>
      </dl>
    </article>

    <article className="overview-card">
      <h3 className="overview-card-title">Racial/Ethnic Population Share</h3>
      <dl className="overview-kv-list">
        {Object.entries(ov.populationByGroup).map(([group, value]) => {
          const pct = ov.totalPopulation
            ? ((value / ov.totalPopulation) * 100).toFixed(1)
            : "0.0";
          return (
            <div className="overview-kv-row" key={group}>
              <dt>{group}</dt>
              <dd>{formatNumber(value)} <span className="overview-pct">({pct}%)</span></dd>
            </div>
          );
        })}
      </dl>
    </article>

    <article className="overview-card">
      <h3 className="overview-card-title">Redistricting Control</h3>
      <dl className="overview-kv-list">
        <div className="overview-kv-row">
          <dt>Redistricting Authority</dt>
          <dd>{cfg.redistrictingAuthority}</dd>
        </div>
      </dl>
    </article>

    <article className="overview-card">
      <h3 className="overview-card-title">Congressional Representation</h3>
      <dl className="overview-kv-list">
        <div className="overview-kv-row">
          <dt>Democrats</dt>
          <dd>{ov.congressionalByParty.Democrat ?? 0}</dd>
        </div>
        <div className="overview-kv-row">
          <dt>Republicans</dt>
          <dd>{ov.congressionalByParty.Republican ?? 0}</dd>
        </div>
        <div className="overview-kv-row">
          <dt>Total Seats</dt>
          <dd>{(ov.congressionalByParty.Democrat ?? 0) + (ov.congressionalByParty.Republican ?? 0)}</dd>
        </div>
      </dl>
    </article>

    <article className="overview-card">
      <h3 className="overview-card-title">Available Ensembles</h3>
      <dl className="overview-kv-list">
        {cfg.ensembles.map((ensemble) => (
          <React.Fragment key={ensemble.id}>
            <div className="overview-kv-row">
              <dt>{ensemble.type} Plans</dt>
              <dd>{ensemble.plans.toLocaleString()}</dd>
            </div>
            <div className="overview-kv-row">
              <dt>{ensemble.type} Threshold</dt>
              <dd>{ensemble.populationThreshold}</dd>
            </div>
          </React.Fragment>
        ))}
      </dl>
    </article>

    {roughProportionality && roughProportionality.length > 0 && (
      <article className="overview-card">
        <h3 className="overview-card-title">Rough Proportionality</h3>
        <table className="rp-table">
          <thead>
            <tr>
              <th>Group</th>
              <th>Effective Districts</th>
              <th>Population Share</th>
              <th>Ratio</th>
            </tr>
          </thead>
          <tbody>
            {roughProportionality.map((row) => (
              <tr key={row.group}>
                <td>{GROUP_LABELS[row.group] ?? row.group}</td>
                <td>{row.effectiveDistrictCount}</td>
                <td>{formatPct1(row.vapPct)}</td>
                <td>{row.ratio.toFixed(2)}×</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    )}
  </div>
);

export default StateOverviewCards;
