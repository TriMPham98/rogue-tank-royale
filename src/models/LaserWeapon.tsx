// src/components/LaserWeapon.tsx
import { useRef, useEffect, useState } from "react";
import { Group } from "three";
import { debug } from "../utils/debug";
import LaserBeam from "./LaserBeam";
import { useWeaponTracking } from "../utils/weaponTracking";
import { WeaponInstance } from "../utils/weapons";
import { LaserModel } from "./weaponVisuals/WeaponModels";
import { WEAPON_ACCENTS, hexToNumber } from "./weaponVisuals/weaponMaterials";
import { fx } from "./fx/fxSystem";

// --- UPDATED PROPS INTERFACE ---
interface LaserWeaponProps {
  weaponInstance: WeaponInstance;
  position: [number, number, number];
  rotation: number;
}

const LaserWeapon = ({
  weaponInstance,
  position,
  rotation,
}: LaserWeaponProps) => {
  const laserRef = useRef<Group>(null);
  const [isBeamActive, setIsBeamActive] = useState(false);
  const firingDurationRef = useRef(0);

  const { damage: laserDamage, instanceId = "default_laser" } = weaponInstance;

  const DAMAGE_TICK_RATE = 0.1;

  // Use the shared weapon tracking logic and get enhanced range
  const { targetEnemyRef, weaponRange } = useWeaponTracking({
    weaponInstance,
    position,
    rotation,
    weaponRef: laserRef as React.RefObject<Group>,
    barrelLength: 1.5,
    onFire: (firePosition, targetId) => {
      setIsBeamActive(true);
      const yaw = laserRef.current?.rotation.y ?? rotation;
      fx.muzzle(
        firePosition[0],
        firePosition[1],
        firePosition[2],
        Math.sin(yaw),
        Math.cos(yaw),
        hexToNumber(WEAPON_ACCENTS.laser),
        0.8
      );
      firingDurationRef.current = 0;
      debug.log(`Laser ${instanceId} started firing at enemy ${targetId}`);
    },
  });

  // --- Calculate Beam Start Position ---
  const beamStartPosition = (): [number, number, number] => {
    if (!laserRef.current) return [0, 0, 0];

    const weaponPos = laserRef.current.position;
    const weaponRot = laserRef.current.rotation.y;
    const emitterOffset = 1.5;

    return [
      weaponPos.x + Math.sin(weaponRot) * emitterOffset,
      weaponPos.y,
      weaponPos.z + Math.cos(weaponRot) * emitterOffset,
    ];
  };

  // --- Lifecycle Logging ---
  useEffect(() => {
    debug.log(`Laser weapon instance ${instanceId} mounted.`);
    return () => {
      debug.log(`Laser weapon instance ${instanceId} unmounted`);
    };
  }, [instanceId]);

  return (
    <>
      {/* Laser weapon model */}
      <group ref={laserRef}>
        <LaserModel active={isBeamActive} />
      </group>

      {/* Render laser beam when active */}
      {isBeamActive && targetEnemyRef.current && (
        <LaserBeam
          startPosition={beamStartPosition()}
          targetId={targetEnemyRef.current}
          damage={laserDamage * DAMAGE_TICK_RATE}
          range={weaponRange}
          color={WEAPON_ACCENTS.laser}
        />
      )}
    </>
  );
};

export default LaserWeapon;
