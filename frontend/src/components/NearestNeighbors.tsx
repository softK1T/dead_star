import { useNearest } from "../hooks/useStars";

interface Props {
  hipId: number;
  onSelect: (hip: number) => void;
}

const STATUS_COLOR: Record<string, string> = {
  "likely dead": "var(--dead)",
  uncertain: "var(--uncertain)",
  alive: "var(--alive)",
};

export default function NearestNeighbors({ hipId, onSelect }: Props) {
  const { data, isLoading } = useNearest(hipId, 5);

  if (isLoading) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 28, borderRadius: 6 }} />
      ))}
    </div>
  );

  if (!data?.length) return (
    <p style={{ color: "var(--text-faint)", fontSize: 12, margin: 0 }}>No neighbors found</p>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {data.map((s, i) => (
        <button
          key={s.HIP}
          onClick={() => onSelect(s.HIP)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 6, padding: "5px 8px",
            cursor: "pointer", width: "100%", textAlign: "left",
            transition: "background 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
        >
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", width: 14, flexShrink: 0 }}>#{i + 1}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", flexShrink: 0 }}>HIP {s.HIP}</span>
          <span style={{ fontSize: 11, color: "var(--text-faint)", flex: 1 }}>{s.SpType || "—"}</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
            {s.distance_ly != null ? `${(+s.distance_ly).toFixed(0)} ly` : "—"}
          </span>
          <span style={{
            fontSize: 10, padding: "1px 6px", borderRadius: 99,
            background: (STATUS_COLOR[s.status] ?? "#888") + "22",
            color: STATUS_COLOR[s.status] ?? "#888",
            border: `1px solid ${STATUS_COLOR[s.status] ?? "#888"}44`,
            flexShrink: 0, whiteSpace: "nowrap",
          }}>{s.status}</span>
        </button>
      ))}
    </div>
  );
}
