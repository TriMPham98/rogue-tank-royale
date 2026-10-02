import { AdditiveBlending, Color, SpriteMaterial } from "three";
import { getGlowTexture } from "./fxTextures";

const materials = new Map<string, SpriteMaterial>();

/**
 * Shared additive glow material per colour. Stands in for point lights, which
 * force every lit material to recompile whenever the light count changes.
 */
export function getGlowMaterial(color: string, opacity = 1): SpriteMaterial {
  const key = `${color}|${opacity}`;
  let mat = materials.get(key);
  if (!mat) {
    mat = new SpriteMaterial({
      map: getGlowTexture(),
      color: new Color(color),
      transparent: true,
      opacity,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    materials.set(key, mat);
  }
  return mat;
}

/** Per-instance glow material for sprites that animate their own opacity. */
export function createGlowMaterial(color: string, opacity = 1): SpriteMaterial {
  return getGlowMaterial(color, opacity).clone();
}
