import { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import type { Star } from "../types/star";

// 1 ly = 1 unit in scene. Camera starts far back so full galaxy is visible.
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
  const d   = s.distance_ly;           // raw ly, 1 unit = 1 ly
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

  const validStars = useMemo(() =>
    stars.filter(s =>
      s.distance_ly > 0 &&
      s.distance_ly <= 50_000 &&
      s.RAdeg != null &&
      s.DEdeg != null
    ), [stars]);

  useEffect(() => {
    const el = mountRef.current;
    if (!el || validStars.length === 0) return;
    cleanupRef.current?.();
    cleanupRef.current = null;

    const W = el.clientWidth  || 800;
    const H = el.clientHeight || 600;

    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x04050f, 1);
    el.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();

    // Camera starts at Sun (origin), pulled back on Z so stars fill the FOV
    const camera = new THREE.PerspectiveCamera(75, W / H, 1, 200_000);
    camera.position.set(0, 0, 800);
    camera.lookAt(0, 0, 0);

    // --- Background dust ---
    {
      const N   = 5000;
      const pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        pos[i*3]   = (Math.random() - 0.5) * 120_000;
        pos[i*3+1] = (Math.random() - 0.5) * 120_000;
        pos[i*3+2] = (Math.random() - 0.5) * 120_000;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      scene.add(new THREE.Points(g, new THREE.PointsMaterial({
        color: 0x2a3a5a, size: 0.5, sizeAttenuation: false,
      })));
    }

    // --- Hipparcos stars ---
    const n      = validStars.length;
    const pos    = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const sizes  = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      const s    = validStars[i];
      const v    = toXYZ(s);
      pos[i*3]   = v.x; pos[i*3+1] = v.y; pos[i*3+2] = v.z;

      const col = spectralColor(s.SpType);
      colors[i*3] = col.r; colors[i*3+1] = col.g; colors[i*3+2] = col.b;

      // luminosity -> size (px, not attenuated)
      const lum  = s.L && +s.L > 0 ? Math.log10(+s.L + 1) : 0.3;
      const base = Math.max(1.2, Math.min(5, lum * 1.8));
      sizes[i]   = s.status === "likely dead" ? base * 1.6 : base;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(pos,    3));
    starGeo.setAttribute("color",    new THREE.BufferAttribute(colors, 3));
    starGeo.setAttribute("aSize",    new THREE.BufferAttribute(sizes,  1));

    const starMat = new THREE.ShaderMaterial({
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
          float core = 1.0 - smoothstep(0.0, 0.5, d);
          float halo = exp(-d * d * 8.0) * 0.5;
          gl_FragColor = vec4(vCol + halo * 0.3, clamp(core + halo, 0.0, 1.0));
        }
      `,
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
      vertexColors: true,
    });

    scene.add(new THREE.Points(starGeo, starMat));

    // --- Sun glow at origin ---
    {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const ctx  = c.getContext("2d")!;
      const g    = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0,   "rgba(253,233,138,1)");
      g.addColorStop(0.4, "rgba(253,180,60,0.6)");
      g.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(c),
        blending: THREE.AdditiveBlending,
        transparent: true,
      }));
      sp.scale.set(120, 120, 1);
      scene.add(sp);
    }

    // --- Mouse-look + WASD flight ---
    const keys:  Record<string, boolean> = {};
    const euler  = new THREE.Euler(0, Math.PI, 0, "YXZ"); // face -Z (toward stars)
    const quat   = new THREE.Quaternion().setFromEuler(euler);
    camera.quaternion.copy(quat);
    let locked = false;

    const onKD = (e: KeyboardEvent) => { keys[e.code] = true;  e.code === "Space" && e.preventDefault(); };
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

    let speed = 200; // ly / s
    const onWheel = (e: WheelEvent) => {
      speed = Math.max(10, Math.min(10_000, speed * (e.deltaY > 0 ? 0.85 : 1.18)));
    };
    el.addEventListener("wheel", onWheel, { passive: true });

    const resizeObs = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObs.observe(el);

    const clock = new THREE.Clock();
    const fwd   = new THREE.Vector3();
    const right = new THREE.Vector3();
    let animId  = 0;

    const tick = () => {
      animId = requestAnimationFrame(tick);
      const dt  = Math.min(clock.getDelta(), 0.05);
      const spd = speed * dt;

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

      <div style={{ ...panel, bottom: 14, left: 14 }}>
        <div style={{ color: "#7a82a6", fontWeight: 600, marginBottom: 3 }}>NAVIGATION</div>
        <div>Click to capture mouse</div>
        <div>W / S &mdash; forward / back</div>
        <div>A / D &mdash; strafe</div>
        <div>E / Q &mdash; up / down</div>
        <div>Scroll &mdash; speed</div>
        <div>Esc &mdash; release</div>
      </div>

      <div style={{ ...panel, top: 14, left: 14, color: "#7a82a6" }}>
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
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 11,
  color: "#3d4460",
  lineHeight: 1.9,
  backdropFilter: "blur(6px)",
  userSelect: "none",
  pointerEvents: "none",
};
