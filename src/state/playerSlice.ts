// Player state slice
import type { StateCreator } from "zustand";
import type { GameState, PlayerSlice, UpgradeableStat } from "./types";
import { GAME_CONSTANTS } from "../constants/game";

// Helper function to keep entities within map boundaries
const enforceMapBoundaries = (
  position: [number, number, number]
): [number, number, number] => {
  const halfMapSize = GAME_CONSTANTS.HALF_MAP_SIZE;
  const buffer = GAME_CONSTANTS.MAP_BOUNDARY_BUFFER;

  const constrainedPosition: [number, number, number] = [...position];

  if (constrainedPosition[0] < -halfMapSize + buffer) {
    constrainedPosition[0] = -halfMapSize + buffer;
  } else if (constrainedPosition[0] > halfMapSize - buffer) {
    constrainedPosition[0] = halfMapSize - buffer;
  }

  if (constrainedPosition[2] < -halfMapSize + buffer) {
    constrainedPosition[2] = -halfMapSize + buffer;
  } else if (constrainedPosition[2] > halfMapSize - buffer) {
    constrainedPosition[2] = halfMapSize - buffer;
  }

  return constrainedPosition;
};

export const createPlayerSlice: StateCreator<
  GameState,
  [],
  [],
  PlayerSlice
> = (set) => ({
  // Initial player stats
  playerHealth: GAME_CONSTANTS.PLAYER_INITIAL_HEALTH,
  playerMaxHealth: GAME_CONSTANTS.PLAYER_INITIAL_HEALTH,
  playerSpeed: GAME_CONSTANTS.PLAYER_INITIAL_SPEED,
  playerDamage: 25,
  playerTurretDamage: GAME_CONSTANTS.PLAYER_INITIAL_TURRET_DAMAGE,
  playerFireRate: GAME_CONSTANTS.PLAYER_INITIAL_FIRE_RATE,
  playerCameraRange: GAME_CONSTANTS.PLAYER_INITIAL_CAMERA_RANGE,
  playerHealthRegen: 0,
  playerBulletVelocity: GAME_CONSTANTS.PLAYER_INITIAL_BULLET_VELOCITY,
  playerPenetration: 0,
  playerLevel: 1,

  // Position
  playerTankPosition: [0, 0.5, 0],
  playerTurretRotation: 0,

  // Actions
  takeDamage: (amount) =>
    set((state) => {
      const newHealth = Math.max(0, state.playerHealth - amount);
      return {
        playerHealth: newHealth,
        isGameOver: newHealth <= 0,
      };
    }),

  healPlayer: (amount) =>
    set((state) => ({
      playerHealth: Math.min(
        state.playerMaxHealth,
        state.playerHealth + amount
      ),
    })),

  updatePlayerPosition: (position) => {
    const constrainedPosition = enforceMapBoundaries(position);
    set(() => ({ playerTankPosition: constrainedPosition }));
  },

  updatePlayerTurretRotation: (rotation) => {
    set(() => ({ playerTurretRotation: rotation }));
  },

  upgradeStat: (stat: UpgradeableStat) =>
    set((state) => {
      if (state.level > GAME_CONSTANTS.UPGRADE_UI_MAX_LEVEL) {
        return { showUpgradeUI: false };
      }

      const updates: Partial<GameState> = {
        showUpgradeUI: false,
        isPaused: false,
      };

      switch (stat) {
        case "tankSpeed":
          updates.playerSpeed = state.playerSpeed + 0.5;
          break;
        case "fireRate":
          const currentShotsPerSecond = 1 / state.playerFireRate;
          const newShotsPerSecond = currentShotsPerSecond + 0.1;
          const cappedShotsPerSecond = Math.min(
            GAME_CONSTANTS.PLAYER_MAX_FIRE_RATE,
            newShotsPerSecond
          );
          updates.playerFireRate = 1 / cappedShotsPerSecond;
          break;
        case "cameraRange":
          updates.playerCameraRange = state.playerCameraRange + 2;
          break;
        case "maxHealth":
          updates.playerMaxHealth = state.playerMaxHealth + 25;
          updates.playerHealth = state.playerHealth + 25;
          break;
        case "healthRegen":
          updates.playerHealthRegen = state.playerHealthRegen + 0.5;
          break;
        case "turretDamage":
          const tankBaseHealth = GAME_CONSTANTS.ENEMY_TANK_BASE_HEALTH;
          const linearHealthScale = GAME_CONSTANTS.ENEMY_HEALTH_SCALE_PER_LEVEL;
          const currentTankHealth =
            tankBaseHealth + state.level * linearHealthScale;
          const damageIncrease = Math.max(
            15,
            Math.floor(currentTankHealth * 0.25)
          );
          updates.playerTurretDamage =
            state.playerTurretDamage + damageIncrease;
          break;
        case "bulletVelocity":
          updates.playerBulletVelocity = state.playerBulletVelocity + 2;
          break;
        case "penetration":
          updates.playerPenetration = Math.min(
            GAME_CONSTANTS.PLAYER_MAX_PENETRATION,
            state.playerPenetration + 1
          );
          break;
      }

      return updates;
    }),
});

// Initial player state values for reset
export const initialPlayerState = {
  playerHealth: GAME_CONSTANTS.PLAYER_INITIAL_HEALTH,
  playerMaxHealth: GAME_CONSTANTS.PLAYER_INITIAL_HEALTH,
  playerSpeed: GAME_CONSTANTS.PLAYER_INITIAL_SPEED,
  playerDamage: 25,
  playerTurretDamage: GAME_CONSTANTS.PLAYER_INITIAL_TURRET_DAMAGE,
  playerFireRate: GAME_CONSTANTS.PLAYER_INITIAL_FIRE_RATE,
  playerCameraRange: GAME_CONSTANTS.PLAYER_INITIAL_CAMERA_RANGE,
  playerHealthRegen: 0,
  playerBulletVelocity: GAME_CONSTANTS.PLAYER_INITIAL_BULLET_VELOCITY,
  playerPenetration: 0,
  playerLevel: 1,
  playerTankPosition: [0, 0.5, 0] as [number, number, number],
  playerTurretRotation: 0,
};
