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

const NOW_GYR  = 0;
const RANGE_MIN = -12;
const RANGE_MAX =  12;

/** Deterministic but well-distributed jitter in [-1, 1] */
function jitter(hip: number): number {
  // two-step hash so nearby HIP values spread apart
  const h = ((hip * 2654435761) ^ (hip * 40503)) >>> 0;
  return ((h % 10000) / 10000) * 2 - 1;
}

export default function Timeline({ stars, selectedHip, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // hit list sorted by draw order (last = topmost)
  const hitsRef = useRef<{ hip: number; cx: number; cy: number; r: number }[]>([]);
  const [tooltip, setTooltip] = useState<{ hip: number; x: number; y: number; label: string } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr  = devicePixelRatio;
    const w    = canvas.offsetWidth;
    const h    = canvas.offsetHeight;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const PAD   = { top: 40, right: 24, bottom: 32, left: 24 };
    const plotW = w - PAD.left - PAD.right;
    const axisY = PAD.top + (h - PAD.top - PAD.bottom) * 0.5;
    const bandH = (h - PAD.top - PAD.bottom) * 0.38;

    const toX = (gyr: number) =>
      PAD.left + ((gyr - RANGE_MIN) / (RANGE_MAX - RANGE_MIN)) * plotW;

    // Background
    ctx.fillStyle = "#080810";
    ctx.fillRect(0, 0, w, h);

    // Past / future gradient shading
    const nowX = toX(NOW_GYR);
    const grad = ctx.createLinearGradient(PAD.left, 0, PAD.left + plotW, 0);
    grad.addColorStop(0,   "rgba(255,80,80,0.04)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.00)");
    grad.addColorStop(1,   "rgba(80,195,247,0.04)");
    ctx.fillStyle = grad;
    ctx.fillRect(PAD.left, PAD.top, plotW, h - PAD.top - PAD.bottom);

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 0.5;
    for (let g = RANGE_MIN; g <= RANGE_MAX; g += 2) {
      const x = toX(g);
      ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, h - PAD.bottom); ctx.stroke();
    }

    // Axis
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
      const label = g === 0 ? "" : g > 0 ? `+${g}Gyr` : `${g}Gyr`;
      ctx.fillText(label, toX(g), h - PAD.bottom + 14);
    }

    ctx.font = "9px 'Satoshi', sans-serif";
    ctx.fillStyle = "rgba(255,80,80,0.4)";
    ctx.textAlign = "left";
    ctx.fillText("\u2190 PAST", PAD.left + 4, PAD.top - 6);
    ctx.fillStyle = "rgba(80,195,247,0.4)";
    ctx.textAlign = "right";
    ctx.fillText("FUTURE \u2192", PAD.left + plotW - 4, PAD.top - 6);

    // Split stars: normal first, selected drawn last (always on top)
    const valid = stars.filter(s =>
      s.t_remaining_gyr != null &&
      isFinite(Number(s.t_remaining_gyr)) &&
      Number(s.t_remaining_gyr) >= RANGE_MIN &&
      Number(s.t_remaining_gyr) <= RANGE_MAX
    );
    const normal   = valid.filter(s => s.HIP !== selectedHip);
    const selected = valid.filter(s => s.HIP === selectedHip);

    const hits: { hip: number; cx: number; cy: number; r: number }[] = [];

    const drawStar = (s: Star, isSel: boolean) => {
      const gyr   = Number(s.t_remaining_gyr);
      const cx    = toX(gyr);
      const cy    = axisY + jitter(s.HIP) * bandH;
      const r     = isSel ? 5.5 : 2;
      const color = STATUS_COLOR[s.status] ?? "#aaa";

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);

      if (isSel) {
        // Outer glow ring
        ctx.shadowBlur  = 18;
        ctx.shadowColor = color;
        ctx.fillStyle   = "#fff";
        ctx.fill();
        ctx.shadowBlur  = 0;
        // Colour ring
        ctx.strokeStyle = color;
        ctx.lineWidth   = 1.5;
        ctx.stroke();
      } else {
        ctx.fillStyle = color + "99";
        ctx.fill();
      }

      // store hit — pushed in draw order so last = topmost
      hits.push({ hip: s.HIP, cx, cy, r });
    };

    normal.forEach(s   => drawStar(s, false));
    selected.forEach(s => drawStar(s, true));

    hitsRef.current = hits;
  }, [stars, selectedHip]);

  // Hit-test: iterate in REVERSE draw order (topmost first),
  // prefer a point where cursor is within its rendered radius.
  const hitTest = (mx: number, my: number): (typeof hitsRef.current)[0] | null => {
    const list = hitsRef.current;
    // Reverse so topmost (last drawn) wins
    for (let i = list.length - 1; i >= 0; i--) {
      const { cx, cy, r } = list[i];
      if (Math.hypot(cx - mx, cy - my) <= Math.max(r + 4, 8)) return list[i];
    }
    return null;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const hit  = hitTest(e.clientX - rect.left, e.clientY - rect.top);
    if (hit) {
      const s = stars.find(s => s.HIP === hit.hip);
      if (s) {
        const gyr = Number(s.t_remaining_gyr);
        const label = gyr < 0
          ? `HIP ${s.HIP} \u00b7 died ${Math.abs(gyr).toFixed(2)} Gyr ago`
          : `HIP ${s.HIP} \u00b7 dies in ${gyr.toFixed(2)} Gyr`;
        setTooltip({ hip: s.HIP, x: hit.cx, y: hit.cy, label });
        return;
      }
    }
    setTooltip(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const hit  = hitTest(e.clientX - rect.left, e.clientY - rect.top);
    if (hit) onSelect(hit.hip);
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

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: "absolute",
          left: tooltip.x + 12,
          top:  tooltip.y - 30,
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
