import { useRef, type MutableRefObject, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import TrackAssembly from "./TrackAssembly";
import { Box, Cylinder, Sphere } from "@react-three/drei";
import { Group } from "three";
import {
  EMPLACEMENT_MATS as E,
  ENEMY_TANK_MATS as T,
  ENEMY_TRIM_MATS as X,
} from "./tankMaterials";
import GlowSprite from "../fx/GlowSprite";

interface EnemyCombatMeshProps {
  variant: "tank" | "turret";
  turretRef: RefObject<Group>;
  trackSpinRef?: MutableRefObject<number>;
}

/**
 * "Crimson Raider" — angular assault tank. Wedge glacis, reactive-armour side
 * skirts, hexagonal turret with a glowing red sensor visor and a muzzle-braked
 * gun. Footprint (~1.5 x 2.2) and barrel tip (z≈1.75 in turret space) match the
 * original so hitboxes and projectile spawn points are unchanged.
 */
const EnemyTankHull = ({
  turretRef,
  trackSpinRef,
}: {
  turretRef: RefObject<Group>;
  trackSpinRef?: MutableRefObject<number>;
}) => (
  <>
    {/* Lower hull + belly */}
    <Box args={[1.36, 0.26, 1.9]} position={[0, -0.1, 0]} material={T.hullDark} castShadow receiveShadow />
    {/* Upper deck */}
    <Box args={[1.5, 0.24, 1.55]} position={[0, 0.13, -0.16]} material={T.hull} castShadow receiveShadow />
    {/* Wedge glacis, two plates forming a beak */}
    <Box args={[0.78, 0.16, 0.72]} position={[-0.36, 0.08, 0.78]} rotation={[-0.42, 0.22, 0.06]} material={T.hull} castShadow />
    <Box args={[0.78, 0.16, 0.72]} position={[0.36, 0.08, 0.78]} rotation={[-0.42, -0.22, -0.06]} material={T.hull} castShadow />
    {/* Glowing chevron on the nose */}
    <Box args={[0.42, 0.03, 0.06]} position={[-0.17, 0.2, 0.92]} rotation={[-0.42, 0.55, 0]} material={X.redGlow} />
    <Box args={[0.42, 0.03, 0.06]} position={[0.17, 0.2, 0.92]} rotation={[-0.42, -0.55, 0]} material={X.redGlow} />
    {/* Headlights */}
    <Box args={[0.14, 0.06, 0.04]} position={[-0.55, 0.0, 1.0]} material={T.light} />
    <Box args={[0.14, 0.06, 0.04]} position={[0.55, 0.0, 1.0]} material={T.light} />

    {/* Side skirts with ERA tiles */}
    {[-1, 1].map((s) => (
      <group key={`skirt-${s}`}>
        <Box args={[0.07, 0.3, 2.0]} position={[s * 0.8, -0.04, 0]} material={T.hullDark} castShadow />
        {[-0.72, -0.24, 0.24, 0.72].map((z) => (
          <Box
            key={`era-${s}-${z}`}
            args={[0.06, 0.2, 0.42]}
            position={[s * 0.85, -0.02, z]}
            rotation={[0, 0, s * 0.08]}
            material={X.era}
            castShadow
          />
        ))}
      </group>
    ))}

    {/* Engine deck: grille + exhaust glow */}
    {[-0.25, -0.1, 0.05, 0.2].map((x) => (
      <Box key={`grille-${x}`} args={[0.08, 0.04, 0.5]} position={[x, 0.27, -0.66]} material={X.gunmetal} />
    ))}
    <Box args={[0.22, 0.12, 0.2]} position={[-0.5, 0.3, -0.78]} material={X.gunmetal} />
    <Box args={[0.22, 0.12, 0.2]} position={[0.5, 0.3, -0.78]} material={X.gunmetal} />
    <Box args={[0.5, 0.04, 0.04]} position={[0, 0.06, -0.98]} material={X.redGlow} />
    <GlowSprite color="#ff3a20" size={0.55} opacity={0.5} position={[0, 0.08, -1.05]} />

    <TrackAssembly side={-1} x={0.72} y={-0.3} length={2.2} roadWheels={4} spinRef={trackSpinRef} belt={T.rubber} wheel={T.wheel} rim={T.rim} metal={T.metal} />
    <TrackAssembly side={1} x={0.72} y={-0.3} length={2.2} roadWheels={4} spinRef={trackSpinRef} belt={T.rubber} wheel={T.wheel} rim={T.rim} metal={T.metal} />

    <group position={[0, 0.25, 0]} ref={turretRef}>
      {/* Turret ring */}
      <Cylinder args={[0.5, 0.54, 0.12, 14]} position={[0, 0.06, 0]} material={T.metal} castShadow />
      {/* Hexagonal turret body */}
      <Cylinder args={[0.6, 0.7, 0.34, 6]} position={[0, 0.25, -0.05]} rotation={[0, Math.PI / 6, 0]} material={T.turret} castShadow />
      {/* Angled cheek armour */}
      <Box args={[0.42, 0.3, 0.5]} position={[-0.32, 0.24, 0.36]} rotation={[0, 0.5, 0]} material={T.turret} castShadow />
      <Box args={[0.42, 0.3, 0.5]} position={[0.32, 0.24, 0.36]} rotation={[0, -0.5, 0]} material={T.turret} castShadow />
      {/* Bustle */}
      <Box args={[0.78, 0.26, 0.42]} position={[0, 0.24, -0.62]} material={T.turret} castShadow />
      <Box args={[0.82, 0.06, 0.08]} position={[0, 0.3, -0.85]} material={X.gunmetal} />
      {/* Sensor visor (glowing slit) */}
      <Box args={[0.62, 0.05, 0.05]} position={[0, 0.36, 0.5]} material={X.redGlow} />
      {/* Commander cupola + optic */}
      <Cylinder args={[0.18, 0.2, 0.14, 8]} position={[0.22, 0.48, -0.22]} material={T.hullDark} castShadow />
      <Sphere args={[0.08, 10, 10]} position={[0.22, 0.58, -0.15]} material={T.optic} />
      {/* Smoke launchers */}
      {[-1, 1].map((s) =>
        [0, 1].map((i) => (
          <Cylinder
            key={`smoke-${s}-${i}`}
            args={[0.045, 0.045, 0.16, 6]}
            position={[s * (0.5 + i * 0.07), 0.38, 0.12 - i * 0.1]}
            rotation={[Math.PI / 2.6, 0, 0]}
            material={X.gunmetal}
          />
        ))
      )}
      {/* Whip antenna with beacon */}
      <Cylinder args={[0.015, 0.02, 0.95, 5]} position={[-0.3, 0.86, -0.55]} material={T.metal} />
      <Sphere args={[0.04, 6, 6]} position={[-0.3, 1.34, -0.55]} material={X.redGlow} />

      {/* Mantlet + gun */}
      <Box args={[0.36, 0.26, 0.22]} position={[0, 0.2, 0.62]} material={T.hullDark} castShadow />
      <Cylinder args={[0.1, 0.11, 1.2, 12]} position={[0, 0.2, 1.1]} rotation={[Math.PI / 2, 0, 0]} material={X.gunmetal} castShadow />
      <Cylinder args={[0.13, 0.13, 0.26, 12]} position={[0, 0.2, 1.1]} rotation={[Math.PI / 2, 0, 0]} material={T.metal} />
      {/* Muzzle brake */}
      <Box args={[0.3, 0.16, 0.22]} position={[0, 0.2, 1.72]} material={T.metal} castShadow />
      <Box args={[0.32, 0.04, 0.05]} position={[0, 0.2, 1.72]} material={X.gunmetal} />
    </group>
  </>
);

/** Slow radar sweep on the bastion — cosmetic only. */
const RadarDish = () => {
  const ref = useRef<Group>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 1.6;
  });
  return (
    <group ref={ref} position={[0, 0.62, -0.5]}>
      <Cylinder args={[0.03, 0.03, 0.26, 6]} position={[0, 0.13, 0]} material={E.steel} />
      <Cylinder args={[0.24, 0.06, 0.08, 10]} position={[0, 0.3, 0.04]} rotation={[Math.PI / 2.4, 0, 0]} material={X.dish} />
      <Sphere args={[0.035, 6, 6]} position={[0, 0.33, 0.16]} material={X.blueGlow} />
    </group>
  );
};

