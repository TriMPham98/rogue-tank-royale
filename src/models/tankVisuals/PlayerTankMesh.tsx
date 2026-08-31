import { useEffect, useMemo, useRef, type MutableRefObject, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Box, Cylinder, Sphere } from "@react-three/drei";
import { Group, PointLight } from "three";
import TrackAssembly from "./TrackAssembly";
import {
  PLAYER_TANK_MATS as M,
  createBrakeLightMaterial,
  createMuzzleFlashMaterial,
} from "./tankMaterials";

interface PlayerTankMeshProps {
  turretRef: RefObject<Group>;
  isFirstPerson: boolean;
  isBraking: boolean;
  trackSpinRef: MutableRefObject<number>;
  muzzleFlashRef: MutableRefObject<number>;
}

const PlayerTankMesh = ({
  turretRef,
  isFirstPerson,
  isBraking,
  trackSpinRef,
  muzzleFlashRef,
}: PlayerTankMeshProps) => {
  const brakeMat = useMemo(() => createBrakeLightMaterial(), []);
  const flashMat = useMemo(() => createMuzzleFlashMaterial(), []);
  const opticMat = useMemo(() => M.optic.clone(), []);
  const flashPointRef = useRef<PointLight>(null);

  useEffect(() => {
    brakeMat.emissiveIntensity = isBraking ? 3.4 : 0.4;
  }, [isBraking, brakeMat]);

  useFrame((state, delta) => {
    const pulse = 0.7 + Math.sin(state.clock.elapsedTime * 3.2) * 0.35;
    opticMat.emissiveIntensity = pulse;
    if (muzzleFlashRef.current > 0) {
      muzzleFlashRef.current = Math.max(0, muzzleFlashRef.current - delta * 8);
    }
    const f = muzzleFlashRef.current;
    flashMat.emissiveIntensity = f * 6;
    flashMat.opacity = f * 0.85;
    if (flashPointRef.current) {
      flashPointRef.current.intensity = f * 5;
    }
  });

  return (
    <>
      {/* Lower / upper hull */}
      <Box args={[1.62, 0.36, 2.12]} position={[0, -0.08, 0]} material={M.hullDark} castShadow receiveShadow />
      <Box args={[1.78, 0.3, 1.95]} position={[0, 0.2, -0.04]} material={M.hull} castShadow receiveShadow />

      {/* Glacis and nose */}
      <Box
        args={[1.72, 0.2, 0.58]}
        position={[0, 0.1, 0.98]}
        rotation={[-0.42, 0, 0]}
        material={M.hull}
        castShadow
        receiveShadow
      />
      <Box args={[1.5, 0.16, 0.28]} position={[0, -0.04, 1.14]} material={M.hullDark} castShadow />
      <Box args={[1.2, 0.06, 0.18]} position={[0, 0.22, 1.12]} material={M.hullLight} castShadow />

      {/* Rear engine deck */}
      <Box
        args={[1.55, 0.22, 0.52]}
        position={[0, 0.26, -0.98]}
        rotation={[0.22, 0, 0]}
        material={M.hull}
        castShadow
      />
      <Box args={[0.55, 0.04, 0.32]} position={[-0.38, 0.38, -0.92]} material={M.darkMetal} />
      <Box args={[0.55, 0.04, 0.32]} position={[0.38, 0.38, -0.92]} material={M.darkMetal} />
      <Box args={[0.18, 0.08, 0.28]} position={[-0.55, 0.36, -1.18]} material={M.darkMetal} castShadow />
      <Box args={[0.18, 0.08, 0.28]} position={[0.55, 0.36, -1.18]} material={M.darkMetal} castShadow />
      <Cylinder args={[0.06, 0.07, 0.22, 8]} position={[-0.55, 0.42, -1.32]} rotation={[Math.PI / 2.4, 0, 0]} material={M.metal} />
      <Cylinder args={[0.06, 0.07, 0.22, 8]} position={[0.55, 0.42, -1.32]} rotation={[Math.PI / 2.4, 0, 0]} material={M.metal} />

      {/* Side skirts + applique */}
      <Box args={[0.1, 0.3, 2.28]} position={[-0.94, -0.04, 0]} material={M.hullDark} castShadow />
      <Box args={[0.1, 0.3, 2.28]} position={[0.94, -0.04, 0]} material={M.hullDark} castShadow />
      {[-0.7, -0.15, 0.4].map((z) => (
        <Box
          key={`era-l-${z}`}
          args={[0.08, 0.22, 0.42]}
          position={[-0.98, 0.08, z]}
          material={M.hullLight}
          castShadow
        />
      ))}
      {[-0.7, -0.15, 0.4].map((z) => (
        <Box
          key={`era-r-${z}`}
          args={[0.08, 0.22, 0.42]}
          position={[0.98, 0.08, z]}
          material={M.hullLight}
          castShadow
        />
      ))}

      {/* Stowage */}
      <Box args={[0.42, 0.16, 0.28]} position={[-0.58, 0.38, -0.55]} material={M.hullDark} castShadow />
      <Box args={[0.42, 0.16, 0.28]} position={[0.58, 0.38, -0.55]} material={M.hullDark} castShadow />

      {/* Headlights */}
      <Box args={[0.16, 0.1, 0.06]} position={[-0.58, 0.08, 1.2]} material={M.darkMetal} castShadow />
      <Box args={[0.16, 0.1, 0.06]} position={[0.58, 0.08, 1.2]} material={M.darkMetal} castShadow />
      <Box args={[0.12, 0.07, 0.04]} position={[-0.58, 0.08, 1.24]} material={M.headlight} />
      <Box args={[0.12, 0.07, 0.04]} position={[0.58, 0.08, 1.24]} material={M.headlight} />
      <pointLight position={[-0.58, 0.1, 1.3]} color="#ffe08a" intensity={0.28} distance={5} decay={2} />
      <pointLight position={[0.58, 0.1, 1.3]} color="#ffe08a" intensity={0.28} distance={5} decay={2} />

      {/* Taillights */}
      <Box args={[0.14, 0.08, 0.05]} position={[-0.72, 0.1, -1.18]} material={brakeMat} />
      <Box args={[0.14, 0.08, 0.05]} position={[0.72, 0.1, -1.18]} material={brakeMat} />

      <TrackAssembly
        side={-1}
        spinRef={trackSpinRef}
        belt={M.rubber}
        wheel={M.wheel}
        rim={M.rim}
        metal={M.metal}
      />
      <TrackAssembly
        side={1}
        spinRef={trackSpinRef}
        belt={M.rubber}
        wheel={M.wheel}
        rim={M.rim}
        metal={M.metal}
      />

      <group position={[0, 0.5, 0]} ref={turretRef}>
        {!isFirstPerson && (
          <>
            <Cylinder args={[0.62, 0.62, 0.12, 16]} position={[0, 0.06, 0]} material={M.metal} castShadow />
            <Cylinder args={[0.72, 0.82, 0.46, 12]} position={[0, 0.28, -0.04]} material={M.turret} castShadow />
            <Box args={[1.15, 0.28, 0.55]} position={[0, 0.26, 0.42]} material={M.turret} castShadow />
            <Box args={[0.95, 0.32, 0.55]} position={[0, 0.28, -0.55]} material={M.turret} castShadow />
            <Box args={[0.7, 0.08, 0.4]} position={[0, 0.48, -0.62]} material={M.hullDark} />
            <Box args={[0.55, 0.28, 0.22]} position={[0, 0.26, 0.72]} material={M.hullDark} castShadow />

            <Box args={[0.28, 0.32, 0.95]} position={[-0.7, 0.26, 0]} material={M.turret} castShadow />
            <Box args={[0.28, 0.32, 0.95]} position={[0.7, 0.26, 0]} material={M.turret} castShadow />

            <Cylinder args={[0.22, 0.22, 0.14, 12]} position={[0.12, 0.58, -0.18]} material={M.hullDark} castShadow />
            <Cylinder args={[0.16, 0.16, 0.05, 10]} position={[0.12, 0.66, -0.18]} material={M.metal} />
            <Box args={[0.18, 0.06, 0.16]} position={[0.12, 0.64, -0.02]} material={M.glass} />

            {/* Smoke grenade banks */}
            {[-0.18, 0, 0.18].map((z) => (
              <Cylinder
                key={`sg-l-${z}`}
                args={[0.035, 0.04, 0.12, 6]}
                position={[-0.62, 0.42, 0.28 + z]}
                rotation={[0.7, 0, -0.4]}
                material={M.darkMetal}
              />
            ))}
            {[-0.18, 0, 0.18].map((z) => (
              <Cylinder
                key={`sg-r-${z}`}
                args={[0.035, 0.04, 0.12, 6]}
                position={[0.62, 0.42, 0.28 + z]}
                rotation={[0.7, 0, 0.4]}
                material={M.darkMetal}
              />
            ))}

            <Box args={[0.22, 0.12, 0.14]} position={[0, 0.4, 0.55]} material={M.darkMetal} castShadow />
            <Sphere args={[0.13, 14, 14]} position={[0, 0.58, 0.18]} material={opticMat} castShadow />
          </>
        )}

        {/* Cannon — keep muzzle at z=2 so shot spawn stays aligned */}
        <Cylinder args={[0.16, 0.18, 0.35, 12]} position={[0, 0.25, 0.62]} rotation={[Math.PI / 2, 0, 0]} material={M.darkMetal} castShadow />
        <Cylinder args={[0.12, 0.12, 1.8, 12]} position={[0, 0.25, 1.1]} rotation={[Math.PI / 2, 0, 0]} material={M.barrel} castShadow />
        <Cylinder args={[0.135, 0.135, 0.08, 10]} position={[0, 0.25, 0.7]} rotation={[Math.PI / 2, 0, 0]} material={M.metal} />
        <Cylinder args={[0.135, 0.135, 0.08, 10]} position={[0, 0.25, 1.15]} rotation={[Math.PI / 2, 0, 0]} material={M.metal} />
        <Cylinder args={[0.135, 0.135, 0.08, 10]} position={[0, 0.25, 1.55]} rotation={[Math.PI / 2, 0, 0]} material={M.metal} />
        <Cylinder args={[0.06, 0.06, 0.9, 8]} position={[0.14, 0.36, 1.0]} rotation={[Math.PI / 2, 0, 0]} material={M.metal} />
        <Cylinder args={[0.18, 0.18, 0.3, 12]} position={[0, 0.25, 2]} rotation={[Math.PI / 2, 0, 0]} material={M.darkMetal} castShadow />
        <Cylinder args={[0.14, 0.2, 0.12, 10]} position={[0, 0.25, 2.16]} rotation={[Math.PI / 2, 0, 0]} material={M.darkMetal} />

        <Sphere args={[0.16, 10, 10]} position={[0, 0.25, 2.28]} material={flashMat} />
        <pointLight ref={flashPointRef} position={[0, 0.25, 2.3]} color="#ffc14a" intensity={0} distance={5} />

        {/* Coax + antenna */}
        <Cylinder args={[0.03, 0.03, 0.7, 6]} position={[0.22, 0.18, 0.95]} rotation={[Math.PI / 2, 0, 0]} material={M.darkMetal} />
        <Cylinder args={[0.045, 0.045, 0.16, 8]} position={[0.4, 0.52, -0.38]} material={M.darkMetal} />
        <Cylinder args={[0.018, 0.012, 1.05, 6]} position={[0.4, 1.05, -0.38]} material={M.metal} />

        {isFirstPerson && (
          <group position={[0, 0.25, 3.5]}>
            <Box args={[0.3, 0.02, 0.02]}>
              <meshStandardMaterial
                color="#00ff00"
                emissive="#00ff00"
                emissiveIntensity={1.5}
                transparent
                opacity={0.9}
              />
            </Box>
            <Box args={[0.02, 0.3, 0.02]}>
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
