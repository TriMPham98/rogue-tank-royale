// src/components/SniperRifle.tsx
import { useRef, useEffect } from "react";
import { Group } from "three";
import { SecondaryWeapon } from "../utils/gameState"; // Adjust path
import { debug } from "../utils/debug";
import SniperProjectile from "./SniperProjectile";
import { useWeaponTracking } from "../utils/weaponTracking";
import { SniperModel } from "./weaponVisuals/WeaponModels";
import { WEAPON_ACCENTS, hexToNumber } from "./weaponVisuals/weaponMaterials";
import { fx } from "./fx/fxSystem";

// --- UPDATED PROPS INTERFACE ---
interface SniperRifleProps {
  weaponInstance: SecondaryWeapon;
  position: [number, number, number]; // Receive absolute position
  rotation: number; // Receive base rotation
}

const SniperRifle = ({
  weaponInstance,
  position,
  rotation,
}: SniperRifleProps) => {
  const rifleRef = useRef<Group>(null);
  const projectilesRef = useRef<
    {
      id: string;
      position: [number, number, number];
      rotation: number;
      targetId: string | null; // Keep targetId if SniperProjectile uses it for guidance/initial velocity
      // Add damage if SniperProjectile needs it directly
      damage: number;
      penetrationPower: number; // Add penetration power property
    }[]
  >([]);

  // Use the shared weapon tracking logic
  const { instanceId } = useWeaponTracking({
    weaponInstance,
    position,
    rotation,
    weaponRef: rifleRef as React.RefObject<Group>,
    barrelLength: 2.0, // Adjusted slightly based on model changes
    onFire: (firePosition, targetId, damage) => {
      const projectileId = Math.random().toString(36).substr(2, 9);
      const yaw = rifleRef.current?.rotation.y ?? 0;
      fx.muzzle(
        firePosition[0],
        firePosition[1],
        firePosition[2],
        Math.sin(yaw),
        Math.cos(yaw),
        hexToNumber(WEAPON_ACCENTS.sniper),
        1.2
      );

      // Sniper rifles have penetration power to hit multiple targets in a row
      const penetrationPower = 3; // Can penetrate up to 3 enemies

      projectilesRef.current.push({
        id: projectileId,
        position: firePosition,
        rotation: rifleRef.current?.rotation.y ?? 0,
        targetId: targetId,
        damage: damage,
        penetrationPower: penetrationPower,
      });

      debug.log(`Fired sniper shot with penetration power ${penetrationPower}`);
    },
  });

  const removeProjectile = (id: string) => {
    projectilesRef.current = projectilesRef.current.filter((p) => p.id !== id);
  };

  // --- Lifecycle Logging ---
  useEffect(() => {
    debug.log(`Sniper rifle instance ${instanceId} mounted.`);
    return () => {
      debug.log(`Sniper rifle instance ${instanceId} unmounted`);
    };
  }, [instanceId]);

  return (
    <>
      {/* Sniper rifle model - position/rotation handled by ref updates */}
      <group ref={rifleRef}>
        <SniperModel />
      </group>

      {/* Render projectiles */}
      {projectilesRef.current.map((projectile) => (
        <SniperProjectile
          key={projectile.id}
          id={projectile.id}
          position={projectile.position}
          rotation={projectile.rotation}
          damage={projectile.damage}
          targetId={projectile.targetId}
          penetrationPower={projectile.penetrationPower}
          onRemove={removeProjectile}
        />
      ))}
    </>
  );
};

export default SniperRifle;
