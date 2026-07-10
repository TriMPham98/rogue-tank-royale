// Shared hook for tank terrain collision detection
import { useMemo, useCallback } from "react";
import { Vector3 } from "three";
import { GAME_CONSTANTS } from "../constants/game";
import { useGameState } from "../utils/gameState";
import { getObstacleHash, getEnemyHash } from "../utils/spatialHash";
import { isWithinMapBoundaries } from "../utils/boundaries";

interface UseTankCollisionOptions {
  tankRadius: number;
  enemyId?: string; // For enemy tanks to skip self-collision
  useSpatialHash?: boolean; // Whether to use spatial hashing (default: true)
}

/**
 * Hook for checking tank collision with terrain obstacles and map boundaries
 * Uses spatial hashing for O(1) average case collision detection
 */
export function useTankCollision({
  tankRadius,
  enemyId,
  useSpatialHash = true,
}: UseTankCollisionOptions) {
  // Memoized vectors to avoid creating new ones on each collision check
  const collisionVectors = useMemo(
    () => ({
      tankPosition: new Vector3(),
      obstaclePos: new Vector3(),
    }),
    []
  );

  const checkTerrainCollision = useCallback(
    (newX: number, newZ: number): boolean => {
      // Check map boundary using centralized utility (behavior preserved for gameplay)
      if (!isWithinMapBoundaries(newX, newZ)) {
        return true;
      }

      collisionVectors.tankPosition.set(newX, 0, newZ);
      const safetyMargin = 0.1;

      // Use spatial hash if available and has obstacles
      const obstacleHash = getObstacleHash();
      if (useSpatialHash && obstacleHash.size > 0) {
        // Query only nearby obstacles using spatial hash
        const searchRadius = tankRadius + 5; // Max obstacle radius + buffer
        const nearbyObstacles = obstacleHash.getNearby(newX, newZ, searchRadius);

        for (const obstacle of nearbyObstacles) {
          const dx = obstacle.x - newX;
          const dz = obstacle.z - newZ;
          const distance = Math.sqrt(dx * dx + dz * dz);

          if (distance < tankRadius + obstacle.radius + safetyMargin) {
            return true;
          }
        }
      } else {
        // Fallback to iterating all obstacles
        const state = useGameState.getState();
        const terrainObstacles = state.terrainObstacles;

        for (const obstacle of terrainObstacles) {
          if (obstacle.type === "rock" || !obstacle.type) {
            collisionVectors.obstaclePos.set(
              obstacle.position[0],
              0,
              obstacle.position[2]
            );
            const distance = collisionVectors.obstaclePos.distanceTo(
              collisionVectors.tankPosition
            );
            const obstacleRadius =
              obstacle.size * GAME_CONSTANTS.OBSTACLE_RADIUS_MULTIPLIER;

            if (distance < tankRadius + obstacleRadius + safetyMargin) {
              return true;
            }
          }
        }
      }

      // For enemy tanks, check collision with turrets
      if (enemyId) {
        const enemyHash = getEnemyHash();
        const turretSafetyMargin = 0.2;

        if (useSpatialHash && enemyHash.size > 0) {
          // Use spatial hash for turret collision
          const searchRadius = tankRadius + GAME_CONSTANTS.TURRET_COLLISION_RADIUS + 1;
          const nearbyEnemies = enemyHash.getNearby(newX, newZ, searchRadius);

          for (const enemy of nearbyEnemies) {
            if (enemy.id === enemyId) continue;
            if (enemy.type === "turret") {
              const dx = enemy.x - newX;
              const dz = enemy.z - newZ;
              const distance = Math.sqrt(dx * dx + dz * dz);
              const turretRadius = GAME_CONSTANTS.TURRET_COLLISION_RADIUS;

              if (distance < tankRadius + turretRadius + turretSafetyMargin) {
                return true;
              }
            }
          }
        } else {
          // Fallback to iterating all enemies
          const state = useGameState.getState();
          const enemies = state.enemies;

          for (const otherEnemy of enemies) {
            if (otherEnemy.id === enemyId) continue;
            if (otherEnemy.type === "turret") {
              collisionVectors.obstaclePos.set(
                otherEnemy.position[0],
                0,
                otherEnemy.position[2]
              );
              const distance = collisionVectors.obstaclePos.distanceTo(
                collisionVectors.tankPosition
              );
              const turretRadius = GAME_CONSTANTS.TURRET_COLLISION_RADIUS;

              if (distance < tankRadius + turretRadius + turretSafetyMargin) {
                return true;
              }
            }
          }
        }
      }

      return false;
    },
    [tankRadius, enemyId, collisionVectors, useSpatialHash]
  );

  return { checkTerrainCollision, collisionVectors };
}

export default useTankCollision;
