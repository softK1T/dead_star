import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import * as THREE from "three";
import type { Star } from "../types/star";

/* ─── spectral colour ─────────────────────────────────────────── */
function spectralColor(spType: string): THREE.Color {
  const c = (spType || "").trim().toUpperCase()[0];
  if (c === "O") return new THREE.Color(0x9bb0ff);
  if (c === "B") return new THREE.Color(0xaabfff);
  if (c === "A") return new THREE.Color(0xcad7ff);
  if (c === "F") return new THREE.Color(0xf8f7ff);
  if (c === "G") return new THREE.Color(0xfff4e8);
  if (c === "K") return new THREE.Color(0xffd2a1);
  if (c === "M") return new THREE.Color(0xff9933);
  return new THREE.Color(0x8899bb);
}

/* ─── types ───────────────────────────────────────────────────── */
interface P {
  SpType: string; status: string;
  distance_ly: number; RAdeg: number; DEdeg: number;
  L: number; M: number; HIP: number;
  Vmag: number; M_V: number;
  light_left_year: number; t_remaining_gyr: number;
  t_life: number; t_age: number;
}

function parse(s: Star): P | null {
  const d = Number(s.distance_ly), ra = Number(s.RAdeg), dec = Number(s.DEdeg);
  if (!isFinite(d) || d <= 0 || d > 50_000) return null;
  if (!isFinite(ra) || !isFinite(dec)) return null;
  return {
    SpType: String(s.SpType || ""), status: String(s.status || ""),
    distance_ly: d, RAdeg: ra, DEdeg: dec,
    L: Number(s.L) || 1, M: Number(s.M) || 1, HIP: Number(s.HIP) || 0,
    Vmag: Number(s.Vmag) ?? 0, M_V: Number(s.M_V) ?? 0,
    light_left_year: Number(s.light_left_year) || 0,
    t_remaining_gyr: Number(s.t_remaining_gyr) || 0,
    t_life: Number(s.t_life) || 0, t_age: Number(s.t_age) || 0,
  };
}

function xyz(d: number, ra: number, dec: number) {
  const r = (ra * Math.PI) / 180, de = (dec * Math.PI) / 180;
  return new THREE.Vector3(
    d * Math.cos(de) * Math.cos(r),
    d * Math.sin(de),
    -d * Math.cos(de) * Math.sin(r),
  );
}

/* ─── shaders ─────────────────────────────────────────────────── */
const VERT = /* glsl */`
  attribute float aSize;
  attribute vec3  aColor;
  attribute float aHighlight;
  varying   vec3  vColor;
  varying   float vHL;
  void main() {
    vColor = aColor;
    vHL    = aHighlight;
    gl_PointSize = aSize * (1.0 + aHighlight * 1.5);
    gl_Position  = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const FRAG = /* glsl */`
  varying vec3  vColor;
  varying float vHL;
  void main() {
    vec2  uv   = gl_PointCoord - 0.5;
    float d    = length(uv) * 2.0;
    if (d > 1.0) discard;
    float core = exp(-d * d * 5.0);
    float halo = exp(-d * d * 1.2) * 0.45;
    float a    = clamp(core + halo, 0.0, 1.0);
    vec3  col  = vColor + vec3(core * 0.5) + vec3(vHL * 0.5);
    gl_FragColor = vec4(col, a);
  }
