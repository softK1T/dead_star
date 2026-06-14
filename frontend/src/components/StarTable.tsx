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
}

const STATUS_OPTIONS = ["", "likely dead", "uncertain", "alive"];

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
}: Props) {
  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
      {/* Controls */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={statusFilter}
          onChange={(e) => { onStatusChange(e.target.value); onPageChange(1); }}
          className="ctrl"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s || "All statuses"}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search HIP..."
          value={search}
          onChange={(e) => { onSearchChange(e.target.value); onPageChange(1); }}
          className="ctrl"
          style={{ minWidth: 130 }}
        />

        <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: "auto" }}>
          <button className="btn" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}>Prev</button>
          <span style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 70, textAlign: "center" }}>
            {page} / {totalPages}
          </span>
          <button className="btn" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>Next</button>
        </div>
      </div>

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
