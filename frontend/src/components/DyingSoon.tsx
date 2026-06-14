import type { Star } from "../types/star";
import { useMemo } from "react";

interface Props {
  stars: Star[];
  onSelect: (hip: number) => void;
  selectedHip: number | null;
}

function formatRemaining(gyr: number): { text: string; color: string; subtext: string } {
  const abs = Math.abs(gyr);
  if (gyr <= 0) {
    if (abs < 0.001) return { text: "just died",                   color: "#ff4f4f", subtext: "dead" };
    if (abs < 1)     return { text: `${(abs*1000).toFixed(0)} Myr ago`, color: "#ff4f4f", subtext: "dead" };
    return            { text: `${abs.toFixed(2)} Gyr ago`,          color: "#ff6b6b", subtext: "dead" };
  }
  if (abs < 0.001) return { text: `< 1 Myr`,                      color: "#ff7043", subtext: "dying soon" };
  if (abs < 0.1)   return { text: `${(abs*1000).toFixed(0)} Myr`,  color: "#f5a623", subtext: "soon" };
  if (abs < 1)     return { text: `${(abs*1000).toFixed(0)} Myr`,  color: "#f5c842", subtext: "future" };
  if (abs < 5)     return { text: `${abs.toFixed(2)} Gyr`,         color: "#aed581", subtext: "future" };
  return             { text: `${abs.toFixed(1)} Gyr`,              color: "#4fc3f7", subtext: "long future" };
}

function ProgressBar({ fraction, color }: { fraction: number; color: string }) {
  const pct = Math.max(0, Math.min(100, fraction * 100));
  return (
    <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 99, overflow: "hidden", marginTop: 4 }}>
      <div style={{
        height: "100%", width: `${pct}%`,
        background: pct > 88 ? `linear-gradient(90deg,${color},#ff4f4f)` : color,
        borderRadius: 99,
        boxShadow: pct > 85 ? `0 0 6px ${color}88` : "none",
        transition: "width 0.5s cubic-bezier(0.16,1,0.3,1)",
      }} />
    </div>
  );
}

function Row({ s, rank, onSelect, selectedHip }: { s: Star; rank: number; onSelect:(h:number)=>void; selectedHip:number|null }) {
  const gyr      = Number(s.t_remaining_gyr ?? 0);
  const life     = Math.max(Number(s.t_life) || 1, 0.001);
  const age      = Number(s.t_age) || 0;
  const lifeFrac = Math.min(1, age / life);
  const { text, color, subtext } = formatRemaining(gyr);
  const isSel    = s.HIP === selectedHip;
  const dotVar   = s.status === "likely dead" ? "dead" : s.status === "uncertain" ? "uncertain" : "alive";

  return (
    <button
      onClick={() => onSelect(s.HIP)}
      style={{
        display: "block", width: "100%", textAlign: "left",
        background: isSel ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${isSel ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.05)"}`,
        borderRadius: 8, padding: "8px 10px",
        cursor: "pointer", transition: "all 0.15s",
      }}
      onMouseEnter={e => { if(!isSel){ const b=e.currentTarget as HTMLButtonElement; b.style.background="rgba(255,255,255,0.05)"; b.style.borderColor="rgba(255,255,255,0.12)"; }}}
      onMouseLeave={e => { if(!isSel){ const b=e.currentTarget as HTMLButtonElement; b.style.background="rgba(255,255,255,0.02)"; b.style.borderColor="rgba(255,255,255,0.05)"; }}}
    >
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:10, color:"rgba(255,255,255,0.2)", width:18, flexShrink:0, fontVariantNumeric:"tabular-nums" }}>#{rank}</span>
        <div style={{ width:8, height:8, borderRadius:"50%", flexShrink:0, background:`var(--${dotVar})`, boxShadow:`0 0 5px var(--${dotVar}-glow)` }} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
            <span style={{ fontSize:13, fontWeight:700, color:"var(--text)" }}>HIP {s.HIP}</span>
            <span style={{ fontSize:10, color:"var(--text-faint)" }}>{s.SpType || "—"}</span>
            {s.distance_ly != null && (
              <span style={{ fontSize:10, color:"rgba(255,255,255,0.18)", marginLeft:"auto" }}>{Number(s.distance_ly).toFixed(0)} ly</span>
            )}
          </div>
          <ProgressBar fraction={lifeFrac} color={color} />
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:2 }}>
            <span style={{ fontSize:9, color:"rgba(255,255,255,0.2)" }}>
              age {age<1 ? `${(age*1000).toFixed(0)} Myr` : `${age.toFixed(1)} Gyr`} / life {life<1 ? `${(life*1000).toFixed(0)} Myr` : `${life.toFixed(1)} Gyr`}
            </span>
            {s.M != null && <span style={{ fontSize:9, color:"rgba(255,255,255,0.2)" }}>{Number(s.M).toFixed(1)} M☉</span>}
          </div>
        </div>
        <div style={{ textAlign:"right", flexShrink:0, minWidth:84 }}>
          <div style={{ fontSize:12, fontWeight:700, color, fontVariantNumeric:"tabular-nums" }}>{text}</div>
          <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:"0.06em", marginTop:1 }}>{subtext}</div>
        </div>
      </div>
    </button>
  );
}

