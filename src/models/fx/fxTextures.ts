/**
 * Procedural textures shared by effects, pickups, and projectiles.
 * Generated lazily on first use so test environments without canvas stay happy.
 */
import { CanvasTexture, ClampToEdgeWrapping, LinearSRGBColorSpace, SRGBColorSpace, Texture } from "three";

const cache = new Map<string, Texture>();

function canvas(w: number, h: number): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c.getContext("2d");
}

function finish(ctx: CanvasRenderingContext2D, srgb = true): CanvasTexture {
  const tex = new CanvasTexture(ctx.canvas);
  tex.colorSpace = srgb ? SRGBColorSpace : LinearSRGBColorSpace;
  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function cached(key: string, build: () => Texture | null): Texture | null {
  const hit = cache.get(key);
  if (hit) return hit;
  const tex = build();
  if (tex) cache.set(key, tex);
  return tex;
}

/** Soft radial glow with a hot core — sprites and halos. */
export function getGlowTexture(): Texture | null {
  return cached("glow", () => {
    const ctx = canvas(128, 128);
    if (!ctx) return null;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.18, "rgba(255,255,255,0.85)");
    g.addColorStop(0.45, "rgba(255,255,255,0.28)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return finish(ctx);
  });
}

/** Billowy smoke puff: noisy alpha with soft top-lit shading. */
export function getPuffTexture(): Texture | null {
  return cached("puff", () => {
    const S = 128;
    const ctx = canvas(S, S);
    if (!ctx) return null;
    ctx.clearRect(0, 0, S, S);
    // Overlapping lobes build an irregular silhouette
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * 26;
      const x = S / 2 + Math.cos(a) * d;
      const y = S / 2 + Math.sin(a) * d;
      const r = 18 + Math.random() * 22;
      const shade = 200 + Math.floor((1 - (y / S)) * 55);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${shade},${shade},${shade},0.32)`);
      g.addColorStop(1, `rgba(${shade},${shade},${shade},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
    }
    // Fade edge so quads never show a hard border
    const img = ctx.getImageData(0, 0, S, S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const dx = (x - S / 2) / (S / 2);
        const dy = (y - S / 2) / (S / 2);
        const edge = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
        const k = (y * S + x) * 4 + 3;
        img.data[k] = Math.min(255, img.data[k] * Math.min(1, edge * 2.2));
      }
    }
    ctx.putImageData(img, 0, 0);
    return finish(ctx);
  });
}

/** Mottled mask for scorch decals (red channel = noise). */
export function getScorchTexture(): Texture | null {
  return cached("scorch", () => {
    const S = 128;
    const ctx = canvas(S, S);
    if (!ctx) return null;
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 160; i++) {
      const v = Math.floor(Math.random() * 255);
      ctx.fillStyle = `rgba(${v},${v},${v},0.35)`;
      ctx.beginPath();
      ctx.arc(Math.random() * S, Math.random() * S, 3 + Math.random() * 14, 0, Math.PI * 2);
      ctx.fill();
    }
    return finish(ctx, false);
  });
}

/**
 * Tracer streak: bright rounded head at v=1 tapering to nothing at v=0,
 * soft across u. Used on crossed quads trailing projectiles.
 */
export function getTracerTexture(): Texture | null {
  return cached("tracer", () => {
    const W = 32;
    const H = 128;
    const ctx = canvas(W, H);
    if (!ctx) return null;
    const img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      const v = 1 - y / (H - 1); // canvas top = texture v=1 (head)
      for (let x = 0; x < W; x++) {
        const u = (x / (W - 1)) * 2 - 1;
        const width = 0.25 + 0.75 * Math.pow(v, 0.6);
        const across = Math.max(0, 1 - Math.abs(u) / width);
        const along = Math.pow(v, 1.8);
        const head = Math.max(0, 1 - Math.hypot(u * 1.1, (v - 0.9) * 6)) * 1.2;
        const a = Math.min(1, across * across * along + head);
        const k = (y * W + x) * 4;
        img.data[k] = 255;
        img.data[k + 1] = 255;
        img.data[k + 2] = 255;
        img.data[k + 3] = Math.round(a * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    return finish(ctx);
  });
}
