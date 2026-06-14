import { useState } from "react";
import type { StarsResponse } from "../types/star";

interface Props {
  data: StarsResponse | undefined;
  isLoading: boolean;
  onSelect: (hip: number) => void;
  selectedHip: number | null;
  statusFilter: string;
  onStatusChange: (s: string) => void;
  search: string;
  onSearchChange: (s: string) => void;
  page: number;
  onPageChange: (p: number) => void;
  spectralFilter: string;
  onSpectralChange: (s: string) => void;
  distMin: string;
  distMax: string;
  onDistMinChange: (s: string) => void;
  onDistMaxChange: (s: string) => void;
}

const SPECTRAL_TYPES = ["", "O", "B", "A", "F", "G", "K", "M"];

const STATUS_BTNS: { label: string; value: string; cls: string }[] = [
  { label: "All",       value: "",           cls: "" },
  { label: "☠ Dead",   value: "likely dead", cls: "dead" },
  { label: "? Uncertain", value: "uncertain", cls: "uncertain" },
  { label: "✦ Alive",  value: "alive",       cls: "alive" },
];

function badgeClass(s: string) {
  if (s === "likely dead") return "badge badge-dead";
  if (s === "uncertain") return "badge badge-uncertain";
  return "badge badge-alive";
}

export default function StarTable({
  data, isLoading, onSelect, selectedHip,
  statusFilter, onStatusChange,
  search, onSearchChange,
  page, onPageChange,
  spectralFilter, onSpectralChange,
  distMin, distMax, onDistMinChange, onDistMaxChange,
}: Props) {
  const [showFilters, setShowFilters] = useState(false);
  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;
  const activeFilterCount = [statusFilter, spectralFilter, distMin, distMax].filter(Boolean).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
      {/* Top bar */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search HIP..."
          value={search}
          onChange={(e) => { onSearchChange(e.target.value); onPageChange(1); }}
          className="ctrl"
          style={{ flex: 1, minWidth: 0 }}
        />
        <button
          className="btn"
          onClick={() => setShowFilters(v => !v)}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            background: showFilters ? "rgba(255,255,255,0.08)" : undefined,
            position: "relative",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M1 3h14M3 8h10M6 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span style={{
              position: "absolute", top: -4, right: -4,
              background: "var(--dead)", color: "#fff",
              borderRadius: "50%", width: 14, height: 14,
              fontSize: 9, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>{activeFilterCount}</span>
          )}
        </button>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <button className="btn" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}>‹</button>
          <span style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 60, textAlign: "center" }}>
            {page} / {totalPages}
          </span>
          <button className="btn" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>›</button>
        </div>
      </div>

      {/* Expandable filters panel */}
      {showFilters && (
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "10px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}>
          {/* Status toggles */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-faint)" }}>Status</span>
            <div style={{ display: "flex", gap: 5 }}>
              {STATUS_BTNS.map(({ label, value, cls }) => {
                const active = statusFilter === value;
                return (
                  <button
                    key={value}
                    onClick={() => { onStatusChange(value); onPageChange(1); }}
                    style={{
                      padding: "4px 10px",
                      fontSize: 12,
                      fontWeight: active ? 600 : 400,
                      borderRadius: 6,
                      border: active
                        ? `1px solid var(--${cls || "text-muted"})`
                        : "1px solid var(--border)",
                      background: active
                        ? `color-mix(in oklch, var(--${cls || "surface-2"}) 18%, transparent)`
                        : "transparent",
                      color: active
                        ? (cls ? `var(--${cls})` : "var(--text)")
                        : "var(--text-muted)",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Spectral type */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-faint)" }}>Spectral Type</span>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {SPECTRAL_TYPES.map((sp) => {
                const active = spectralFilter === sp;
                return (
                  <button
                    key={sp || "all"}
                    onClick={() => { onSpectralChange(sp); onPageChange(1); }}
                    style={{
                      padding: "3px 9px",
                      fontSize: 12,
                      fontFamily: "monospace",
                      borderRadius: 6,
                      border: active ? "1px solid rgba(255,255,255,0.2)" : "1px solid var(--border)",
                      background: active ? "rgba(255,255,255,0.10)" : "transparent",
                      color: active ? "var(--text)" : "var(--text-muted)",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {sp || "All"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Distance range */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-faint)" }}>Distance (ly)</span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="number"
                placeholder="Min"
                value={distMin}
                onChange={(e) => { onDistMinChange(e.target.value); onPageChange(1); }}
                className="ctrl"
                style={{ width: 80 }}
              />
              <span style={{ color: "var(--text-faint)", fontSize: 12 }}>—</span>
              <input
                type="number"
                placeholder="Max"
                value={distMax}
                onChange={(e) => { onDistMaxChange(e.target.value); onPageChange(1); }}
                className="ctrl"
                style={{ width: 80 }}
              />
              {(distMin || distMax) && (
                <button
                  className="btn"
                  style={{ padding: "2px 7px", fontSize: 11 }}
                  onClick={() => { onDistMinChange(""); onDistMaxChange(""); onPageChange(1); }}
                >✕</button>
              )}
            </div>
          </div>

          {/* Reset all */}
          {activeFilterCount > 0 && (
            <button
              style={{
                alignSelf: "flex-start",
                padding: "3px 10px", fontSize: 11,
                borderRadius: 6, border: "1px solid var(--border)",
                background: "transparent", color: "var(--text-muted)",
                cursor: "pointer",
              }}
              onClick={() => {
                onStatusChange("");
                onSpectralChange("");
                onDistMinChange("");
                onDistMaxChange("");
                onPageChange(1);
              }}
            >
              Reset all filters
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div style={{ overflowY: "auto", flex: 1, borderRadius: "var(--radius-lg)", border: "1px solid var(--border)" }}>
        {isLoading ? (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 28, opacity: 1 - i * 0.06 }} />
            ))}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", position: "sticky", top: 0, zIndex: 1 }}>
                <th style={th}>HIP</th>
                <th style={th}>Type</th>
                <th style={{ ...th, textAlign: "right" }}>Dist (ly)</th>
                <th style={{ ...th, textAlign: "right" }}>t_rem (Gyr)</th>
                <th style={{ ...th, textAlign: "right" }}>B-V</th>
                <th style={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((s) => (
                <tr
                  key={s.HIP}
                  className={`star-row${selectedHip === s.HIP ? " selected" : ""}`}
                  onClick={() => onSelect(s.HIP)}
                >
                  <td style={td}>
                    <span style={{ fontFamily: "monospace", color: "var(--text-muted)" }}>{s.HIP}</span>
                  </td>
                  <td style={td}>
                    <span style={{ color: "var(--text)", fontFamily: "monospace", fontSize: 12 }}>{s.SpType}</span>
                  </td>
                  <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--text-muted)" }}>
                    {s.distance_ly?.toFixed(0)}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    <span style={{ color: remainColor(s.t_remaining_gyr) }}>{s.t_remaining_gyr?.toFixed(2)}</span>
                  </td>
                  <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--text-muted)" }}>
                    {s["B-V"]?.toFixed(3)}
                  </td>
                  <td style={td}>
                    <span className={badgeClass(s.status)}>
                      <span className={`dot dot-${s.status === "likely dead" ? "dead" : s.status === "uncertain" ? "uncertain" : "alive"}`} />
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "8px 12px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--text-faint)",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "7px 12px",
  color: "var(--text-muted)",
};

function remainColor(v: number | null | undefined): string {
  if (v == null) return "var(--text-muted)";
  if (v < 0) return "var(--dead)";
  if (v < 1) return "var(--uncertain)";
  return "var(--alive)";
}
