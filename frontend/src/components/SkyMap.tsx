import { useMemo } from "react";
import Plot from "react-plotly.js";
import type { Star } from "../types/star";

const STATUS_COLORS: Record<string, string> = {
  "likely dead": "#f04a4a",
  uncertain:     "#f0b84a",
  alive:         "#4af07a",
};

function toXYZ(star: Star): [number, number, number] {
  const d   = star.distance_ly;
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
      if (!s.distance_ly || s.distance_ly <= 0 || !s.RAdeg || !s.DEdeg) continue;
      if (s.distance_ly > 100_000) continue;
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
        text: items.map(s =>
          `<b>HIP ${s.HIP}</b><br>${s.SpType || "—"}<br>${s.distance_ly?.toFixed(0)} ly`
        ),
        hovertemplate: "%{text}<extra></extra>",
        marker: {
          color: STATUS_COLORS[status] || "#888",
          size: 2,
          opacity: 0.85,
          line: { width: 0 },
        },
      };
    });
  }, [stars]);

  const sunTrace = {
    type: "scatter3d",
    mode: "markers+text",
    name: "Sun",
    x: [0], y: [0], z: [0],
    text: ["☀"],
    textfont: { size: 14 },
    textposition: "top center",
    hovertemplate: "Sun (origin)<extra></extra>",
    marker: { color: "#fde98a", size: 6, opacity: 1 },
  };

  return (
    <Plot
      data={[...traces, sunTrace] as any}
      layout={{
        paper_bgcolor: "#04050f",
        scene: {
          bgcolor: "#04050f",
          xaxis: { title: "", gridcolor: "rgba(255,255,255,0.05)", zerolinecolor: "rgba(255,255,255,0.08)", tickfont: { color: "#3d4460", size: 10 }, showticklabels: false },
          yaxis: { title: "", gridcolor: "rgba(255,255,255,0.05)", zerolinecolor: "rgba(255,255,255,0.08)", tickfont: { color: "#3d4460", size: 10 }, showticklabels: false },
          zaxis: { title: "", gridcolor: "rgba(255,255,255,0.05)", zerolinecolor: "rgba(255,255,255,0.08)", tickfont: { color: "#3d4460", size: 10 }, showticklabels: false },
          camera: { eye: { x: 0.9, y: 1.6, z: 0.7 }, center: { x: 0, y: 0, z: 0 } },
          aspectmode: "cube",
          dragmode: "orbit",
        },
        font: { color: "#7a82a6", family: "Satoshi, Inter, sans-serif", size: 12 },
        margin: { t: 0, r: 0, b: 0, l: 0 },
        autosize: true,
        legend: {
          x: 0.02, y: 0.98,
          bgcolor: "rgba(4,5,15,0.8)",
          bordercolor: "rgba(255,255,255,0.07)",
          borderwidth: 1,
          font: { size: 12, color: "#7a82a6" },
        },
        hoverlabel: {
          bgcolor: "#0d1124",
          bordercolor: "rgba(255,255,255,0.14)",
          font: { color: "#e8eaf0", size: 13, family: "Satoshi, Inter, sans-serif" },
        },
      }}
      config={{ displayModeBar: false, scrollZoom: true }}
      useResizeHandler
      style={{ width: "100%", height: "100%" }}
    />
  );
}
