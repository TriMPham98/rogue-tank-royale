/**
 * Faceted low-poly boulder geometry with baked per-face colour
 * (weathered stone, moss on upward faces, damp dark base).
 */
import {
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  IcosahedronGeometry,
  LinearSRGBColorSpace,
  MeshStandardMaterial,
  RepeatWrapping,
  Vector3,
} from "three";
import { noise3, seededRandom } from "./noise";

export const ROCK_VARIANTS = 4;

const STONE_A = new Color("#7a746a");
const STONE_B = new Color("#5f5b55");
const STONE_WARM = new Color("#857661");
const MOSS = new Color("#56663a");
const BASE = new Color("#3b3832");

const cache = new Map<string, BufferGeometry>();

/** Unit-radius-ish boulder with a flattened base sitting on y = 0. */
export function getRockGeometry(variant: number, detail = 1): BufferGeometry {
  const key = `${variant}|${detail}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const rand = seededRandom(1000 + variant * 77);
  const seed = variant * 3.1 + 1.7;
  const ico = new IcosahedronGeometry(1, detail);
  const geom = ico.toNonIndexed();
  ico.dispose();
  const pos = geom.getAttribute("position");
  const v = new Vector3();
  const squash = 0.55 + rand() * 0.2;
  const lean = (rand() - 0.5) * 0.3;

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = noise3(v.x * 1.4, v.y * 1.4, v.z * 1.4, seed);
    const r = 1 + n * 0.32;
    v.multiplyScalar(r);
    v.y *= squash;
    v.x += v.y * lean;
    // Flatten the underside so it sits on the ground instead of floating
    if (v.y < -0.12) v.y = -0.12 + (v.y + 0.12) * 0.15;
    v.y += 0.14;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geom.computeVertexNormals();

  // Per-face colour from facing direction + height
  const normals = geom.getAttribute("normal");
  const colors = new Float32Array(pos.count * 3);
  const c = new Color();
  for (let f = 0; f < pos.count; f += 3) {
    const ny = (normals.getY(f) + normals.getY(f + 1) + normals.getY(f + 2)) / 3;
    const cy = (pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2)) / 3;
    const tint = rand();
    c.copy(STONE_A).lerp(STONE_B, tint);
    if (tint > 0.75) c.lerp(STONE_WARM, 0.5);
    const moss = Math.max(0, (ny - 0.45) / 0.55) * (0.55 + rand() * 0.45);
    c.lerp(MOSS, moss * 0.85);
    const damp = Math.max(0, 1 - cy / 0.35);
    c.lerp(BASE, damp * 0.6);
    for (let k = 0; k < 3; k++) {
      colors[(f + k) * 3] = c.r;
      colors[(f + k) * 3 + 1] = c.g;
      colors[(f + k) * 3 + 2] = c.b;
    }
  }
  geom.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geom.computeBoundingSphere();
  cache.set(key, geom);
  return geom;
}

let grainTexture: CanvasTexture | null | undefined;

function getGrainTexture(): CanvasTexture | null {
  if (grainTexture !== undefined) return grainTexture;
  grainTexture = null;
  if (typeof document === "undefined") return null;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const rand = seededRandom(4242);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 190 + rand() * 65;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // Fine cracks
  ctx.strokeStyle = "rgba(60,60,60,0.35)";
  for (let i = 0; i < 18; i++) {
    let x = rand() * size;
    let y = rand() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      x += (rand() - 0.5) * 18;
      y += (rand() - 0.5) * 18;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  grainTexture = new CanvasTexture(canvas);
  grainTexture.colorSpace = LinearSRGBColorSpace;
  grainTexture.wrapS = RepeatWrapping;
  grainTexture.wrapT = RepeatWrapping;
  grainTexture.repeat.set(2, 2);
  grainTexture.needsUpdate = true;
  return grainTexture;
}

let rockMaterial: MeshStandardMaterial | null = null;

export function getRockMaterial(): MeshStandardMaterial {
  if (!rockMaterial) {
    const grain = getGrainTexture();
    rockMaterial = new MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.92,
      metalness: 0.02,
      map: grain ?? undefined,
      bumpMap: grain ?? undefined,
      bumpScale: 0.8,
    });
  }
  return rockMaterial;
}
