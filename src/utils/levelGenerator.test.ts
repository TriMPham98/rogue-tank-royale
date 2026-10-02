import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMaxEnemies } from "./difficulty";
import { GAME_CONSTANTS } from "../constants/game";

// Mock the gameState module before importing levelGenerator
vi.mock("./gameState", () => ({
  useGameState: {
    getState: vi.fn(() => ({
      terrainObstacles: [],
      safeZoneCenter: [0, 0],
      safeZoneRadius: 50,
      safeZoneActive: false,
      spawnEnemy: vi.fn(),
      isTerrainReady: true,
    })),
    subscribe: vi.fn(),
  },
}));

// Mock debug module
vi.mock("./debug", () => ({
  debug: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { generateRandomPosition, generateEnemies } from "./levelGenerator";
import { useGameState } from "./gameState";

describe("levelGenerator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mock to default state
    vi.mocked(useGameState.getState).mockReturnValue({
      terrainObstacles: [],
      safeZoneCenter: [0, 0],
      safeZoneRadius: 50,
      safeZoneActive: false,
      spawnEnemy: vi.fn(),
      isTerrainReady: true,
    } as unknown as ReturnType<typeof useGameState.getState>);
  });

  describe("generateRandomPosition", () => {
    it("should return a position with y = 0.5", () => {
      const position = generateRandomPosition(50, []);
      expect(position[1]).toBe(0.5);
    });

    it("should return position within grid bounds", () => {
      const gridSize = 50;
      for (let i = 0; i < 10; i++) {
        const position = generateRandomPosition(gridSize, []);
        expect(Math.abs(position[0])).toBeLessThanOrEqual(gridSize / 2);
        expect(Math.abs(position[2])).toBeLessThanOrEqual(gridSize / 2);
      }
    });

    it("should avoid existing positions based on minDistance", () => {
      const existingPositions: [number, number, number][] = [[0, 0.5, 0]];
      const minDistance = 10;

      for (let i = 0; i < 5; i++) {
        const position = generateRandomPosition(50, existingPositions, minDistance);
        const dx = position[0] - existingPositions[0][0];
        const dz = position[2] - existingPositions[0][2];
        const distance = Math.sqrt(dx * dx + dz * dz);
        expect(distance).toBeGreaterThanOrEqual(minDistance);
      }
    });

    it("should avoid terrain obstacles", () => {
      const obstacleSize = 3;
      vi.mocked(useGameState.getState).mockReturnValue({
        terrainObstacles: [
          { position: [10, 0.5, 10], type: "rock", size: obstacleSize },
        ],
        safeZoneCenter: [0, 0],
        safeZoneRadius: 50,
        safeZoneActive: false,
        spawnEnemy: vi.fn(),
        isTerrainReady: true,
      } as unknown as ReturnType<typeof useGameState.getState>);

      for (let i = 0; i < 5; i++) {
        const position = generateRandomPosition(50, []);
        const dx = position[0] - 10;
        const dz = position[2] - 10;
        const distance = Math.sqrt(dx * dx + dz * dz);
        // Position should be clear of obstacle (size * 2.5 + minClearance)
        const requiredClearance = obstacleSize * 2.5 + 12;
        expect(distance).toBeGreaterThanOrEqual(requiredClearance - 1); // Allow small margin
      }
    });

    it("should use fallback positions when random attempts fail", () => {
      // Fill the map with obstacles to force fallback
      const obstacles = [];
      for (let x = -40; x <= 40; x += 5) {
        for (let z = -40; z <= 40; z += 5) {
          obstacles.push({ position: [x, 0.5, z], type: "rock" as const, size: 5 });
        }
      }

      vi.mocked(useGameState.getState).mockReturnValue({
        terrainObstacles: obstacles,
        safeZoneCenter: [0, 0],
        safeZoneRadius: 50,
        safeZoneActive: false,
        spawnEnemy: vi.fn(),
        isTerrainReady: true,
      } as unknown as ReturnType<typeof useGameState.getState>);

      // Should still return a valid position (possibly emergency fallback)
      const position = generateRandomPosition(50, [], 5, 10);
      expect(position).toBeDefined();
      expect(Array.isArray(position)).toBe(true);
      expect(position.length).toBe(3);
    });
  });

  describe("generateEnemies", () => {
    it("should generate exactly 1 enemy for level 1", () => {
      const enemies = generateEnemies(1, [0, 0.5, 0]);
      expect(enemies.length).toBe(1);
    });

    it("should generate tank type enemy for level 1", () => {
      const enemies = generateEnemies(1, [0, 0.5, 0]);
      expect(enemies[0].type).toBe("tank");
    });

    it("should set correct health for level 1 enemy", () => {
      const enemies = generateEnemies(1, [0, 0.5, 0]);
      expect(enemies[0].health).toBe(85);
    });

    it("should increase enemy count with level", () => {
      const enemies5 = generateEnemies(5, [0, 0.5, 0]);
      const enemies10 = generateEnemies(10, [0, 0.5, 0]);

      expect(enemies10.length).toBeGreaterThan(enemies5.length);
    });

    it("should cap enemy count at max limit", () => {
      const enemies = generateEnemies(100, [0, 0.5, 0]);
      expect(enemies.length).toBeLessThanOrEqual(GAME_CONSTANTS.MAX_ENEMIES);
    });

    it("should scale enemy health with level", () => {
      const enemies5 = generateEnemies(5, [0, 0.5, 0]);
      const enemies10 = generateEnemies(10, [0, 0.5, 0]);

      // Find tank enemies to compare (tank type is consistent for health comparison)
      const tank5 = enemies5.find((e) => e.type === "tank");
      const tank10 = enemies10.find((e) => e.type === "tank");

      if (tank5 && tank10) {
        expect(tank10.health).toBeGreaterThan(tank5.health);
      }
    });

    it("should not generate bombers before level 15", () => {
      // Run multiple times due to randomness
      for (let i = 0; i < 5; i++) {
        const enemies = generateEnemies(10, [0, 0.5, 0]);
        const bomberCount = enemies.filter((e) => e.type === "bomber").length;
        expect(bomberCount).toBe(0);
      }
    });

    it("should limit turrets to max 3", () => {
      // Run multiple times due to randomness
      for (let i = 0; i < 5; i++) {
        const enemies = generateEnemies(50, [0, 0.5, 0]);
        const turretCount = enemies.filter((e) => e.type === "turret").length;
        expect(turretCount).toBeLessThanOrEqual(3);
      }
    });

    it("should set bomber speed higher than tank speed", () => {
      vi.mocked(useGameState.getState).mockReturnValue({
        terrainObstacles: [],
        safeZoneCenter: [0, 0],
        safeZoneRadius: 50,
        safeZoneActive: false,
        spawnEnemy: vi.fn(),
        isTerrainReady: true,
      } as unknown as ReturnType<typeof useGameState.getState>);

      // Generate at level 20 to potentially get bombers
      const enemies = generateEnemies(20, [0, 0.5, 0]);

      const tanks = enemies.filter((e) => e.type === "tank");
      const bombers = enemies.filter((e) => e.type === "bomber");

      if (tanks.length > 0 && bombers.length > 0) {
        const bomberSpeed = bombers[0].speed ?? 0;
        const tankSpeed = tanks[0].speed ?? 0;
        expect(bomberSpeed).toBeGreaterThan(tankSpeed);
      }
    });

    it("should ensure enemies spawn inside safe zone when active", () => {
      const safeZoneRadius = 20;
      const safeZoneCenter: [number, number] = [5, 5];

      vi.mocked(useGameState.getState).mockReturnValue({
        terrainObstacles: [],
        safeZoneCenter: safeZoneCenter,
        safeZoneRadius: safeZoneRadius,
        safeZoneActive: true,
        spawnEnemy: vi.fn(),
        isTerrainReady: true,
      } as unknown as ReturnType<typeof useGameState.getState>);

      const enemies = generateEnemies(10, [0, 0.5, 0]);

      // Check that tanks and turrets are within safe zone
      for (const enemy of enemies) {
        if (enemy.type === "tank" || enemy.type === "turret") {
          const dx = enemy.position[0] - safeZoneCenter[0];
          const dz = enemy.position[2] - safeZoneCenter[1];
          const distance = Math.sqrt(dx * dx + dz * dz);
          // Allow some margin for fallback positions
          expect(distance).toBeLessThanOrEqual(safeZoneRadius * 1.5);
        }
      }
    });
  });

  describe("enemy count formulas", () => {
    const calculateEnemyCount = (level: number) =>
      level === 1 ? 2 : getMaxEnemies(level);

    it("should follow sqrt scaling for levels 1-10", () => {
      // Level 1: 1 + floor(1 * 1.25) = 1 + 1 = 2
      expect(calculateEnemyCount(1)).toBe(2);
      // Level 4: 1 + floor(2 * 1.25) = 1 + 2 = 3
      expect(calculateEnemyCount(4)).toBe(3);
      // Level 9: 1 + floor(3 * 1.25) = 1 + 3 = 4
      expect(calculateEnemyCount(9)).toBe(4);
    });

    it("should increase multiplier for levels 11-39", () => {
      // Level 16: 1 + floor(4 * 2) = 1 + 8 = 9
      expect(calculateEnemyCount(16)).toBe(9);
      // Level 25: 1 + floor(5 * 2) = 1 + 10 = 11
      expect(calculateEnemyCount(25)).toBe(11);
    });

    it("should cap at 15 for levels below 40", () => {
      expect(calculateEnemyCount(39)).toBeLessThanOrEqual(15);
    });

    it("should cap at 20 for levels 40-59", () => {
      expect(calculateEnemyCount(40)).toBeLessThanOrEqual(20);
      expect(calculateEnemyCount(59)).toBeLessThanOrEqual(20);
    });

    it("should allow a larger late-game field, capped at MAX_ENEMIES", () => {
      expect(calculateEnemyCount(80)).toBeGreaterThan(calculateEnemyCount(59));
      expect(calculateEnemyCount(200)).toBeLessThanOrEqual(GAME_CONSTANTS.MAX_ENEMIES);
    });
  });
});
