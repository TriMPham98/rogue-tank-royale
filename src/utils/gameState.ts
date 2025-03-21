import { create } from "zustand";

// Define the type for an enemy
export interface Enemy {
  id: string;
  position: [number, number, number];
  health: number;
  type: "tank" | "turret";
}

// Define the type for a power-up
export interface PowerUp {
  id: string;
  position: [number, number, number];
  type: "health" | "speed" | "damage";
}

// Define the game state
interface GameState {
  // Player stats
  playerHealth: number;
  playerMaxHealth: number;
  playerSpeed: number;
  playerDamage: number;
  score: number;
  level: number;

  // Player position for tracking
  playerTankPosition: [number, number, number];

  // Game entities
  enemies: Enemy[];
  powerUps: PowerUp[];

  // Game state flags
  isGameOver: boolean;
  isPaused: boolean;

  // Actions
  takeDamage: (amount: number) => void;
  healPlayer: (amount: number) => void;
  increaseScore: (amount: number) => void;
  spawnEnemy: (enemy: Omit<Enemy, "id">) => void;
  removeEnemy: (id: string) => void;
  spawnPowerUp: (powerUp: Omit<PowerUp, "id">) => void;
  collectPowerUp: (id: string) => void;
  restartGame: () => void;
  togglePause: () => void;
  advanceLevel: () => void;
}

// Create the game state store
export const useGameState = create<GameState>((set) => ({
  // Initial player stats
  playerHealth: 100,
  playerMaxHealth: 100,
  playerSpeed: 3,
  playerDamage: 25,
  score: 0,
  level: 1,

  // Initial player position
  playerTankPosition: [0, 0.5, 0],

  // Initial game entities
  enemies: [],
  powerUps: [],

  // Initial game state flags
  isGameOver: false,
  isPaused: false,

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

  increaseScore: (amount) =>
    set((state) => ({
      score: state.score + amount,
    })),

  spawnEnemy: (enemy) =>
    set((state) => ({
      enemies: [
        ...state.enemies,
        { ...enemy, id: Math.random().toString(36).substr(2, 9) },
      ],
    })),

  removeEnemy: (id) =>
    set((state) => ({
      enemies: state.enemies.filter((enemy) => enemy.id !== id),
    })),

  spawnPowerUp: (powerUp) =>
    set((state) => ({
      powerUps: [
        ...state.powerUps,
        { ...powerUp, id: Math.random().toString(36).substr(2, 9) },
      ],
    })),

  collectPowerUp: (id) =>
    set((state) => {
      const powerUp = state.powerUps.find((p) => p.id === id);
      if (!powerUp) return state;

      const newPowerUps = state.powerUps.filter((p) => p.id !== id);
      let updates = { powerUps: newPowerUps };

      switch (powerUp.type) {
        case "health":
          updates = {
            ...updates,
            playerHealth: Math.min(
              state.playerMaxHealth,
              state.playerHealth + 25
            ),
          };
          break;
        case "speed":
          updates = { ...updates, playerSpeed: state.playerSpeed + 0.5 };
          break;
        case "damage":
          updates = { ...updates, playerDamage: state.playerDamage + 5 };
          break;
      }

      return updates;
    }),

  restartGame: () =>
    set({
      playerHealth: 100,
      playerMaxHealth: 100,
      playerSpeed: 3,
      playerDamage: 25,
      score: 0,
      level: 1,
      playerTankPosition: [0, 0.5, 0],
      enemies: [],
      powerUps: [],
      isGameOver: false,
      isPaused: false,
    }),

  togglePause: () =>
    set((state) => ({
      isPaused: !state.isPaused,
    })),

  advanceLevel: () =>
    set((state) => ({
      level: state.level + 1,
      playerMaxHealth: state.playerMaxHealth + 10,
      playerHealth: state.playerHealth + 10,
    })),
}));
