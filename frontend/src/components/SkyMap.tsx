import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import * as THREE from "three";
import type { Star } from "../types/star";

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

interface P {
  SpType: string; status: string;
  distance_ly: number; RAdeg: number; DEdeg: number;
  L: number; HIP: number; t_remaining_gyr: number;
}

function parse(s: Star): P | null {
  const d = Number(s.distance_ly), ra = Number(s.RAdeg), dec = Number(s.DEdeg);
  if (!isFinite(d) || d <= 0 || d > 50_000) return null;
  if (!isFinite(ra) || !isFinite(dec)) return null;
  return {
    SpType: String(s.SpType || ""), status: String(s.status || ""),
    distance_ly: d, RAdeg: ra, DEdeg: dec,
    L: Number(s.L) || 1, HIP: Number(s.HIP) || 0,
    t_remaining_gyr: Number(s.t_remaining_gyr) || 0,
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

const VERT = /* glsl */`
  attribute float aSize;
  attribute vec3  aColor;
  attribute float aHighlight;
  varying   vec3  vColor;
  varying   float vHL;
  varying   float vAlpha;
  void main() {
    vColor = aColor;
    vHL    = aHighlight;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    float dist = -mvPos.z;
    float att  = aSize * 300.0 / max(dist, 1.0);
    gl_PointSize = clamp(att, 1.0, 28.0) * (1.0 + aHighlight * 1.4);
    vAlpha = clamp(att / 2.0, 0.15, 1.0);
    gl_Position = projectionMatrix * mvPos;
  }
`;
const FRAG = /* glsl */`
  varying vec3  vColor;
  varying float vHL;
  varying float vAlpha;
  void main() {
    vec2  uv   = gl_PointCoord - 0.5;
    float d    = length(uv) * 2.0;
    if (d > 1.0) discard;
    float core = exp(-d * d * 8.0);
    float halo = exp(-d * d * 2.2) * 0.28;
    float a    = (core + halo) * vAlpha;
    vec3  col  = mix(vColor, vec3(1.0), core * 0.35);
    col += vec3(vHL * 0.45) * core;
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  }
`;

const STATUS_COLOR: Record<string, string> = {
  "likely dead": "#f04a4a",
  "uncertain":   "#f0b84a",
  "alive":       "#4af07a",
};

interface Tip { x: number; y: number; star: P; }

function Tooltip({ tip, cw, ch }: { tip: Tip; cw: number; ch: number }) {
  const color = STATUS_COLOR[tip.star.status] ?? "#8899bb";
  const W = 180, H = 90, PAD = 14;
  let left = tip.x + PAD;
  let top  = tip.y - H / 2;
  if (left + W > cw - 6) left = tip.x - W - PAD;
  if (top < 6) top = 6;
  if (top + H > ch - 6) top = ch - H - 6;
  const trem = tip.star.t_remaining_gyr;
  const tremStr = !isFinite(trem) ? "—"
    : Math.abs(trem) < 0.001 ? "< 1 Myr"
    : Math.abs(trem) < 1 ? (trem * 1000).toFixed(0) + " Myr"
    : trem.toFixed(1) + " Gyr";
  const tremColor = trem < 0 ? "#f04a4a" : trem < 0.5 ? "#f0b84a" : "#c8cfe8";
  return (
    <div style={{
      position: "absolute", left, top, width: W,
      background: "rgba(5,6,18,0.92)",
      border: `1px solid ${color}44`,
      borderRadius: 8, padding: "10px 12px",
      pointerEvents: "none", zIndex: 50,
      backdropFilter: "blur(12px)",
      boxShadow: `0 0 20px ${color}22, 0 4px 24px rgba(0,0,0,0.5)`,
      fontFamily: "inherit",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0, display: "inline-block" }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e6f5", letterSpacing: "0.02em" }}>HIP {tip.star.HIP}</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color, fontWeight: 500 }}>{tip.star.SpType || "—"}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 4px", textAlign: "center" }}>
        {([
          ["dist", tip.star.distance_ly.toFixed(0) + " ly", "#c8cfe8"],
          ["lum",  tip.star.L.toFixed(1) + " L☉", "#c8cfe8"],
          ["left", tremStr, tremColor],
        ] as [string, string, string][]).map(([k, v, vc]) => (
          <div key={k}>
            <div style={{ fontSize: 9, color: "#3d4460", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>{k}</div>
            <div style={{ fontSize: 12, color: vc, fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SkyMap({ stars }: { stars: Star[] }) {
  const mountRef    = useRef<HTMLDivElement>(null);
  const cleanupRef  = useRef<(() => void) | null>(null);
  const hlRef       = useRef<THREE.BufferAttribute | null>(null);
  const parsedRef   = useRef<P[]>([]);
  const sizeRef     = useRef({ w: 800, h: 600 });
  const [tooltip, setTooltip] = useState<Tip | null>(null);
  const lastMoveRef = useRef(0);

  const parsed = useMemo(() => {
    if (!stars?.length) return [];
    return stars.map(parse).filter((s): s is P => s !== null);
  }, [stars]);

  const handleMouseMove = useCallback((
    e: MouseEvent,
    renderer: THREE.WebGLRenderer,
    camera: THREE.PerspectiveCamera,
    geo: THREE.BufferGeometry,
    el: HTMLDivElement,
  ) => {
    const now = Date.now();
    if (now - lastMoveRef.current < 30) return;
    lastMoveRef.current = now;
    const rect = el.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    const my = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(mx, my), camera);
    raycaster.params.Points!.threshold = Math.max(20, camera.position.length() * 0.04);
    const hits = raycaster.intersectObject(new THREE.Points(geo));
    const hlAttr = hlRef.current;
    if (!hlAttr) return;
    for (let i = 0; i < hlAttr.count; i++) hlAttr.setX(i, 0);
    if (hits.length > 0) {
      const idx = hits[0].index!;
      hlAttr.setX(idx, 1);
      const star = parsedRef.current[idx];
      if (star) setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, star });
    } else {
      setTooltip(null);
    }
    hlAttr.needsUpdate = true;
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

    // background dust
    const bgPos = new Float32Array(8_000 * 3);
    for (let i = 0; i < 8_000; i++) {
      bgPos[i*3]   = center.x + (Math.random() - 0.5) * radius * 6;
      bgPos[i*3+1] = center.y + (Math.random() - 0.5) * radius * 6;
      bgPos[i*3+2] = center.z + (Math.random() - 0.5) * radius * 6;
    }
    const bgGeo = new THREE.BufferGeometry();
    bgGeo.setAttribute("position", new THREE.BufferAttribute(bgPos, 3));
    scene.add(new THREE.Points(bgGeo, new THREE.PointsMaterial({
      color: 0x263556, size: 0.8, sizeAttenuation: false, transparent: true, opacity: 0.6,
    })));

    // ---- build one Points object: data stars + Sun as last entry ----
    const n = parsed.length;
    // +1 slot for the Sun at origin
    const pos = new Float32Array((n + 1) * 3);
    const col = new Float32Array((n + 1) * 3);
    const siz = new Float32Array(n + 1);
    const hl  = new Float32Array(n + 1);

    for (let i = 0; i < n; i++) {
      const s = parsed[i], v = positions[i];
      pos[i*3] = v.x; pos[i*3+1] = v.y; pos[i*3+2] = v.z;
      const c = spectralColor(s.SpType);
      col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
      const lum  = s.L > 0 ? Math.log10(s.L + 1) : 0;
      const base = 0.8 + lum * 1.6;
      siz[i] = s.status === "likely dead" ? base * 1.5 : base;
    }

    // Sun entry — same shader, reasonable size
    const si = n;
    pos[si*3] = 0; pos[si*3+1] = 0; pos[si*3+2] = 0;   // origin
    col[si*3] = 1.0; col[si*3+1] = 0.95; col[si*3+2] = 0.6; // warm yellow
    siz[si] = 2.5;  // same world-unit scale as other G-type stars

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

    // controls
    const keys: Record<string, boolean> = {};
    const euler = new THREE.Euler(0, 0, 0, "YXZ");
    let locked = false;
    euler.setFromQuaternion(camera.quaternion);
    const onKD = (e: KeyboardEvent) => { keys[e.code] = true; };
    const onKU = (e: KeyboardEvent) => { keys[e.code] = false; };
    window.addEventListener("keydown", onKD);
    window.addEventListener("keyup",   onKU);
    renderer.domElement.addEventListener("click", () => renderer.domElement.requestPointerLock());
    const onLC = () => { locked = document.pointerLockElement === renderer.domElement; if (locked) setTooltip(null); };
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
    el.addEventListener("wheel", (ev: WheelEvent) => {
      speed = Math.max(1, Math.min(radius * 8, speed * (ev.deltaY > 0 ? 0.85 : 1.18)));
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

      {tooltip && <Tooltip tip={tooltip} cw={sizeRef.current.w} ch={sizeRef.current.h} />}

      <div style={{ ...panel, top: 14, left: 14 }}>
        {(["likely dead", "uncertain", "alive"] as const).map(s => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 6, lineHeight: 2 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_COLOR[s], boxShadow: `0 0 4px ${STATUS_COLOR[s]}`, display: "inline-block", flexShrink: 0 }} />
            <span style={{ color: "#6a7296" }}>{s}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 6, lineHeight: 2 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fde98a", boxShadow: "0 0 4px #fde98a", display: "inline-block", flexShrink: 0 }} />
          <span style={{ color: "#6a7296" }}>Sun</span>
        </div>
      </div>

      <div style={{ ...panel, bottom: 14, left: 14 }}>
        <div style={{ color: "#6a7296", fontWeight: 600, marginBottom: 2 }}>NAVIGATION</div>
        {([["W/S","forward/back"],["A/D","strafe"],["E/Q","up/down"],["Scroll","speed"],["Click","capture"],["Esc","release"]] as [string,string][]).map(([k,v]) => (
          <div key={k} style={{ display: "flex", gap: 6 }}>
            <span style={{ color: "#4a5278", minWidth: 36, fontWeight: 600 }}>{k}</span>
            <span style={{ color: "#3d4460" }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const panel: React.CSSProperties = {
  position: "absolute",
  background: "rgba(4,5,15,0.80)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 8, padding: "8px 12px",
  fontSize: 11, lineHeight: 1.9,
  backdropFilter: "blur(6px)",
  userSelect: "none", pointerEvents: "none",
};
