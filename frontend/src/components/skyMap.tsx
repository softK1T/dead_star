import Plot from "react-plotly.js"
import type { Star } from "../types/star"

const STATUS_COLOR: Record<string, string> = {
  alive: "#00ff88",
  uncertain: "#ffcc00",
  "likely dead": "#ff3333",
}

interface Props {
  stars: Star[]
  onSelect: (hip_id: number) => void
}

export default function SkyMap({ stars, onSelect }: Props) {
  const traces = ["alive", "uncertain", "likely dead"].map(status => {
    const subset = stars.filter(s => s.status === status)
    return {
      type: "scattergl" as const,
      mode: "markers" as const,
      name: status,
      x: subset.map(s => s.RAdeg),
      y: subset.map(s => s.DEdeg),
      text: subset.map(s => `HIP ${s.HIP} · ${s.SpType} · ${s.distance_ly.toFixed(0)} ly`),
      hoverinfo: "text" as const,
      customdata: subset.map(s => s.HIP),
      marker: { color: STATUS_COLOR[status], size: 4, opacity: 0.8 },
    }
  })

  return (
    <Plot
      data={traces}
      layout={{
        paper_bgcolor: "#0a0a1a",
        plot_bgcolor: "#0a0a1a",
        font: { color: "white" },
        xaxis: { title: "RA (°)", gridcolor: "#1a1a2e", zeroline: false },
        yaxis: { title: "Dec (°)", gridcolor: "#1a1a2e", zeroline: false },
        margin: { t: 20, b: 40, l: 50, r: 20 },
        legend: { bgcolor: "#0a0a1a" },
      }}
      style={{ width: "100%", height: "500px" }}
      onClick={e => {
        const hip = e.points[0]?.customdata as number
        if (hip) onSelect(hip)
      }}
    />
  )
}