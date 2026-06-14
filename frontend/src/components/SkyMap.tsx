import { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import type { Star } from "../types/star";

const SCALE = 0.002; // 1 ly = 0.002 units  ->  500 ly ~ 1 unit from Sun

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

function toXYZ(star: Star): [number, number, number] {
  const d   = star.distance_ly * SCALE;
  const ra  = (star.RAdeg  * Math.PI) / 180;
  const dec = (star.DEdeg  * Math.PI) / 180;
  return [
    d * Math.cos(dec) * Math.cos(ra),
    d * Math.sin(dec),
    -d * Math.cos(dec) * Math.sin(ra),
  ];
}

export default function SkyMap({ stars }: { stars: Star[] }) {
  const mountRef   = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const validStars = useMemo(() =>
    stars.filter(s => s.distance_ly > 0 && s.distance_ly <= 100_000 && s.RAdeg != null && s.DEdeg != null),
    [stars]
  );

  useEffect(() => {
    const el = mountRef.current;
    if (!el || validStars.length === 0) return;
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }

    const W = el.clientWidth  || 800;
    const H = el.clientHeight || 600;

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, W / H, 0.001, 50000);
    camera.position.set(0.05, 0.02, 0.3);
    camera.lookAt(1, 0, -2);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x04050f);
    el.appendChild(renderer.domElement);

    // background dust
    const bgPos = new Float32Array(4000 * 3);
    for (let i = 0; i < 4000; i++) {
      bgPos[i*3]   = (Math.random() - 0.5) * 600;
      bgPos[i*3+1] = (Math.random() - 0.5) * 600;
      bgPos[i*3+2] = (Math.random() - 0.5) * 600;
    }
    const bgGeo = new THREE.BufferGeometry();
    bgGeo.setAttribute("position", new THREE.BufferAttribute(bgPos, 3));
    scene.add(new THREE.Points(bgGeo,
      new THREE.PointsMaterial({ color: 0x223355, size: 0.08, sizeAttenuation: true })));

    // star buffers
    const n      = validStars.length;
    const pos    = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const sizes  = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      const s = validStars[i];
      const [x, y, z] = toXYZ(s);
      pos[i*3] = x; pos[i*3+1] = y; pos[i*3+2] = z;

      const col = spectralColor(s.SpType);
      colors[i*3] = col.r; colors[i*3+1] = col.g; colors[i*3+2] = col.b;

      const lum  = s.L && +s.L > 0 ? Math.log10(+s.L + 1) : 0.3;
      const base = Math.max(1.5, Math.min(14, lum * 3.5));
      sizes[i]   = s.status === "likely dead" ? base * 1.5 : base;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos,    3));
    geo.setAttribute("color",    new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("size",     new THREE.BufferAttribute(sizes,  1));

    const mat = new THREE.ShaderMaterial({
      uniforms: { uPixelRatio: { value: renderer.getPixelRatio() } },
      vertexShader: /* glsl */`
        attribute float size;
        attribute vec3  color;
        varying   vec3  vColor;
        uniform   float uPixelRatio;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uPixelRatio * (280.0 / -mv.z);
          gl_Position  = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */`
        varying vec3 vColor;
        void main() {
          vec2  uv = gl_PointCoord - 0.5;
          float d  = length(uv);
          if (d > 0.5) discard;
          float core = smoothstep(0.5, 0.0, d);
          float halo = exp(-d * d * 12.0) * 0.55;
          float a    = clamp(core + halo, 0.0, 1.0);
          gl_FragColor = vec4(vColor + vec3(halo * 0.25), a);
        }
      `,
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
      vertexColors: true,
    });

    scene.add(new THREE.Points(geo, mat));

    // Sun
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xfde98a })
    ));
    const spriteCanvas = document.createElement("canvas");
    spriteCanvas.width = spriteCanvas.height = 128;
    const ctx  = spriteCanvas.getContext("2d")!;
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0,   "rgba(253,233,138,1)");
    grad.addColorStop(0.3, "rgba(253,200,80,0.5)");
    grad.addColorStop(1,   "rgba(253,150,30,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(spriteCanvas),
      blending: THREE.AdditiveBlending,
      transparent: true,
    }));
    sunSprite.scale.set(0.8, 0.8, 1);
    scene.add(sunSprite);

    // flight controls
    const keys: Record<string, boolean> = {};
    const euler = new THREE.Euler(0, 0, 0, "YXZ");
    const quat  = new THREE.Quaternion();
    let   locked = false;
    euler.setFromQuaternion(camera.quaternion);

    const onKeyDown = (e: KeyboardEvent) => { keys[e.code] = true; };
    const onKeyUp   = (e: KeyboardEvent) => { keys[e.code] = false; };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup",   onKeyUp);

    renderer.domElement.addEventListener("click", () => renderer.domElement.requestPointerLock());
    const onLockChange = () => { locked = document.pointerLockElement === renderer.domElement; };
    const onMouseMove  = (e: MouseEvent) => {
      if (!locked) return;
      euler.y -= e.movementX * 0.0022;
      euler.x -= e.movementY * 0.0022;
      euler.x  = Math.max(-Math.PI * 0.49, Math.min(Math.PI * 0.49, euler.x));
      quat.setFromEuler(euler);
      camera.quaternion.copy(quat);
    };
    document.addEventListener("pointerlockchange", onLockChange);
    document.addEventListener("mousemove", onMouseMove);

    let speedMult = 1;
    const onWheel = (e: WheelEvent) => {
      speedMult = Math.max(0.05, Math.min(20, speedMult * (e.deltaY > 0 ? 0.9 : 1.1)));
    };
    el.addEventListener("wheel", onWheel, { passive: true });

    const resizeObs = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObs.observe(el);

    const clock  = new THREE.Clock();
    const vel    = new THREE.Vector3();
    const fwd    = new THREE.Vector3();
    const right  = new THREE.Vector3();
    let   animId = 0;
    const BASE   = 0.4;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const dt  = Math.min(clock.getDelta(), 0.05);
      const spd = BASE * speedMult * dt;

      camera.getWorldDirection(fwd);
      right.crossVectors(fwd, camera.up).normalize();
      vel.set(0, 0, 0);

      if (keys["KeyW"] || keys["ArrowUp"])    vel.addScaledVector(fwd,    spd);
      if (keys["KeyS"] || keys["ArrowDown"])  vel.addScaledVector(fwd,   -spd);
      if (keys["KeyD"] || keys["ArrowRight"]) vel.addScaledVector(right,  spd);
      if (keys["KeyA"] || keys["ArrowLeft"])  vel.addScaledVector(right, -spd);
      if (keys["KeyE"] || keys["Space"])      vel.y +=  spd;
      if (keys["KeyQ"] || keys["ShiftLeft"])  vel.y -= spd;

      camera.position.add(vel);
      renderer.render(scene, camera);
    };
    animate();

    cleanupRef.current = () => {
      cancelAnimationFrame(animId);
      resizeObs.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup",   onKeyUp);
      document.removeEventListener("pointerlockchange", onLockChange);
      document.removeEventListener("mousemove", onMouseMove);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, [validStars]);

  useEffect(() => () => { cleanupRef.current?.(); }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#04050f" }}>
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
        ] as [string, string][]).map(([col, label]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: col, boxShadow: `0 0 5px ${col}`, flexShrink: 0, display: "inline-block" }} />
            {label}
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
