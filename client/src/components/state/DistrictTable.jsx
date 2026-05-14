import React, { useEffect, useMemo, useRef, useState } from "react";
import Pagination from "../ui/Pagination";

const PAGE_SIZE = 10;

// EI confidence per state/group, from the state_config.json files used by the
// EI pipeline. Same numbers the Java AnalysisService uses to compute
// rough proportionality.
const EI_CONFIDENCE = {
  MA: { black: 0.97, hispanic: 0.67, asian: 0.98 },
  TX: { black: 0.90, hispanic: 0.58, asian: 0.74 },
};

const GROUP_LABEL = { black: "Black", hispanic: "Latino", asian: "Asian" };

// effectiveness = min(2k, 1) * ei_confidence ; k = group VAP fraction.
// Calibrated form scales by k itself so very-low-VAP districts read as low
// effectiveness even when ei_confidence is high (proxy for the s^dist
// calibration in the Becker paper).
function effectivenessScores(pct, eiConf) {
  if (pct == null || eiConf == null) return { raw: null, calibrated: null };
  const k = pct / 100;
  const raw = Math.min(2 * k, 1) * eiConf;
  const calibrated = raw * Math.min(1, k * 2);
  return { raw: +raw.toFixed(3), calibrated: +calibrated.toFixed(3) };
}

const DistrictTable = ({ rows, selectedDistrict, onSelectDistrict, enactedDemographics, stateId, minorityGroups }) => {
  const [page, setPage] = useState(0);
  const [effGroup, setEffGroup] = useState(null);
  const wrapperRef = useRef(null);
  const rowRefs = useRef(new Map());

  // Auto-pick the first feasible group when minorityGroups loads
  useEffect(() => {
    if (effGroup) return;
    if (minorityGroups?.length) setEffGroup(minorityGroups[0].key);
  }, [minorityGroups, effGroup]);

  // Map district number -> group VAP pct from enactedDemographics
  const districtPct = useMemo(() => {
    const map = new Map();
    const districts = enactedDemographics?.districts || [];
    for (const dd of districts) {
      const groups = dd.groups || {};
      const inner = {};
      for (const g of Object.keys(groups)) {
        inner[g] = groups[g]?.pct ?? 0;
      }
      map.set(dd.district, inner);
    }
    return map;
  }, [enactedDemographics]);

  const eiConf = (stateId && EI_CONFIDENCE[stateId]?.[effGroup]) ?? null;
  const showEffectiveness = effGroup && eiConf != null && districtPct.size > 0;

  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    if (selectedDistrict === null) return;
    const rowIndex = rows.findIndex(
      (r) => Number.parseInt(r.districtNumber, 10) === selectedDistrict
    );
    if (rowIndex !== -1) setPage(Math.floor(rowIndex / PAGE_SIZE));

    const wrapper = wrapperRef.current;
    const row = rowRefs.current.get(selectedDistrict);
    if (!wrapper || !row) return;
    const rowTop = row.offsetTop;
    const rowBottom = rowTop + row.offsetHeight;
    const visibleTop = wrapper.scrollTop;
    const visibleBottom = visibleTop + wrapper.clientHeight;
    if (rowTop < visibleTop) {
      wrapper.scrollTo({ top: rowTop, behavior: "smooth" });
    } else if (rowBottom > visibleBottom) {
      wrapper.scrollTo({ top: rowBottom - wrapper.clientHeight, behavior: "smooth" });
    }
  }, [selectedDistrict, rows]);

  return (
    <div className="district-table-wrapper" ref={wrapperRef}>
      {showEffectiveness && (
        <div className="chart-controls" style={{ marginBottom: 6 }}>
          <span className="chart-controls-label">Effectiveness for:</span>
          {(minorityGroups || []).map((g) => (
            <button
              key={g.key}
              type="button"
              className={`demo-group-btn${effGroup === g.key ? " active" : ""}`}
              onClick={() => setEffGroup(g.key)}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}
      <table className="district-table" aria-label="Congressional representation table">
        <thead>
          <tr>
            <th>#</th>
            <th>Representative</th>
            <th>Party</th>
            <th>Race</th>
            <th>Vote Margin %</th>
            {showEffectiveness && <th>Eff.</th>}
            {showEffectiveness && <th>Calib. Eff.</th>}
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row) => {
            const districtNumber = Number.parseInt(row.districtNumber, 10);
            const isSelected = selectedDistrict === districtNumber;
            const groupPct = showEffectiveness ? districtPct.get(districtNumber)?.[effGroup] : null;
            const scores = effectivenessScores(groupPct, eiConf);
            return (
              <tr
                key={row.districtNumber}
                ref={(el) => {
                  if (el) rowRefs.current.set(districtNumber, el);
                  else rowRefs.current.delete(districtNumber);
                }}
                className={`district-row-clickable${isSelected ? " district-row-selected" : ""}`}
                onClick={() => onSelectDistrict((prev) => prev === districtNumber ? null : districtNumber)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectDistrict((prev) => prev === districtNumber ? null : districtNumber);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Select district ${row.districtNumber}`}
              >
                <td>{row.districtNumber}</td>
                <td>{row.representative}</td>
                <td>
                  <span className={`party-badge party-${row.party?.toLowerCase()}`}>
                    {row.party === "Democrat" ? "D" : row.party === "Republican" ? "R" : row.party}
                  </span>
                </td>
                <td>{row.racialEthnicGroup}</td>
                <td>{row.voteMargin}</td>
                {showEffectiveness && <td>{scores.raw == null ? "—" : scores.raw.toFixed(2)}</td>}
                {showEffectiveness && <td>{scores.calibrated == null ? "—" : scores.calibrated.toFixed(2)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
};

export default DistrictTable;
