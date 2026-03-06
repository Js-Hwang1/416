const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8081";

export const apiUrl = (path) => `${API_BASE}${path}`;
export const tilesUrl = (file) => `pmtiles://${API_BASE}/tiles/${file}`;
