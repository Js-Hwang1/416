import React, { useEffect, useMemo, useRef, useState } from "react";
import Pagination from "../ui/Pagination";

const PAGE_SIZE = 15;

const EI_CONFIDENCE = {
  MA: { black: 0.97, hispanic: 0.67, asian: 0.98 },
  TX: { black: 0.90, hispanic: 0.58, asian: 0.74 },
};

// effectiveness = min(2k, 1) * ei_confidence ; k = group VAP fraction.
// Calibrated form scales by k so very-low-VAP districts read as low
// effectiveness even when ei_confidence is high.
function effectivenessScores(pct, eiConf) {
  if (pct == null || eiConf == null) return { raw: null, calibrated: null };
  const k = pct / 100;
  const raw = Math.min(2 * k, 1) * eiConf;
  const calibrated = raw * Math.min(1, k * 2);
  return { raw: +(raw * 100).toFixed(1), calibrated: +(calibrated * 100).toFixed(1) };
}

const fmt = (val) => val == null ? "—" : `${val.toFixed(1)}%`;

const DistrictTable = ({ rows, selectedDistrict, onSelectDistrict, enactedDemographics, stateId, minorityGroups }) => {
  const [page, setPage] = useState(0);
  const [groupIdx, setGroupIdx] = useState(0);
  const wrapperRef = useRef(null);
  const rowRefs = useRef(new Map());

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

  // Only include groups that have a known EI confidence for this state
  const feasibleGroups = useMemo(() => {
    if (!minorityGroups?.length || !stateId) return [];
    return minorityGroups.filter((g) => EI_CONFIDENCE[stateId]?.[g.key] != null);
  }, [minorityGroups, stateId]);

  const showEffectiveness = feasibleGroups.length > 0 && districtPct.size > 0;
  const activeGroup = feasibleGroups[groupIdx] ?? null;

  // Reset group index when state changes
  useEffect(() => { setGroupIdx(0); }, [stateId]);

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
        <div className="district-group-nav">
          {feasibleGroups.map((g, i) => (
            <button
              key={g.key}
              type="button"
              className={`demo-group-btn${groupIdx === i ? " active" : ""}`}
              onClick={() => setGroupIdx(i)}
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
            <th>Vote Margin</th>
            {showEffectiveness && <th>Eff.</th>}
            {showEffectiveness && <th>Calib. Eff.</th>}
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row) => {
            const districtNumber = Number.parseInt(row.districtNumber, 10);
            const isSelected = selectedDistrict === districtNumber;
            let scores = { raw: null, calibrated: null };
            if (showEffectiveness && activeGroup) {
              const pct = districtPct.get(districtNumber)?.[activeGroup.key];
              const eiConf = EI_CONFIDENCE[stateId][activeGroup.key];
              scores = effectivenessScores(pct, eiConf);
            }
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
                {showEffectiveness && <td>{fmt(scores.raw)}</td>}
                {showEffectiveness && <td>{fmt(scores.calibrated)}</td>}
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
