import { useEffect, useRef, useMemo } from "react";
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
  distance_ly: number; RAdeg: number; DEdeg: number; L: number;
}

function parse(s: Star): P | null {
  const d = Number(s.distance_ly), ra = Number(s.RAdeg), dec = Number(s.DEdeg);
  if (!isFinite(d) || d <= 0 || d > 50_000) return null;
  if (!isFinite(ra) || !isFinite(dec)) return null;
  return {
    SpType: String(s.SpType || ""), status: String(s.status || ""),
    distance_ly: d, RAdeg: ra, DEdeg: dec, L: Number(s.L) || 1,
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

// Fixed screen-space size — no distance attenuation whatsoever
const VERT = /* glsl */`
  attribute float aSize;
  attribute vec3  aColor;
  varying   vec3  vColor;
  void main() {
    vColor      = aColor;
    gl_PointSize = aSize;
    gl_Position  = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const FRAG = /* glsl */`
  varying vec3 vColor;
  void main() {
    vec2  uv   = gl_PointCoord - 0.5;
    float d    = length(uv) * 2.0;
    if (d > 1.0) discard;
    float core = exp(-d * d * 5.0);
    float halo = exp(-d * d * 1.2) * 0.45;
    float a    = clamp(core + halo, 0.0, 1.0);
    vec3  col  = vColor + vec3(core * 0.5);  // white-hot center
    gl_FragColor = vec4(col, a);
  }
`;

export default function SkyMap({ stars }: { stars: Star[] }) {
  const mountRef   = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const parsed = useMemo(() => {
    if (!stars?.length) return [];
    return stars.map(parse).filter((s): s is P => s !== null);
  }, [stars]);

  useEffect(() => {
    const el = mountRef.current;
    if (!el || parsed.length === 0) return;
    cleanupRef.current?.();
    cleanupRef.current = null;

    const W = el.clientWidth || 800, H = el.clientHeight || 600;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x04050f, 1);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    // bounding box for camera placement only
    const positions = parsed.map(s => xyz(s.distance_ly, s.RAdeg, s.DEdeg));
    const box = new THREE.Box3();
    positions.forEach(p => box.expandByPoint(p));
    const center = new THREE.Vector3(), sz = new THREE.Vector3();
    box.getCenter(center); box.getSize(sz);
    const radius = Math.max(sz.length() * 0.55, 10);

    const camera = new THREE.PerspectiveCamera(70, W / H, 1, radius * 15);
    camera.position.set(center.x, center.y, center.z + radius * 1.4);
    camera.lookAt(center);

    // background galaxy dust
    const bgPos = new Float32Array(10_000 * 3);
    for (let i = 0; i < 10_000; i++) {
      bgPos[i*3]   = center.x + (Math.random() - 0.5) * radius * 5;
      bgPos[i*3+1] = center.y + (Math.random() - 0.5) * radius * 5;
      bgPos[i*3+2] = center.z + (Math.random() - 0.5) * radius * 5;
    }
    const bgGeo = new THREE.BufferGeometry();
    bgGeo.setAttribute("position", new THREE.BufferAttribute(bgPos, 3));
    scene.add(new THREE.Points(bgGeo, new THREE.PointsMaterial({
      color: 0x1a2a44, size: 1.0, sizeAttenuation: false,
    })));

    // hipparcos stars — size in screen pixels only, no attenuation
    const n = parsed.length;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const siz = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      const s = parsed[i], v = positions[i];
      pos[i*3] = v.x; pos[i*3+1] = v.y; pos[i*3+2] = v.z;

      const c = spectralColor(s.SpType);
      col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;

      // luminosity in solar units → screen size in px
      // log scale: L=1 (sun) → 4px, L=1e6 → 16px, dead stars boosted
      const lum  = s.L > 0 ? Math.log10(s.L + 1) : 0.5;
      const base = Math.max(3, Math.min(18, 3 + lum * 4.5));
      siz[i] = s.status === "likely dead" ? base * 1.8 : base;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aColor",   new THREE.BufferAttribute(col, 3));
    geo.setAttribute("aSize",    new THREE.BufferAttribute(siz, 1));

    scene.add(new THREE.Points(geo, new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    })));

    // Sun glow at origin
    const sc = document.createElement("canvas"); sc.width = sc.height = 128;
    const ctx = sc.getContext("2d")!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0,   "rgba(255,240,150,1)");
    g.addColorStop(0.3, "rgba(253,180,50,0.7)");
    g.addColorStop(1,   "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    const sunSp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(sc), blending: THREE.AdditiveBlending, transparent: true,
    }));
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
    const onLC = () => { locked = document.pointerLockElement === renderer.domElement; };
    const onMM = (e: MouseEvent) => {
      if (!locked) return;
      euler.y -= e.movementX * 0.002;
      euler.x  = Math.max(-1.5, Math.min(1.5, euler.x - e.movementY * 0.002));
      camera.quaternion.setFromEuler(euler);
    };
    document.addEventListener("pointerlockchange", onLC);
    document.addEventListener("mousemove", onMM);

    let speed = radius * 0.3;
    el.addEventListener("wheel", (e: WheelEvent) => {
      speed = Math.max(1, Math.min(radius * 8, speed * (e.deltaY > 0 ? 0.85 : 1.18)));
    }, { passive: true });

    const obs = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight;
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
  }, [parsed]);

  useEffect(() => () => { cleanupRef.current?.(); }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

      <div style={{ ...panel, bottom: 14, left: 14 }}>
        <div style={{ color: "#7a82a6", fontWeight: 600, marginBottom: 3 }}>NAVIGATION</div>
        <div>Click → capture mouse</div>
        <div>W / S — forward / back</div>
        <div>A / D — strafe</div>
        <div>E / Q — up / down</div>
        <div>Scroll — speed</div>
        <div>Esc — release</div>
      </div>

      <div style={{ ...panel, top: 14, left: 14, color: "#7a82a6" }}>
        {([
          ["#f04a4a", "likely dead"],
          ["#f0b84a", "uncertain"],
          ["#4af07a", "alive"],
          ["#fde98a", "Sun"],
        ] as [string, string][]).map(([c, l]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 7, lineHeight: 2 }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%", background: c,
              boxShadow: `0 0 5px ${c}`, flexShrink: 0, display: "inline-block",
            }} />
            {l}
          </div>
        ))}
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
