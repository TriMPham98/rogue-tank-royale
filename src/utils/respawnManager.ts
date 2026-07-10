import { useEffect, useRef } from "react";
import { useGameState, Enemy } from "../utils/gameState";
import { generateRandomPosition } from "../utils/levelGenerator";
import { debug } from "../utils/debug";
import * as THREE from "three"; // Import THREE for Vector2
import { GAME_CONSTANTS } from "../constants/game";
import { enforceMapBoundaries } from "./boundaries";

const SPAWN_STATS_DEBUG = false;

// New helper function to generate varied spawn positions
const generateVariedSpawnPosition = (
  level: number,
  existingPositions: [number, number, number][],
  minDistance: number,
  maxDistance: number,
  enemyType: "tank" | "turret" | "bomber"
): [number, number, number] => {
  const halfMapSize = GAME_CONSTANTS.HALF_MAP_SIZE;

  // Define spawn zones based on enemy type
  let spawnZone: "edge" | "mid" | "any" = "any";
  if (enemyType === "turret") {
    spawnZone = "mid"; // Turrets prefer middle areas
  } else if (enemyType === "bomber") {
    spawnZone = "edge"; // Bombers prefer edge areas
  }

  // Calculate dynamic spawn parameters based on level
  const baseGridSize = Math.min(40 + level * 2, 70);
  const spawnAttempts = 20; // Increased attempts for better position finding

  for (let attempt = 0; attempt < spawnAttempts; attempt++) {
    let x: number, z: number;

    // Generate position based on spawn zone
    switch (spawnZone) {
      case "edge": {
        // Edge spawn with some randomness
        const edge = Math.random() < 0.5 ? "north" : "south";
        const edgeOffset = Math.random() * 20 + 10; // 10-30 units from edge
        x = (Math.random() - 0.5) * (halfMapSize - edgeOffset);
        z =
          edge === "north"
            ? halfMapSize - edgeOffset
            : -halfMapSize + edgeOffset;
        break;
      }
      case "mid": {
        // Mid area spawn with tighter bounds
        const midRange = halfMapSize * 0.4;
        x = (Math.random() - 0.5) * midRange;
        z = (Math.random() - 0.5) * midRange;
        break;
      }
      default: {
        // Anywhere spawn with level-based distribution
        const distribution = Math.random();
        if (distribution < 0.4) {
          // 40% chance for edge spawns
          const edge = Math.random() < 0.5 ? "north" : "south";
          const edgeOffset = Math.random() * 15 + 5;
          x = (Math.random() - 0.5) * (halfMapSize - edgeOffset);
          z =
            edge === "north"
              ? halfMapSize - edgeOffset
              : -halfMapSize + edgeOffset;
        } else {
          // 60% chance for general area spawns
          x = (Math.random() - 0.5) * baseGridSize;
          z = (Math.random() - 0.5) * baseGridSize;
        }
      }
    }

    const position: [number, number, number] = [x, 0.5, z];

    // Check distance from existing positions
    let isTooClose = false;
    for (const existingPos of existingPositions) {
      const dx = existingPos[0] - position[0];
      const dz = existingPos[2] - position[2];
      const distance = Math.sqrt(dx * dx + dz * dz);
      if (distance < minDistance) {
        isTooClose = true;
        break;
      }
    }

    if (!isTooClose) {
      return enforceMapBoundaries(position);
    }
  }

  // Fallback to original random position if no good position found
  return enforceMapBoundaries(
    generateRandomPosition(
      baseGridSize,
      existingPositions,
      minDistance,
      maxDistance
    )
  );
};

const BASE_ENEMIES = 1;
const getMaxEnemies = (level: number) => {
  if (level === 1) return 1;

  // Reduce tanks in early game (levels 2-10)
  if (level <= 10) {
    return Math.min(BASE_ENEMIES + Math.floor(Math.sqrt(level) * 1.25), 15);
  }
  // Standard progression (levels 11-39)
  else if (level < 40) {
    return Math.min(BASE_ENEMIES + Math.floor(Math.sqrt(level) * 2), 15);
  }
  // Increase difficulty for late game (level 40+)
  else {
    return Math.min(BASE_ENEMIES + Math.floor(Math.sqrt(level) * 2.3), 20);
  }
};

