/**
 * Arena framing: concrete barrier ring at the map edge, blinking warning lamps,
 * corner floodlight towers, tank traps and distant ridges fading into fog.
 * Everything is instanced; none of it participates in collision.
 */
import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ExtrudeGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  Shape,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GAME_CONSTANTS } from "../../constants/game";
import { getRockGeometry, getRockMaterial, ROCK_VARIANTS } from "./rockGeometry";
import { seededRandom } from "./noise";
import GlowSprite from "../fx/GlowSprite";

const EDGE = GAME_CONSTANTS.HALF_MAP_SIZE + 0.7;
const BARRIER_LENGTH = 1.9;
const BARRIER_STEP = 2.05;

interface Placement {
  x: number;
  y: number;
  z: number;
  ry: number;
  sx?: number;
  sy?: number;
  sz?: number;
  rx?: number;
  rz?: number;
}

function createBarrierGeometry(): BufferGeometry {
  const s = new Shape();
  s.moveTo(-0.34, 0);
  s.lineTo(0.34, 0);
  s.lineTo(0.32, 0.09);
  s.lineTo(0.13, 0.32);
  s.lineTo(0.1, 0.82);
  s.lineTo(-0.1, 0.82);
  s.lineTo(-0.13, 0.32);
  s.lineTo(-0.32, 0.09);
  s.closePath();
  const g = new ExtrudeGeometry(s, { depth: BARRIER_LENGTH, bevelEnabled: false });
  g.translate(0, 0, -BARRIER_LENGTH / 2);
  g.computeVertexNormals();
  return g;
}

function createTankTrapGeometry(): BufferGeometry {
  const beam = () => new BoxGeometry(0.14, 1.5, 0.14);
  const a = beam();
  a.rotateZ(Math.PI / 4);
  a.rotateY(Math.PI / 4);
  const b = beam();
  b.rotateZ(-Math.PI / 4);
  b.rotateY(Math.PI / 4);
  const c = beam();
  c.rotateX(Math.PI / 2);
  c.rotateY(Math.PI / 4);
  c.rotateZ(Math.PI / 5);
  const merged = mergeGeometries([a, b, c]) ?? a;
  merged.translate(0, 0.5, 0);
  return merged;
}

function barrierPlacements(): Placement[] {
  const rand = seededRandom(808);
  const out: Placement[] = [];
  const count = Math.floor((EDGE * 2 - 2) / BARRIER_STEP);
  const start = -((count - 1) * BARRIER_STEP) / 2;
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < count; i++) {
      const along = start + i * BARRIER_STEP + (rand() - 0.5) * 0.08;
      const jitter = (rand() - 0.5) * 0.12;
      const yaw = (rand() - 0.5) * 0.05;
      if (side === 0) out.push({ x: EDGE + jitter, y: 0, z: along, ry: yaw });
      if (side === 1) out.push({ x: -EDGE + jitter, y: 0, z: along, ry: yaw });
      if (side === 2) out.push({ x: along, y: 0, z: EDGE + jitter, ry: Math.PI / 2 + yaw });
      if (side === 3) out.push({ x: along, y: 0, z: -EDGE + jitter, ry: Math.PI / 2 + yaw });
    }
  }
  return out;
}

function useInstances(
  ref: React.RefObject<InstancedMesh>,
  placements: Placement[],
  colors?: (i: number) => Color
) {
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const tmp = new Object3D();
    placements.forEach((p, i) => {
      tmp.position.set(p.x, p.y, p.z);
      tmp.rotation.set(p.rx ?? 0, p.ry, p.rz ?? 0);
      tmp.scale.set(p.sx ?? 1, p.sy ?? 1, p.sz ?? 1);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
      if (colors) mesh.setColorAt(i, colors(i));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [ref, placements, colors]);
}

const Barriers = () => {
  const bodyRef = useRef<InstancedMesh>(null);
  const stripeRef = useRef<InstancedMesh>(null);
  const lampRef = useRef<InstancedMesh>(null);

  const placements = useMemo(barrierPlacements, []);
  const stripes = useMemo(
    () =>
      placements.flatMap((p) => {
        const nx = Math.cos(p.ry) * 0.115;
        const nz = -Math.sin(p.ry) * 0.115;
        return [
          { ...p, x: p.x + nx, z: p.z + nz, y: 0.6 },
          { ...p, x: p.x - nx, z: p.z - nz, y: 0.6 },
        ];
      }),
    [placements]
  );
  const lamps = useMemo(
    () => placements.filter((_, i) => i % 6 === 3).map((p) => ({ ...p, y: 0.87 })),
    [placements]
  );

  const geometry = useMemo(createBarrierGeometry, []);
  const stripeGeometry = useMemo(() => new BoxGeometry(0.02, 0.09, BARRIER_LENGTH * 0.86), []);
  const lampGeometry = useMemo(() => new BoxGeometry(0.12, 0.09, 0.12), []);

  const concrete = useMemo(
    () => new MeshStandardMaterial({ color: "#ffffff", roughness: 0.9, metalness: 0.02 }),
    []
  );
  const paint = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#d9a91c",
        emissive: new Color("#6b4f00"),
        emissiveIntensity: 0.35,
        roughness: 0.6,
      }),
    []
  );
  const lamp = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#ff3a2a",
        emissive: new Color("#ff2010"),
        emissiveIntensity: 2,
        toneMapped: false,
      }),
    []
  );

  const concreteTint = useMemo(() => {
    const rand = seededRandom(31);
    const base = new Color("#9b968b");
    const c = new Color();
    return () => c.copy(base).multiplyScalar(0.86 + rand() * 0.22);
  }, []);

  useInstances(bodyRef, placements, concreteTint);
  useInstances(stripeRef, stripes);
  useInstances(lampRef, lamps);

  useFrame(({ clock }) => {
    // Slow beacon blink
    const t = clock.elapsedTime;
    lamp.emissiveIntensity = 0.4 + Math.max(0, Math.sin(t * 2.4)) * 2.6;
  });

  return (
    <>
      <instancedMesh
        ref={bodyRef}
        args={[geometry, concrete, placements.length]}
        castShadow
        receiveShadow
      />
      <instancedMesh ref={stripeRef} args={[stripeGeometry, paint, stripes.length]} />
      <instancedMesh ref={lampRef} args={[lampGeometry, lamp, lamps.length]} />
    </>
  );
};

