/**
 * Hook for managing spatial hashes synchronized with game state
 */
import { useEffect, useRef, useCallback } from "react";
import { useGameState } from "../utils/gameState";
import {
  SpatialHash,
  SpatialEntity,
  getObstacleHash,
  getEnemyHash,
  resetSpatialHashes,
} from "../utils/spatialHash";
import { GAME_CONSTANTS } from "../constants/game";

interface ObstacleSpatialEntity extends SpatialEntity {
  size: number;
  type: "rock";
}

interface EnemySpatialEntity extends SpatialEntity {
  type: "tank" | "turret" | "bomber";
}

/**
 * Hook to initialize and maintain spatial hashes for obstacles
 * Should be called once at the game scene level
 */
export function useObstacleSpatialHash() {
  const hashRef = useRef<SpatialHash<ObstacleSpatialEntity>>(getObstacleHash() as SpatialHash<ObstacleSpatialEntity>);
  const terrainObstacles = useGameState((state) => state.terrainObstacles);
  const isTerrainReady = useGameState((state) => state.isTerrainReady);

  useEffect(() => {
    if (!isTerrainReady || terrainObstacles.length === 0) return;

    // Rebuild obstacle hash when terrain changes
    const entities: ObstacleSpatialEntity[] = terrainObstacles.map((obstacle) => ({
      id: obstacle.id,
      x: obstacle.position[0],
      z: obstacle.position[2],
      radius: obstacle.size * GAME_CONSTANTS.OBSTACLE_RADIUS_MULTIPLIER,
      size: obstacle.size,
      type: obstacle.type,
    }));

    hashRef.current.rebuild(entities);
  }, [terrainObstacles, isTerrainReady]);

  // Reset on game restart
  useEffect(() => {
    const unsubscribe = useGameState.subscribe((state, prevState) => {
      if (prevState.level > 1 && state.level === 1) {
        hashRef.current.clear();
      }
    });
    return unsubscribe;
  }, []);

  const getNearbyObstacles = useCallback((x: number, z: number, radius: number) => {
    return hashRef.current.getNearby(x, z, radius);
  }, []);

  const getObstaclesInRadius = useCallback((x: number, z: number, radius: number) => {
    return hashRef.current.getWithinRadius(x, z, radius);
  }, []);

  return {
    getNearbyObstacles,
    getObstaclesInRadius,
    obstacleHash: hashRef.current,
  };
}

/**
 * Hook to maintain spatial hash for enemies
 * Updates automatically when enemies move
 */
export function useEnemySpatialHash() {
  const hashRef = useRef<SpatialHash<EnemySpatialEntity>>(getEnemyHash() as SpatialHash<EnemySpatialEntity>);
  const prevEnemyPositionsRef = useRef<Map<string, [number, number]>>(new Map());

  useEffect(() => {
    const unsubscribe = useGameState.subscribe((state) => {
      const enemies = state.enemies;
      const currentIds = new Set(enemies.map((e) => e.id));
      const prevPositions = prevEnemyPositionsRef.current;

      // Remove enemies that no longer exist
      for (const prevId of prevPositions.keys()) {
        if (!currentIds.has(prevId)) {
          hashRef.current.remove(prevId);
          prevPositions.delete(prevId);
        }
      }

      // Add or update enemies
      for (const enemy of enemies) {
        const prevPos = prevPositions.get(enemy.id);
        const currentX = enemy.position[0];
        const currentZ = enemy.position[2];

        // Only update if position changed significantly (> 0.5 units)
        if (!prevPos || Math.abs(prevPos[0] - currentX) > 0.5 || Math.abs(prevPos[1] - currentZ) > 0.5) {
          const radius =
            enemy.type === "bomber"
              ? GAME_CONSTANTS.BOMBER_RADIUS
              : enemy.type === "turret"
              ? GAME_CONSTANTS.TURRET_COLLISION_RADIUS
              : GAME_CONSTANTS.TANK_RADIUS;

          const entity: EnemySpatialEntity = {
            id: enemy.id,
            x: currentX,
            z: currentZ,
            radius,
            type: enemy.type,
          };

          if (prevPos) {
            hashRef.current.update(entity);
          } else {
            hashRef.current.insert(entity);
          }
          prevPositions.set(enemy.id, [currentX, currentZ]);
        }
      }
    });

    return unsubscribe;
  }, []);

  // Reset on game restart
  useEffect(() => {
    const unsubscribe = useGameState.subscribe((state, prevState) => {
      if (prevState.level > 1 && state.level === 1) {
        hashRef.current.clear();
        prevEnemyPositionsRef.current.clear();
      }
    });
    return unsubscribe;
  }, []);

  const getNearbyEnemies = useCallback((x: number, z: number, radius: number) => {
    return hashRef.current.getNearby(x, z, radius);
  }, []);

  const getEnemiesInRadius = useCallback((x: number, z: number, radius: number) => {
    return hashRef.current.getWithinRadius(x, z, radius);
  }, []);

  return {
    getNearbyEnemies,
    getEnemiesInRadius,
    enemyHash: hashRef.current,
  };
}

/**
 * Combined hook for using both spatial hashes
 */
export function useSpatialCollision() {
  const { getNearbyObstacles, getObstaclesInRadius } = useObstacleSpatialHash();
  const { getNearbyEnemies, getEnemiesInRadius } = useEnemySpatialHash();

  return {
    getNearbyObstacles,
    getObstaclesInRadius,
    getNearbyEnemies,
    getEnemiesInRadius,
  };
}

export { resetSpatialHashes };
