import { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import type { Star } from "../types/star";

// Spectral type → approximate blackbody color
function spectralColor(spType: string): THREE.Color {
  const s = (spType || "").trim().toUpperCase();
  const c = s[0];
  if (c === "O") return new THREE.Color(0x9bb0ff);
  if (c === "B") return new THREE.Color(0xaabfff);
  if (c === "A") return new THREE.Color(0xcad7ff);
  if (c === "F") return new THREE.Color(0xf8f7ff);
  if (c === "G") return new THREE.Color(0xfff4e8);
  if (c === "K") return new THREE.Color(0xffd2a1);
  if (c === "M") return new THREE.Color(0xffcc6f);
  return new THREE.Color(0xaaaaaa);
}

function toXYZ(star: Star): [number, number, number] {
  const d   = star.distance_ly / 100; // scale down
  const ra  = (star.RAdeg  * Math.PI) / 180;
  const dec = (star.DEdeg  * Math.PI) / 180;
  return [
    d * Math.cos(dec) * Math.cos(ra),
    d * Math.sin(dec),
    -d * Math.cos(dec) * Math.sin(ra),
  ];
}

export default function SkyMap({ stars }: { stars: Star[] }) {
  const mountRef  = useRef<HTMLDivElement>(null);
  const stateRef  = useRef<{ renderer: THREE.WebGLRenderer; animId: number } | null>(null);

  const validStars = useMemo(() =>
    stars.filter(s => s.distance_ly > 0 && s.distance_ly <= 100_000 && s.RAdeg != null && s.DEdeg != null),
    [stars]
  );

  useEffect(() => {
    const el = mountRef.current;
    if (!el || validStars.length === 0) return;

    // ── Scene ────────────────────────────────────────────────
    const scene    = new THREE.Scene();
    const W = el.clientWidth, H = el.clientHeight;
    const camera   = new THREE.PerspectiveCamera(60, W / H, 0.01, 20000);
    camera.position.set(0, 0, 20);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(W, H);
    renderer.setClearColor(0x04050f);
    el.appendChild(renderer.domElement);

    // ── Background star dust (tiny random dots) ──────────────
    const bgCount = 3000;
    const bgPos   = new Float32Array(bgCount * 3);
    for (let i = 0; i < bgCount; i++) {
      bgPos[i*3]   = (Math.random() - 0.5) * 8000;
      bgPos[i*3+1] = (Math.random() - 0.5) * 8000;
      bgPos[i*3+2] = (Math.random() - 0.5) * 8000;
    }
    const bgGeo = new THREE.BufferGeometry();
    bgGeo.setAttribute("position", new THREE.BufferAttribute(bgPos, 3));
    const bgMat = new THREE.PointsMaterial({ color: 0x334466, size: 0.4, sizeAttenuation: true });
    scene.add(new THREE.Points(bgGeo, bgMat));

    // ── Star geometry ─────────────────────────────────────────
    const n       = validStars.length;
    const pos     = new Float32Array(n * 3);
    const colors  = new Float32Array(n * 3);
    const sizes   = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      const s = validStars[i];
      const [x, y, z] = toXYZ(s);
      pos[i*3]   = x;
      pos[i*3+1] = y;
      pos[i*3+2] = z;

      const col = spectralColor(s.SpType);
      colors[i*3]   = col.r;
      colors[i*3+1] = col.g;
      colors[i*3+2] = col.b;

      // size driven by log(L) clamped; dead stars get boosted
      const lum = s.L && +s.L > 0 ? Math.log10(+s.L + 1) : 0.5;
      const base = Math.max(0.5, Math.min(6, lum * 1.4));
      sizes[i] = s.status === "likely dead" ? base * 1.6 : base;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color",    new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("size",     new THREE.BufferAttribute(sizes, 1));

    // ── Shader: round sprite + soft glow ─────────────────────
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:    { value: 0 },
        uPixelRatio: { value: renderer.getPixelRatio() },
      },
      vertexShader: /* glsl */`
        attribute float size;
        attribute vec3 color;
        varying vec3  vColor;
        varying float vSize;
        uniform float uPixelRatio;
        void main() {
          vColor = color;
          vSize  = size;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uPixelRatio * (300.0 / -mv.z);
          gl_Position  = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */`
        varying vec3  vColor;
        varying float vSize;
        void main() {
          vec2  uv   = gl_PointCoord - 0.5;
          float dist = length(uv);
          if (dist > 0.5) discard;
          // core bright disc + wide soft halo
          float core = smoothstep(0.5, 0.05, dist);
          float halo = exp(-dist * dist * 8.0) * 0.6;
          float alpha = clamp(core + halo, 0.0, 1.0);
          gl_FragColor = vec4(vColor + vec3(halo * 0.3), alpha);
        }
      `,
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
      vertexColors: true,
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);

    // ── Sun at origin ─────────────────────────────────────────
    const sunGeo = new THREE.SphereGeometry(0.3, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfde98a });
    const sun    = new THREE.Mesh(sunGeo, sunMat);
    scene.add(sun);
    // sun glow sprite
    const spriteCanvas = document.createElement("canvas");
    spriteCanvas.width  = 128;
    spriteCanvas.height = 128;
    const ctx = spriteCanvas.getContext("2d")!;
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0,   "rgba(253,233,138,0.9)");
    grad.addColorStop(0.3, "rgba(253,233,138,0.4)");
    grad.addColorStop(1,   "rgba(253,233,138,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const sunSpriteMat = new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(spriteCanvas),
      blending: THREE.AdditiveBlending,
      transparent: true,
    });
    const sunSprite = new THREE.Sprite(sunSpriteMat);
    sunSprite.scale.set(4, 4, 1);
    scene.add(sunSprite);

    // ── Flight controls ───────────────────────────────────────
    const keys: Record<string, boolean> = {};
    const euler  = new THREE.Euler(0, 0, 0, "YXZ");
    const quat   = new THREE.Quaternion();
    let   isLocked = false;

    const onKey   = (e: KeyboardEvent, down: boolean) => { keys[e.code] = down; };
    window.addEventListener("keydown", e => onKey(e, true));
    window.addEventListener("keyup",   e => onKey(e, false));

    // pointer-lock for mouse-look
    renderer.domElement.addEventListener("click", () => {
      renderer.domElement.requestPointerLock();
    });
    document.addEventListener("pointerlockchange", () => {
      isLocked = document.pointerLockElement === renderer.domElement;
    });
    document.addEventListener("mousemove", (e) => {
      if (!isLocked) return;
      euler.y -= e.movementX * 0.002;
      euler.x -= e.movementY * 0.002;
      euler.x  = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
      quat.setFromEuler(euler);
      camera.quaternion.copy(quat);
    });

    // ── Resize ────────────────────────────────────────────────
    const onResize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObs = new ResizeObserver(onResize);
    resizeObs.observe(el);

    // ── Animate ───────────────────────────────────────────────
    const clock = new THREE.Clock();
    const vel   = new THREE.Vector3();
    const dir   = new THREE.Vector3();
    const SPEED = 12;

    const animate = () => {
      const animId = requestAnimationFrame(animate);
      stateRef.current = { renderer, animId };
      const dt = clock.getDelta();
      mat.uniforms.uTime.value += dt;

      // WASD + EQ flight
      if (isLocked) {
        camera.getWorldDirection(dir);
        vel.set(0, 0, 0);
        if (keys["KeyW"] || keys["ArrowUp"])   vel.addScaledVector(dir,  SPEED);
        if (keys["KeyS"] || keys["ArrowDown"]) vel.addScaledVector(dir, -SPEED);
        const right = new THREE.Vector3().crossVectors(dir, camera.up).normalize();
        if (keys["KeyD"] || keys["ArrowRight"]) vel.addScaledVector(right,  SPEED);
        if (keys["KeyA"] || keys["ArrowLeft"])  vel.addScaledVector(right, -SPEED);
        if (keys["KeyE"] || keys["Space"])      vel.y +=  SPEED;
        if (keys["KeyQ"] || keys["ShiftLeft"])  vel.y -= SPEED;
        camera.position.addScaledVector(vel, dt);
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      if (stateRef.current) cancelAnimationFrame(stateRef.current.animId);
      resizeObs.disconnect();
      window.removeEventListener("keydown", e => onKey(e, true));
      window.removeEventListener("keyup",   e => onKey(e, false));
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, [validStars]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#04050f" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

      {/* HUD */}
      <div style={{
        position: "absolute", bottom: 14, left: 14,
        background: "rgba(4,5,15,0.75)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 8,
        padding: "8px 14px",
        fontSize: 11,
        color: "#3d4460",
        lineHeight: 1.8,
        backdropFilter: "blur(6px)",
        userSelect: "none",
        pointerEvents: "none",
      }}>
        <div style={{ color: "#7a82a6", fontWeight: 600, marginBottom: 2 }}>NAVIGATION</div>
        <div>Click to capture mouse</div>
        <div>W / S — forward / back</div>
        <div>A / D — strafe</div>
        <div>E / Q — up / down</div>
        <div>Esc — release mouse</div>
      </div>

      {/* Legend */}
      <div style={{
        position: "absolute", top: 14, left: 14,
        background: "rgba(4,5,15,0.75)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 8,
        padding: "8px 14px",
        fontSize: 11,
        color: "#7a82a6",
        lineHeight: 2,
        backdropFilter: "blur(6px)",
        userSelect: "none",
        pointerEvents: "none",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f04a4a", boxShadow: "0 0 5px #f04a4a", display: "inline-block" }} />
          likely dead
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f0b84a", boxShadow: "0 0 5px #f0b84a", display: "inline-block" }} />
          uncertain
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4af07a", boxShadow: "0 0 5px #4af07a", display: "inline-block" }} />
          alive
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 2 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fde98a", boxShadow: "0 0 5px #fde98a", display: "inline-block" }} />
          Sun
        </div>
      </div>
    </div>
  );
}
