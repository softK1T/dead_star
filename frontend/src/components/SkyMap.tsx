import { useMemo } from "react";
import Plot from "react-plotly.js";
import type { Star } from "../types/star";

const STATUS_COLORS: Record<string, string> = {
  "likely dead": "#ef4444",
  uncertain: "#f59e0b",
  alive: "#22c55e",
};

export default function SkyMap({ stars }: { stars: Star[] }) {
  const traces = useMemo(() => {
    const groups: Record<string, Star[]> = {};
    for (const s of stars) {
      (groups[s.status] ??= []).push(s);
    }
    return Object.entries(groups).map(([status, items]) => ({
      x: items.map((s) => s.RAdeg),
      y: items.map((s) => s.DEdeg),
      type: "scatter",
      mode: "markers",
      name: status,
      marker: { color: STATUS_COLORS[status] || "#888", size: 3, opacity: 0.7 },
      hovertemplate: "HIP %{text}<br>RA %{x:.2f}  Dec %{y:.2f}<extra></extra>",
      text: items.map((s) => s.HIP),
    }));
  }, [stars]);

  return (
    <Plot
      data={traces as any}
      layout={{
        paper_bgcolor: "#111827",
        plot_bgcolor: "#111827",
        font: { color: "#fff" },
        xaxis: { title: "RA (deg)", gridcolor: "#374151" },
        yaxis: { title: "Dec (deg)", gridcolor: "#374151" },
        margin: { t: 10, r: 10, b: 40, l: 50 },
        autosize: true,
        legend: { x: 1, y: 1 },
      }}
      useResizeHandler
      style={{ width: "100%", height: "100%" }}
    />
  );
}
