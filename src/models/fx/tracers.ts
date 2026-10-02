/**
 * Shared geometry/materials for projectile tracers: a hot elongated core plus
 * crossed additive quads trailing behind (readable from top-down and FPV).
 * Local +Z is the direction of travel.
 */
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  MeshBasicMaterial,
  SphereGeometry,
} from "three";
import { getTracerTexture } from "./fxTextures";

const geometries = new Map<string, BufferGeometry>();
const materials = new Map<string, MeshBasicMaterial>();

/** Two perpendicular quads from z = -length (tail, v=0) to z = head (v=1). */
export function getTrailGeometry(length: number, width: number): BufferGeometry {
  const key = `trail|${length}|${width}`;
  let g = geometries.get(key);
  if (g) return g;
  const head = width * 0.6;
  const w = width / 2;
  // prettier-ignore
  const positions = [
    // horizontal quad
    -w, 0, -length,   w, 0, -length,   w, 0, head,   -w, 0, head,
    // vertical quad
    0, -w, -length,   0, w, -length,   0, w, head,   0, -w, head,
  ];
  // prettier-ignore
  const uvs = [0, 0, 1, 0, 1, 1, 0, 1,   0, 0, 1, 0, 1, 1, 0, 1];
  const index = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7];
  g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  g.setIndex(index);
  g.computeBoundingSphere();
  geometries.set(key, g);
  return g;
}

/** Unit sphere stretched along Z — scale per use for calibre. */
export function getCoreGeometry(): BufferGeometry {
  let g = geometries.get("core");
  if (!g) {
    g = new SphereGeometry(1, 10, 8);
    g.scale(1, 1, 2.6);
    geometries.set("core", g);
  }
  return g;
}

export function getTrailMaterial(color: string, opacity = 1): MeshBasicMaterial {
  const key = `trail|${color}|${opacity}`;
  let m = materials.get(key);
  if (!m) {
    m = new MeshBasicMaterial({
      color: new Color(color),
      map: getTracerTexture(),
      transparent: true,
      opacity,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    });
    materials.set(key, m);
  }
  return m;
}

export function getCoreMaterial(color: string): MeshBasicMaterial {
  const key = `core|${color}`;
  let m = materials.get(key);
  if (!m) {
    m = new MeshBasicMaterial({ color: new Color(color), toneMapped: false });
    materials.set(key, m);
  }
  return m;
}

/** Layered additive beam materials (white-hot core, coloured glow, faint haze). */
const beamMaterials = new Map<
  string,
  { core: MeshBasicMaterial; glow: MeshBasicMaterial; haze: MeshBasicMaterial }
>();

export function getBeamMaterials(color: string) {
  let mats = beamMaterials.get(color);
  if (!mats) {
    const additive = (c: string, opacity: number) =>
      new MeshBasicMaterial({
        color: new Color(c),
        transparent: true,
        opacity,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
    mats = {
      core: additive("#f2ffff", 1),
      glow: additive(color, 0.55),
      haze: additive(color, 0.16),
    };
    beamMaterials.set(color, mats);
  }
  return mats;
}