export default function DyingSoon({ stars, onSelect, selectedHip }: Props) {
  const valid = useMemo(() =>
    stars.filter(s => s.t_remaining_gyr != null && !isNaN(Number(s.t_remaining_gyr))),
    [stars]);

  // Future deaths — soonest first
  const dyingSoon = useMemo(() =>
    valid.filter(s => Number(s.t_remaining_gyr) > 0)
      .sort((a,b) => Number(a.t_remaining_gyr) - Number(b.t_remaining_gyr))
      .slice(0, 10),
    [valid]);

  // Recently dead — closest to 0 from the negative side
  const recentlyDead = useMemo(() =>
    valid.filter(s => Number(s.t_remaining_gyr) <= 0)
      .sort((a,b) => Number(b.t_remaining_gyr) - Number(a.t_remaining_gyr))
      .slice(0, 8),
    [valid]);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20, padding:"12px 14px", overflowY:"auto", height:"100%", boxSizing:"border-box" }}>

      {/* Summary */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {([
          ["With time data", valid.length, "rgba(255,255,255,0.45)"],
          ["Dying soonest", dyingSoon.length, "#4fc3f7"],
          ["Recently dead", recentlyDead.length, "#ff4f4f"],
        ] as [string,number,string][]).map(([label,val,color]) => (
          <div key={label} style={{ padding:"3px 10px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:6, fontSize:10 }}>
            <span style={{ color:"rgba(255,255,255,0.35)" }}>{label} </span>
            <strong style={{ color, fontVariantNumeric:"tabular-nums" }}>{val.toLocaleString()}</strong>
          </div>
        ))}
      </div>

      {/* Future deaths */}
      <div>
        <div style={{ fontSize:10, fontWeight:700, color:"rgba(80,195,247,0.7)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8, borderLeft:"2px solid rgba(80,195,247,0.4)", paddingLeft:8 }}>⏳ Dying soonest (future)</div>
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          {dyingSoon.length > 0
            ? dyingSoon.map((s,i) => <Row key={s.HIP} s={s} rank={i+1} onSelect={onSelect} selectedHip={selectedHip} />)
            : <p style={{ color:"var(--text-faint)", fontSize:12, margin:0, padding:"8px 0" }}>No future deaths in current map sample — try increasing map count to 10k or All.</p>}
        </div>
      </div>

      {/* Recently dead */}
      <div>
        <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,79,79,0.7)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8, borderLeft:"2px solid rgba(255,79,79,0.4)", paddingLeft:8 }}>☠ Most recently dead</div>
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          {recentlyDead.length > 0
            ? recentlyDead.map((s,i) => <Row key={s.HIP} s={s} rank={i+1} onSelect={onSelect} selectedHip={selectedHip} />)
            : <p style={{ color:"var(--text-faint)", fontSize:12, margin:0, padding:"8px 0" }}>No dead stars in current sample.</p>}
        </div>
      </div>
    </div>
  );
}
