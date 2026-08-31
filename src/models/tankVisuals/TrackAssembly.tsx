import { useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Box, Cylinder } from "@react-three/drei";
import { Group, MeshStandardMaterial } from "three";

interface TrackAssemblyProps {
  side: 1 | -1;
  x?: number;
  y?: number;
  length?: number;
  roadWheels?: number;
  spinRef?: MutableRefObject<number>;
  belt: MeshStandardMaterial;
  wheel: MeshStandardMaterial;
  rim: MeshStandardMaterial;
  metal: MeshStandardMaterial;
}

const TrackAssembly = ({
  side,
  x = 0.88,
  y = -0.32,
  length = 2.42,
  roadWheels = 5,
  spinRef,
  belt,
  wheel,
  rim,
  metal,
}: TrackAssemblyProps) => {
  const wheelsRef = useRef<Group>(null);
  const px = side * x;
  const half = length * 0.5;
  const sprocketZ = half - 0.16;
  const idlerZ = -half + 0.16;
  const wheelSpan = sprocketZ - idlerZ - 0.42;
  const firstZ = idlerZ + 0.21;

  useFrame(() => {
    if (!wheelsRef.current || !spinRef) return;
    const spin = spinRef.current;
    for (const child of wheelsRef.current.children) {
      const spinner = child.children[0];
      if (spinner) spinner.rotation.y = spin * side;
    }
  });

  return (
    <group>
      <Box
        args={[0.4, 0.34, length]}
        position={[px, y, 0]}
        material={belt}
        castShadow
        receiveShadow
      />
      <Box
        args={[0.42, 0.08, length + 0.04]}
        position={[px, y - 0.18, 0]}
        material={belt}
        castShadow
      />
      <Box
        args={[0.16, 0.1, length - 0.12]}
        position={[px, y + 0.2, 0]}
        material={metal}
        castShadow
      />
      {Array.from({ length: 9 }, (_, i) => (
        <Box
          key={`pad-${side}-${i}`}
          args={[0.44, 0.05, 0.14]}
          position={[px, y - 0.2, -half + 0.2 + i * ((length - 0.28) / 8)]}
          material={belt}
          castShadow
        />
      ))}

      <group ref={wheelsRef}>
        <group position={[px, y, sprocketZ]} rotation={[0, 0, Math.PI / 2]}>
          <group>
            <Cylinder args={[0.17, 0.17, 0.16, 10]} material={wheel} castShadow />
            <Cylinder args={[0.1, 0.1, 0.18, 8]} material={rim} />
          </group>
        </group>
        <group position={[px, y, idlerZ]} rotation={[0, 0, Math.PI / 2]}>
          <group>
            <Cylinder args={[0.15, 0.15, 0.14, 10]} material={wheel} castShadow />
            <Cylinder args={[0.08, 0.08, 0.16, 8]} material={rim} />
          </group>
        </group>
        {Array.from({ length: roadWheels }, (_, i) => {
          const z = firstZ + (i + 0.5) * (wheelSpan / roadWheels);
          return (
            <group
              key={`rw-${side}-${i}`}
              position={[px, y - 0.02, z]}
              rotation={[0, 0, Math.PI / 2]}>
              <group>
                <Cylinder args={[0.135, 0.135, 0.14, 10]} material={wheel} castShadow />
                <Cylinder args={[0.07, 0.07, 0.16, 8]} material={rim} />
              </group>
            </group>
          );
        })}
      </group>
    </group>
  );
};

export default TrackAssembly;
