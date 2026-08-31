import {
  CanvasTexture,
  RepeatWrapping,
  SRGBColorSpace,
  LinearSRGBColorSpace,
} from "three";

function makeCanvas(size: number): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas.getContext("2d");
}

function finishTexture(
  ctx: CanvasRenderingContext2D,
  repeat = 2,
  colorSpace: typeof SRGBColorSpace | typeof LinearSRGBColorSpace = SRGBColorSpace
): CanvasTexture {
  const texture = new CanvasTexture(ctx.canvas);
  texture.colorSpace = colorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function blob(
  ctx: CanvasRenderingContext2D,
  color: string,
  count: number,
  minR: number,
  maxR: number
) {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const rx = minR + Math.random() * (maxR - minR);
    const ry = minR + Math.random() * (maxR - minR);
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function createCamoTexture(
  base: string,
  mid: string,
  dark: string,
  accent: string
): CanvasTexture | null {
  const ctx = makeCanvas(256);
  if (!ctx) return null;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  blob(ctx, mid, 28, 18, 48);
  blob(ctx, dark, 18, 12, 36);
  blob(ctx, accent, 10, 6, 18);
  // Fine grit so large hull faces do not read as flat plastic
  const grit = ctx.getImageData(0, 0, 256, 256);
  for (let i = 0; i < grit.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 18;
    grit.data[i] = Math.max(0, Math.min(255, grit.data[i] + n));
    grit.data[i + 1] = Math.max(0, Math.min(255, grit.data[i + 1] + n));
    grit.data[i + 2] = Math.max(0, Math.min(255, grit.data[i + 2] + n));
  }
  ctx.putImageData(grit, 0, 0);
  return finishTexture(ctx, 1.6);
}

export function createPlateTexture(
  base: string,
  rivet: string
): CanvasTexture | null {
  const ctx = makeCanvas(256);
  if (!ctx) return null;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "rgba(0,0,0,0.22)";
  ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    ctx.strokeRect(8 + i * 60, 8, 52, 240);
  }
  ctx.fillStyle = rivet;
  for (let x = 16; x < 256; x += 30) {
    for (let y = 16; y < 256; y += 36) {
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return finishTexture(ctx, 1.2);
}

export function createRubberTexture(): CanvasTexture | null {
  const ctx = makeCanvas(128);
  if (!ctx) return null;
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = "#111111";
  for (let y = 0; y < 128; y += 10) {
    ctx.fillRect(0, y, 128, 5);
  }
  ctx.fillStyle = "#2a2a2a";
  for (let y = 2; y < 128; y += 10) {
    ctx.fillRect(0, y, 128, 1);
  }
  return finishTexture(ctx, 3, LinearSRGBColorSpace);
}

export function createMetalNoiseTexture(): CanvasTexture | null {
  const ctx = makeCanvas(128);
  if (!ctx) return null;
  const img = ctx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 90 + Math.random() * 80;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return finishTexture(ctx, 2, LinearSRGBColorSpace);
}
