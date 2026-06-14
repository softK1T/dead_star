import { useState, useCallback } from "react";
import { useStars, useStats } from "./hooks/useStars";
import SkyMap from "./components/SkyMap";
import StarTable from "./components/StarTable";
import StarDetail from "./components/StarDetail";

export default function App() {
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedHip, setSelectedHip] = useState<number | null>(null);
  // Camera target: when set, SkyMap flies to this HIP
  const [flyToHip, setFlyToHip] = useState<number | null>(null);

  const { data, isLoading } = useStars(statusFilter || undefined, search || undefined, page, 50);
  const { data: mapData } = useStars(statusFilter || undefined, undefined, 1, 3000, true);
  const { data: stats } = useStats();
  const mapStars = mapData?.data ?? [];

  // Table row click → fly camera to star
  const handleSelectStar = useCallback((hip: number) => {
    setSelectedHip(hip);
    setFlyToHip(hip);
  }, []);

  // 3D click → select in table + show detail
  const handleMapClick = useCallback((hip: number) => {
    setSelectedHip(hip);
    // If star not in current page, search for it
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
              ["Total",     stats.total,        "",                  "var(--text)"],
              ["Dead",      stats.likely_dead,   "dot-dead",         "var(--dead)"],
              ["Uncertain", stats.uncertain,     "dot-uncertain",    "var(--uncertain)"],
              ["Alive",     stats.alive,         "dot-alive",        "var(--alive)"],
            ] as [string, number, string, string][]).map(([label, val, dot, color]) => (
              <span key={label} className="stat-chip">
                {dot && <span className={`dot ${dot}`} />}
                <span style={{ color: "var(--text-muted)" }}>{label}</span>
                <strong style={{ color }}>{val.toLocaleString()}</strong>
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* 3D Map */}
        <div style={{ flex: "0 0 55%", position: "relative", borderRight: "1px solid var(--border)" }}>
          <SkyMap
            stars={mapStars}
            flyToHip={flyToHip}
            onStarClick={handleMapClick}
            selectedHip={selectedHip}
          />
        </div>

        {/* Right panel */}
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
    </div>
  );
}
