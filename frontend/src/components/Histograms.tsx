import { useMemo } from "react";
import type { Star } from "../types/star";

interface Props { stars: Star[]; }

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11 }}>
      <span style={{ width: 36, textAlign: "right", color: "rgba(255,255,255,0.35)", flexShrink: 0, fontVariantNumeric: "tabular-nums", fontSize: 10 }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: color,
          borderRadius: 99,
          transition: "width 0.4s cubic-bezier(0.16,1,0.3,1)",
        }} />
      </div>
      <span style={{ width: 40, textAlign: "right", color: "rgba(255,255,255,0.45)", flexShrink: 0, fontVariantNumeric: "tabular-nums", fontSize: 10 }}>
        {value.toLocaleString()}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)",
        letterSpacing: "0.1em", marginBottom: 8, textTransform: "uppercase",
      }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>{children}</div>
    </div>
  );
}

export default function Histograms({ stars }: Props) {
  const distBuckets = useMemo(() => {
    const edges = [0, 100, 300, 500, 1000, 2000, 5000, Infinity];
    const labels = ["<100", "100–300", "300–500", "500–1k", "1k–2k", "2k–5k", ">5k"];
    const counts = new Array(labels.length).fill(0);
    stars.forEach(s => {
      const d = Number(s.distance_ly);
      if (!d) return;
      for (let i = 0; i < edges.length - 1; i++) {
        if (d >= edges[i] && d < edges[i + 1]) { counts[i]++; break; }
      }
    });
    return labels.map((l, i) => ({ label: l, count: counts[i] }));
  }, [stars]);

  const spectralBuckets = useMemo(() => {
    const map: Record<string, number> = {};
    stars.forEach(s => {
      const key = s.SpType ? s.SpType[0] : "?";
      map[key] = (map[key] ?? 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [stars]);

  const statusBuckets = useMemo(() => [
    { label: "Dead",      count: stars.filter(s => s.status === "likely dead").length, color: "#ff4f4fcc" },
    { label: "Uncertain", count: stars.filter(s => s.status === "uncertain").length,   color: "#f5a623cc" },
    { label: "Alive",     count: stars.filter(s => s.status === "alive").length,       color: "#4fc3f7cc" },
  ], [stars]);

  const maxDist = Math.max(...distBuckets.map(b => b.count), 1);
  const maxSpec = Math.max(...spectralBuckets.map(b => b[1]), 1);
  const maxStat = Math.max(...statusBuckets.map(b => b.count), 1);

  const SPECTRAL_COLORS: Record<string, string> = {
    O: "#9bb0ffbb", B: "#aabfffbb", A: "#cad7ffbb",
    F: "#f8f7ffbb", G: "#fff4eabb", K: "#ffd2a1bb",
    M: "#ffaa6bbb", "?": "#888",
  };

  const total = stars.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, padding: "14px 16px", overflowY: "auto", height: "100%" }}>
      {/* Summary numbers */}
      <div style={{ display: "flex", gap: 12 }}>
        {statusBuckets.map(b => (
          <div key={b.label} style={{
            flex: 1, padding: "8px 10px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 8,
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: b.color.slice(0, 7), fontVariantNumeric: "tabular-nums" }}>
              {b.count.toLocaleString()}
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{b.label}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 1 }}>
              {total > 0 ? ((b.count / total) * 100).toFixed(1) : 0}%
            </div>
          </div>
        ))}
      </div>

      <Section title="Status distribution">
        {statusBuckets.map(b => <BarRow key={b.label} label={b.label} value={b.count} max={maxStat} color={b.color} />)}
      </Section>

      <Section title="Distance (light-years)">
        {distBuckets.map(b => <BarRow key={b.label} label={b.label} value={b.count} max={maxDist} color="#4fc3f7aa" />)}
      </Section>

      <Section title="Spectral class">
        {spectralBuckets.map(([k, v]) => (
          <BarRow key={k} label={k} value={v} max={maxSpec} color={SPECTRAL_COLORS[k] ?? "#aaaaaabb"} />
        ))}
      </Section>
    </div>
  );
}
