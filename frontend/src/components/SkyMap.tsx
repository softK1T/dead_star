import { useEffect, useRef, useMemo, useState } from "react";
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

function toXYZ(d: number, ra: number, dec: number) {
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
  uniform   float uRefDist;
  varying   vec3  vColor;
  varying   float vHL;
  varying   float vBrightness;
  void main() {
    vColor = aColor; vHL = aHighlight;
    vec4  mv   = modelViewMatrix * vec4(position, 1.0);
    float dist = max(-mv.z, 0.1);
    float px   = aSize * clamp(uRefDist / dist, 0.3, 5.0);
    gl_PointSize  = clamp(px, 1.5, 24.0) * (1.0 + aHighlight * 1.8);
    vBrightness   = clamp(px / 3.5, 0.25, 1.0);
    gl_Position   = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */`
  varying vec3  vColor;
  varying float vHL;
  varying float vBrightness;
  void main() {
    vec2  uv = gl_PointCoord - 0.5;
    float d  = length(uv) * 2.0;
    if (d > 1.0) discard;
    float core = exp(-d * d * 9.0);
    float glow = exp(-d * d * 2.5) * 0.30;
    float a    = (core + glow) * vBrightness;
    vec3 col   = mix(vColor, vec3(1.0), core * 0.38) + vec3(vHL * 0.5) * core;
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
  let left = tip.x + PAD, top = tip.y - H / 2;
  if (left + W > cw - 6) left = tip.x - W - PAD;
  if (top < 6) top = 6;
  if (top + H > ch - 6) top = ch - H - 6;
  const trem = tip.star.t_remaining_gyr;
  const tremStr = !isFinite(trem) ? "\u2014"
    : Math.abs(trem) < 0.001 ? "< 1 Myr"
    : Math.abs(trem) < 1 ? (trem * 1000).toFixed(0) + " Myr"
    : trem.toFixed(1) + " Gyr";
  const tremColor = trem < 0 ? "#f04a4a" : trem < 0.5 ? "#f0b84a" : "#c8cfe8";
  return (
    <div style={{
      position: "absolute", left, top, width: W,
      background: "rgba(5,6,18,0.92)", border: `1px solid ${color}44`,
      borderRadius: 8, padding: "10px 12px", pointerEvents: "none", zIndex: 50,
      backdropFilter: "blur(12px)",
      boxShadow: `0 0 20px ${color}22, 0 4px 24px rgba(0,0,0,0.5)`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0, display: "inline-block" }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e6f5" }}>HIP\u00a0{tip.star.HIP}</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color, fontWeight: 500 }}>{tip.star.SpType || "\u2014"}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 4px", textAlign: "center" }}>
        {([
          ["dist", tip.star.distance_ly.toFixed(0) + "\u00a0ly", "#c8cfe8"],
          ["lum",  tip.star.L.toFixed(1) + "\u00a0L\u2609", "#c8cfe8"],
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
  const mountRef   = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const hlRef      = useRef<THREE.BufferAttribute | null>(null);
  const parsedRef  = useRef<P[]>([]);
  const sizeRef    = useRef({ w: 800, h: 600 });
  const [tooltip, setTooltip]   = useState<Tip | null>(null);
  const [locked,  setLocked]    = useState(false);
  const lastMoveRef = useRef(0);

  const parsed = useMemo(() => {
    if (!stars?.length) return [];
    return stars.map(parse).filter((s): s is P => s !== null);
  }, [stars]);

  useEffect(() => { parsedRef.current = parsed; }, [parsed]);

  useEffect(() => {
    const el = mountRef.current;
    if (!el || parsed.length === 0) return;
    cleanupRef.current?.();

    const W = el.clientWidth || 800, H = el.clientHeight || 600;
    sizeRef.current = { w: W, h: H };

    // ── Renderer ──────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x03040e, 1);
    // tabIndex so the canvas can receive keyboard focus
    renderer.domElement.tabIndex = 0;
    renderer.domElement.style.outline = "none";
    el.appendChild(renderer.domElement);

    // ── Scene & Camera ────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    const maxDist = parsed.reduce((m, s) => Math.max(m, s.distance_ly), 0);
    const FAR = Math.max(maxDist * 2.5, 200_000);

    const camera = new THREE.PerspectiveCamera(60, W / H, 0.5, FAR);
    camera.position.set(0, 0, 0);
    const gcRA = (266 * Math.PI) / 180, gcDec = (-29 * Math.PI) / 180;
    camera.lookAt(
      Math.cos(gcDec) * Math.cos(gcRA) * 1000,
      Math.sin(gcDec) * 1000,
      -Math.cos(gcDec) * Math.sin(gcRA) * 1000,
    );

    // ── Background dust ───────────────────────────────────────────────────
    const bgPos = new Float32Array(12_000 * 3);
    for (let i = 0; i < 12_000; i++) {
      const d = Math.random() * FAR * 0.6;
      const ra = Math.random() * Math.PI * 2;
      const dec = (Math.random() - 0.5) * Math.PI;
      bgPos[i*3]   = d * Math.cos(dec) * Math.cos(ra);
      bgPos[i*3+1] = d * Math.sin(dec);
      bgPos[i*3+2] = -d * Math.cos(dec) * Math.sin(ra);
    }
    const bgGeo = new THREE.BufferGeometry();
    bgGeo.setAttribute("position", new THREE.BufferAttribute(bgPos, 3));
    scene.add(new THREE.Points(bgGeo, new THREE.PointsMaterial({
      color: 0x1a2840, size: 0.7, sizeAttenuation: false, transparent: true, opacity: 0.45,
    })));

    // ── Star geometry ─────────────────────────────────────────────────────
    const n   = parsed.length;
    const pos = new Float32Array((n + 1) * 3);
    const col = new Float32Array((n + 1) * 3);
    const siz = new Float32Array(n + 1);
    const hl  = new Float32Array(n + 1);

    for (let i = 0; i < n; i++) {
      const s = parsed[i];
      const v = toXYZ(s.distance_ly, s.RAdeg, s.DEdeg);
      pos[i*3] = v.x; pos[i*3+1] = v.y; pos[i*3+2] = v.z;
      const c = spectralColor(s.SpType);
      col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
      const lum = s.L > 0 ? Math.log10(s.L + 1) : 0;
      siz[i] = Math.min(2 + lum * 3.2 * (s.status === "likely dead" ? 1.35 : 1), 12);
    }
    // Sun
    pos[n*3] = 0; pos[n*3+1] = 0; pos[n*3+2] = 0;
    col[n*3] = 1; col[n*3+1] = 0.94; col[n*3+2] = 0.55;
    siz[n] = 5;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position",   new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aColor",     new THREE.BufferAttribute(col, 3));
    geo.setAttribute("aSize",      new THREE.BufferAttribute(siz, 1));
    const hlAttr = new THREE.BufferAttribute(hl, 1);
    hlAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("aHighlight", hlAttr);
    hlRef.current = hlAttr;

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uRefDist: { value: 500 } },
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    // ── Raycaster ─────────────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    let prevHl = -1;

    const onMouseMove = (e: MouseEvent) => {
      // ---- Flight mode: rotate camera ----
      if (document.pointerLockElement === renderer.domElement) {
        // Читаем euler из текущего quaternion — не накапливаем рассинхрон
        const euler = new THREE.Euler(0, 0, 0, "YXZ");
        euler.setFromQuaternion(camera.quaternion);
        euler.y -= e.movementX * 0.002;
        euler.x  = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, euler.x - e.movementY * 0.002));
        camera.quaternion.setFromEuler(euler);
        return;
      }

      // ---- Normal mode: tooltip ----
      const now = Date.now();
      if (now - lastMoveRef.current < 30) return;
      lastMoveRef.current = now;

      const rect = el.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      const my = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      raycaster.setFromCamera(new THREE.Vector2(mx, my), camera);

      // World-space threshold ≈ 12px at reference distance 200ly
      const pxWorld = Math.tan(30 * Math.PI / 180) * 2 / sizeRef.current.h;
      raycaster.params.Points!.threshold = 12 * pxWorld * 200;

      const hits = raycaster.intersectObject(points);
      const attr = hlRef.current;
      if (!attr) return;

      if (prevHl >= 0) { attr.setX(prevHl, 0); prevHl = -1; }

      if (hits.length > 0) {
        // Screen-space nearest
        let bestIdx = -1, bestD2 = Infinity;
        const proj = new THREE.Vector3();
        for (const h of hits) {
          const hi = h.index!;
          proj.set(pos[hi*3], pos[hi*3+1], pos[hi*3+2]).project(camera);
          const sx = (proj.x + 1) / 2 * sizeRef.current.w;
          const sy = (1 - proj.y) / 2 * sizeRef.current.h;
          const dx = sx - (e.clientX - rect.left);
          const dy = sy - (e.clientY - rect.top);
          const d2 = dx*dx + dy*dy;
          if (d2 < bestD2) { bestD2 = d2; bestIdx = hi; }
        }
        if (bestIdx >= 0 && Math.sqrt(bestD2) <= 14) {
          attr.setX(bestIdx, 1); prevHl = bestIdx;
          const star = parsedRef.current[bestIdx];
          if (star) setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, star });
        } else { setTooltip(null); }
      } else { setTooltip(null); }
      attr.needsUpdate = true;
    };

    document.addEventListener("mousemove", onMouseMove);

    // ── Keyboard ──────────────────────────────────────────────────────────
    // Listen on window so keys work even if canvas not focused
    const keys: Record<string, boolean> = {};
    const onKD = (e: KeyboardEvent) => {
      // Prevent arrow keys from scrolling the page when navigating
      if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(e.code)) e.preventDefault();
      keys[e.code] = true;
    };
    const onKU = (e: KeyboardEvent) => { keys[e.code] = false; };
    window.addEventListener("keydown", onKD);
    window.addEventListener("keyup",   onKU);

    // ── Pointer Lock ──────────────────────────────────────────────────────
    const onPLC = () => {
      const isLocked = document.pointerLockElement === renderer.domElement;
      setLocked(isLocked);
      if (isLocked) { setTooltip(null); renderer.domElement.focus(); }
    };
    document.addEventListener("pointerlockchange", onPLC);
    renderer.domElement.addEventListener("click", () => {
      renderer.domElement.requestPointerLock();
    });

    // ── Scroll speed ──────────────────────────────────────────────────────
    let speed = 50;
    const onWheel = (e: WheelEvent) => {
      speed = Math.max(0.5, Math.min(50_000, speed * (e.deltaY > 0 ? 0.82 : 1.22)));
    };
    el.addEventListener("wheel", onWheel, { passive: true });

    // ── Resize ────────────────────────────────────────────────────────────
    const obs = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight;
      sizeRef.current = { w, h };
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    obs.observe(el);

    // ── Game loop ─────────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    const fwd   = new THREE.Vector3();
    const right = new THREE.Vector3();
    let animId = 0;

    const tick = () => {
      animId = requestAnimationFrame(tick);
      const dt  = Math.min(clock.getDelta(), 0.05);
      const spd = speed * dt;
      camera.getWorldDirection(fwd);
      right.crossVectors(fwd, camera.up).normalize();

      if (keys["KeyW"] || keys["ArrowUp"])    camera.position.addScaledVector(fwd,   spd);
      if (keys["KeyS"] || keys["ArrowDown"])  camera.position.addScaledVector(fwd,  -spd);
      if (keys["KeyA"] || keys["ArrowLeft"])  camera.position.addScaledVector(right,-spd);
      if (keys["KeyD"] || keys["ArrowRight"]) camera.position.addScaledVector(right, spd);
      if (keys["KeyE"] || keys["Space"])      camera.position.y += spd;
      if (keys["KeyQ"] || keys["ShiftLeft"])  camera.position.y -= spd;

      renderer.render(scene, camera);
    };
    tick();

    // ── Cleanup ───────────────────────────────────────────────────────────
    cleanupRef.current = () => {
      cancelAnimationFrame(animId);
      obs.disconnect();
      window.removeEventListener("keydown", onKD);
      window.removeEventListener("keyup",   onKU);
      document.removeEventListener("pointerlockchange", onPLC);
      document.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("wheel", onWheel);
      renderer.dispose();
      geo.dispose(); mat.dispose(); bgGeo.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, [parsed]);

  useEffect(() => () => { cleanupRef.current?.(); }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%", cursor: locked ? "none" : tooltip ? "crosshair" : "default" }} />

      {tooltip && !locked && <Tooltip tip={tooltip} cw={sizeRef.current.w} ch={sizeRef.current.h} />}

      {/* Crosshair in flight mode */}
      {locked && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none", opacity: 0.6 }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#ffffff" strokeWidth="1">
            <line x1="10" y1="2" x2="10" y2="8" />
            <line x1="10" y1="12" x2="10" y2="18" />
            <line x1="2" y1="10" x2="8" y2="10" />
            <line x1="12" y1="10" x2="18" y2="10" />
          </svg>
        </div>
      )}

      {/* Legend */}
      <div style={{ ...panel, top: 14, left: 14 }}>
        {(["likely dead", "uncertain", "alive"] as const).map(s => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 6, lineHeight: 2 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_COLOR[s], boxShadow: `0 0 4px ${STATUS_COLOR[s]}`, display: "inline-block", flexShrink: 0 }} />
            <span style={{ color: "#6a7296" }}>{s}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 6, lineHeight: 2 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fde98a", boxShadow: "0 0 4px #fde98a", display: "inline-block", flexShrink: 0 }} />
          <span style={{ color: "#6a7296" }}>Sun (you)</span>
        </div>
      </div>

      {/* Controls hint — hidden while locked */}
      {!locked && (
        <div style={{ ...panel, bottom: 14, left: 14 }}>
          <div style={{ color: "#6a7296", fontWeight: 600, marginBottom: 2 }}>NAVIGATION</div>
          {([["Click","enter fly mode"],["W/S","forward/back"],["A/D","strafe"],["E/Q","up/down"],["Scroll","speed"],["Esc","exit"]] as [string,string][]).map(([k,v]) => (
            <div key={k} style={{ display: "flex", gap: 6 }}>
              <span style={{ color: "#4a5278", minWidth: 52, fontWeight: 600 }}>{k}</span>
              <span style={{ color: "#3d4460" }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Speed indicator while flying */}
      {locked && (
        <div style={{ ...panel, bottom: 14, right: 14, textAlign: "right" }}>
          <div style={{ color: "#3d4460", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>Esc to exit</div>
        </div>
      )}
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
