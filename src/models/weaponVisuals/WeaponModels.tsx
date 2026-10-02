/**
 * Secondary weapon drone pods. Local +Z is the firing direction; muzzle
 * positions match the barrelLength / fireOffsetY each weapon passes to
 * useWeaponTracking so shots leave the visible barrel.
 */
import { useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Material, MeshStandardMaterial, Sprite } from "three";
import GlowSprite from "../fx/GlowSprite";
import { createGlowMaterial } from "../fx/glowMaterials";
import { fx, FX_COLORS } from "../fx/fxSystem";
import { WEAPON_ACCENTS as A, WEAPON_MATS as W, getAccentMaterial } from "./weaponMaterials";

type V3 = [number, number, number];
const ALONG_Z: V3 = [Math.PI / 2, 0, 0];

const Box = ({ s, p, r, m, shadow = true }: { s: V3; p?: V3; r?: V3; m: Material; shadow?: boolean }) => (
  <mesh position={p} rotation={r} material={m} castShadow={shadow}>
    <boxGeometry args={s} />
  </mesh>
);

const Cyl = ({
  a,
  p,
  r,
  m,
  shadow = true,
}: {
  a: [number, number, number, number?];
  p?: V3;
  r?: V3;
  m: Material;
  shadow?: boolean;
}) => (
  <mesh position={p} rotation={r} material={m} castShadow={shadow}>
    <cylinderGeometry args={[a[0], a[1], a[2], a[3] ?? 12]} />
  </mesh>
);

const Ring = ({ a, p, r, m }: { a: [number, number]; p?: V3; r?: V3; m: Material }) => (
  <mesh position={p} rotation={r} material={m}>
    <torusGeometry args={[a[0], a[1], 8, 28]} />
  </mesh>
);

/** Hover base + slow bob shared by every pod. */
export const WeaponPod = ({ accent, children }: { accent: string; children: ReactNode }) => {
  const bobRef = useRef<Group>(null);
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  const ringMat = getAccentMaterial(accent, 2.2);

  useFrame(({ clock }) => {
    if (bobRef.current) {
      bobRef.current.position.y = Math.sin(clock.elapsedTime * 2.2 + phase) * 0.035;
    }
  });

  return (
    <group ref={bobRef}>
      <group position={[0, -0.3, 0]}>
        <Cyl a={[0.24, 0.3, 0.07, 16]} m={W.darkMetal} />
        <Ring a={[0.27, 0.02]} r={[Math.PI / 2, 0, 0]} p={[0, -0.02, 0]} m={ringMat} />
        <GlowSprite color={accent} size={1.1} opacity={0.3} position={[0, -0.12, 0]} />
      </group>
      {children}
    </group>
  );
};

// ---------------------------------------------------------------------------

export const MortarModel = () => {
  const glow = getAccentMaterial(A.rocket, 2.4);
  return (
    <WeaponPod accent={A.rocket}>
      {/* Yoke + trunnions */}
      <Cyl a={[0.18, 0.22, 0.14, 12]} p={[0, -0.2, 0.05]} m={W.darkMetal} />
      <Box s={[0.1, 0.3, 0.22]} p={[-0.31, -0.04, 0.12]} m={W.armorDark} />
      <Box s={[0.1, 0.3, 0.22]} p={[0.31, -0.04, 0.12]} m={W.armorDark} />
      {/* Breech box */}
      <Box s={[0.52, 0.4, 0.62]} p={[0, 0.04, 0.18]} m={W.armor} />
      <Box s={[0.54, 0.06, 0.64]} p={[0, 0.26, 0.18]} m={W.armorDark} />
      <Box s={[0.53, 0.07, 0.12]} p={[0, -0.08, 0.46]} m={W.hazard} />
      <Box s={[0.02, 0.08, 0.22]} p={[0.27, 0.1, 0.16]} m={glow} shadow={false} />
      <Box s={[0.02, 0.08, 0.22]} p={[-0.27, 0.1, 0.16]} m={glow} shadow={false} />
      {/* Twin launch tubes */}
      {[-0.13, 0.13].map((x) => (
        <group key={x} position={[x, 0.05, 0]}>
          <Cyl a={[0.1, 0.1, 1.1, 14]} p={[0, 0, 1.0]} r={ALONG_Z} m={W.darkMetal} />
          <Cyl a={[0.118, 0.118, 0.07, 14]} p={[0, 0, 0.7]} r={ALONG_Z} m={W.metal} />
          <Cyl a={[0.118, 0.118, 0.07, 14]} p={[0, 0, 1.2]} r={ALONG_Z} m={W.metal} />
          <Cyl a={[0.125, 0.112, 0.1, 14]} p={[0, 0, 1.52]} r={ALONG_Z} m={W.barrel} />
          <Cyl a={[0.07, 0.07, 0.02, 12]} p={[0, 0, 1.56]} r={ALONG_Z} m={glow} shadow={false} />
        </group>
      ))}
    </WeaponPod>
  );
};

