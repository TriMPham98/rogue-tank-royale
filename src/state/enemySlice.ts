// Enemy state slice
import type { StateCreator } from "zustand";
import type { GameState, EnemySlice, Enemy, PowerUp } from "./types";
import { GAME_CONSTANTS } from "../constants/game";
import SoundManager from "../utils/sound";
import { enforceMapBoundaries } from "../utils/boundaries";
import { getEnemyVisualPosition } from "../utils/enemyVisualPositions";
import { fx } from "../models/fx/fxSystem";

const EXPLOSION_SCALE = { tank: 1, turret: 1.15, bomber: 1.35 } as const;

export const createEnemySlice: StateCreator<
  GameState,
  [],
  [],
  EnemySlice
> = (set, get) => ({
  enemies: [],
  powerUps: [],

  spawnEnemy: (enemy) =>
    set((state) => {
      // If this is a turret, check if we already have max turrets
      if (enemy.type === "turret") {
        const currentTurrets = state.enemies.filter(
          (e) => e.type === "turret"
        ).length;
        if (currentTurrets >= GAME_CONSTANTS.MAX_TURRETS) {
          // Change this enemy to a tank instead
          enemy.type = "tank";
          const tankBaseHealth = GAME_CONSTANTS.ENEMY_TANK_BASE_HEALTH;
          const linearScale =
            state.level * GAME_CONSTANTS.ENEMY_HEALTH_SCALE_PER_LEVEL;
          enemy.health = tankBaseHealth + linearScale;
          enemy.speed = 1.3;
        }
      }

      return {
        enemies: [
          ...state.enemies,
          { ...enemy, id: Math.random().toString(36).substr(2, 9) },
        ],
      };
    }),

  removeEnemy: (id) =>
    set((state) => ({
      enemies: state.enemies.filter((enemy) => enemy.id !== id),
    })),

  damageEnemy: (id, amount) => {
    const state = get();
    const enemy = state.enemies.find((e) => e.id === id);

    if (!enemy) return false;

    const newHealth = enemy.health - amount;
    const isDestroyed = newHealth <= 0;

    if (isDestroyed) {
      // Mesh position is live; store position is throttled
      const at = getEnemyVisualPosition(id) ?? enemy.position;
      fx.explosion(at[0], at[1], at[2], EXPLOSION_SCALE[enemy.type] ?? 1);
      get().removeEnemy(id);
      get().increaseScore(enemy.type === "tank" ? 100 : 150);
      get().incrementEnemyDefeatCount();

      // Calculate distance-based volume
      const playerPos = state.playerTankPosition;
      const enemyPos = enemy.position;
      const dx = playerPos[0] - enemyPos[0];
      const dz = playerPos[2] - enemyPos[2];
      const distance = Math.sqrt(dx * dx + dz * dz);

      const maxVolume = 0.1925;
      const minVolume = 0.011;
      const maxDistance = 50;
      const volume = Math.max(
        minVolume,
        maxVolume * (1 - distance / maxDistance)
      );

      SoundManager.setVolume("npcImpact", volume);
      SoundManager.play("npcImpact");
      return true;
    } else {
      set((state) => ({
        enemies: state.enemies.map((e) =>
          e.id === id ? { ...e, health: newHealth } : e
        ),
      }));
      return false;
    }
  },

  updateEnemyPosition: (id, position) => {
    const constrainedPosition = enforceMapBoundaries(position);
    set((state) => ({
      enemies: state.enemies.map((enemy) =>
        enemy.id === id ? { ...enemy, position: constrainedPosition } : enemy
      ),
    }));
  },

  updateEnemyPositions: (enemyMoves) => {
    set((state) => ({
      enemies: state.enemies.map((enemy) => {
        const move = enemyMoves.find((m) => m.id === enemy.id);
        if (move) {
          return {
            ...enemy,
            position: enforceMapBoundaries(move.newPosition),
          };
        }
        return enemy;
      }),
    }));
  },

  spawnPowerUp: (powerUp) =>
    set((state) => ({
      powerUps: [
        ...state.powerUps,
        { ...powerUp, id: Math.random().toString(36).substr(2, 9) },
      ],
    })),

  collectPowerUp: (id, byPlayer = false) =>
    set((state) => {
      const powerUp = state.powerUps.find((p) => p.id === id);
      if (!powerUp) return state;

      const newPowerUps = state.powerUps.filter((p) => p.id !== id);
      let updates: Partial<GameState> = { powerUps: newPowerUps };

      if (powerUp.type === "health") {
        if (byPlayer) {
          updates = {
            ...updates,
            playerHealth: Math.min(
              state.playerMaxHealth,
              state.playerHealth + GAME_CONSTANTS.HEALTH_PACK_HEAL_AMOUNT
            ),
          };
          SoundManager.setVolume("healthPickUp", 0.385);
          SoundManager.play("healthPickUp");
        }
      } else if (powerUp.type === "coin") {
        if (byPlayer) {
          const coinValue = powerUp.value ?? 1;
          updates = {
            ...updates,
            coins: (state.coins || 0) + coinValue,
          };
          SoundManager.setVolume("healthPickUp", 0.3);
          SoundManager.play("healthPickUp");
        }
      }

      return updates;
    }),
});

// Initial enemy state for reset
export const initialEnemyState = {
  enemies: [] as Enemy[],
  powerUps: [] as PowerUp[],
};
