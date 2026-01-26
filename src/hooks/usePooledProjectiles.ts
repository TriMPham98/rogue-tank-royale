/**
 * Hook for spawning projectiles using the object pool
 */
import { useCallback, useRef } from "react";
import { getProjectilePool, PooledProjectile } from "../systems/ProjectilePool";
import { useGameState } from "../utils/gameState";

interface UsePooledProjectilesOptions {
  isEnemy?: boolean;
  defaultDamage?: number;
  defaultVelocity?: number;
}

export function usePooledProjectiles({
  isEnemy = false,
  defaultDamage = 25,
  defaultVelocity = 15,
}: UsePooledProjectilesOptions = {}) {
  const lastShootTimeRef = useRef(0);
  const pool = getProjectilePool();

  const playerBulletVelocity = useGameState((state) => state.playerBulletVelocity);
  const playerPenetration = useGameState((state) => state.playerPenetration);

  const spawnProjectile = useCallback(
    (
      position: [number, number, number],
      rotation: number,
      damage?: number,
      velocity?: number,
      penetration?: number
    ): PooledProjectile | null => {
      const finalDamage = damage ?? defaultDamage;
      const finalVelocity = isEnemy
        ? (velocity ?? defaultVelocity)
        : (velocity ?? playerBulletVelocity);
      const finalPenetration = isEnemy ? 0 : (penetration ?? playerPenetration);

      return pool.spawn(
        position,
        rotation,
        finalVelocity,
        finalDamage,
        isEnemy,
        finalPenetration
      );
    },
    [isEnemy, defaultDamage, defaultVelocity, playerBulletVelocity, playerPenetration, pool]
  );

  const canShoot = useCallback(
    (currentTime: number, fireRate: number): boolean => {
      return currentTime - lastShootTimeRef.current >= fireRate;
    },
    []
  );

  const recordShot = useCallback((currentTime: number) => {
    lastShootTimeRef.current = currentTime;
  }, []);

  const getActiveCount = useCallback(() => {
    return pool.getActiveCount(isEnemy);
  }, [isEnemy, pool]);

  return {
    spawnProjectile,
    canShoot,
    recordShot,
    getActiveCount,
    lastShootTimeRef,
  };
}

export default usePooledProjectiles;
