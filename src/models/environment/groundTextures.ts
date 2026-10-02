/**
 * Procedural battlefield textures. The arena macro map is painted once per
 * load: grass/dirt fields, churned tracks, shell craters, survey grid.
 * Canvas x maps to world x and canvas y maps to world z (see Ground.tsx).
 */
import {
  CanvasTexture,
  LinearSRGBColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  ClampToEdgeWrapping,
} from "three";
import { fbm2, fbmTile, seededRandom } from "./noise";

const WORLD = 100;

function makeCtx(size: number): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  return c.getContext("2d");
}

type RGB = [number, number, number];
const hex = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

const GRASS_DARK = hex("#34431f");
const GRASS = hex("#4b5f2e");
const GRASS_DRY = hex("#76734a");
const DIRT = hex("#6a5636");

export function createArenaGroundTexture(size = 1024): CanvasTexture | null {
  const ctx = makeCtx(size);
  if (!ctx) return null;
  const rand = seededRandom(1337);
  const toPx = (world: number) => ((world + WORLD / 2) / WORLD) * size;

  // --- Base fields (computed at half-res, upscaled smoothly) ---
  const half = size / 2;
  const base = makeCtx(half);
  if (!base) return null;
  const img = base.createImageData(half, half);
  for (let y = 0; y < half; y++) {
    for (let x = 0; x < half; x++) {
      const wx = (x / half) * WORLD;
      const wy = (y / half) * WORLD;
      const fields = fbm2(wx * 0.045, wy * 0.045, 4, 11);
      const tone = fbm2(wx * 0.12, wy * 0.12, 3, 23);
      const fine = fbm2(wx * 0.6, wy * 0.6, 2, 41);
      let c = mix(GRASS_DARK, GRASS, smooth(0.3, 0.7, tone));
      c = mix(c, GRASS_DRY, smooth(0.55, 0.8, fields) * 0.8);
      c = mix(c, DIRT, smooth(0.62, 0.78, fields * 0.7 + fine * 0.3));
      const shade = 0.88 + fine * 0.24;
      const k = (y * half + x) * 4;
      img.data[k] = c[0] * shade;
      img.data[k + 1] = c[1] * shade;
      img.data[k + 2] = c[2] * shade;
      img.data[k + 3] = 255;
    }
  }
  base.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(base.canvas, 0, 0, size, size);

  // --- Churned vehicle tracks: soft dirt lanes with paired tread ruts ---
  const lanes = 5;
  for (let l = 0; l < lanes; l++) {
    const pts: Array<[number, number]> = [];
    const horizontal = l % 2 === 0;
    const offset = (rand() - 0.5) * size * 0.8;
    for (let i = 0; i <= 6; i++) {
      const along = (i / 6) * size * 1.2 - size * 0.1;
      const wobble = (rand() - 0.5) * size * 0.18;
      pts.push(horizontal ? [along, size / 2 + offset + wobble] : [size / 2 + offset + wobble, along]);
    }
    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2;
        const my = (pts[i][1] + pts[i + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
      }
      ctx.stroke();
    };
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.filter = "blur(6px)";
    ctx.strokeStyle = "rgba(96, 78, 50, 0.55)";
    ctx.lineWidth = size * 0.03;
    trace();
    ctx.filter = "blur(1.5px)";
    ctx.strokeStyle = "rgba(52, 41, 27, 0.45)";
    ctx.lineWidth = size * 0.004;
    ctx.setLineDash([size * 0.006, size * 0.003]);
    for (const shift of [-1, 1]) {
      ctx.save();
      ctx.translate(horizontal ? 0 : shift * size * 0.008, horizontal ? shift * size * 0.008 : 0);
      trace();
      ctx.restore();
    }
    ctx.setLineDash([]);
  }
  ctx.filter = "none";

  // --- Shell craters (kept off the central deployment pad) ---
  for (let i = 0; i < 26; i++) {
    let wx = 0;
    let wz = 0;
    do {
      wx = (rand() - 0.5) * WORLD * 0.94;
      wz = (rand() - 0.5) * WORLD * 0.94;
    } while (Math.hypot(wx, wz) < 9);
    const r = ((0.8 + rand() * 1.8) / WORLD) * size;
    const cx = toPx(wx);
    const cy = toPx(wz);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.6);
    g.addColorStop(0, "rgba(28, 22, 15, 0.75)");
    g.addColorStop(0.45, "rgba(58, 46, 31, 0.55)");
    g.addColorStop(0.62, "rgba(128, 108, 76, 0.35)");
    g.addColorStop(1, "rgba(80, 66, 45, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Scattered pebbles / debris speckle ---
  for (let i = 0; i < 2600; i++) {
    const v = 70 + rand() * 80;
    ctx.fillStyle = `rgba(${v}, ${v * 0.92}, ${v * 0.8}, ${0.25 + rand() * 0.35})`;
    ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 1.5, 1 + rand() * 1.5);
  }

  // --- Faint survey grid every 10 m keeps the tactical read ---
  ctx.strokeStyle = "rgba(190, 230, 150, 0.07)";
  ctx.lineWidth = 1.5;
  for (let w = -40; w <= 40; w += 10) {
    const p = toPx(w);
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  // --- Darken the outer rim so the arena edge reads as worn ground ---
  const vignette = ctx.createRadialGradient(size / 2, size / 2, size * 0.35, size / 2, size / 2, size * 0.72);
  vignette.addColorStop(0, "rgba(30, 24, 16, 0)");
  vignette.addColorStop(1, "rgba(30, 24, 16, 0.35)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, size, size);

  const tex = new CanvasTexture(ctx.canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/** Tiling grayscale grit used as bump + colour breakup on all ground. */
export function createGroundDetailTexture(size = 256): CanvasTexture | null {
  const ctx = makeCtx(size);
  if (!ctx) return null;
  const rand = seededRandom(99);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbmTile((x / size) * 16, (y / size) * 16, 16, 3, 7);
      const v = 128 + (n - 0.5) * 120 + (rand() - 0.5) * 40;
      const k = (y * size + x) * 4;
      img.data[k] = v;
      img.data[k + 1] = v;
      img.data[k + 2] = v;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // Short grass-blade strokes
  for (let i = 0; i < 900; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const l = 2 + rand() * 4;
    const a = -Math.PI / 2 + (rand() - 0.5) * 0.9;
    const v = rand() < 0.5 ? 60 : 200;
    ctx.strokeStyle = `rgba(${v},${v},${v},0.5)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  const tex = new CanvasTexture(ctx.canvas);
  tex.colorSpace = LinearSRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/** Concrete deployment pad at the spawn point. */
export function createPadTexture(size = 512): CanvasTexture | null {
  const ctx = makeCtx(size);
  if (!ctx) return null;
  const c = size / 2;
  const rand = seededRandom(5);
  ctx.clearRect(0, 0, size, size);

  // Concrete disc
  ctx.fillStyle = "#77746c";
  ctx.beginPath();
  ctx.arc(c, c, c * 0.98, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 4000; i++) {
    const v = 90 + rand() * 60;
    ctx.fillStyle = `rgba(${v},${v},${v * 0.95},0.18)`;
    ctx.fillRect(rand() * size, rand() * size, 2, 2);
  }
  // Slab seams
  ctx.strokeStyle = "rgba(40,38,34,0.55)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * c * 0.32, c + Math.sin(a) * c * 0.32);
    ctx.lineTo(c + Math.cos(a) * c * 0.8, c + Math.sin(a) * c * 0.8);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(c, c, c * 0.32, 0, Math.PI * 2);
  ctx.stroke();

  // Hazard chevron ring
  const inner = c * 0.8;
  const outer = c * 0.94;
  const segments = 36;
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    ctx.fillStyle = i % 2 === 0 ? "#d9a91c" : "#1d1b18";
    ctx.beginPath();
    ctx.arc(c, c, outer, a0, a1);
    ctx.arc(c, c, inner, a1 + 0.06, a0 + 0.06, true);
    ctx.closePath();
    ctx.fill();
  }

  // Center emblem: deployment arrow
  ctx.fillStyle = "rgba(225, 222, 210, 0.75)";
  ctx.beginPath();
  ctx.moveTo(c, c - c * 0.24);
  ctx.lineTo(c + c * 0.16, c + c * 0.04);
  ctx.lineTo(c + c * 0.06, c + c * 0.04);
  ctx.lineTo(c + c * 0.06, c + c * 0.22);
  ctx.lineTo(c - c * 0.06, c + c * 0.22);
  ctx.lineTo(c - c * 0.06, c + c * 0.04);
  ctx.lineTo(c - c * 0.16, c + c * 0.04);
  ctx.closePath();
  ctx.fill();

  // Weathering
  for (let i = 0; i < 40; i++) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 20 + rand() * 40);
    g.addColorStop(0, "rgba(40,34,26,0.22)");
    g.addColorStop(1, "rgba(40,34,26,0)");
    ctx.save();
    ctx.translate(rand() * size, rand() * size);
    ctx.fillStyle = g;
    ctx.fillRect(-60, -60, 120, 120);
    ctx.restore();
  }
  // Clip weathering to the disc edge
  ctx.globalCompositeOperation = "destination-in";
  ctx.beginPath();
  ctx.arc(c, c, c * 0.98, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  const tex = new CanvasTexture(ctx.canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/** Grass tuft card: a few tapered blades on transparent background. */
export function createGrassTexture(size = 128): CanvasTexture | null {
  const ctx = makeCtx(size);
  if (!ctx) return null;
  const rand = seededRandom(77);
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 14; i++) {
    const baseX = size * (0.2 + rand() * 0.6);
    const h = size * (0.5 + rand() * 0.48);
    const lean = (rand() - 0.5) * size * 0.35;
    const w = size * (0.025 + rand() * 0.02);
    const g = ctx.createLinearGradient(0, size, 0, size - h);
    const tone = rand();
    g.addColorStop(0, `rgb(${62 + tone * 12}, ${78 + tone * 14}, ${38})`);
    g.addColorStop(1, `rgb(${132 + tone * 40}, ${150 + tone * 30}, ${78 + tone * 20})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(baseX - w, size);
    ctx.quadraticCurveTo(baseX + lean * 0.3, size - h * 0.6, baseX + lean, size - h);
    ctx.quadraticCurveTo(baseX + lean * 0.3 + w, size - h * 0.55, baseX + w, size);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new CanvasTexture(ctx.canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
