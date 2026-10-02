import { forwardRef } from "react";
import { Sprite, SpriteMaterial } from "three";
import { getGlowMaterial } from "./glowMaterials";

interface GlowSpriteProps {
  color: string;
  size: number;
  opacity?: number;
  position?: [number, number, number];
  material?: SpriteMaterial;
}

/** Additive camera-facing glow; pass `material` to animate opacity per instance. */
const GlowSprite = forwardRef<Sprite, GlowSpriteProps>(
  ({ color, size, opacity = 1, position, material }, ref) => (
    <sprite
      ref={ref}
      position={position}
      scale={[size, size, size]}
      material={material ?? getGlowMaterial(color, opacity)}
      renderOrder={5}
    />
  )
);

export default GlowSprite;
