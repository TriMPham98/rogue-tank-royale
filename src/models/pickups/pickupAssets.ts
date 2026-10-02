/**
 * Shared geometry/materials for field pickups (medkit crate, supply coin).
 * Built once and reused by every PowerUpItem instance.
 */
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  Shape,
  TorusGeometry,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

function star(points: number, outer: number, inner: number, depth: number): BufferGeometry {
  const s = new Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  const g = new ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelSize: 0.008,
    bevelThickness: 0.008,
    bevelSegments: 1,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

let assets: ReturnType<typeof build> | null = null;

function build() {
  const coinDisc = new CylinderGeometry(0.4, 0.4, 0.08, 40);
  coinDisc.rotateX(Math.PI / 2);
  const coinFace = new CylinderGeometry(0.29, 0.29, 0.092, 40);
  coinFace.rotateX(Math.PI / 2);

  return {
    geometry: {
      medkitCase: new RoundedBoxGeometry(0.78, 0.48, 0.56, 3, 0.07),
      medkitSeam: new BoxGeometry(0.8, 0.035, 0.58),
      crossLong: new BoxGeometry(0.12, 0.02, 0.4),
      crossShort: new BoxGeometry(0.4, 0.02, 0.12),
      crossSideV: new BoxGeometry(0.1, 0.3, 0.02),
      crossSideH: new BoxGeometry(0.3, 0.1, 0.02),
      handleBar: new BoxGeometry(0.32, 0.045, 0.06),
      handlePost: new BoxGeometry(0.045, 0.08, 0.06),
      latch: new BoxGeometry(0.08, 0.1, 0.03),
      coinDisc,
      coinFace,
      coinRim: new TorusGeometry(0.4, 0.035, 8, 40),
      coinStar: star(5, 0.17, 0.075, 0.03),
      groundRing: new RingGeometry(0.5, 0.6, 48),
    },
    material: {
      medkitShell: new MeshStandardMaterial({ color: "#e8e3d4", roughness: 0.45, metalness: 0.15 }),
      medkitTrim: new MeshStandardMaterial({ color: "#2d3034", roughness: 0.5, metalness: 0.6 }),
      medkitCross: new MeshStandardMaterial({
        color: "#ff3030",
        emissive: new Color("#ff1a1a"),
        emissiveIntensity: 1.6,
        roughness: 0.35,
      }),
      gold: new MeshStandardMaterial({
        color: "#ffcb45",
        metalness: 1,
        roughness: 0.24,
        emissive: new Color("#8a5c00"),
        emissiveIntensity: 0.45,
      }),
      goldDeep: new MeshStandardMaterial({
        color: "#d79b1c",
        metalness: 1,
        roughness: 0.35,
        emissive: new Color("#5c3a00"),
        emissiveIntensity: 0.35,
      }),
      healthRing: new MeshBasicMaterial({
        color: new Color("#ff5050"),
        transparent: true,
        opacity: 0.32,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
      }),
      coinRing: new MeshBasicMaterial({
        color: new Color("#ffd54a"),
        transparent: true,
        opacity: 0.32,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
      }),
    },
  };
}

export function getPickupAssets() {
  if (!assets) assets = build();
  return assets;
}
