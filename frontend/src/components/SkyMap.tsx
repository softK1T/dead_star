import { useMemo } from "react";
import Plot from "react-plotly.js";
import type { Star } from "../types/star";

const STATUS_COLORS: Record<string, string> = {
  "likely dead": "#ef4444",
  uncertain:     "#f59e0b",
  alive:         "#22c55e",
};

function toXYZ(star: Star): [number, number, number] {
  const d = star.distance_ly;
  const ra  = (star.RAdeg  * Math.PI) / 180;
  const dec = (star.DEdeg  * Math.PI) / 180;
  return [
    d * Math.cos(dec) * Math.cos(ra),
    d * Math.cos(dec) * Math.sin(ra),
    d * Math.sin(dec),
  ];
}

export default function SkyMap({ stars }: { stars: Star[] }) {
  const traces = useMemo(() => {
    const groups: Record<string, Star[]> = {};
    for (const s of stars) {
      if (!s.distance_ly || !s.RAdeg || !s.DEdeg) continue;
      (groups[s.status] ??= []).push(s);
    }

    return Object.entries(groups).map(([status, items]) => {
      const coords = items.map(toXYZ);
      return {
        type: "scatter3d",
        mode: "markers",
        name: status,
        x: coords.map(c => c[0]),
        y: coords.map(c => c[1]),
        z: coords.map(c => c[2]),
        text: items.map(s => `HIP ${s.HIP}<br>${s.SpType || ""}<br>${s.distance_ly?.toFixed(0)} ly`),
        hovertemplate: "%{text}<extra></extra>",
        marker: {
          color: STATUS_COLORS[status] || "#888",
          size: 2.5,
          opacity: 0.85,
        },
      };
    });
  }, [stars]);

  const sunTrace = {
    type: "scatter3d",
    mode: "markers+text",
    name: "Sun",
    x: [0], y: [0], z: [0],
    text: ["☀ Sun"],
    textposition: "top center",
    hoverinfo: "text",
    marker: { color: "#fde68a", size: 6, symbol: "circle" },
  };

  return (
    <Plot
      data={[...traces, sunTrace] as any}
      layout={{
        paper_bgcolor: "#030712",
        scene: {
          bgcolor: "#030712",
          xaxis: { title: "X (ly)", gridcolor: "#1f2937", zerolinecolor: "#374151" },
          yaxis: { title: "Y (ly)", gridcolor: "#1f2937", zerolinecolor: "#374151" },
          zaxis: { title: "Z (ly)", gridcolor: "#1f2937", zerolinecolor: "#374151" },
          camera: { eye: { x: 1.4, y: 1.4, z: 0.8 } },
        },
        font: { color: "#d1d5db" },
        margin: { t: 0, r: 0, b: 0, l: 0 },
        autosize: true,
        legend: { x: 0, y: 1, bgcolor: "rgba(0,0,0,0.4)" },
      }}
      config={{ displayModeBar: false }}
      useResizeHandler
      style={{ width: "100%", height: "100%" }}
    />
  );
}
