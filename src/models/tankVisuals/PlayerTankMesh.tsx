import { useEffect, useMemo, useRef, type MutableRefObject, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Box } from "@react-three/drei";
import { Group, MeshStandardMaterial, PointLight } from "three";
import TrackAssembly from "./TrackAssembly";
import {
  PLAYER_TANK_MATS as M,
  createBrakeLightMaterial,
  createMuzzleFlashMaterial,
} from "./tankMaterials";
import {
  BARREL_RECOIL,
  GUN_AXIS_Y,
  MUZZLE_Z,
  PLAYER_TANK_PARTS,
  TRACK,
  TURRET_OFFSET,
  type PartGroup,
  type TankMatKey,
  type TankPart,
} from "./playerTankParts";

interface PlayerTankMeshProps {
  turretRef: RefObject<Group>;
  isFirstPerson: boolean;
  isBraking: boolean;
  trackSpinRef: MutableRefObject<number>;
  muzzleFlashRef: MutableRefObject<number>;
  /** 1 on fire, decays to 0; drives the barrel slide-back */
  recoilRef: MutableRefObject<number>;
}

const partsIn = (group: PartGroup) => PLAYER_TANK_PARTS.filter((p) => p.group === group);
const HULL_PARTS = partsIn("hull");
const TURRET_PARTS = partsIn("turret");
const BARREL_PARTS = partsIn("barrel");

const PartMesh = ({ part, material }: { part: TankPart; material: MeshStandardMaterial }) => (
  <mesh
    position={part.pos}
    rotation={part.rot ?? [0, 0, 0]}
    material={material}
    castShadow={part.shadow}
    receiveShadow={part.shadow}>
    {part.kind === "box" ? (
      <boxGeometry args={part.size} />
    ) : (
      <cylinderGeometry args={[part.rTop, part.rBottom, part.h, part.seg]} />
    )}
  </mesh>
);

const PlayerTankMesh = ({
  turretRef,
  isFirstPerson,
  isBraking,
  trackSpinRef,
  muzzleFlashRef,
  recoilRef,
}: PlayerTankMeshProps) => {
  const barrelRef = useRef<Group>(null);
  const periHeadRef = useRef<Group>(null);
  const brakeMat = useMemo(() => createBrakeLightMaterial(), []);
  const flashMat = useMemo(() => createMuzzleFlashMaterial(), []);
  const opticMat = useMemo(() => M.optic.clone(), []);
  const flashPointRef = useRef<PointLight>(null);

  const materialFor = (key: TankMatKey): MeshStandardMaterial => {
    if (key === "optic") return opticMat;
    if (key === "brake") return brakeMat;
    if (key === "flash") return flashMat;
    return M[key];
  };

  useEffect(() => {
    brakeMat.emissiveIntensity = isBraking ? 3.4 : 0.4;
  }, [isBraking, brakeMat]);

  useEffect(
    () => () => {
      brakeMat.dispose();
      flashMat.dispose();
      opticMat.dispose();
    },
    [brakeMat, flashMat, opticMat]
  );

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    opticMat.emissiveIntensity = 0.7 + Math.sin(t * 3.2) * 0.35;
    if (muzzleFlashRef.current > 0) {
      muzzleFlashRef.current = Math.max(0, muzzleFlashRef.current - delta * 8);
    }
    const f = muzzleFlashRef.current;
    flashMat.emissiveIntensity = f * 6;
    flashMat.opacity = f * 0.85;
    if (flashPointRef.current) {
      flashPointRef.current.intensity = f * 5;
    }

    // Barrel slams back on the shot, then runs out again on the recuperator
    if (recoilRef.current > 0) {
      recoilRef.current = Math.max(0, recoilRef.current - delta * 3.2);
    }
    if (barrelRef.current) {
      const r = recoilRef.current;
      barrelRef.current.position.z = -BARREL_RECOIL * r * r;
    }

    // Commander's panoramic sight scans slowly
    if (periHeadRef.current) {
      periHeadRef.current.rotation.y = Math.sin(t * 0.4) * 1.2;
    }
  });

  // The panoramic sight head + lens rotate together about the mast
  const periMast = TURRET_PARTS.find((p) => p.id === "periMast")!;
  const isPeriHead = (p: TankPart) => p.id === "periHead" || p.id === "periLens";

  return (
    <>
      {HULL_PARTS.map((p) => (
        <PartMesh key={p.id} part={p} material={materialFor(p.mat)} />
      ))}
      <pointLight position={[-0.62, 0.03, 1.38]} color="#ffe08a" intensity={0.28} distance={5} decay={2} />
      <pointLight position={[0.62, 0.03, 1.38]} color="#ffe08a" intensity={0.28} distance={5} decay={2} />

      <TrackAssembly
        side={-1}
        x={TRACK.x}
        y={TRACK.y}
        length={TRACK.length}
        roadWheels={TRACK.roadWheels}
        spinRef={trackSpinRef}
        belt={M.rubber}
        wheel={M.wheel}
        rim={M.rim}
        metal={M.metal}
      />
      <TrackAssembly
        side={1}
        x={TRACK.x}
        y={TRACK.y}
        length={TRACK.length}
        roadWheels={TRACK.roadWheels}
        spinRef={trackSpinRef}
        belt={M.rubber}
        wheel={M.wheel}
        rim={M.rim}
        metal={M.metal}
      />

      <group position={TURRET_OFFSET} ref={turretRef}>
        {TURRET_PARTS.filter((p) => !isPeriHead(p) && !(isFirstPerson && p.hideInFpv)).map((p) => (
          <PartMesh key={p.id} part={p} material={materialFor(p.mat)} />
        ))}
        {!isFirstPerson && (
          <group ref={periHeadRef} position={[periMast.pos[0], 0, periMast.pos[2]]}>
            {TURRET_PARTS.filter(isPeriHead).map((p) => (
              <PartMesh
                key={p.id}
                part={{ ...p, pos: [p.pos[0] - periMast.pos[0], p.pos[1], p.pos[2] - periMast.pos[2]] }}
                material={materialFor(p.mat)}
              />
            ))}
          </group>
        )}

        <group ref={barrelRef}>
          {BARREL_PARTS.map((p) => (
            <PartMesh key={p.id} part={p} material={materialFor(p.mat)} />
          ))}
          <mesh position={[0, GUN_AXIS_Y, MUZZLE_Z + 0.06]} material={flashMat}>
            <sphereGeometry args={[0.18, 10, 10]} />
          </mesh>
          <pointLight
            ref={flashPointRef}
            position={[0, GUN_AXIS_Y, MUZZLE_Z + 0.1]}
            color="#ffc14a"
            intensity={0}
            distance={5}
          />
        </group>

        {isFirstPerson && (
          <group position={[0, GUN_AXIS_Y, 3.6]}>
            <Box args={[0.3, 0.02, 0.02]}>
              <meshStandardMaterial
                color="#00ff00"
                emissive="#00ff00"
                emissiveIntensity={1.5}
                transparent
                opacity={0.9}
              />
            </Box>
            {/* Thinner in depth so its faces never coincide with the horizontal bar */}
            <Box args={[0.02, 0.3, 0.016]}>
              <meshStandardMaterial
                color="#00ff00"
                emissive="#00ff00"
                emissiveIntensity={1.5}
                transparent
                opacity={0.9}
              />
            </Box>
          </group>
        )}
      </group>
    </>
  );
};

export default PlayerTankMesh;
