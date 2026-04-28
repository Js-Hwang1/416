import React from "react";

const Pagination = ({ page, totalPages, onChange }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="gingles-pagination">
      <button
        className="gingles-page-btn"
        onClick={() => onChange(page - 1)}
        disabled={page === 0}
      >‹</button>
      <input
        type="number"
        className="gingles-page-input"
        min={1}
        max={totalPages}
        defaultValue={page + 1}
        key={page}
        onBlur={(e) => {
          const v = Number(e.target.value) - 1;
          if (v >= 0 && v < totalPages) onChange(v);
          else e.target.value = page + 1;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.target.blur();
        }}
      />
      <span className="gingles-page-info">/ {totalPages}</span>
      <button
        className="gingles-page-btn"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages - 1}
      >›</button>
    </div>
  );
};

export default Pagination;
