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

function toXYZ(s: Star): THREE.Vector3 {
  const d   = s.distance_ly;
  const ra  = (s.RAdeg  * Math.PI) / 180;
  const dec = (s.DEdeg  * Math.PI) / 180;
  return new THREE.Vector3(
    d * Math.cos(dec) * Math.cos(ra),
    d * Math.sin(dec),
    -d * Math.cos(dec) * Math.sin(ra),
  );
}

export default function SkyMap({ stars }: { stars: Star[] }) {
  const mountRef   = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [dbg, setDbg] = useState("");

  const validStars = useMemo(() => {
    const v = stars.filter(s =>
      s.distance_ly > 0 &&
      s.distance_ly <= 50_000 &&
      s.RAdeg != null &&
      s.DEdeg != null
    );
    return v;
  }, [stars]);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    // show debug info regardless of star count
    if (validStars.length === 0) {
      const sample = stars[0];
      setDbg(`total props: ${stars.length} | valid: 0 | sample: ${JSON.stringify(sample)}`);
      return;
    }

    const s0 = validStars[0];
    const v0 = toXYZ(s0);
    setDbg(`stars: ${validStars.length} | first HIP:${s0.HIP} d:${s0.distance_ly?.toFixed(0)}ly xyz:(${v0.x.toFixed(0)},${v0.y.toFixed(0)},${v0.z.toFixed(0)})`);

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
    const camera = new THREE.PerspectiveCamera(75, W / H, 0.1, 500_000);

    // compute bounding sphere of all stars and place camera outside it
    const positions = validStars.map(toXYZ);
    const box = new THREE.Box3();
    positions.forEach(p => box.expandByPoint(p));
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size   = new THREE.Vector3();
    box.getSize(size);
    const radius = size.length() * 0.6;

    camera.position.copy(center);
    camera.position.z += radius * 1.2;
    camera.lookAt(center);

    setDbg(prev => prev + ` | cam z:${camera.position.z.toFixed(0)} radius:${radius.toFixed(0)}`);

    // background dust
    const bgPos = new Float32Array(5000 * 3);
    for (let i = 0; i < 5000; i++) {
      bgPos[i*3]   = center.x + (Math.random() - 0.5) * radius * 3;
      bgPos[i*3+1] = center.y + (Math.random() - 0.5) * radius * 3;
      bgPos[i*3+2] = center.z + (Math.random() - 0.5) * radius * 3;
    }
    const bgGeo = new THREE.BufferGeometry();
    bgGeo.setAttribute("position", new THREE.BufferAttribute(bgPos, 3));
    scene.add(new THREE.Points(bgGeo, new THREE.PointsMaterial({
      color: 0x223355, size: 1.0, sizeAttenuation: false,
    })));

    // star points
    const n      = validStars.length;
    const pos    = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const sizes  = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      const s = validStars[i];
      const v = positions[i];
      pos[i*3] = v.x; pos[i*3+1] = v.y; pos[i*3+2] = v.z;
      const col = spectralColor(s.SpType);
      colors[i*3] = col.r; colors[i*3+1] = col.g; colors[i*3+2] = col.b;
      const lum  = s.L && +s.L > 0 ? Math.log10(+s.L + 1) : 0.3;
      sizes[i]   = Math.max(2, Math.min(6, lum * 2)) * (s.status === "likely dead" ? 1.6 : 1);
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
          float a = 1.0 - smoothstep(0.1, 0.5, d);
          gl_FragColor = vec4(vCol, a);
        }
      `,
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
      vertexColors: true,
    });
    scene.add(new THREE.Points(geo, mat));

    // Sun sprite
    const sc = document.createElement("canvas");
    sc.width = sc.height = 64;
    const sctx = sc.getContext("2d")!;
    const sg   = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    sg.addColorStop(0, "rgba(253,233,138,1)");
    sg.addColorStop(1, "rgba(0,0,0,0)");
    sctx.fillStyle = sg;
    sctx.fillRect(0, 0, 64, 64);
    const sunSp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(sc), blending: THREE.AdditiveBlending, transparent: true,
    }));
    sunSp.scale.set(radius * 0.05, radius * 0.05, 1);
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
    const onWheel = (e: WheelEvent) => {
      speed = Math.max(1, Math.min(radius * 5, speed * (e.deltaY > 0 ? 0.85 : 1.18)));
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
  }, [validStars]);

  useEffect(() => () => { cleanupRef.current?.(); }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

      {/* debug bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        background: "rgba(255,0,0,0.15)", color: "#f87",
        fontSize: 10, padding: "3px 8px",
        fontFamily: "monospace", pointerEvents: "none",
        zIndex: 99, wordBreak: "break-all",
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