/**
 * "Bastion" — fortified blue emplacement. Octagonal concrete pad ringed with
 * sandbags, armoured dome with a cyan sensor band, twin linked cannons and a
 * sweeping radar dish. Projectile spawn (z≈2.2) is unchanged.
 */
const EnemyEmplacement = ({ turretRef }: { turretRef: RefObject<Group> }) => (
  <>
    <Cylinder args={[1.05, 1.18, 0.24, 8]} position={[0, -0.28, 0]} rotation={[0, Math.PI / 8, 0]} material={E.concrete} castShadow receiveShadow />
    {/* Sandbag ring */}
    {Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return (
        <Box
          key={`bag-${i}`}
          args={[0.46, 0.18, 0.24]}
          position={[Math.sin(a) * 0.98, -0.08, Math.cos(a) * 0.98]}
          rotation={[0, a, 0]}
          material={X.sandbag}
          castShadow
        />
      );
    })}
    {/* Armoured base */}
    <Cylinder args={[0.78, 0.9, 0.5, 8]} position={[0, 0.05, 0]} rotation={[0, Math.PI / 8, 0]} material={E.hull} castShadow receiveShadow />
    <Cylinder args={[0.8, 0.8, 0.05, 16]} position={[0, 0.3, 0]} material={X.blueGlow} />
    {/* Hazard stripes on the four faces */}
    {[0, 1, 2, 3].map((i) => (
      <Box
        key={`haz-${i}`}
        args={[0.5, 0.07, 0.04]}
        position={[Math.sin((i * Math.PI) / 2) * 0.84, -0.08, Math.cos((i * Math.PI) / 2) * 0.84]}
        rotation={[0, (i * Math.PI) / 2, 0]}
        material={E.hazard}
      />
    ))}

    <group position={[0, 0.35, 0]} ref={turretRef}>
      <Cylinder args={[0.6, 0.64, 0.14, 14]} position={[0, 0.06, 0]} material={E.steel} castShadow />
      {/* Dome */}
      <Sphere args={[0.62, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} position={[0, 0.12, -0.05]} material={E.hull} castShadow />
      {/* Sensor band */}
      <Box args={[0.7, 0.07, 0.06]} position={[0, 0.38, 0.47]} material={X.blueGlow} />
      <Sphere args={[0.1, 10, 10]} position={[0, 0.5, 0.3]} material={E.optic} />
      {/* Gun housing */}
      <Box args={[0.78, 0.32, 0.5]} position={[0, 0.22, 0.5]} material={E.accent} castShadow />
      <Box args={[0.84, 0.06, 0.54]} position={[0, 0.4, 0.5]} material={E.steel} />
      <RadarDish />
      {/* Twin cannons */}
      {[-0.17, 0.17].map((x) => (
        <group key={`gun-${x}`}>
          <Cylinder args={[0.08, 0.09, 1.55, 10]} position={[x, 0.2, 1.4]} rotation={[Math.PI / 2, 0, 0]} material={E.barrel} castShadow />
          <Cylinder args={[0.1, 0.1, 0.12, 10]} position={[x, 0.2, 1.0]} rotation={[Math.PI / 2, 0, 0]} material={E.steel} />
          <Cylinder args={[0.11, 0.11, 0.22, 10]} position={[x, 0.2, 2.15]} rotation={[Math.PI / 2, 0, 0]} material={E.steel} castShadow />
          <Cylinder args={[0.06, 0.06, 0.03, 10]} position={[x, 0.2, 2.27]} rotation={[Math.PI / 2, 0, 0]} material={X.blueGlow} />
        </group>
      ))}
      <Box args={[0.42, 0.06, 0.1]} position={[0, 0.2, 1.7]} material={E.steel} />
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
