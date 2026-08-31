import { type MutableRefObject, type RefObject } from "react";
import TrackAssembly from "./TrackAssembly";
import { Box, Cylinder, Sphere } from "@react-three/drei";
import { Group } from "three";
import { EMPLACEMENT_MATS as E, ENEMY_TANK_MATS as T } from "./tankMaterials";

interface EnemyCombatMeshProps {
  variant: "tank" | "turret";
  turretRef: RefObject<Group>;
  trackSpinRef?: MutableRefObject<number>;
}

const EnemyTankHull = ({
  turretRef,
  trackSpinRef,
}: {
  turretRef: RefObject<Group>;
  trackSpinRef?: MutableRefObject<number>;
}) => (
  <>
    <Box args={[1.45, 0.28, 1.95]} position={[0, -0.08, 0]} material={T.hullDark} castShadow receiveShadow />
    <Box args={[1.52, 0.28, 1.85]} position={[0, 0.14, -0.04]} material={T.hull} castShadow receiveShadow />
    <Box
      args={[1.48, 0.18, 0.5]}
      position={[0, 0.06, 0.88]}
      rotation={[-0.38, 0, 0]}
      material={T.hull}
      castShadow
    />
    <Box args={[1.2, 0.08, 0.22]} position={[0, 0.18, 0.98]} material={T.hazard} />
    <Box args={[0.16, 0.1, 0.7]} position={[-0.35, 0.22, 0.85]} rotation={[-0.2, 0, 0]} material={T.hullDark} />
    <Box args={[0.16, 0.1, 0.7]} position={[0.35, 0.22, 0.85]} rotation={[-0.2, 0, 0]} material={T.hullDark} />

    <Box args={[0.08, 0.24, 2.05]} position={[-0.78, -0.02, 0]} material={T.hullDark} castShadow />
    <Box args={[0.08, 0.24, 2.05]} position={[0.78, -0.02, 0]} material={T.hullDark} castShadow />
    <Box args={[0.36, 0.14, 0.28]} position={[-0.48, 0.3, -0.7]} material={T.hullDark} />
    <Box args={[0.36, 0.14, 0.28]} position={[0.48, 0.3, -0.7]} material={T.hullDark} />
    <Box args={[0.1, 0.06, 0.04]} position={[-0.5, 0.06, 1.08]} material={T.light} />
    <Box args={[0.1, 0.06, 0.04]} position={[0.5, 0.06, 1.08]} material={T.light} />

    <TrackAssembly
      side={-1}
      x={0.72}
      y={-0.3}
      length={2.2}
      roadWheels={4}
      spinRef={trackSpinRef}
      belt={T.rubber}
      wheel={T.wheel}
      rim={T.rim}
      metal={T.metal}
    />
    <TrackAssembly
      side={1}
      x={0.72}
      y={-0.3}
      length={2.2}
      roadWheels={4}
      spinRef={trackSpinRef}
      belt={T.rubber}
      wheel={T.wheel}
      rim={T.rim}
      metal={T.metal}
    />

    <group position={[0, 0.25, 0]} ref={turretRef}>
      <Cylinder args={[0.5, 0.5, 0.14, 12]} position={[0, 0.07, 0]} material={T.metal} castShadow />
      <Cylinder args={[0.62, 0.72, 0.4, 10]} position={[0, 0.22, 0]} material={T.turret} castShadow />
      <Box args={[0.95, 0.22, 0.42]} position={[0, 0.2, 0.38]} material={T.turret} castShadow />
      <Box args={[0.7, 0.24, 0.4]} position={[0, 0.22, -0.42]} material={T.turret} castShadow />
      <Cylinder args={[0.28, 0.28, 0.1, 10]} position={[0, 0.46, -0.18]} material={T.hullDark} castShadow />
      <Box args={[0.22, 0.28, 0.75]} position={[-0.58, 0.2, 0]} material={T.turret} castShadow />
      <Box args={[0.22, 0.28, 0.75]} position={[0.58, 0.2, 0]} material={T.turret} castShadow />
      <Box args={[0.18, 0.1, 0.1]} position={[0, 0.4, 0.42]} material={T.optic} />
      <Sphere args={[0.1, 10, 10]} position={[0, 0.5, 0.12]} material={T.optic} />

      <Cylinder args={[0.14, 0.16, 0.28, 10]} position={[0, 0.2, 0.55]} rotation={[Math.PI / 2, 0, 0]} material={T.metal} />
      <Cylinder args={[0.1, 0.1, 1.5, 10]} position={[0, 0.2, 1]} rotation={[Math.PI / 2, 0, 0]} material={T.barrel} castShadow />
      <Cylinder args={[0.12, 0.12, 0.08, 8]} position={[0, 0.2, 0.7]} rotation={[Math.PI / 2, 0, 0]} material={T.metal} />
      <Cylinder args={[0.12, 0.12, 0.08, 8]} position={[0, 0.2, 1.2]} rotation={[Math.PI / 2, 0, 0]} material={T.metal} />
      <Cylinder args={[0.15, 0.15, 0.2, 10]} position={[0, 0.2, 1.85]} rotation={[Math.PI / 2, 0, 0]} material={T.metal} castShadow />
      <Cylinder args={[0.02, 0.02, 0.9, 6]} position={[0.28, 0.62, -0.28]} material={T.metal} />
    </group>
  </>
);

