import { useRef, type Ref } from "react";
import { useFrame } from "@react-three/fiber";
import { Box, Cylinder, Sphere, Torus } from "@react-three/drei";
import { Group, MeshStandardMaterial } from "three";
import { BOMBER_MATS as B, ENEMY_TRIM_MATS as X } from "./tankMaterials";
import GlowSprite from "../fx/GlowSprite";

interface BomberMeshProps {
  flashMaterialRef: Ref<MeshStandardMaterial>;
}

const ROTOR_OFFSETS: [number, number][] = [
  [0.95, 0.95],
  [-0.95, 0.95],
  [0.95, -0.95],
  [-0.95, -0.95],
].map(([x, z]) => [x * 0.75, z * 0.75]);

/**
 * "Hornet" — quad-rotor suicide drone. Armoured hub with a hazard-striped
 * warhead, four ducted rotors that spin, a glowing amber core and a rear
 * thruster. Stays inside the original 1.2–1.4 radius footprint; the red
 * proximity-flash sphere is unchanged.
 */
const BomberMesh = ({ flashMaterialRef }: BomberMeshProps) => {
  const rotorsRef = useRef<Group>(null);
  const baseR = 1.2;
  const baseH = 0.3;

  useFrame((_, delta) => {
    const g = rotorsRef.current;
    if (!g) return;
    for (let i = 0; i < g.children.length; i++) {
      const blade = g.children[i].children[0];
      if (blade) blade.rotation.y += delta * (i % 2 ? -28 : 28);
    }
  });

  return (
    <>
      {/* Central hub */}
      <Cylinder args={[0.62, 0.72, 0.28, 8]} position={[0, 0.2, 0]} material={B.body} castShadow receiveShadow />
      <Cylinder args={[0.7, 0.7, 0.05, 16]} position={[0, 0.06, 0]} material={B.stripe} />
      {/* Cross arms */}
      <Box args={[2.0, 0.1, 0.18]} position={[0, 0.22, 0]} rotation={[0, Math.PI / 4, 0]} material={B.dark} castShadow />
      <Box args={[2.0, 0.1, 0.18]} position={[0, 0.22, 0]} rotation={[0, -Math.PI / 4, 0]} material={B.dark} castShadow />

      {/* Warhead with hazard bands */}
      <Sphere args={[0.42, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} position={[0, 0.34, 0]} material={B.gold} castShadow />
      <Cylinder args={[0.43, 0.43, 0.06, 16]} position={[0, 0.4, 0]} material={B.dark} />
      <Cylinder args={[0.3, 0.3, 0.05, 16]} position={[0, 0.6, 0]} material={B.stripe} />
      <Sphere args={[0.12, 10, 10]} position={[0, 0.74, 0]} material={X.amberGlow} />
      <GlowSprite color="#ffae2a" size={0.9} opacity={0.55} position={[0, 0.78, 0]} />

      {/* Sensor eye at the front */}
      <Sphere args={[0.14, 12, 12]} position={[0, 0.24, 0.66]} material={B.glass} />
      <Box args={[0.3, 0.04, 0.04]} position={[0, 0.3, 0.7]} material={X.redGlow} />

      {/* Ducted rotors */}
      <group ref={rotorsRef}>
        {ROTOR_OFFSETS.map(([x, z]) => (
          <group key={`rotor-${x}-${z}`} position={[x, 0.3, z]}>
            <group>
              <Box args={[0.66, 0.02, 0.07]} material={X.rotor} />
              <Box args={[0.66, 0.02, 0.07]} rotation={[0, Math.PI / 2, 0]} material={X.rotor} />
            </group>
            <Torus args={[0.36, 0.045, 6, 18]} rotation={[Math.PI / 2, 0, 0]} material={B.body} castShadow />
            <Cylinder args={[0.07, 0.07, 0.1, 8]} position={[0, -0.04, 0]} material={B.dark} />
            <Sphere args={[0.035, 6, 6]} position={[0, -0.04, 0.38]} material={X.redGlow} />
          </group>
        ))}
      </group>

      {/* Rear thruster */}
      <Cylinder args={[0.16, 0.22, 0.36, 8]} position={[0, 0.2, -0.78]} rotation={[Math.PI / 2, 0, 0]} material={B.dark} castShadow />
      <Cylinder args={[0.13, 0.16, 0.1, 8]} position={[0, 0.2, -0.98]} rotation={[Math.PI / 2, 0, 0]} material={B.thruster} />
      <GlowSprite color="#ff6a1a" size={1.2} opacity={0.85} position={[0, 0.2, -1.2]} />

      <Sphere args={[baseR * 1.1, 20, 20]} position={[0, baseH / 2, 0]} renderOrder={1}>
        <meshStandardMaterial
          ref={flashMaterialRef}
          color="red"
          emissive="red"
          emissiveIntensity={0}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </Sphere>
    </>
  );
};

export default BomberMesh;
