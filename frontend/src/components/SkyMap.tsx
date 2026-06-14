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

interface ParsedStar {
  HIP: number;
  SpType: string;
  status: string;
  distance_ly: number;
  RAdeg: number;
  DEdeg: number;
  L: number;
}

function parseStar(s: Star): ParsedStar | null {
  const d   = Number(s.distance_ly);
  const ra  = Number(s.RAdeg);
  const dec = Number(s.DEdeg);
  if (!isFinite(d) || d <= 0 || d > 50_000) return null;
  if (!isFinite(ra) || !isFinite(dec))       return null;
  return {
    HIP: Number(s.HIP),
    SpType: String(s.SpType || ""),
    status: String(s.status || ""),
    distance_ly: d,
    RAdeg: ra,
    DEdeg: dec,
    L: Number(s.L) || 1,
  };
}

function toXYZ(d: number, ra: number, dec: number): THREE.Vector3 {
  const raR  = (ra  * Math.PI) / 180;
  const decR = (dec * Math.PI) / 180;
  return new THREE.Vector3(
    d * Math.cos(decR) * Math.cos(raR),
    d * Math.sin(decR),
    -d * Math.cos(decR) * Math.sin(raR),
  );
}

export default function SkyMap({ stars }: { stars: Star[] }) {
  const mountRef   = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [dbg, setDbg] = useState("waiting for data...");

  const parsed = useMemo(() => {
    const result = stars.map(parseStar).filter((s): s is ParsedStar => s !== null);
    return result;
  }, [stars]);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    if (parsed.length === 0) {
      const s0 = stars[0];
      setDbg(`props.stars=${stars.length} | parsed=0 | raw[0]=${JSON.stringify(s0).slice(0, 200)}`);
      return;
    }

    const s0 = parsed[0];
    setDbg(`parsed=${parsed.length} | HIP${s0.HIP} d=${s0.distance_ly.toFixed(0)}ly ra=${s0.RAdeg.toFixed(1)} dec=${s0.DEdeg.toFixed(1)}`);

    cleanupRef.current?.();
    cleanupRef.current = null;

    const W = el.clientWidth  || 800;
    const H = el.clientHeight || 600;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x04050f, 1);
    el.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();

    // build positions first to compute bounding box
    const positions = parsed.map(s => toXYZ(s.distance_ly, s.RAdeg, s.DEdeg));
    const box = new THREE.Box3();
    positions.forEach(p => box.expandByPoint(p));
    const center = new THREE.Vector3();
    const size   = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    const radius = size.length() * 0.55;

    const camera = new THREE.PerspectiveCamera(75, W / H, 1, radius * 10);
    camera.position.copy(center).addScalar(0);
    camera.position.z = center.z + radius * 1.3;
    camera.lookAt(center);

    setDbg(prev => prev + ` | center=(${center.x.toFixed(0)},${center.y.toFixed(0)},${center.z.toFixed(0)}) r=${radius.toFixed(0)} cam.z=${camera.position.z.toFixed(0)}`);

    // background dust
    const bgPos = new Float32Array(6000 * 3);
    for (let i = 0; i < 6000; i++) {
      bgPos[i*3]   = center.x + (Math.random() - 0.5) * radius * 4;
      bgPos[i*3+1] = center.y + (Math.random() - 0.5) * radius * 4;
      bgPos[i*3+2] = center.z + (Math.random() - 0.5) * radius * 4;
    }
    const bgGeo = new THREE.BufferGeometry();
    bgGeo.setAttribute("position", new THREE.BufferAttribute(bgPos, 3));
    scene.add(new THREE.Points(bgGeo, new THREE.PointsMaterial({
      color: 0x1a2a44, size: 1.2, sizeAttenuation: false,
    })));

    // hipparcos stars
    const n      = parsed.length;
    const pos    = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const sizes  = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      const s = parsed[i];
      const v = positions[i];
      pos[i*3] = v.x; pos[i*3+1] = v.y; pos[i*3+2] = v.z;
      const col = spectralColor(s.SpType);
      colors[i*3] = col.r; colors[i*3+1] = col.g; colors[i*3+2] = col.b;
      const lum  = s.L > 0 ? Math.log10(s.L + 1) : 0.3;
      const base = Math.max(2, Math.min(7, lum * 2.2));
      sizes[i]   = s.status === "likely dead" ? base * 1.5 : base;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos,    3));
    geo.setAttribute("color",    new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("aSize",    new THREE.BufferAttribute(sizes,  1));

    const mat = new THREE.ShaderMaterial({
      vertexShader: `
        attribute float aSize;
        attribute vec3  color;
        varying   vec3  vCol;
        void main() {
          vCol = color;
          gl_PointSize = aSize;
          gl_Position  = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vCol;
        void main() {
          vec2  uv = gl_PointCoord - 0.5;
          float d  = length(uv);
          if (d > 0.5) discard;
          float core = 1.0 - smoothstep(0.05, 0.5, d);
          float halo = exp(-d * d * 10.0) * 0.6;
          gl_FragColor = vec4(vCol + halo * 0.3, clamp(core + halo, 0.0, 1.0));
        }
      `,
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
      vertexColors: true,
    });
    scene.add(new THREE.Points(geo, mat));

    // Sun glow at origin
    const sc = document.createElement("canvas");
    sc.width = sc.height = 64;
    const sctx = sc.getContext("2d")!;
    const sg = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    sg.addColorStop(0, "rgba(253,233,138,1)");
    sg.addColorStop(1, "rgba(0,0,0,0)");
    sctx.fillStyle = sg;
    sctx.fillRect(0, 0, 64, 64);
    const sunSp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(sc), blending: THREE.AdditiveBlending, transparent: true,
    }));
    sunSp.scale.setScalar(radius * 0.04);
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

    let speed = radius * 0.25;
    const onWheel = (e: WheelEvent) => {
      speed = Math.max(1, Math.min(radius * 8, speed * (e.deltaY > 0 ? 0.85 : 1.18)));
    };
    el.addEventListener("wheel", onWheel, { passive: true });

    const resizeObs = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
    });
    resizeObs.observe(el);

    const clock = new THREE.Clock();
    const fwd   = new THREE.Vector3();
    const right = new THREE.Vector3();
    let animId  = 0;

    const tick = () => {
      animId = requestAnimationFrame(tick);
      const spd = speed * Math.min(clock.getDelta(), 0.05);
      camera.getWorldDirection(fwd);
      right.crossVectors(fwd, camera.up).normalize();
      if (keys["KeyW"] || keys["ArrowUp"])    camera.position.addScaledVector(fwd,    spd);
      if (keys["KeyS"] || keys["ArrowDown"])  camera.position.addScaledVector(fwd,   -spd);
      if (keys["KeyD"] || keys["ArrowRight"]) camera.position.addScaledVector(right,  spd);
      if (keys["KeyA"] || keys["ArrowLeft"])  camera.position.addScaledVector(right, -spd);
      if (keys["KeyE"] || keys["Space"])      camera.position.y +=  spd;
      if (keys["KeyQ"] || keys["ShiftLeft"])  camera.position.y -= spd;
      renderer.render(scene, camera);
    };
    tick();

    cleanupRef.current = () => {
      cancelAnimationFrame(animId);
      resizeObs.disconnect();
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

      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        background: "rgba(0,0,0,0.7)", color: "#f87171",
        fontSize: 10, padding: "3px 8px", fontFamily: "monospace",
        pointerEvents: "none", zIndex: 99, wordBreak: "break-all",
      }}>{dbg}</div>

      <div style={{ ...panel, bottom: 14, left: 14 }}>
        <div style={{ color: "#7a82a6", fontWeight: 600, marginBottom: 3 }}>NAVIGATION</div>
        <div>Click to capture mouse</div>
        <div>W / S &mdash; forward / back</div>
        <div>A / D &mdash; strafe</div>
        <div>E / Q &mdash; up / down</div>
        <div>Scroll &mdash; speed</div>
        <div>Esc &mdash; release</div>
      </div>

      <div style={{ ...panel, top: 30, left: 14, color: "#7a82a6" }}>
        {([
          ["#f04a4a", "likely dead"],
          ["#f0b84a", "uncertain"],
          ["#4af07a", "alive"],
          ["#fde98a", "Sun"],
        ] as [string, string][]).map(([col, lbl]) => (
          <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 7, lineHeight: 2 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: col,
              boxShadow: `0 0 5px ${col}`, flexShrink: 0, display: "inline-block" }} />
            {lbl}
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
