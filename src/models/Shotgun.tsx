// src/components/Shotgun.tsx
import React, { useRef, useEffect, FC } from "react";
import { Group } from "three";
import { debug } from "../utils/debug";
import ShotgunPellet from "./ShotgunPellet";
import { useWeaponTracking } from "../utils/weaponTracking";
import { SecondaryWeapon } from "../utils/gameState";
import { ShotgunModel } from "./weaponVisuals/WeaponModels";
import { WEAPON_ACCENTS, hexToNumber } from "./weaponVisuals/weaponMaterials";
import { fx } from "./fx/fxSystem";

interface ShotgunProps {
  weaponInstance: SecondaryWeapon;
  position: [number, number, number];
  rotation: number;
}

interface PelletData {
  id: string;
  position: [number, number, number];
  rotation: number;
  damage: number;
  speed: number;
  range: number;
  ttl: number;
}

const Shotgun: FC<ShotgunProps> = ({ weaponInstance, position, rotation }) => {
  const shotgunRef = useRef<Group>(null);
  const projectilesRef = useRef<PelletData[]>([]);

  const {
    projectileSpeed,
    damage: damagePerShot,
    instanceId = "default_shotgun",
  } = weaponInstance;

  const PELLET_COUNT: number = 5;
  const SPREAD_ANGLE: number = 0.25;
  const damagePerPellet: number = damagePerShot / PELLET_COUNT;

  // Get enhanced weapon range from weapon tracking
  const { weaponRange } = useWeaponTracking({
    weaponInstance,
    position,
    rotation,
    weaponRef: shotgunRef as React.RefObject<Group>,
    barrelLength: 1.2, // Approximate end of the barrels
    onFire: (firePosition) => {
      debug.log(`Firing from position: ${firePosition}`);
      const currentRotation = shotgunRef.current?.rotation.y ?? rotation;
      fx.muzzle(
        firePosition[0],
        firePosition[1],
        firePosition[2],
        Math.sin(currentRotation),
        Math.cos(currentRotation),
        hexToNumber(WEAPON_ACCENTS.shotgun),
        1.25
      );

      // Calculate TTL using enhanced range
      const projectileTTL: number = weaponRange / projectileSpeed;

      for (let i = 0; i < PELLET_COUNT; i++) {
        const spreadOffset = (Math.random() - 0.5) * SPREAD_ANGLE;
        const pelletRotation = currentRotation + spreadOffset;
        const projectileId = `${instanceId}-pellet-${performance.now()}-${i}`;

        const newPelletData: PelletData = {
          id: projectileId,
          position: firePosition,
          rotation: pelletRotation,
          damage: damagePerPellet,
          speed: projectileSpeed,
          range: weaponRange, // Use enhanced range
          ttl: projectileTTL,
        };
        projectilesRef.current.push(newPelletData);
      }
    },
  });

  const removeProjectile = (id: string): void => {
    projectilesRef.current = projectilesRef.current.filter((p) => p.id !== id);
  };

  useEffect(() => {
    debug.log(`Shotgun instance ${instanceId} mounted.`);
    return () => {
      debug.log(`Shotgun instance ${instanceId} unmounted`);
    };
  }, [instanceId]);

  return (
    <>
      <group ref={shotgunRef}>
        <ShotgunModel />
      </group>

      {projectilesRef.current.map((pelletData: PelletData) => (
        <ShotgunPellet
          key={pelletData.id}
          id={pelletData.id}
          position={pelletData.position}
          rotation={pelletData.rotation}
          damage={pelletData.damage}
          speed={pelletData.speed}
          range={pelletData.range}
          ttl={pelletData.ttl}
          onRemove={removeProjectile}
        />
      ))}
    </>
  );
};

export default Shotgun;
