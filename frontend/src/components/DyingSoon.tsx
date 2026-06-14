import type { Star } from "../types/star";
import { useMemo } from "react";

interface Props {
  stars: Star[];
  onSelect: (hip: number) => void;
  selectedHip: number | null;
}

const GYR_TO_YR = 1e9;

function formatRemaining(gyr: number): { text: string; color: string } {
  const absGyr = Math.abs(gyr);
  if (gyr < 0) {
    return {
      text: `died ${absGyr < 1 ? (absGyr * 1000).toFixed(0) + " Myr ago" : absGyr.toFixed(2) + " Gyr ago"}`,
      color: "#ff4f4f",
    };
  }
  if (absGyr < 0.001) return { text: `< 1 Myr`, color: "#ff4f4f" };
  if (absGyr < 1)     return { text: `${(absGyr * 1000).toFixed(0)} Myr`, color: "#f5a623" };
  return { text: `${absGyr.toFixed(2)} Gyr`, color: "#4fc3f7" };
}

function ProgressBar({ fraction, color }: { fraction: number; color: string }) {
  return (
    <div style={{
      height: 3, background: "rgba(255,255,255,0.07)",
      borderRadius: 99, overflow: "hidden", marginTop: 3,
    }}>
      <div style={{
        height: "100%",
        width: `${Math.max(0, Math.min(100, fraction * 100))}%`,
        background: color,
        borderRadius: 99,
        transition: "width 0.4s cubic-bezier(0.16,1,0.3,1)",
      }} />
    </div>
  );
}

export default function DyingSoon({ stars, onSelect, selectedHip }: Props) {
  // Top 10: smallest positive t_remaining_gyr (soonest to die among alive/uncertain)
  const top10 = useMemo(() => {
    return stars
      .filter(s => s.t_remaining_gyr != null && Number(s.t_remaining_gyr) > -5 && Number(s.t_remaining_gyr) < 20)
      .sort((a, b) => Number(a.t_remaining_gyr) - Number(b.t_remaining_gyr))
      .slice(0, 10);
  }, [stars]);

  // Also show top 5 already dead (most recently)
  const recentlyDead = useMemo(() => {
    return stars
      .filter(s => s.status === "likely dead" && s.t_remaining_gyr != null)
      .sort((a, b) => Number(b.t_remaining_gyr) - Number(a.t_remaining_gyr)) // closest to 0 from negative
      .slice(0, 5);
  }, [stars]);

  const maxLife = useMemo(() => {
    const vals = top10.map(s => Number(s.t_life)).filter(Boolean);
    return vals.length ? Math.max(...vals) : 1;
  }, [top10]);

  const renderRow = (s: Star, i: number) => {
    const remaining = Number(s.t_remaining_gyr);
    const life      = Number(s.t_life) || 1;
    const age       = Number(s.t_age) || 0;
    const lifeFraction = Math.min(1, age / life); // how far through its life
    const { text, color } = formatRemaining(remaining);
    const isSelected = s.HIP === selectedHip;
    const statusKey = s.status === "likely dead" ? "dead" : s.status === "uncertain" ? "uncertain" : "alive";

    return (
      <button
        key={s.HIP}
        onClick={() => onSelect(s.HIP)}
        style={{
          display: "block", width: "100%", textAlign: "left",
          background: isSelected ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
          border: isSelected ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(255,255,255,0.05)",
          borderRadius: 8, padding: "8px 10px",
          cursor: "pointer", transition: "all 0.15s",
        }}
        onMouseEnter={e => {
          if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
        }}
        onMouseLeave={e => {
          if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.02)";
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Rank */}
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", width: 16, flexShrink: 0 }}>#{i + 1}</span>

          {/* Star dot */}
          <div style={{
            width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
            background: `var(--${statusKey})`,
            boxShadow: `0 0 6px var(--${statusKey}-glow)`,
          }} />

          {/* HIP + SpType */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>HIP {s.HIP}</span>
              <span style={{ fontSize: 10, color: "var(--text-faint)" }}>{s.SpType || "—"}</span>
            </div>
            {/* Life progress bar */}
            <ProgressBar fraction={lifeFraction} color={color} />
          </div>

          {/* Remaining time */}
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{text}</div>
            {s.M != null && (
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>{(+s.M).toFixed(1)} M☉</div>
            )}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "12px 14px", overflowY: "auto", height: "100%" }}>

      {/* Header note */}
      <div style={{
        fontSize: 11, color: "rgba(255,255,255,0.3)",
        borderLeft: "2px solid rgba(255,80,80,0.4)",
        paddingLeft: 8, lineHeight: 1.5,
      }}>
        Stars sorted by time remaining. Progress bar shows how far through their total lifespan they are.
      </div>

      {/* Dying soonest */}
      <div>
        <div style={{
          fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)",
          letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8,
        }}>Dying soonest / recently dead</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {top10.map((s, i) => renderRow(s, i))}
          {top10.length === 0 && (
            <p style={{ color: "var(--text-faint)", fontSize: 12, margin: 0 }}>No data with current filters</p>
          )}
        </div>
      </div>

      {/* Recently dead */}
      {recentlyDead.length > 0 && (
        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, color: "rgba(255,80,80,0.5)",
            letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8,
          }}>Most recently confirmed dead</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {recentlyDead.map((s, i) => renderRow(s, i))}
          </div>
        </div>
      )}
    </div>
  );
}
