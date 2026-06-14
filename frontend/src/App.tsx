import { useState, useCallback } from "react";
import { useStars, useStats } from "./hooks/useStars";
import SkyMap from "./components/SkyMap";
import StarTable from "./components/StarTable";
import StarDetail from "./components/StarDetail";
import HRDiagram from "./components/HRDiagram";
import Histograms from "./components/Histograms";

const MAP_COUNTS = [
  { label: "500",  value: 500 },
  { label: "1k",   value: 1_000 },
  { label: "3k",   value: 3_000 },
  { label: "10k",  value: 10_000 },
  { label: "All",  value: 99_999 },
];

type SidePanel = "table" | "hr" | "hist";

export default function App() {
  const [statusFilter, setStatusFilter] = useState("");
  const [spectralFilter, setSpectralFilter] = useState("");
  const [distMin, setDistMin] = useState("");
  const [distMax, setDistMax] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedHip, setSelectedHip] = useState<number | null>(null);
  const [flyToHip, setFlyToHip] = useState<number | null>(null);
  const [mapCount, setMapCount] = useState(3_000);
  const [sidePanel, setSidePanel] = useState<SidePanel>("table");

  const { data, isLoading } = useStars(
    statusFilter || undefined, search || undefined,
    page, 50, false,
    spectralFilter || undefined,
    distMin ? Number(distMin) : undefined,
    distMax ? Number(distMax) : undefined,
  );

  const { data: mapData, isLoading: mapLoading } = useStars(
    statusFilter || undefined, undefined,
    1, mapCount, true,
    spectralFilter || undefined,
    distMin ? Number(distMin) : undefined,
    distMax ? Number(distMax) : undefined,
  );

  const { data: stats } = useStats();
  const mapStars = mapData?.data ?? [];

  const handleSelectStar = useCallback((hip: number) => {
    setSelectedHip(hip); setFlyToHip(hip);
  }, []);

  const handleMapClick = useCallback((hip: number) => {
    setSelectedHip(hip); setSearch(String(hip)); setPage(1);
  }, []);

  const handleNeighborSelect = useCallback((hip: number) => {
    setSelectedHip(hip); setFlyToHip(hip); setSearch(String(hip)); setPage(1);
  }, []);

  const handleExport = () => {
    const params = new URLSearchParams();
    if (statusFilter)  params.set("status",        statusFilter);
    if (spectralFilter) params.set("spectral_type", spectralFilter);
    if (distMin)       params.set("dist_min",       distMin);
    if (distMax)       params.set("dist_max",       distMax);
    const a = document.createElement("a");
    a.href = `/api/export/csv?${params.toString()}`;
    a.download = "dead_stars_export.csv";
    a.click();
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "5px 14px", fontSize: 12, borderRadius: "6px 6px 0 0",
    border: active ? "1px solid var(--border)" : "1px solid transparent",
    borderBottom: active ? "1px solid var(--surface)" : "1px solid transparent",
    background: active ? "var(--surface)" : "transparent",
    color: active ? "var(--text)" : "var(--text-muted)",
    cursor: "pointer", fontWeight: active ? 600 : 400,
    transition: "all 0.15s", marginBottom: "-1px", position: "relative" as const,
  });

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <header style={{
        background: "var(--surface)", borderBottom: "1px solid var(--border)",
        padding: "10px 20px", display: "flex", alignItems: "center", gap: 20,
        flexShrink: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M11 2L13.2 8.2L20 8.2L14.4 12.3L16.6 18.5L11 14.4L5.4 18.5L7.6 12.3L2 8.2L8.8 8.2Z"
              fill="var(--sun)" opacity="0.9"/>
          </svg>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "0.03em", color: "var(--text)" }}>Dead Stars</span>
        </div>

        {stats && (
          <div style={{ display: "flex", gap: 8, marginLeft: 8, flexWrap: "wrap" }}>
            {([
              ["Total",     stats.total,       "",              "var(--text)"],
              ["Dead",      stats.likely_dead,  "dot-dead",      "var(--dead)"],
              ["Uncertain", stats.uncertain,    "dot-uncertain", "var(--uncertain)"],
              ["Alive",     stats.alive,        "dot-alive",     "var(--alive)"],
            ] as [string, number, string, string][]).map(([label, val, dot, color]) => (
              <span key={label} className="stat-chip">
                {dot && <span className={`dot ${dot}`} />}
                <span style={{ color: "var(--text-muted)" }}>{label}</span>
                <strong style={{ color }}>{val.toLocaleString()}</strong>
              </span>
            ))}
          </div>
        )}

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          {/* Export CSV */}
          <button
            onClick={handleExport}
            style={{
              padding: "4px 12px", fontSize: 11, borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.6)",
              cursor: "pointer", transition: "all 0.15s",
              display: "flex", alignItems: "center", gap: 5,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#fff"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.3)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.6)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)"; }}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M5.5 1v6M2.5 7l3 3 3-3M1 10h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Export CSV
          </button>

          <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>Stars on map</span>
          <div style={{ display: "flex", gap: 3 }}>
            {MAP_COUNTS.map(({ label, value }) => {
              const active = mapCount === value;
              return (
                <button
                  key={value}
                  onClick={() => setMapCount(value)}
                  style={{
                    padding: "3px 9px", fontSize: 11,
                    fontWeight: active ? 700 : 400,
                    borderRadius: 6,
                    border: active ? "1px solid rgba(255,255,255,0.18)" : "1px solid rgba(255,255,255,0.06)",
                    background: active ? "rgba(255,255,255,0.10)" : "transparent",
                    color: active ? "var(--text)" : "var(--text-muted)",
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text)"; } }}
                  onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; } }}
                >
                  {label}
                </button>
              );
            })}
          </div>
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
        {/* 3D map */}
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

          {/* Tabs */}
          <div style={{
            display: "flex", gap: 2, padding: "8px 12px 0",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg)", flexShrink: 0,
          }}>
            <button style={tabStyle(sidePanel === "table")} onClick={() => setSidePanel("table")}>Table</button>
            <button style={tabStyle(sidePanel === "hr")}    onClick={() => setSidePanel("hr")}>HR Diagram</button>
            <button style={tabStyle(sidePanel === "hist")}  onClick={() => setSidePanel("hist")}>Statistics</button>
          </div>

          {/* Panel content */}
          <div style={{
            flex: 1, overflow: "hidden",
            display: "flex", flexDirection: "column",
          }}>
            {sidePanel === "table" && (
              <div style={{ flex: 1, overflow: "hidden", padding: 12 }}>
                <StarTable
                  data={data} isLoading={isLoading}
                  onSelect={handleSelectStar} selectedHip={selectedHip}
                  statusFilter={statusFilter} onStatusChange={s => { setStatusFilter(s); setPage(1); }}
                  search={search} onSearchChange={s => { setSearch(s); setPage(1); }}
                  page={page} onPageChange={setPage}
                  spectralFilter={spectralFilter} onSpectralChange={s => { setSpectralFilter(s); setPage(1); }}
                  distMin={distMin} distMax={distMax}
                  onDistMinChange={s => { setDistMin(s); setPage(1); }}
                  onDistMaxChange={s => { setDistMax(s); setPage(1); }}
                />
              </div>
            )}
            {sidePanel === "hr" && (
              <div style={{ flex: 1, overflow: "hidden" }}>
                <HRDiagram
                  stars={mapStars}
                  selectedHip={selectedHip}
                  onSelect={hip => { setSelectedHip(hip); setFlyToHip(hip); }}
                />
              </div>
            )}
            {sidePanel === "hist" && (
              <div style={{ flex: 1, overflow: "hidden" }}>
                <Histograms stars={mapStars} />
              </div>
            )}
          </div>

          {/* Star detail */}
          {selectedHip && (
            <div style={{
              borderTop: "1px solid var(--border)",
              padding: 12, flexShrink: 0,
              overflowY: "auto", maxHeight: 320,
              background: "var(--surface)",
            }}>
              <StarDetail
                hipId={selectedHip}
                onClose={() => setSelectedHip(null)}
                onSelect={handleNeighborSelect}
              />
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