export const useRespawnManager = () => {
  const prevEnemyCountRef = useRef<number>(0);
  const prevEnemiesRef = useRef<string[]>([]);
  const enemiesSpawnedThisRoundRef = useRef<number>(0);
  const currentLevelRef = useRef<number>(1);
  const isSpawningWaveRef = useRef<boolean>(false);
  const gameRestartedRef = useRef<boolean>(false);

  // Helper function to spawn a single enemy
  const spawnEnemy = (maxEnemies: number): boolean => {
    // Added return type boolean
    const freshState = useGameState.getState();
    if (
      !freshState.isGameOver &&
      !freshState.isPaused &&
      freshState.enemies.length < maxEnemies
    ) {
      const {
        safeZoneCenter,
        safeZoneRadius,
        safeZoneActive,
        terrainObstacles,
        playerTankPosition,
        level,
        enemies, // Get current enemies list
      } = freshState;

      let position: [number, number, number] = [0, 0.5, 0]; // Initialize with default values
      let type: "tank" | "turret" | "bomber";
      let health: number;
      let speed: number = 1;

      const turretMaxRegenAttempts = 15; // Max attempts for respawn as well

      try {
        // Determine enemy type first
        const turretProbability = Math.min(0.1 + level * 0.02, 0.3);
        const bomberProbability =
          level >= 15 ? Math.min(0.15 + (level - 15) * 0.03, 0.3) : 0;
        const random = Math.random();
        const currentTurretCount = enemies.filter(
          (e) => e.type === "turret"
        ).length;
        const maxTurrets = 3;

        if (level >= 15 && random < bomberProbability) {
          type = "bomber";
          health = 40 + level * 3;
          speed = 4.0;
        } else if (
          random < turretProbability + bomberProbability &&
          currentTurretCount < maxTurrets
        ) {
          type = "turret";
          const turretBaseHealth = 75;
          // Note: Reverted health scaling slightly to match generateEnemies for consistency
          const linearScale = level * 9;
          health = turretBaseHealth + linearScale;
        } else {
          type = "tank";
          const tankBaseHealth = 50;
          const linearScale = level * 9;
          health = tankBaseHealth + linearScale;
          speed = 1.3;
        }

        // Now generate position, checking safe zone for turrets
        let attempts = 0;
        let positionFound = false;
        const existingPositions = [
          playerTankPosition,
          ...enemies.map((e: Enemy) => e.position),
        ];

        // For tanks/turrets with active safe zone, generate positions inside the zone directly
        const shouldSpawnInSafeZone =
          (type === "turret" || type === "tank") && safeZoneActive;

        while (attempts < turretMaxRegenAttempts && !positionFound) {
          // Generate position based on whether we need to be in safe zone
          if (shouldSpawnInSafeZone) {
            // Generate position directly inside safe zone for better success rate
            const angle = Math.random() * Math.PI * 2;
            // Use 90% of safe zone radius to ensure we're comfortably inside
            const radius = Math.random() * safeZoneRadius * 0.9;
            position = [
              safeZoneCenter[0] + Math.cos(angle) * radius,
              0.5,
              safeZoneCenter[1] + Math.sin(angle) * radius,
            ];
            position = enforceMapBoundaries(position);
          } else {
            position = generateVariedSpawnPosition(
              level,
              existingPositions,
              7,
              400,
              type
            );
          }

          // Extra validation for distance from terrain obstacles
          // Use reduced clearance for small safe zones to allow spawning
          const baseClearance = shouldSpawnInSafeZone && safeZoneRadius < 15
            ? Math.max(3, safeZoneRadius * 0.3) // Reduced clearance for tiny zones
            : 7;
          let isClear = true;
          for (const obstacle of terrainObstacles) {
            const dx = obstacle.position[0] - position[0];
            const dz = obstacle.position[2] - position[2];
            const distance = Math.sqrt(dx * dx + dz * dz);
            const minClearance = obstacle.size * 2.5 + baseClearance;
            if (distance < minClearance) {
              isClear = false;
              if (SPAWN_STATS_DEBUG) {
                debug.warn(
                  "Respawn rejected spawn position too close to obstacle:",
                  position
                );
              }
              break;
            }
          }

          // Check distance from existing enemies/player
          if (isClear) {
            for (const existingPos of existingPositions) {
              const dx = existingPos[0] - position[0];
              const dz = existingPos[2] - position[2];
              const distance = Math.sqrt(dx * dx + dz * dz);
              if (distance < 5) {
                isClear = false;
                break;
              }
            }
          }

          if (!isClear) {
            attempts++;
            continue;
          }

          // For safe zone spawns, verify we're actually inside
          if (shouldSpawnInSafeZone) {
            const posVec = new THREE.Vector2(position[0], position[2]);
            const centerVec = new THREE.Vector2(
              safeZoneCenter[0],
              safeZoneCenter[1]
            );
            const distanceToCenter = posVec.distanceTo(centerVec);

            if (distanceToCenter <= safeZoneRadius) {
              positionFound = true;
            } else {
              attempts++;
            }
          } else {
            // Bombers and non-safe-zone spawns don't need zone check
            positionFound = true;
          }

          // If we've exhausted attempts for safe zone spawns, use fallback
          if (!positionFound && attempts >= turretMaxRegenAttempts) {
            debug.warn(
              `${type} RESPAWN failed after ${attempts} attempts. Using center fallback.`
            );
            // Place at safe zone center as last resort
            position = [safeZoneCenter[0], 0.5, safeZoneCenter[1]];
            position = enforceMapBoundaries(position);
            positionFound = true;
          }
        }

        // Double check state one more time before spawning
        const finalState = useGameState.getState();
        if (
          !finalState.isGameOver &&
          !finalState.isPaused &&
          finalState.enemies.length < maxEnemies &&
          positionFound // Ensure a valid position was actually found/assigned
        ) {
          // Ensure position is properly initialized and typecast appropriately
          const finalPosition: [number, number, number] = [
            position[0],
            position[1],
            position[2],
          ];

          // Apply map boundaries to ensure the position is constrained before spawning
          const constrainedPosition = enforceMapBoundaries(finalPosition);

          // Create the complete enemy object before spawning to ensure no recalculation
          const enemyToSpawn = {
            position: constrainedPosition,
            health,
            type,
            speed,
          };

          freshState.spawnEnemy(enemyToSpawn);

          enemiesSpawnedThisRoundRef.current++;
          if (SPAWN_STATS_DEBUG) {
            console.log(
              `[SPAWN STATS] New ${type} respawned - Active enemies: ${
                finalState.enemies.length + 1
              }/${maxEnemies} (Total spawned this round: ${
                enemiesSpawnedThisRoundRef.current
              })`
            );
          }
          return true; // Indicate successful spawn
        } else {
          if (!positionFound) {
            debug.error("Failed to find any valid position for enemy respawn.");
          }
        }
      } catch (error) {
        console.error(`Error spawning enemy: ${error}`);
      }
    }
    return false; // Indicate spawn failed or wasn't needed
  };

  // Function to spawn a wave of enemies
  const spawnEnemyWave = (count: number) => {
    if (isSpawningWaveRef.current) {
      if (SPAWN_STATS_DEBUG)
        console.log(`[SPAWN STATS] Wave spawn already in progress, skipping`);
      return;
    }
    isSpawningWaveRef.current = true;
    let spawned = 0;
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 10; // Prevent infinite retry loops

    const spawnNext = () => {
      const freshState = useGameState.getState();
      const maxEnemies = getMaxEnemies(freshState.level);
      if (spawned < count && freshState.enemies.length < maxEnemies) {
        if (spawnEnemy(maxEnemies)) {
          // Use the boolean return value
          spawned++;
          consecutiveFailures = 0; // Reset on success
          if (spawned < count) {
            setTimeout(spawnNext, 300); // Stagger spawns slightly
          } else {
            isSpawningWaveRef.current = false; // Wave finished
            if (SPAWN_STATS_DEBUG)
              console.log(`[SPAWN STATS] Wave spawn of ${count} finished.`);
          }
        } else {
          consecutiveFailures++;
          if (consecutiveFailures >= maxConsecutiveFailures) {
            // Give up after too many failures to prevent infinite loop
            debug.warn(
              `Wave spawn giving up after ${consecutiveFailures} consecutive failures. Spawned ${spawned}/${count}.`
            );
            isSpawningWaveRef.current = false;
            return;
          }
          // If spawn failed (e.g., couldn't find position), try again shortly
          debug.warn("Spawn attempt failed during wave, retrying...");
          setTimeout(spawnNext, 500); // Longer delay on failure retry
        }
      } else {
        isSpawningWaveRef.current = false; // Wave finished (or conditions met)
        if (SPAWN_STATS_DEBUG)
          console.log(
            `[SPAWN STATS] Wave spawn condition met (spawned: ${spawned}/${count}, max: ${maxEnemies}).`
          );
      }
    };
    if (SPAWN_STATS_DEBUG)
      console.log(`[SPAWN STATS] Starting wave spawn of ${count} enemies`);
    spawnNext();
  };

  // Add specific effect to monitor game restarts
  useEffect(() => {
    const unsubscribeRestart = useGameState.subscribe((state) => {
      // Detect game restart (level went back to 1)
      if (currentLevelRef.current > 1 && state.level === 1) {
        debug.log("Respawn Manager: Game restart detected, resetting state");
        // Game was restarted, reset state
        prevEnemyCountRef.current = 0;
        prevEnemiesRef.current = [];
        enemiesSpawnedThisRoundRef.current = 0;
        currentLevelRef.current = 1;
        gameRestartedRef.current = true;
      } else if (gameRestartedRef.current && state.isTerrainReady) {
        // Terrain is ready after restart, reset flag
        gameRestartedRef.current = false;
      }
    });

    return unsubscribeRestart;
  }, []);

  // Listen for changes in the enemies array (existing effect remains unchanged)
  useEffect(() => {
    const initialState = useGameState.getState();
    prevEnemyCountRef.current = initialState.enemies.length;
    prevEnemiesRef.current = initialState.enemies.map((e) => e.id);
    enemiesSpawnedThisRoundRef.current = initialState.enemies.length;
    currentLevelRef.current = initialState.level;
    const initialMaxEnemies = getMaxEnemies(initialState.level);
    if (SPAWN_STATS_DEBUG) {
      console.log(
        `[SPAWN STATS] Initializing Respawn Manager - Level: ${initialState.level}, Enemies: ${initialState.enemies.length}/${initialMaxEnemies}`
      );
    }

    const unsubscribe = useGameState.subscribe((state, prevState) => {
      // Skip if we're in a restarted state waiting for terrain to be ready
      if (gameRestartedRef.current) {
        return;
      }

      // Use prevState
      // Check for level change
      if (state.level !== currentLevelRef.current) {
        const newMaxEnemies = getMaxEnemies(state.level);
        const currentEnemies = state.enemies.length;
        // Calculate how many enemies were *intended* for the *previous* level
        const prevMaxEnemies = getMaxEnemies(currentLevelRef.current);
        // Determine how many new enemies to spawn based on the *new* level's max count
        const additionalEnemiesNeeded = Math.max(
          0,
          newMaxEnemies - currentEnemies
        );

        if (SPAWN_STATS_DEBUG) {
          console.log(
            `[SPAWN STATS] Level Change Detected: ${currentLevelRef.current} -> ${state.level}. Max Enemies: ${prevMaxEnemies} -> ${newMaxEnemies}. Current: ${currentEnemies}. Spawning: ${additionalEnemiesNeeded}`
          );
        }

        // Reset round spawn count only when level changes
        enemiesSpawnedThisRoundRef.current = currentEnemies; // Start count from existing enemies
        currentLevelRef.current = state.level;

        if (additionalEnemiesNeeded > 0) {
          setTimeout(() => {
            // Delay wave spawn slightly after level change
            spawnEnemyWave(additionalEnemiesNeeded);
          }, 500);
        }
      } else {
        // Only check for respawn if level hasn't changed in this update
        const currentEnemyCount = state.enemies.length;
        const currentEnemyIds = state.enemies.map((e) => e.id);

        // Check if an enemy was destroyed (count decreased AND ID removed)
        // Using ID check is more robust than just count
        const destroyedEnemyIds = prevEnemiesRef.current.filter(
          (id) => !currentEnemyIds.includes(id)
        );

        if (
          destroyedEnemyIds.length > 0 &&
          prevEnemyCountRef.current > currentEnemyCount
        ) {
          // For each destroyed enemy, check if we should spawn a power-up (5% chance)
          if (destroyedEnemyIds.length > 0) {
            const prevEnemies = prevState.enemies.filter((enemy) =>
              destroyedEnemyIds.includes(enemy.id)
            );

            prevEnemies.forEach((enemy) => {
              // 5% chance to drop a health power-up
              if (Math.random() < 0.05) {
                const { spawnPowerUp } = state;
                // Slight random offset so multiple drops don't overlap perfectly
                const offsetX = (Math.random() - 0.5) * 1.5;
                const offsetZ = (Math.random() - 0.5) * 1.5;
                const dropPosition: [number, number, number] = [
                  enemy.position[0] + offsetX,
                  0.5,
                  enemy.position[2] + offsetZ,
                ];
                spawnPowerUp({
                  position: dropPosition,
                  type: "health",
                });
                if (SPAWN_STATS_DEBUG) {
                  debug.log(`Enemy ${enemy.id} dropped a health power-up`);
                }
              }
              // 35% chance to drop coins; value scales mildly with level and enemy type
              if (Math.random() < 0.35) {
                const { spawnPowerUp } = state;
                const base =
                  enemy.type === "tank" ? 3 : enemy.type === "turret" ? 4 : 2;
                const levelFactor = Math.max(1, Math.floor(state.level / 5));
                const coinValue = Math.min(
                  99,
                  base + Math.floor(Math.random() * (2 + levelFactor))
                );
                const offsetX = (Math.random() - 0.5) * 1.5;
                const offsetZ = (Math.random() - 0.5) * 1.5;
                const dropPosition: [number, number, number] = [
                  enemy.position[0] + offsetX,
                  0.5,
                  enemy.position[2] + offsetZ,
                ];
                spawnPowerUp({
                  position: dropPosition,
                  type: "coin",
                  value: coinValue,
                });
                if (SPAWN_STATS_DEBUG) {
                  debug.log(`Enemy ${enemy.id} dropped ${coinValue} coin(s)`);
                }
              }
            });
          }

          const maxEnemies = getMaxEnemies(state.level);
          if (SPAWN_STATS_DEBUG) {
            console.log(
              `[SPAWN STATS] ${
                destroyedEnemyIds.length
              } Enemy destroyed. Current: ${currentEnemyCount}/${maxEnemies}. IDs: ${destroyedEnemyIds.join(
                ", "
              )}`
            );
          }

          // Respawn logic: Only spawn if under max and not currently in a wave spawn
          if (currentEnemyCount < maxEnemies && !isSpawningWaveRef.current) {
            const respawnDelay = Math.max(4000 - state.level * 150, 1500); // Slightly longer base delay, scales down faster
            if (SPAWN_STATS_DEBUG)
              console.log(
                `[SPAWN STATS] Scheduling respawn in ${respawnDelay}ms`
              );
            setTimeout(() => {
              // Pass the current maxEnemies for the level
              spawnEnemy(maxEnemies);
            }, respawnDelay);
          } else {
            if (SPAWN_STATS_DEBUG)
              console.log(
                `[SPAWN STATS] Respawn skipped (At Max: ${
                  currentEnemyCount >= maxEnemies
                }, Spawning Wave: ${isSpawningWaveRef.current})`
              );
          }
        }

        // Update previous state references *after* comparison
        prevEnemyCountRef.current = currentEnemyCount;
        prevEnemiesRef.current = currentEnemyIds;
      }
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs only once on mount

  return null; // This hook doesn't render anything
};
