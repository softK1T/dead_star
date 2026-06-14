import { useEffect, useRef } from "react";
import type { Star } from "../types/star";

interface Props {
  stars: Star[];
  selectedHip: number | null;
  onSelect: (hip: number) => void;
}

const STATUS_COLOR: Record<string, string> = {
  "likely dead": "#ff4f4f",
  uncertain: "#f5a623",
  alive: "#4fc3f7",
};

export default function HRDiagram({ stars, selectedHip, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hitsRef = useRef<{ hip: number; cx: number; cy: number }[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = devicePixelRatio;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const PAD = { top: 28, right: 20, bottom: 40, left: 52 };
    const plotW = w - PAD.left - PAD.right;
    const plotH = h - PAD.top - PAD.bottom;

    const BV_MIN = -0.4, BV_MAX = 2.0;
    const MV_MIN = -10, MV_MAX = 16;

    const toX = (bv: number) => PAD.left + ((bv - BV_MIN) / (BV_MAX - BV_MIN)) * plotW;
    const toY = (mv: number) => PAD.top + ((mv - MV_MIN) / (MV_MAX - MV_MIN)) * plotH;

    // Background
    ctx.fillStyle = "#080810";
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 0.5;
    for (let mv = -10; mv <= 16; mv += 2) {
      ctx.beginPath(); ctx.moveTo(PAD.left, toY(mv)); ctx.lineTo(PAD.left + plotW, toY(mv)); ctx.stroke();
    }
    for (let bv = -0.4; bv <= 2.01; bv += 0.4) {
      ctx.beginPath(); ctx.moveTo(toX(bv), PAD.top); ctx.lineTo(toX(bv), PAD.top + plotH); ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD.left, PAD.top);
    ctx.lineTo(PAD.left, PAD.top + plotH);
    ctx.lineTo(PAD.left + plotW, PAD.top + plotH);
    ctx.stroke();

    // Y-axis ticks & labels
    ctx.font = "9px 'Satoshi', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.textAlign = "right";
    for (let mv = -10; mv <= 16; mv += 5) {
      const y = toY(mv);
      ctx.beginPath();
      ctx.moveTo(PAD.left - 3, y); ctx.lineTo(PAD.left, y);
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.stroke();
      ctx.fillText(String(mv), PAD.left - 6, y + 3);
    }

    // X-axis spectral class labels
    ctx.textAlign = "center";
    const spectralLabels = [
      { label: "O", bv: -0.3, color: "#9bb0ff" },
      { label: "B", bv: -0.05, color: "#aabfff" },
      { label: "A", bv: 0.15, color: "#cad7ff" },
      { label: "F", bv: 0.38, color: "#f8f7ff" },
      { label: "G", bv: 0.65, color: "#fff4ea" },
      { label: "K", bv: 0.95, color: "#ffd2a1" },
      { label: "M", bv: 1.45, color: "#ffaa6b" },
    ];
    spectralLabels.forEach(({ label, bv, color }) => {
      ctx.fillStyle = color + "99";
      ctx.fillText(label, toX(bv), PAD.top + plotH + 16);
    });

    // Axis titles
    ctx.font = "10px 'Satoshi', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.textAlign = "center";
    ctx.fillText("B − V  (colour index)", PAD.left + plotW / 2, h - 4);
    ctx.save();
    ctx.translate(13, PAD.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Absolute magnitude M\u2085", 0, 0);
    ctx.restore();

    // Diagram title
    ctx.font = "bold 11px 'Satoshi', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.textAlign = "left";
    ctx.fillText("Hertzsprung\u2013Russell Diagram", PAD.left + 4, 16);

    // Data points
    const hits: { hip: number; cx: number; cy: number }[] = [];
    const filtered = stars.filter(s => s["B-V"] != null && s.M_V != null);

    filtered.forEach(s => {
      const bv = Number(s["B-V"]);
      const mv = Number(s.M_V);
      if (isNaN(bv) || isNaN(mv)) return;
      if (bv < BV_MIN || bv > BV_MAX || mv < MV_MIN || mv > MV_MAX) return;

      const cx = toX(bv);
      const cy = toY(mv);
      const isSelected = s.HIP === selectedHip;
      const color = STATUS_COLOR[s.status] ?? "#aaa";

      ctx.beginPath();
      ctx.arc(cx, cy, isSelected ? 5 : 1.8, 0, Math.PI * 2);

      if (isSelected) {
        ctx.shadowBlur = 16;
        ctx.shadowColor = "#ffffff";
        ctx.fillStyle = "#ffffff";
      } else {
        ctx.fillStyle = color + "bb";
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      hits.push({ hip: s.HIP, cx, cy });
    });

    hitsRef.current = hits;
  }, [stars, selectedHip]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let best: { hip: number; dist: number } | null = null;
    hitsRef.current.forEach(({ hip, cx, cy }) => {
      const d = Math.hypot(cx - mx, cy - my);
      if (!best || d < best.dist) best = { hip, dist: d };
    });
    if (best && (best as any).dist < 14) onSelect((best as any).hip);
  };

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        style={{ width: "100%", height: "100%", cursor: "crosshair", display: "block" }}
      />
      {/* Legend */}
      <div style={{
        position: "absolute", bottom: 8, right: 8,
        display: "flex", flexDirection: "column", gap: 3,
        background: "rgba(0,0,0,0.5)", borderRadius: 6,
        padding: "6px 10px", fontSize: 10,
        border: "1px solid rgba(255,255,255,0.08)",
      }}>
        {Object.entries(STATUS_COLOR).map(([s, c]) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 5, color: "rgba(255,255,255,0.6)" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: c, flexShrink: 0 }} />
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}
