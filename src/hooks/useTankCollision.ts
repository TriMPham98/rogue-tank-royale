// Shared hook for tank terrain collision detection
import { useMemo, useCallback } from "react";
import { Vector3 } from "three";
import { GAME_CONSTANTS } from "../constants/game";
import { useGameState } from "../utils/gameState";

interface UseTankCollisionOptions {
  tankRadius: number;
  enemyId?: string; // For enemy tanks to skip self-collision
}

/**
 * Hook for checking tank collision with terrain obstacles and map boundaries
 */
export function useTankCollision({ tankRadius, enemyId }: UseTankCollisionOptions) {
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
      // Check map boundary
      const mapBoundary = GAME_CONSTANTS.HALF_MAP_SIZE - 1;
      if (Math.abs(newX) > mapBoundary || Math.abs(newZ) > mapBoundary) {
        return true;
      }

      collisionVectors.tankPosition.set(newX, 0, newZ);

      const state = useGameState.getState();
      const terrainObstacles = state.terrainObstacles;

      // Check collision with terrain obstacles (rocks)
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
          const safetyMargin = 0.1;

          if (distance < tankRadius + obstacleRadius + safetyMargin) {
            return true;
          }
        }
      }

      // For enemy tanks, check collision with turrets
      if (enemyId) {
        const enemies = state.enemies;
        for (const otherEnemy of enemies) {
          // Skip self
          if (otherEnemy.id === enemyId) continue;

          // Only check turrets as static obstacles
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
            const safetyMargin = 0.2;

            if (distance < tankRadius + turretRadius + safetyMargin) {
              return true;
            }
          }
        }
      }

      return false;
    },
    [tankRadius, enemyId, collisionVectors]
  );

  return { checkTerrainCollision, collisionVectors };
}

export default useTankCollision;
