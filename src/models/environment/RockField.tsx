/**
 * All terrain obstacles rendered as instanced boulder clusters
 * (one draw call per rock variant instead of three boxes per obstacle).
 * Footprints stay within the gameplay collision radius (size * 0.75).
 */
import { useLayoutEffect, useMemo, useRef } from "react";
import { InstancedMesh, Object3D } from "three";
import type { ObstacleData } from "../../types/index";
import { getRockGeometry, getRockMaterial, ROCK_VARIANTS } from "./rockGeometry";
import { hashString, seededRandom } from "./noise";

interface RockPiece {
  variant: number;
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  rx: number;
  ry: number;
  rz: number;
}

function buildRockPieces(obstacles: ObstacleData[]): RockPiece[] {
  const pieces: RockPiece[] = [];
  for (const o of obstacles) {
    const rand = seededRandom(hashString(o.id));
    const size = o.size;
    const [ox, , oz] = o.position;
    const main = Math.floor(rand() * ROCK_VARIANTS);
    const heading = rand() * Math.PI * 2;

    // Main boulder
    pieces.push({
      variant: main,
      x: ox,
      y: 0,
      z: oz,
      sx: size * (0.66 + rand() * 0.1),
      sy: size * (0.85 + rand() * 0.35),
      sz: size * (0.62 + rand() * 0.1),
      rx: (rand() - 0.5) * 0.15,
      ry: heading,
      rz: (rand() - 0.5) * 0.15,
    });

    // Satellite boulders leaning on the main one
    const satellites = 1 + Math.floor(rand() * 2);
    for (let s = 0; s < satellites; s++) {
      const a = heading + (s + 0.5) * ((Math.PI * 2) / satellites) + (rand() - 0.5);
      const d = size * (0.5 + rand() * 0.15);
      const k = size * (0.28 + rand() * 0.14);
      pieces.push({
        variant: (main + 1 + s) % ROCK_VARIANTS,
        x: ox + Math.cos(a) * d,
        y: -0.02,
        z: oz + Math.sin(a) * d,
        sx: k,
        sy: k * (0.9 + rand() * 0.5),
        sz: k,
        rx: (rand() - 0.5) * 0.5,
        ry: rand() * Math.PI * 2,
        rz: (rand() - 0.5) * 0.5,
      });
    }

    // Loose pebbles around the base
    const pebbles = 3 + Math.floor(rand() * 4);
    for (let p = 0; p < pebbles; p++) {
      const a = rand() * Math.PI * 2;
      const d = size * (0.7 + rand() * 0.55);
      const k = 0.07 + rand() * 0.12;
      pieces.push({
        variant: Math.floor(rand() * ROCK_VARIANTS),
        x: ox + Math.cos(a) * d,
        y: -0.01,
        z: oz + Math.sin(a) * d,
        sx: k,
        sy: k * 0.8,
        sz: k,
        rx: rand() * 3,
        ry: rand() * 3,
        rz: rand() * 3,
      });
    }
  }
  return pieces;
}

const RockVariant = ({ variant, pieces }: { variant: number; pieces: RockPiece[] }) => {
  const ref = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => getRockGeometry(variant), [variant]);
  const material = useMemo(() => getRockMaterial(), []);
  const capacity = Math.max(1, pieces.length);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const tmp = new Object3D();
    pieces.forEach((p, i) => {
      tmp.position.set(p.x, p.y, p.z);
      tmp.rotation.set(p.rx, p.ry, p.rz);
      tmp.scale.set(p.sx, p.sy, p.sz);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    });
    mesh.count = pieces.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [pieces]);

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, capacity]}
      castShadow
      receiveShadow
    />
  );
};

const RockField = ({ obstacles }: { obstacles: ObstacleData[] }) => {
  const byVariant = useMemo(() => {
    const groups: RockPiece[][] = Array.from({ length: ROCK_VARIANTS }, () => []);
    for (const piece of buildRockPieces(obstacles)) groups[piece.variant].push(piece);
    return groups;
  }, [obstacles]);

  return (
    <group>
      {byVariant.map((pieces, variant) => (
        <RockVariant
          // Remount when capacity must grow; InstancedMesh cannot resize in place
          key={`rock-${variant}-${pieces.length}`}
          variant={variant}
          pieces={pieces}
        />
      ))}
    </group>
  );
};

export default RockField;