// ---------------------------------------------------------------------------

export const LaserModel = ({ active }: { active: boolean }) => {
  const coilMat = useMemo(() => getAccentMaterial(A.laser, 1.2).clone() as MeshStandardMaterial, []);
  const lensGlow = useMemo(() => createGlowMaterial(A.laser, 0.6), []);
  const glowRef = useRef<Sprite>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const charge = active ? 2.2 + Math.sin(t * 9) * 0.8 : 0.9 + Math.sin(t * 2) * 0.2;
    coilMat.emissiveIntensity = charge;
    lensGlow.opacity = active ? 0.75 + Math.sin(t * 13) * 0.2 : 0.35;
    if (glowRef.current) glowRef.current.scale.setScalar(active ? 0.9 : 0.55);
  });

  return (
    <WeaponPod accent={A.laser}>
      <Box s={[0.34, 0.3, 0.62]} p={[0, 0, 0.05]} m={W.darkMetal} />
      <Box s={[0.06, 0.26, 0.5]} p={[-0.2, 0, 0.05]} m={W.armor} />
      <Box s={[0.06, 0.26, 0.5]} p={[0.2, 0, 0.05]} m={W.armor} />
      <Box s={[0.18, 0.1, 0.32]} p={[0, 0.2, -0.02]} m={W.armorDark} />
      <Box s={[0.14, 0.02, 0.28]} p={[0, 0.26, -0.02]} m={coilMat} shadow={false} />
      <Cyl a={[0.07, 0.07, 1.05, 12]} p={[0, 0, 0.88]} r={ALONG_Z} m={W.barrel} />
      {[0.42, 0.52, 0.62, 0.72].map((z) => (
        <Cyl key={z} a={[0.15, 0.15, 0.03, 16]} p={[0, 0, z]} r={ALONG_Z} m={W.metal} />
      ))}
      {[0.95, 1.1, 1.25].map((z) => (
        <Ring key={z} a={[0.1, 0.028]} p={[0, 0, z]} m={coilMat} />
      ))}
      <Cyl a={[0.08, 0.11, 0.14, 14]} p={[0, 0, 1.42]} r={ALONG_Z} m={W.darkMetal} />
      <mesh position={[0, 0, 1.5]} material={coilMat}>
        <sphereGeometry args={[0.06, 12, 10]} />
      </mesh>
      <GlowSprite ref={glowRef} color={A.laser} size={0.6} position={[0, 0, 1.53]} material={lensGlow} />
    </WeaponPod>
  );
};

// ---------------------------------------------------------------------------

