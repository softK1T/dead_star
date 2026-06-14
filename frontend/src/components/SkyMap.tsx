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
  const dec = (star.DEdeg * Math.PI) / 180;
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
      if (s.distance_ly > 100000) continue; // filter parallax outliers
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
          `HIP ${s.HIP}<br>${s.SpType || ""}<br>${s.distance_ly?.toFixed(0)} ly<br>${s.status}`
        ),
        hovertemplate: "%{text}<extra></extra>",
        marker: { color: STATUS_COLORS[status] || "#888", size: 2, opacity: 0.8 },
      };
    });
  }, [stars]);

  const sunTrace = {
    type: "scatter3d",
    mode: "markers+text",
    name: "Sun",
    x: [0], y: [0], z: [0],
    text: ["☀"],
    textposition: "top center",
    hovertemplate: "Sun<extra></extra>",
    marker: { color: "#fde68a", size: 5 },
  };

  return (
    <Plot
      data={[...traces, sunTrace] as any}
      layout={{
        paper_bgcolor: "#030712",
        scene: {
          bgcolor: "#030712",
          xaxis: { title: "X (ly)", gridcolor: "#1f2937", zerolinecolor: "#4b5563" },
          yaxis: { title: "Y (ly)", gridcolor: "#1f2937", zerolinecolor: "#4b5563" },
          zaxis: { title: "Z (ly)", gridcolor: "#1f2937", zerolinecolor: "#4b5563" },
          camera: { eye: { x: 0.8, y: 1.5, z: 0.6 }, center: { x: 0, y: 0, z: 0 } },
          aspectmode: "cube",
        },
        font: { color: "#9ca3af" },
        margin: { t: 0, r: 0, b: 0, l: 0 },
        autosize: true,
        legend: {
          x: 0.01, y: 0.99,
          bgcolor: "rgba(3,7,18,0.7)",
          bordercolor: "#374151",
          borderwidth: 1,
        },
      }}
      config={{ displayModeBar: false }}
      useResizeHandler
      style={{ width: "100%", height: "100%" }}
    />
  );
}
