import { useEffect, useRef, useState, useCallback } from "react";
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

const RANGE_MIN = -12;
const RANGE_MAX =  12;

function jitter(hip: number): number {
  const h = ((hip * 2654435761) ^ (hip * 40503)) >>> 0;
  return ((h % 10000) / 10000) * 2 - 1;
}

type HitEntry = { hip: number; cx: number; cy: number; r: number };

export default function Timeline({ stars, selectedHip, onSelect }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const hitsRef    = useRef<HitEntry[]>([]);
  const starsRef   = useRef(stars);
  const selRef     = useRef(selectedHip);
  const [tooltip, setTooltip] = useState<{ hip: number; x: number; y: number; label: string } | null>(null);

  starsRef.current = stars;
  selRef.current   = selectedHip;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Use getBoundingClientRect for CSS dimensions — always matches mouse coords
    const rect = canvas.getBoundingClientRect();
    const w    = rect.width;
    const h    = rect.height;
    if (w === 0 || h === 0) return;

    const dpr = devicePixelRatio || 1;
    canvas.width  = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.scale(dpr, dpr);
    // All coordinates below are in CSS pixels

    const PAD   = { top: 40, right: 24, bottom: 32, left: 24 };
    const plotW = w - PAD.left - PAD.right;
    const axisY = PAD.top + (h - PAD.top - PAD.bottom) * 0.5;
    const bandH = (h - PAD.top - PAD.bottom) * 0.38;

    const toX = (gyr: number) =>
      PAD.left + ((gyr - RANGE_MIN) / (RANGE_MAX - RANGE_MIN)) * plotW;

    const nowX = toX(0);

    ctx.fillStyle = "#080810";
    ctx.fillRect(0, 0, w, h);

    const grad = ctx.createLinearGradient(PAD.left, 0, PAD.left + plotW, 0);
    grad.addColorStop(0,   "rgba(255,80,80,0.04)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.00)");
    grad.addColorStop(1,   "rgba(80,195,247,0.04)");
    ctx.fillStyle = grad;
    ctx.fillRect(PAD.left, PAD.top, plotW, h - PAD.top - PAD.bottom);

    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 0.5;
    for (let g = RANGE_MIN; g <= RANGE_MAX; g += 2) {
      const x = toX(g);
      ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, h - PAD.bottom); ctx.stroke();
    }

    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.left, axisY); ctx.lineTo(PAD.left + plotW, axisY); ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(nowX, PAD.top); ctx.lineTo(nowX, h - PAD.bottom); ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = "bold 10px 'Satoshi', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.textAlign = "center";
    ctx.fillText("NOW", nowX, PAD.top - 6);

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

    const currentSel = selRef.current;
    const currentStars = starsRef.current;
    const valid = currentStars.filter(s =>
      s.t_remaining_gyr != null &&
      isFinite(Number(s.t_remaining_gyr)) &&
      Number(s.t_remaining_gyr) >= RANGE_MIN &&
      Number(s.t_remaining_gyr) <= RANGE_MAX
    );
    const normal   = valid.filter(s => s.HIP !== currentSel);
    const selected = valid.filter(s => s.HIP === currentSel);

    const hits: HitEntry[] = [];

    const drawDot = (s: Star, isSel: boolean) => {
      const gyr   = Number(s.t_remaining_gyr);
      // cx, cy are in CSS pixels — same space as mouse events
      const cx    = toX(gyr);
      const cy    = axisY + jitter(s.HIP) * bandH;
      const r     = isSel ? 5.5 : 2;
      const color = STATUS_COLOR[s.status] ?? "#aaa";

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);

      if (isSel) {
        ctx.shadowBlur  = 18;
        ctx.shadowColor = color;
        ctx.fillStyle   = "#fff";
        ctx.fill();
        ctx.shadowBlur  = 0;
        ctx.strokeStyle = color;
        ctx.lineWidth   = 1.5;
        ctx.stroke();
      } else {
        ctx.fillStyle = color + "99";
        ctx.fill();
      }
      hits.push({ hip: s.HIP, cx, cy, r });
    };

    normal.forEach(s   => drawDot(s, false));
    selected.forEach(s => drawDot(s, true));   // drawn last = always on top

    hitsRef.current = hits;
  }, []);  // no deps — reads stars/sel via refs

  // Redraw whenever stars or selectedHip change
  useEffect(() => { draw(); }, [stars, selectedHip, draw]);

  // Redraw on resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obs = new ResizeObserver(() => draw());
    obs.observe(canvas);
    return () => obs.disconnect();
  }, [draw]);

  const hitTest = (mx: number, my: number): HitEntry | null => {
    const list = hitsRef.current;
    for (let i = list.length - 1; i >= 0; i--) {
      const { cx, cy, r } = list[i];
      if (Math.hypot(cx - mx, cy - my) <= Math.max(r + 4, 8)) return list[i];
    }
    return null;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    // Mouse position in CSS pixels relative to canvas top-left
    const mx   = e.clientX - rect.left;
    const my   = e.clientY - rect.top;
    const hit  = hitTest(mx, my);
    if (hit) {
      const s = starsRef.current.find(s => s.HIP === hit.hip);
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
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
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