export const ShotgunModel = () => {
  const glow = getAccentMaterial(A.shotgun, 1.8);
  return (
    <WeaponPod accent={A.shotgun}>
      <Box s={[0.34, 0.3, 0.6]} p={[0, 0, 0.12]} m={W.armor} />
      <Box s={[0.1, 0.05, 0.5]} p={[0, 0.175, 0.1]} m={W.darkMetal} />
      <Cyl a={[0.17, 0.17, 0.2, 18]} p={[0, -0.17, 0.08]} r={[0, 0, Math.PI / 2]} m={W.darkMetal} />
      <Cyl a={[0.176, 0.176, 0.05, 18]} p={[0, -0.17, 0.08]} r={[0, 0, Math.PI / 2]} m={W.hazard} />
      <Box s={[0.26, 0.16, 0.5]} p={[0, 0, 0.64]} m={W.armorDark} />
      {[0.5, 0.64, 0.78].map((z) => (
        <Box key={z} s={[0.27, 0.04, 0.06]} p={[0, 0.03, z]} m={W.darkMetal} shadow={false} />
      ))}
      {[-0.065, 0.065].map((x) => (
        <group key={x}>
          <Cyl a={[0.055, 0.055, 0.78, 12]} p={[x, 0, 0.78]} r={ALONG_Z} m={W.barrel} />
          <Cyl a={[0.07, 0.07, 0.07, 12]} p={[x, 0, 1.165]} r={ALONG_Z} m={W.darkMetal} />
        </group>
      ))}
      <Box s={[0.02, 0.06, 0.14]} p={[0.175, 0.02, 0.1]} m={glow} shadow={false} />
      <Box s={[0.02, 0.06, 0.14]} p={[-0.175, 0.02, 0.1]} m={glow} shadow={false} />
    </WeaponPod>
  );
};

// ---------------------------------------------------------------------------

const laserSightMaterial = new MeshStandardMaterial({
  color: "#ff2a2a",
  emissive: "#ff2a2a",
  emissiveIntensity: 2,
  transparent: true,
  opacity: 0.35,
  depthWrite: false,
  toneMapped: false,
});

export const SniperModel = () => {
  const glow = getAccentMaterial(A.sniper, 2);
  return (
    <WeaponPod accent={A.sniper}>
      <Box s={[0.2, 0.22, 0.8]} p={[0, 0, 0.1]} m={W.armor} />
      <Box s={[0.16, 0.18, 0.3]} p={[0, -0.02, -0.42]} r={[0.12, 0, 0]} m={W.armorDark} />
      <Box s={[0.12, 0.12, 0.5]} p={[0, 0, 0.7]} m={W.darkMetal} />
      <Cyl a={[0.045, 0.045, 1.25, 10]} p={[0, 0, 1.15]} r={ALONG_Z} m={W.barrel} />
      <Box s={[0.13, 0.09, 0.2]} p={[0, 0, 1.9]} m={W.darkMetal} />
      <Box s={[0.14, 0.02, 0.05]} p={[0, 0.02, 1.88]} m={W.barrel} shadow={false} />
      <Box s={[0.14, 0.02, 0.05]} p={[0, -0.02, 1.88]} m={W.barrel} shadow={false} />
      {/* Scope */}
      <Cyl a={[0.055, 0.055, 0.5, 12]} p={[0, 0.2, 0.15]} r={ALONG_Z} m={W.darkMetal} />
      <Cyl a={[0.068, 0.06, 0.08, 12]} p={[0, 0.2, 0.42]} r={ALONG_Z} m={W.darkMetal} />
      <Cyl a={[0.05, 0.05, 0.02, 12]} p={[0, 0.2, 0.465]} r={ALONG_Z} m={glow} shadow={false} />
      <Box s={[0.05, 0.09, 0.05]} p={[0, 0.13, 0.0]} m={W.metal} />
      <Box s={[0.05, 0.09, 0.05]} p={[0, 0.13, 0.3]} m={W.metal} />
      {/* Capacitor strips */}
      <Box s={[0.02, 0.05, 0.5]} p={[0.105, 0.02, 0.1]} m={glow} shadow={false} />
      <Box s={[0.02, 0.05, 0.5]} p={[-0.105, 0.02, 0.1]} m={glow} shadow={false} />
      {/* Folded bipod */}
      <Box s={[0.02, 0.02, 0.38]} p={[0.04, -0.07, 1.3]} r={[0.08, 0, 0]} m={W.darkMetal} />
      <Box s={[0.02, 0.02, 0.38]} p={[-0.04, -0.07, 1.3]} r={[0.08, 0, 0]} m={W.darkMetal} />
      {/* Laser designator */}
      <Box s={[0.035, 0.035, 0.1]} p={[0, 0.08, 1.75]} m={W.darkMetal} />
      <mesh position={[0, 0.08, 3.8]} material={laserSightMaterial} renderOrder={5}>
        <boxGeometry args={[0.008, 0.008, 4]} />
      </mesh>
    </WeaponPod>
  );
};

