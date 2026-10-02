// src/components/RocketLauncher.tsx
import { useRef, useEffect, useState } from "react";
import { Group } from "three";
import { useGameState, SecondaryWeapon } from "../utils/gameState";
import { debug } from "../utils/debug";
import RocketProjectile from "./RocketProjectile";
import { useWeaponTracking } from "../utils/weaponTracking";
import { MortarModel } from "./weaponVisuals/WeaponModels";
import { WEAPON_ACCENTS, hexToNumber } from "./weaponVisuals/weaponMaterials";
import { fx } from "./fx/fxSystem";

interface RocketLauncherProps {
  weaponInstance: SecondaryWeapon;
  position: [number, number, number];
  rotation: number;
}

const RocketLauncher = ({
  weaponInstance,
  position,
  rotation,
}: RocketLauncherProps) => {
  const launcherRef = useRef<Group>(null);
  // Changed from useRef to useState
  const [activeProjectiles, setActiveProjectiles] = useState<
    {
      id: string;
      position: [number, number, number];
      rotation: number;
      targetId: string | null;
    }[]
  >([]);

  const onFire = (
    firePosition: [number, number, number],
    targetId: string | null
  ) => {
    const projectileId = Math.random().toString(36).substring(2, 9);
    const newProjectile = {
      id: projectileId,
      position: firePosition,
      rotation: launcherRef.current?.rotation.y ?? 0,
      targetId: targetId,
    };
    // Use setActiveProjectiles to update the state
    setActiveProjectiles((prev) => [...prev, newProjectile]);
    fx.muzzle(
      firePosition[0],
      firePosition[1],
      firePosition[2],
      Math.sin(newProjectile.rotation),
      Math.cos(newProjectile.rotation),
      hexToNumber(WEAPON_ACCENTS.rocket),
      1.3
    );
    debug.log(`Rocket fired: ${projectileId}`);
  };

  // Use the shared weapon tracking logic
  const { instanceId } = useWeaponTracking({
    weaponInstance,
    position,
    rotation,
    weaponRef: launcherRef as React.RefObject<Group>,
    barrelLength: 1.6, // Slightly adjusted barrel length
    fireOffsetY: 0.05, // Adjusted fire offset
    onFire: onFire, // Pass the callback
  });

  const removeProjectile = (id: string) => {
    setActiveProjectiles((prev) => prev.filter((p) => p.id !== id));
    debug.log(`Rocket projectile ${id} removed from active list.`);
  };

  useEffect(() => {
    debug.log(`Rocket launcher instance ${instanceId} mounted.`);
    return () => {
      debug.log(`Rocket launcher instance ${instanceId} unmounted`);
      // Clear projectiles associated with this specific launcher on unmount
      setActiveProjectiles([]); // Clear the local list
    };
  }, [instanceId]); // Dependency array ensures this runs once per instance

  return (
    <>
      {/* Launcher Model Group */}
      <group ref={launcherRef}>
        <MortarModel />
      </group>

      {/* Render Active Projectiles */}
      {activeProjectiles.map((projectile) => (
        <RocketProjectile
          key={projectile.id}
          id={projectile.id}
          position={projectile.position}
          rotation={projectile.rotation}
          damage={
            weaponInstance.damage *
            (1 + useGameState.getState().playerTurretDamage / 10)
          }
          targetId={projectile.targetId}
          onRemove={removeProjectile}
        />
      ))}
    </>
  );
};

export default RocketLauncher;