const EnemyEmplacement = ({ turretRef }: { turretRef: RefObject<Group> }) => (
  <>
    <Cylinder args={[1.05, 1.15, 0.22, 8]} position={[0, -0.28, 0]} material={E.concrete} castShadow receiveShadow />
    <Box args={[1.75, 0.55, 1.75]} position={[0, 0.05, 0]} material={E.hull} castShadow receiveShadow />
    <Box args={[1.85, 0.12, 1.85]} position={[0, -0.18, 0]} material={E.concrete} castShadow />
    {[-0.7, 0.7].map((x) =>
      [-0.7, 0.7].map((z) => (
        <Box
          key={`leg-${x}-${z}`}
          args={[0.22, 0.18, 0.22]}
          position={[x, -0.38, z]}
          material={E.steel}
          castShadow
        />
      ))
    )}
    <Box args={[1.4, 0.08, 0.18]} position={[0, 0.28, 0.82]} material={E.hazard} />
    <Box args={[0.18, 0.22, 0.18]} position={[-0.7, 0.28, -0.7]} material={E.steel} />
    <Box args={[0.18, 0.22, 0.18]} position={[0.7, 0.28, -0.7]} material={E.steel} />

    <group position={[0, 0.35, 0]} ref={turretRef}>
      <Cylinder args={[0.62, 0.62, 0.18, 12]} position={[0, 0.08, 0]} material={E.steel} castShadow />
      <Cylinder args={[0.72, 0.82, 0.48, 10]} position={[0, 0.22, 0]} material={E.hull} castShadow />
      <Box args={[1.05, 0.26, 0.5]} position={[0, 0.2, 0.42]} material={E.accent} castShadow />
      <Box args={[0.85, 0.28, 0.45]} position={[0, 0.22, -0.48]} material={E.hull} castShadow />
      <Cylinder args={[0.3, 0.3, 0.1, 10]} position={[0, 0.5, -0.18]} material={E.steel} />
      <Box args={[0.22, 0.28, 0.8]} position={[-0.68, 0.2, 0]} material={E.hull} castShadow />
      <Box args={[0.22, 0.28, 0.8]} position={[0.68, 0.2, 0]} material={E.hull} castShadow />
      <Box args={[0.2, 0.1, 0.1]} position={[0, 0.42, 0.52]} material={E.optic} />
      <Sphere args={[0.11, 10, 10]} position={[0, 0.52, 0.1]} material={E.optic} />

      <Cylinder args={[0.16, 0.18, 0.3, 10]} position={[0, 0.2, 0.62]} rotation={[Math.PI / 2, 0, 0]} material={E.steel} />
      <Cylinder args={[0.12, 0.12, 2, 10]} position={[0, 0.2, 1.2]} rotation={[Math.PI / 2, 0, 0]} material={E.barrel} castShadow />
      <Cylinder args={[0.14, 0.14, 0.1, 8]} position={[0, 0.2, 0.7]} rotation={[Math.PI / 2, 0, 0]} material={E.steel} />
      <Cylinder args={[0.14, 0.14, 0.1, 8]} position={[0, 0.2, 1.4]} rotation={[Math.PI / 2, 0, 0]} material={E.steel} />
      <Cylinder args={[0.18, 0.18, 0.25, 10]} position={[0, 0.2, 2.35]} rotation={[Math.PI / 2, 0, 0]} material={E.steel} castShadow />
    </group>
  </>
);

const EnemyCombatMesh = ({ variant, turretRef, trackSpinRef }: EnemyCombatMeshProps) => {
  if (variant === "turret") {
    return <EnemyEmplacement turretRef={turretRef} />;
  }
  return <EnemyTankHull turretRef={turretRef} trackSpinRef={trackSpinRef} />;
};

export default EnemyCombatMesh;