const TOWER_SPOTS: Array<[number, number]> = [
  [EDGE + 1.6, EDGE + 1.6],
  [-EDGE - 1.6, EDGE + 1.6],
  [EDGE + 1.6, -EDGE - 1.6],
  [-EDGE - 1.6, -EDGE - 1.6],
];

const towerSteel = new MeshStandardMaterial({ color: "#3d4147", roughness: 0.55, metalness: 0.7 });
const towerLamp = new MeshStandardMaterial({
  color: "#fff6d8",
  emissive: new Color("#ffe7a8"),
  emissiveIntensity: 2.2,
  toneMapped: false,
});

const FloodTower = ({ x, z }: { x: number; z: number }) => {
  const yaw = Math.atan2(-x, -z);
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.25, 0]} material={towerSteel} castShadow>
        <boxGeometry args={[0.9, 0.5, 0.9]} />
      </mesh>
      <mesh position={[0, 4.5, 0]} material={towerSteel} castShadow>
        <cylinderGeometry args={[0.1, 0.16, 9, 8]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.35, 2.4, 0]} rotation={[0, 0, s * 0.17]} material={towerSteel}>
          <cylinderGeometry args={[0.04, 0.05, 4.8, 6]} />
        </mesh>
      ))}
      <mesh position={[0, 9, 0.15]} material={towerSteel} castShadow>
        <boxGeometry args={[1.6, 0.12, 0.12]} />
      </mesh>
      {[-0.5, 0, 0.5].map((dx) => (
        <group key={dx} position={[dx, 9.15, 0.3]} rotation={[0.55, 0, 0]}>
          <mesh material={towerSteel}>
            <boxGeometry args={[0.42, 0.32, 0.22]} />
          </mesh>
          <mesh position={[0, 0, 0.115]} material={towerLamp}>
            <boxGeometry args={[0.34, 0.24, 0.02]} />
          </mesh>
          <GlowSprite color="#ffe2a0" size={2.6} opacity={0.55} position={[0, 0, 0.3]} />
        </group>
      ))}
    </group>
  );
};

const TankTraps = () => {
  const ref = useRef<InstancedMesh>(null);
  const geometry = useMemo(createTankTrapGeometry, []);
  const material = useMemo(
    () => new MeshStandardMaterial({ color: "#4a3b2c", roughness: 0.7, metalness: 0.6 }),
    []
  );
  const placements = useMemo(() => {
    const rand = seededRandom(64);
    const out: Placement[] = [];
    for (let i = 0; i < 44; i++) {
      const side = i % 4;
      const along = (rand() - 0.5) * 2 * (EDGE - 4);
      const out1 = EDGE + 2.2 + rand() * 4;
      const x = side === 0 ? out1 : side === 1 ? -out1 : along;
      const z = side === 2 ? out1 : side === 3 ? -out1 : along;
      const k = 0.8 + rand() * 0.4;
      out.push({ x, y: 0, z, ry: rand() * Math.PI, sx: k, sy: k, sz: k, rz: (rand() - 0.5) * 0.3 });
    }
    return out;
  }, []);
  useInstances(ref, placements);
  return <instancedMesh ref={ref} args={[geometry, material, placements.length]} castShadow />;
};

const DistantRidges = () => {
  const rand = useMemo(() => seededRandom(2024), []);
  const groups = useMemo(() => {
    const byVariant: Placement[][] = Array.from({ length: ROCK_VARIANTS }, () => []);
    const count = 56;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.12;
      // Push corners out so the ring hugs the square arena evenly
      const square = 1 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
      const r = (64 + rand() * 30) * Math.min(square, 1.25);
      const w = 7 + rand() * 9;
      byVariant[i % ROCK_VARIANTS].push({
        x: Math.cos(a) * r,
        y: -1.2 - rand() * 1.5,
        z: Math.sin(a) * r,
        ry: rand() * Math.PI * 2,
        sx: w,
        sy: 3 + rand() * 7,
        sz: w * (0.7 + rand() * 0.6),
      });
    }
    return byVariant;
  }, [rand]);

  return (
    <>
      {groups.map((placements, v) => (
        <RidgeVariant key={v} variant={v} placements={placements} />
      ))}
    </>
  );
};

const RidgeVariant = ({ variant, placements }: { variant: number; placements: Placement[] }) => {
  const ref = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => getRockGeometry(variant), [variant]);
  useInstances(ref, placements);
  return (
    <instancedMesh ref={ref} args={[geometry, getRockMaterial(), placements.length]} receiveShadow />
  );
};

const ArenaPerimeter = () => (
  <group>
    <Barriers />
    <TankTraps />
    {TOWER_SPOTS.map(([x, z]) => (
      <FloodTower key={`${x}-${z}`} x={x} z={z} />
    ))}
    <DistantRidges />
  </group>
);

export default ArenaPerimeter;