// ---------------------------------------------------------------------------

export const TeslaModel = ({ getWorldPosition }: { getWorldPosition: () => V3 | null }) => {
  const coreGlow = useMemo(() => createGlowMaterial(A.tesla, 0.7), []);
  const coreMat = useMemo(() => getAccentMaterial(A.tesla, 2.5).clone() as MeshStandardMaterial, []);
  const crackleRef = useRef(0.4);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const flicker = 0.75 + Math.sin(t * 31) * 0.12 + Math.sin(t * 17.3) * 0.13;
    coreGlow.opacity = flicker * 0.75;
    coreMat.emissiveIntensity = 1.8 + flicker * 1.5;

    // Idle crackle around the crown
    crackleRef.current -= delta;
    if (crackleRef.current <= 0) {
      crackleRef.current = 0.25 + Math.random() * 0.5;
      const at = getWorldPosition();
      if (at) {
        const a = Math.random() * Math.PI * 2;
        fx.zap(at[0] + Math.cos(a) * 0.22, at[1] + 0.7, at[2] + Math.sin(a) * 0.22, FX_COLORS.tesla, 0.35);
      }
    }
  });

  return (
    <WeaponPod accent={A.tesla}>
      <Cyl a={[0.28, 0.31, 0.14, 6]} p={[0, -0.12, 0]} m={W.darkMetal} />
      <Cyl a={[0.22, 0.25, 0.08, 6]} p={[0, -0.02, 0]} m={W.armor} />
      {[0.06, 0.13, 0.2].map((y, i) => (
        <Cyl key={y} a={[0.15 - i * 0.02, 0.15 - i * 0.02, 0.045, 16]} p={[0, y, 0]} m={W.ceramic} />
      ))}
      <Cyl a={[0.1, 0.11, 0.34, 16]} p={[0, 0.4, 0]} m={W.copper} />
      {[0.26, 0.32, 0.38, 0.44, 0.5, 0.56].map((y) => (
        <Ring key={y} a={[0.112, 0.012]} p={[0, y, 0]} r={[Math.PI / 2, 0, 0]} m={W.copperBright} />
      ))}
      <Cyl a={[0.07, 0.08, 0.07, 12]} p={[0, 0.61, 0]} m={W.ceramic} />
      <mesh position={[0, 0.7, 0]} rotation={[Math.PI / 2, 0, 0]} material={W.chrome} castShadow>
        <torusGeometry args={[0.2, 0.065, 12, 32]} />
      </mesh>
      <mesh position={[0, 0.7, 0]} material={coreMat}>
        <sphereGeometry args={[0.085, 14, 12]} />
      </mesh>
      <GlowSprite color={A.tesla} size={1.1} position={[0, 0.7, 0]} material={coreGlow} />
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.25, 0.2, 0]} rotation={[0, 0, -s * 0.12]}>
          <Cyl a={[0.018, 0.022, 0.55, 6]} p={[0, 0, 0]} m={W.metal} />
          <mesh position={[0, 0.3, 0]} material={W.chrome}>
            <sphereGeometry args={[0.04, 10, 8]} />
          </mesh>
        </group>
      ))}
    </WeaponPod>
  );
};
