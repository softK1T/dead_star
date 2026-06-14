import { useStar } from "../hooks/useStars";
import NearestNeighbors from "./NearestNeighbors";

export default function StarDetail({
  hipId, onClose, onSelect,
}: {
  hipId: number;
  onClose: () => void;
  onSelect: (hip: number) => void;
}) {
  const { data: star, isLoading } = useStar(hipId);

  if (isLoading) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 8 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 22 }} />
      ))}
    </div>
  );
  if (!star) return <p style={{ color: "var(--dead)", padding: 8 }}>Not found</p>;

  const statusKey = star.status === "likely dead" ? "dead" : star.status === "uncertain" ? "uncertain" : "alive";

  const rows: [string, any][] = [
    ["HIP",               star.HIP],
    ["Spectral type",     star.SpType],
    ["V magnitude",       star.Vmag?.toFixed(2)],
    ["B-V index",         star["B-V"]?.toFixed(3)],
    ["Abs magnitude M\u2085", star.M_V?.toFixed(2)],
    ["Distance",          star.distance_ly ? `${(+star.distance_ly).toFixed(0)} ly` : "—"],
    ["Light left Earth",  star.light_left_year ? `${star.light_left_year} yr` : "—"],
    ["Luminosity",        star.L ? `${(+star.L).toExponential(2)} L☉` : "—"],
    ["Mass",              star.M ? `${(+star.M).toFixed(2)} M☉` : "—"],
    ["Total lifetime",    star.t_life ? `${(+star.t_life).toExponential(1)} yr` : "—"],
    ["Estimated age",     star.t_age ? `${(+star.t_age).toExponential(1)} yr` : "—"],
    ["Remaining",         star.t_remaining_gyr != null ? `${(+star.t_remaining_gyr).toFixed(2)} Gyr` : "—"],
    ["Coordinates",       star.RAdeg != null ? `RA ${(+star.RAdeg).toFixed(2)}° / Dec ${(+star.DEdeg!).toFixed(2)}°` : "—"],
  ];

  const simbadUrl = `https://simbad.cds.unistra.fr/simbad/sim-id?Ident=HIP+${star.HIP}`;

  return (
    <div style={{ position: "relative" }}>
      {/* Close */}
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: 0, right: 0,
          background: "none", border: "none", cursor: "pointer",
          color: "var(--text-faint)", fontSize: 18, lineHeight: 1,
          padding: "2px 6px", borderRadius: "var(--radius-sm)",
          transition: "color var(--transition)",
        }}
        onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
        onMouseLeave={e => (e.currentTarget.style.color = "var(--text-faint)")}
      >&times;</button>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: `radial-gradient(circle at 38% 38%, var(--${statusKey}), transparent 70%)`,
          boxShadow: `0 0 14px var(--${statusKey}-glow)`,
          border: `1px solid var(--${statusKey}-glow)`,
          flexShrink: 0,
        }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>HIP {star.HIP}</div>
          <span className={`badge badge-${statusKey}`}>
            <span className={`dot dot-${statusKey}`} />
            {star.status}
          </span>
        </div>
        {/* SIMBAD link */}
        <a
          href={simbadUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginLeft: "auto", marginRight: 28,
            fontSize: 11, padding: "3px 10px",
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.55)",
            textDecoration: "none",
            background: "rgba(255,255,255,0.04)",
            transition: "all 0.15s",
            display: "flex", alignItems: "center", gap: 5,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLAnchorElement).style.color = "#fff";
            (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(255,255,255,0.3)";
            (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.08)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.55)";
            (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(255,255,255,0.12)";
            (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.04)";
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}>
            <path d="M1 9L9 1M9 1H3M9 1V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          SIMBAD
        </a>
      </div>

      {/* Data rows */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: "2px 16px",
        marginBottom: 14,
      }}>
        {rows.map(([label, value]) => {
          const isNeg = label === "Remaining" && value && parseFloat(value) < 0;
          return (
            <div key={label} style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "5px 0",
              borderBottom: "1px solid var(--border)",
              fontSize: 13,
            }}>
              <span style={{ color: "var(--text-faint)" }}>{label}</span>
              <span style={{
                color: isNeg ? "var(--dead)" : "var(--text)",
                fontVariantNumeric: "tabular-nums",
                textAlign: "right",
              }}>{value ?? "—"}</span>
            </div>
          );
        })}
      </div>

      {/* Nearest neighbors */}
      <div>
        <div style={{
          fontSize: 10, fontWeight: 700,
          color: "rgba(255,255,255,0.3)",
          letterSpacing: "0.1em", marginBottom: 8,
          textTransform: "uppercase",
        }}>Nearest neighbors (3D)</div>
        <NearestNeighbors hipId={hipId} onSelect={onSelect} />
      </div>
    </div>
  );
}
