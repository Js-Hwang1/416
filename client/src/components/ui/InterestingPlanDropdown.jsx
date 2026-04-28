import React, { useEffect, useRef, useState } from "react";

const InterestingPlanDropdown = ({ options, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (!ref.current?.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="interesting-plan-dropdown" ref={ref}>
      <button
        type="button"
        className="compare-enacted-btn interesting-plan-select"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {options.find((o) => o.value === value)?.label ?? "Enacted"} ▾
      </button>
      {isOpen && (
        <div
          className="interesting-plan-menu"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {options.map((option) => (
            <button
              type="button"
              key={option.value}
              className="interesting-plan-option"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default InterestingPlanDropdown;
