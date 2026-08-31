import { type Ref } from "react";
import { Box, Cylinder, Sphere } from "@react-three/drei";
import { MeshStandardMaterial } from "three";
import { BOMBER_MATS as B } from "./tankMaterials";

interface BomberMeshProps {
  flashMaterialRef: Ref<MeshStandardMaterial>;
}

const BomberMesh = ({ flashMaterialRef }: BomberMeshProps) => {
  const baseR = 1.2;
  const baseBottomR = 1.4;
  const baseH = 0.3;

  return (
    <>
      <Cylinder args={[baseR, baseBottomR, baseH, 10]} position={[0, baseH / 2, 0]} material={B.body} castShadow receiveShadow />
      <Cylinder args={[0.95, 1.05, 0.12, 10]} position={[0, 0.34, 0]} material={B.dark} />
      <Cylinder args={[1.15, 1.28, 0.08, 10]} position={[0, 0.06, 0]} material={B.stripe} />

      <Box args={[0.72, 0.28, 0.72]} position={[0, 0.48, 0.05]} rotation={[0, Math.PI / 4, 0]} material={B.gold} castShadow />
      <Sphere args={[0.22, 12, 12]} position={[0, 0.62, 0.08]} material={B.glass} />
      <Box args={[0.5, 0.04, 0.12]} position={[0, 0.4, 0.42]} material={B.stripe} />

      <Cylinder
        args={[0.22, 0.28, 0.55, 8]}
        position={[0, 0.22, -baseR * 0.78]}
        rotation={[Math.PI / 2, 0, 0]}
        material={B.dark}
        castShadow
      />
      <Cylinder
        args={[0.16, 0.2, 0.18, 8]}
        position={[0, 0.22, -baseR * 1.05]}
        rotation={[Math.PI / 2, 0, 0]}
        material={B.thruster}
      />
      <pointLight position={[0, 0.22, -1.35]} color="#ff5500" intensity={1.2} distance={4} />

      <Box args={[0.18, 0.42, 0.95]} position={[baseR * 0.82, 0.28, 0.05]} rotation={[0, 0, Math.PI / 7]} material={B.body} castShadow />
      <Box args={[0.18, 0.42, 0.95]} position={[-baseR * 0.82, 0.28, 0.05]} rotation={[0, 0, -Math.PI / 7]} material={B.body} castShadow />
      <Box args={[0.12, 0.22, 0.4]} position={[baseR * 0.95, 0.42, -0.15]} rotation={[0.2, 0, Math.PI / 7]} material={B.stripe} />
      <Box args={[0.12, 0.22, 0.4]} position={[-baseR * 0.95, 0.42, -0.15]} rotation={[0.2, 0, -Math.PI / 7]} material={B.stripe} />

      <Cylinder args={[0.1, 0.12, 0.22, 6]} position={[0.45, 0.12, 0.85]} rotation={[1.1, 0, 0]} material={B.dark} />
      <Cylinder args={[0.1, 0.12, 0.22, 6]} position={[-0.45, 0.12, 0.85]} rotation={[1.1, 0, 0]} material={B.dark} />
      <Cylinder args={[0.07, 0.09, 0.1, 6]} position={[0.45, 0.02, 0.96]} rotation={[1.1, 0, 0]} material={B.thruster} />
      <Cylinder args={[0.07, 0.09, 0.1, 6]} position={[-0.45, 0.02, 0.96]} rotation={[1.1, 0, 0]} material={B.thruster} />

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
