import { useState } from "react";
import { useStars, useStats } from "./hooks/useStars";
import SkyMap from "./components/SkyMap";
import StarTable from "./components/StarTable";
import StarDetail from "./components/StarDetail";

export default function App() {
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedHip, setSelectedHip] = useState<number | null>(null);

  const { data, isLoading } = useStars(statusFilter || undefined, search || undefined, page, 50);
  const { data: mapData } = useStars(statusFilter || undefined, undefined, 1, 3000, true);
  const { data: stats } = useStats();
  const mapStars = mapData?.data ?? [];

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
            <path d="M11 2L13.2 8.2L20 8.2L14.4 12.3L16.6 18.5L11 14.4L5.4 18.5L7.6 12.3L2 8.2L8.8 8.2Z"
              stroke="var(--sun)" strokeWidth="0.5" fill="none"/>
          </svg>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "0.03em", color: "var(--text)" }}>Dead Stars</span>
        </div>

        {stats && (
          <div style={{ display: "flex", gap: 8, marginLeft: 8, flexWrap: "wrap" }}>
            <span className="stat-chip">
              <span style={{ color: "var(--text-muted)" }}>Total</span>
              <strong style={{ color: "var(--text)" }}>{stats.total.toLocaleString()}</strong>
            </span>
            <span className="stat-chip">
              <span className="dot dot-dead" />
              <span style={{ color: "var(--text-muted)" }}>Dead</span>
              <strong style={{ color: "var(--dead)" }}>{stats.likely_dead.toLocaleString()}</strong>
            </span>
            <span className="stat-chip">
              <span className="dot dot-uncertain" />
              <span style={{ color: "var(--text-muted)" }}>Uncertain</span>
              <strong style={{ color: "var(--uncertain)" }}>{stats.uncertain.toLocaleString()}</strong>
            </span>
            <span className="stat-chip">
              <span className="dot dot-alive" />
              <span style={{ color: "var(--text-muted)" }}>Alive</span>
              <strong style={{ color: "var(--alive)" }}>{stats.alive.toLocaleString()}</strong>
            </span>
          </div>
        )}
      </header>

      {/* Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* 3D Map */}
        <div style={{ flex: "0 0 55%", position: "relative", borderRight: "1px solid var(--border)" }}>
          <SkyMap stars={mapStars} />
        </div>

        {/* Right panel */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: 1, overflow: "hidden", padding: "12px" }}>
            <StarTable
              data={data}
              isLoading={isLoading}
              onSelect={setSelectedHip}
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
