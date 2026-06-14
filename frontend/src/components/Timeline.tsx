import { useEffect, useRef, useState } from "react";
import type { Star } from "../types/star";

interface Props {
  stars: Star[];
  selectedHip: number | null;
  onSelect: (hip: number) => void;
}

const STATUS_COLOR: Record<string, string> = {
  "likely dead": "#ff4f4f",
  uncertain:     "#f5a623",
  alive:         "#4fc3f7",
};

// Current cosmic time anchor: ~13.8 Gyr since Big Bang, Sun ~4.6 Gyr old
// We display a timeline in Gyr relative to "now" (0 = present)
const NOW_GYR = 0;
const RANGE_MIN = -12; // Gyr ago
const RANGE_MAX = 12;  // Gyr from now

export default function Timeline({ stars, selectedHip, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hitsRef  = useRef<{ hip: number; cx: number; cy: number }[]>([]);
  const [tooltip, setTooltip] = useState<{ hip: number; x: number; y: number; label: string } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = devicePixelRatio;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const PAD = { top: 40, right: 24, bottom: 32, left: 24 };
    const plotW = w - PAD.left - PAD.right;
    const axisY = PAD.top + (h - PAD.top - PAD.bottom) * 0.5;

    const toX = (gyr: number) =>
      PAD.left + ((gyr - RANGE_MIN) / (RANGE_MAX - RANGE_MIN)) * plotW;

    // Background
    ctx.fillStyle = "#080810";
    ctx.fillRect(0, 0, w, h);

    // Future / Past shading
    const nowX = toX(NOW_GYR);
    const grad = ctx.createLinearGradient(PAD.left, 0, PAD.left + plotW, 0);
    grad.addColorStop(0,   "rgba(255, 80, 80, 0.04)");
    grad.addColorStop(0.5, "rgba(255,255,255, 0.00)");
    grad.addColorStop(1,   "rgba(80, 195, 247, 0.04)");
    ctx.fillStyle = grad;
    ctx.fillRect(PAD.left, PAD.top, plotW, h - PAD.top - PAD.bottom);

    // Grid ticks
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 0.5;
    for (let g = RANGE_MIN; g <= RANGE_MAX; g += 2) {
      const x = toX(g);
      ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, h - PAD.bottom); ctx.stroke();
    }

    // Main axis line
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.left, axisY); ctx.lineTo(PAD.left + plotW, axisY); ctx.stroke();

    // NOW line
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(nowX, PAD.top); ctx.lineTo(nowX, h - PAD.bottom); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "bold 10px 'Satoshi', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.textAlign = "center";
    ctx.fillText("NOW", nowX, PAD.top - 6);

    // Tick labels
    ctx.font = "9px 'Satoshi', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    for (let g = RANGE_MIN; g <= RANGE_MAX; g += 4) {
      const x = toX(g);
      const label = g === 0 ? "" : g > 0 ? `+${g}Gyr` : `${g}Gyr`;
      ctx.fillText(label, x, h - PAD.bottom + 14);
    }

    // "Past" / "Future" labels
    ctx.font = "9px 'Satoshi', sans-serif";
    ctx.fillStyle = "rgba(255,80,80,0.4)";
    ctx.textAlign = "left";
    ctx.fillText("← PAST", PAD.left + 4, PAD.top - 6);
    ctx.fillStyle = "rgba(80,195,247,0.4)";
    ctx.textAlign = "right";
    ctx.fillText("FUTURE →", PAD.left + plotW - 4, PAD.top - 6);

    // Data points
    // For each star: death_time_gyr = t_age - t_life (negative = already dead, positive = future)
    // We use t_remaining_gyr directly: negative = dead, positive = future
    const hits: { hip: number; cx: number; cy: number }[] = [];
    const valid = stars.filter(s => s.t_remaining_gyr != null && !isNaN(Number(s.t_remaining_gyr)));

    // Spread vertically by random-ish band based on HIP mod
    const bandH = (h - PAD.top - PAD.bottom) * 0.35;

    valid.forEach(s => {
      const gyr = Number(s.t_remaining_gyr);
      if (gyr < RANGE_MIN || gyr > RANGE_MAX) return;

      const cx = toX(gyr);
      // vertical jitter deterministic by HIP
      const jitter = ((s.HIP * 7919) % 1000) / 1000 - 0.5; // -0.5 to 0.5
      const cy = axisY + jitter * bandH;

      const isSelected = s.HIP === selectedHip;
      const color = STATUS_COLOR[s.status] ?? "#aaa";

      ctx.beginPath();
      ctx.arc(cx, cy, isSelected ? 5 : 1.8, 0, Math.PI * 2);

      if (isSelected) {
        ctx.shadowBlur = 16;
        ctx.shadowColor = "#fff";
        ctx.fillStyle = "#fff";
      } else {
        ctx.fillStyle = color + "aa";
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      hits.push({ hip: s.HIP, cx, cy });
    });

    hitsRef.current = hits;
  }, [stars, selectedHip]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let best: { hip: number; dist: number; cx: number; cy: number } | null = null;
    hitsRef.current.forEach(({ hip, cx, cy }) => {
      const d = Math.hypot(cx - mx, cy - my);
      if (!best || d < best.dist) best = { hip, dist: d, cx, cy };
    });
    if (best && (best as any).dist < 16) {
      const s = stars.find(s => s.HIP === (best as any).hip);
      if (s) {
        const gyr = Number(s.t_remaining_gyr);
        const label = gyr < 0
          ? `HIP ${s.HIP} · died ${Math.abs(gyr).toFixed(2)} Gyr ago`
          : `HIP ${s.HIP} · dies in ${gyr.toFixed(2)} Gyr`;
        setTooltip({ hip: s.HIP, x: (best as any).cx, y: (best as any).cy, label });
      }
    } else {
      setTooltip(null);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let best: { hip: number; dist: number } | null = null;
    hitsRef.current.forEach(({ hip, cx, cy }) => {
      const d = Math.hypot(cx - mx, cy - my);
      if (!best || d < best.dist) best = { hip, dist: d };
    });
    if (best && (best as any).dist < 16) onSelect((best as any).hip);
  };

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
        onClick={handleClick}
        style={{ width: "100%", height: "100%", cursor: "crosshair", display: "block" }}
      />

      {/* Legend */}
      <div style={{
        position: "absolute", top: 8, right: 8,
        display: "flex", gap: 8,
        background: "rgba(0,0,0,0.5)",
        borderRadius: 6, padding: "5px 10px",
        border: "1px solid rgba(255,255,255,0.08)",
        fontSize: 10,
      }}>
        {Object.entries(STATUS_COLOR).map(([s, c]) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 4, color: "rgba(255,255,255,0.5)" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: c }} />
            {s}
          </div>
        ))}
      </div>

      {/* Hover tooltip */}
      {tooltip && (
        <div style={{
          position: "absolute",
          left: tooltip.x + 10,
          top: tooltip.y - 28,
          background: "rgba(10,10,20,0.92)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 6, padding: "4px 10px",
          fontSize: 11, color: "rgba(255,255,255,0.85)",
          pointerEvents: "none", whiteSpace: "nowrap",
          backdropFilter: "blur(8px)",
        }}>
          {tooltip.label}
        </div>
      )}
    </div>
  );
}