`;

/* ─── status palette ──────────────────────────────────────────── */
const STATUS: Record<string, { color: string; glow: string; label: string }> = {
  "likely dead":  { color: "#f04a4a", glow: "rgba(240,74,74,0.35)",   label: "☠ Likely dead" },
  "uncertain":    { color: "#f0b84a", glow: "rgba(240,184,74,0.30)",  label: "? Uncertain" },
  "alive":        { color: "#4af07a", glow: "rgba(74,240,122,0.30)",  label: "✦ Alive" },
};
const statusMeta = (s: string) => STATUS[s] ?? { color: "#8899bb", glow: "rgba(136,153,187,0.25)", label: s };

/* ─── tooltip ─────────────────────────────────────────────────── */
interface Tooltip { x: number; y: number; star: P; visible: boolean }

function StarTooltip({ tip, containerW, containerH }: { tip: Tooltip; containerW: number; containerH: number }) {
  const sm = statusMeta(tip.star.status);
  const PAD = 16, W = 230, H_EST = 260;
  let left = tip.x + PAD;
  let top  = tip.y - 20;
  if (left + W > containerW - 8) left = tip.x - W - PAD;
  if (top + H_EST > containerH - 8) top = containerH - H_EST - 8;
  if (top < 8) top = 8;

  const fmt = (n: number, dec = 2) => isFinite(n) ? n.toFixed(dec) : "—";
  const fmtGyr = (g: number) => {
    if (!isFinite(g)) return "—";
    if (Math.abs(g) < 0.001) return "< 1 Myr";
    if (Math.abs(g) < 1) return (g * 1000).toFixed(0) + " Myr";
    return g.toFixed(2) + " Gyr";
  };

  const rows: [string, string][] = [
    ["HIP",         String(tip.star.HIP || "—")],
    ["SpType",      tip.star.SpType || "—"],
    ["Distance",    fmt(tip.star.distance_ly, 0) + " ly"],
    ["Visual mag",  fmt(tip.star.Vmag, 2)],
    ["Abs mag",     fmt(tip.star.M_V, 2)],
    ["Luminosity",  fmt(tip.star.L, 3) + " L☉"],
    ["Mass",        fmt(tip.star.M, 2) + " M☉"],
    ["Age",         fmtGyr(tip.star.t_age)],
    ["Lifespan",    fmtGyr(tip.star.t_life)],
    ["t remaining", fmtGyr(tip.star.t_remaining_gyr)],
    ["Light left",  tip.star.light_left_year > 0 ? fmt(tip.star.light_left_year, 0) + " ly" : "—"],
  ];

  return (
    <div style={{
      position: "absolute",
      left, top,
      width: W,
      background: "rgba(6,7,20,0.96)",
      border: `1px solid ${sm.color}55`,
      borderRadius: 10,
      padding: "12px 14px",
      fontSize: 12,
      color: "#c8cfe8",
      lineHeight: 1.65,
      pointerEvents: "none",
      zIndex: 50,
      backdropFilter: "blur(14px)",
      boxShadow: `0 0 28px ${sm.glow}, 0 4px 32px rgba(0,0,0,0.6)`,
      transition: "opacity 0.15s ease",
      opacity: tip.visible ? 1 : 0,
    }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid rgba(255,255,255,0.07)` }}>
        {/* star glyph */}
        <div style={{
          width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
          background: `radial-gradient(circle at 40% 35%, white 0%, ${sm.color} 45%, transparent 100%)`,
          boxShadow: `0 0 10px ${sm.color}88`,
        }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#e8ecf8", letterSpacing: "0.03em" }}>
            {tip.star.SpType || "?"}-type star
          </div>
          <div style={{ fontSize: 11, color: sm.color, fontWeight: 600, marginTop: 1 }}>
            {sm.label}
          </div>
        </div>
      </div>

      {/* data rows */}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", rowGap: 2, columnGap: 12 }}>
        {rows.map(([k, v]) => (
          <> 
            <span key={k + "_k"} style={{ color: "#5a6282", fontVariantNumeric: "tabular-nums" }}>{k}</span>
            <span key={k + "_v"} style={{
              color: k === "t remaining" && tip.star.t_remaining_gyr < 0 ? "#f04a4a" :
                     k === "t remaining" && tip.star.t_remaining_gyr < 0.5 ? "#f0b84a" : "#c8cfe8",
              fontVariantNumeric: "tabular-nums",
            }}>{v}</span>
          </>
        ))}
      </div>

      {/* footer hint */}
      <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.07)", fontSize: 10, color: "#3d4460" }}>
        Click to select · HIP {tip.star.HIP}
      </div>
    </div>
  );
}

