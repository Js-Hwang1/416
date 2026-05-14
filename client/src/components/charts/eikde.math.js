// EI KDE polarization math. The endpoint serves per-group marginal KDEs on
// integer x = 0..100. To get the density of (X - Y) we assume independence
// and discrete-convolve the two marginals.

export const PCT_BINS = 101;

// PMF of (X - Y) on integer support [-100, 100] assuming independence.
// Returns [{x: -1.0..1.0 step 0.01, y: density}] (length 201).
export function computeDifference(f1, f2) {
  const a = new Array(PCT_BINS).fill(0);
  const b = new Array(PCT_BINS).fill(0);
  f1.forEach((p) => { if (p.x >= 0 && p.x < PCT_BINS) a[p.x] = p.y; });
  f2.forEach((p) => { if (p.x >= 0 && p.x < PCT_BINS) b[p.x] = p.y; });

  const sa = a.reduce((s, v) => s + v, 0);
  const sb = b.reduce((s, v) => s + v, 0);
  if (sa > 0) for (let i = 0; i < PCT_BINS; i++) a[i] /= sa;
  if (sb > 0) for (let i = 0; i < PCT_BINS; i++) b[i] /= sb;

  const out = [];
  for (let d = -100; d <= 100; d++) {
    let s = 0;
    for (let y = 0; y < PCT_BINS; y++) {
      const x = d + y;
      if (x >= 0 && x < PCT_BINS) s += a[x] * b[y];
    }
    // PMF (bin width 1%) -> density on x in [-1,1] (bin width 0.01), so y *= 100.
    out.push({ x: d / 100, y: s * 100 });
  }
  return out;
}

// Trapezoidal integral of density from `threshold` to 1.
export function probAboveThreshold(diffData, threshold) {
  let s = 0;
  for (let i = 1; i < diffData.length; i++) {
    const a = diffData[i - 1];
    const b = diffData[i];
    if (b.x <= threshold) continue;
    if (a.x < threshold) {
      const t = (threshold - a.x) / (b.x - a.x);
      const yAtT = a.y + (b.y - a.y) * t;
      s += 0.5 * (yAtT + b.y) * (b.x - threshold);
    } else {
      s += 0.5 * (a.y + b.y) * (b.x - a.x);
    }
  }
  return s;
}
