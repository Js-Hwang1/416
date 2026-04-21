import { useState, useEffect } from "react";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8081";

export const apiUrl = (path) => `${API_BASE}${path}`;
export const tilesUrl = (file) => `pmtiles://${API_BASE}/tiles/${file}`;

export function useFetchJson(url) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!url) return;
    axios.get(url).then((res) => setData(res.data));
  }, [url]);
  return data;
}
