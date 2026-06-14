import { useState, useCallback } from "react";
import { useStars, useStats } from "./hooks/useStars";
import SkyMap from "./components/SkyMap";
import StarTable from "./components/StarTable";
import StarDetail from "./components/StarDetail";

const MAP_COUNTS = [
  { label: "500",  value: 500 },
  { label: "1k",   value: 1_000 },
  { label: "3k",   value: 3_000 },
  { label: "10k",  value: 10_000 },
  { label: "All",  value: 99_999 },
];

export default function App() {
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedHip, setSelectedHip] = useState<number | null>(null);
  const [flyToHip, setFlyToHip] = useState<number | null>(null);
  const [mapCount, setMapCount] = useState(3_000);

  const { data, isLoading } = useStars(statusFilter || undefined, search || undefined, page, 50);
  const { data: mapData, isLoading: mapLoading } = useStars(statusFilter || undefined, undefined, 1, mapCount, true);
  const { data: stats } = useStats();
  const mapStars = mapData?.data ?? [];

  const handleSelectStar = useCallback((hip: number) => {
    setSelectedHip(hip);
    setFlyToHip(hip);
  }, []);

  const handleMapClick = useCallback((hip: number) => {
    setSelectedHip(hip);
    setSearch(String(hip));
    setPage(1);
  }, []);

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <header style={{
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        gap: "20px",
        flexShrink: 0,
        zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M11 2L13.2 8.2L20 8.2L14.4 12.3L16.6 18.5L11 14.4L5.4 18.5L7.6 12.3L2 8.2L8.8 8.2Z"
              fill="var(--sun)" opacity="0.9"/>
          </svg>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "0.03em", color: "var(--text)" }}>Dead Stars</span>
        </div>

        {stats && (
          <div style={{ display: "flex", gap: 8, marginLeft: 8, flexWrap: "wrap" }}>
            {([
              ["Total",     stats.total,        "",               "var(--text)"],
              ["Dead",      stats.likely_dead,   "dot-dead",       "var(--dead)"],
              ["Uncertain", stats.uncertain,     "dot-uncertain",  "var(--uncertain)"],
              ["Alive",     stats.alive,         "dot-alive",      "var(--alive)"],
            ] as [string, number, string, string][]).map(([label, val, dot, color]) => (
              <span key={label} className="stat-chip">
                {dot && <span className={`dot ${dot}`} />}
                <span style={{ color: "var(--text-muted)" }}>{label}</span>
                <strong style={{ color }}>{val.toLocaleString()}</strong>
              </span>
            ))}
          </div>
        )}

        {/* Star count selector */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
            Stars on map
          </span>
          <div style={{ display: "flex", gap: 3 }}>
            {MAP_COUNTS.map(({ label, value }) => {
              const active = mapCount === value;
              return (
                <button
                  key={value}
                  onClick={() => setMapCount(value)}
                  style={{
                    padding: "3px 9px",
                    fontSize: 11,
                    fontWeight: active ? 700 : 400,
                    borderRadius: 6,
                    border: active
                      ? "1px solid rgba(255,255,255,0.18)"
                      : "1px solid rgba(255,255,255,0.06)",
                    background: active ? "rgba(255,255,255,0.10)" : "transparent",
                    color: active ? "var(--text)" : "var(--text-muted)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    position: "relative",
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
                      (e.currentTarget as HTMLButtonElement).style.color = "var(--text)";
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                      (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
                    }
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {/* Loading indicator */}
          {mapLoading && (
            <div style={{ width: 14, height: 14, flexShrink: 0 }}>
              <svg viewBox="0 0 14 14" fill="none" style={{ animation: "spin 1s linear infinite", display: "block" }}>
                <circle cx="7" cy="7" r="5" stroke="rgba(255,255,255,0.15)" strokeWidth="2"/>
                <path d="M7 2 A5 5 0 0 1 12 7" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
          )}
        </div>
      </header>

      {/* Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ flex: "0 0 55%", position: "relative", borderRight: "1px solid var(--border)" }}>
          <SkyMap
            stars={mapStars}
            flyToHip={flyToHip}
            onStarClick={handleMapClick}
            selectedHip={selectedHip}
          />
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: 1, overflow: "hidden", padding: "12px" }}>
            <StarTable
              data={data}
              isLoading={isLoading}
              onSelect={handleSelectStar}
              selectedHip={selectedHip}
              statusFilter={statusFilter}
              onStatusChange={(s) => { setStatusFilter(s); setPage(1); }}
              search={search}
              onSearchChange={(s) => { setSearch(s); setPage(1); }}
              page={page}
              onPageChange={setPage}
            />
          </div>

          {selectedHip && (
            <div style={{
              borderTop: "1px solid var(--border)",
              padding: "12px",
              flexShrink: 0,
              overflowY: "auto",
              maxHeight: "280px",
              background: "var(--surface)",
            }}>
              <StarDetail hipId={selectedHip} onClose={() => setSelectedHip(null)} />
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