/* ─── main component ──────────────────────────────────────────── */
export default function SkyMap({ stars }: { stars: Star[] }) {
  const mountRef   = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const hlRef      = useRef<THREE.BufferAttribute | null>(null);
  const parsedRef  = useRef<P[]>([]);
  const sizeRef    = useRef({ w: 800, h: 600 });
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  const parsed = useMemo(() => {
    if (!stars?.length) return [];
    return stars.map(parse).filter((s): s is P => s !== null);
  }, [stars]);

  /* throttle mousemove to avoid raycaster bottleneck */
  const lastMoveRef = useRef(0);
  const handleMouseMove = useCallback((e: MouseEvent, renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, geo: THREE.BufferGeometry, el: HTMLDivElement) => {
    const now = Date.now();
    if (now - lastMoveRef.current < 30) return; // ~33fps cap
    lastMoveRef.current = now;

    const rect = el.getBoundingClientRect();
    const mx   = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    const my   = -((e.clientY - rect.top)  / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(mx, my), camera);
    // scale threshold with camera distance
    const camDist = camera.position.length();
    raycaster.params.Points!.threshold = Math.max(20, camDist * 0.04);

    const pts = new THREE.Points(geo);
    const hits = raycaster.intersectObject(pts);
    const hlAttr = hlRef.current;
    if (!hlAttr) return;

    for (let i = 0; i < hlAttr.count; i++) hlAttr.setX(i, 0);

    if (hits.length > 0) {
      const idx = hits[0].index!;
      hlAttr.setX(idx, 1);
      hlAttr.needsUpdate = true;
      const star = parsedRef.current[idx];
      if (star) {
        setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, star, visible: true });
      }
    } else {
      hlAttr.needsUpdate = true;
      setTooltip(null);
    }
  }, []);

  useEffect(() => { parsedRef.current = parsed; }, [parsed]);

  useEffect(() => {
    const el = mountRef.current;
    if (!el || parsed.length === 0) return;
    cleanupRef.current?.();
    cleanupRef.current = null;

    const W = el.clientWidth || 800, H = el.clientHeight || 600;
    sizeRef.current = { w: W, h: H };

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x04050f, 1);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const positions = parsed.map(s => xyz(s.distance_ly, s.RAdeg, s.DEdeg));
    const box = new THREE.Box3();
    positions.forEach(p => box.expandByPoint(p));
    const center = new THREE.Vector3(), bsz = new THREE.Vector3();
    box.getCenter(center); box.getSize(bsz);
    const radius = Math.max(bsz.length() * 0.55, 10);

    const camera = new THREE.PerspectiveCamera(70, W / H, 1, radius * 15);
    camera.position.set(center.x, center.y, center.z + radius * 1.4);
    camera.lookAt(center);

    // background stars
    const bgPos = new Float32Array(10_000 * 3);
    for (let i = 0; i < 10_000; i++) {
      bgPos[i*3]   = center.x + (Math.random() - 0.5) * radius * 5;
      bgPos[i*3+1] = center.y + (Math.random() - 0.5) * radius * 5;
      bgPos[i*3+2] = center.z + (Math.random() - 0.5) * radius * 5;
    }
    const bgGeo = new THREE.BufferGeometry();
    bgGeo.setAttribute("position", new THREE.BufferAttribute(bgPos, 3));
    scene.add(new THREE.Points(bgGeo, new THREE.PointsMaterial({ color: 0x1a2a44, size: 1.0, sizeAttenuation: false })));

    // data stars
    const n   = parsed.length;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const siz = new Float32Array(n);
    const hl  = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      const s = parsed[i], v = positions[i];
      pos[i*3] = v.x; pos[i*3+1] = v.y; pos[i*3+2] = v.z;
      const c = spectralColor(s.SpType);
      col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
      const lum  = s.L > 0 ? Math.log10(s.L + 1) : 0.5;
      const base = Math.max(3, Math.min(18, 3 + lum * 4.5));
      siz[i]   = s.status === "likely dead" ? base * 1.8 : base;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position",   new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aColor",     new THREE.BufferAttribute(col, 3));
    geo.setAttribute("aSize",      new THREE.BufferAttribute(siz, 1));
    const hlAttr = new THREE.BufferAttribute(hl, 1);
    hlAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("aHighlight", hlAttr);
    hlRef.current = hlAttr;

    scene.add(new THREE.Points(geo, new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    })));

    // Sun sprite
    const sc = document.createElement("canvas"); sc.width = sc.height = 128;
    const ctx = sc.getContext("2d")!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,240,150,1)"); g.addColorStop(0.3, "rgba(253,180,50,0.7)"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    const sunSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(sc), blending: THREE.AdditiveBlending, transparent: true }));
    sunSp.scale.setScalar(radius * 0.05);
    scene.add(sunSp);

    // controls
    const keys: Record<string, boolean> = {};
    const euler = new THREE.Euler(0, 0, 0, "YXZ");
    let locked  = false;
    euler.setFromQuaternion(camera.quaternion);

    const onKD = (e: KeyboardEvent) => { keys[e.code] = true; };
    const onKU = (e: KeyboardEvent) => { keys[e.code] = false; };
    window.addEventListener("keydown", onKD);
    window.addEventListener("keyup",   onKU);
    renderer.domElement.addEventListener("click", () => renderer.domElement.requestPointerLock());
    const onLC = () => {
      locked = document.pointerLockElement === renderer.domElement;
      if (locked) setTooltip(null);
    };
    const onMM = (e: MouseEvent) => {
      if (locked) {
        euler.y -= e.movementX * 0.002;
        euler.x  = Math.max(-1.5, Math.min(1.5, euler.x - e.movementY * 0.002));
        camera.quaternion.setFromEuler(euler);
      } else {
        handleMouseMove(e, renderer, camera, geo, el);
      }
    };
    document.addEventListener("pointerlockchange", onLC);
    document.addEventListener("mousemove", onMM);

    let speed = radius * 0.3;
    el.addEventListener("wheel", (e: WheelEvent) => {
      speed = Math.max(1, Math.min(radius * 8, speed * (e.deltaY > 0 ? 0.85 : 1.18)));
    }, { passive: true });

    const obs = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight;
      sizeRef.current = { w, h };
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
    });
    obs.observe(el);

    const clock = new THREE.Clock();
    const fwd = new THREE.Vector3(), right = new THREE.Vector3();
    let animId = 0;
    const tick = () => {
      animId = requestAnimationFrame(tick);
      const spd = speed * Math.min(clock.getDelta(), 0.05);
      camera.getWorldDirection(fwd);
      right.crossVectors(fwd, camera.up).normalize();
      if (keys["KeyW"] || keys["ArrowUp"])    camera.position.addScaledVector(fwd,    spd);
      if (keys["KeyS"] || keys["ArrowDown"])  camera.position.addScaledVector(fwd,   -spd);
      if (keys["KeyD"] || keys["ArrowRight"]) camera.position.addScaledVector(right,  spd);
      if (keys["KeyA"] || keys["ArrowLeft"])  camera.position.addScaledVector(right, -spd);
      if (keys["KeyE"] || keys["Space"])      camera.position.y += spd;
      if (keys["KeyQ"] || keys["ShiftLeft"])  camera.position.y -= spd;
      renderer.render(scene, camera);
    };
    tick();

    cleanupRef.current = () => {
      cancelAnimationFrame(animId); obs.disconnect();
      window.removeEventListener("keydown", onKD);
      window.removeEventListener("keyup",   onKU);
      document.removeEventListener("pointerlockchange", onLC);
      document.removeEventListener("mousemove", onMM);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, [parsed, handleMouseMove]);

  useEffect(() => () => { cleanupRef.current?.(); }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%", cursor: tooltip ? "crosshair" : "default" }} />

      {tooltip && (
        <StarTooltip
          tip={tooltip}
          containerW={sizeRef.current.w}
          containerH={sizeRef.current.h}
        />
      )}

      {/* Legend */}
      <div style={{ ...panel, top: 14, left: 14 }}>
        {(["likely dead", "uncertain", "alive"] as const).map(s => {
          const m = statusMeta(s);
          return (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 7, lineHeight: 2 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: m.color, boxShadow: `0 0 5px ${m.color}`, flexShrink: 0, display: "inline-block" }} />
              <span style={{ color: "#7a82a6" }}>{s}</span>
            </div>
          );
        })}
        <div style={{ display: "flex", alignItems: "center", gap: 7, lineHeight: 2 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fde98a", boxShadow: "0 0 5px #fde98a", flexShrink: 0, display: "inline-block" }} />
          <span style={{ color: "#7a82a6" }}>Sun</span>
        </div>
      </div>

      {/* Navigation hint */}
      <div style={{ ...panel, bottom: 14, left: 14 }}>
        <div style={{ color: "#7a82a6", fontWeight: 600, marginBottom: 3 }}>NAVIGATION</div>
        <div>Click → capture mouse</div>
        <div>W / S — forward / back</div>
        <div>A / D — strafe</div>
        <div>E / Q — up / down</div>
        <div>Scroll — speed</div>
        <div>Esc — release</div>
      </div>
    </div>
  );
}

const panel: React.CSSProperties = {
  position: "absolute",
  background: "rgba(4,5,15,0.82)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 8, padding: "8px 14px",
  fontSize: 11, color: "#3d4460", lineHeight: 1.9,
  backdropFilter: "blur(6px)",
  userSelect: "none", pointerEvents: "none",
};
