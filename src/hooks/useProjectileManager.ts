// Shared hook for managing projectile state
import { useState, useCallback, useRef } from "react";

interface Projectile {
  id: string;
  position: [number, number, number];
  rotation: number;
}

/**
 * Hook for managing projectile spawning and removal
 */
export function useProjectileManager() {
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const lastShootTimeRef = useRef(0);

  const spawnProjectile = useCallback(
    (position: [number, number, number], rotation: number) => {
      const newProjectile: Projectile = {
        id: Math.random().toString(36).substr(2, 9),
        position,
        rotation,
      };
      setProjectiles((prev) => [...prev, newProjectile]);
      return newProjectile.id;
    },
    []
  );

  const removeProjectile = useCallback((id: string) => {
    setProjectiles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const canShoot = useCallback(
    (currentTime: number, fireRate: number): boolean => {
      return currentTime - lastShootTimeRef.current >= fireRate;
    },
    []
  );

  const recordShot = useCallback((currentTime: number) => {
    lastShootTimeRef.current = currentTime;
  }, []);

  return {
    projectiles,
    spawnProjectile,
    removeProjectile,
    canShoot,
    recordShot,
    lastShootTimeRef,
  };
}

export default useProjectileManager;
