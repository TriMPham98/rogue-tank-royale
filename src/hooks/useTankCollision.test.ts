import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Mock the gameState module
vi.mock("../utils/gameState", () => ({
  useGameState: {
    getState: vi.fn(),
  },
}));

import { useTankCollision } from "./useTankCollision";
import { useGameState } from "../utils/gameState";
import { GAME_CONSTANTS } from "../constants/game";

describe("useTankCollision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("map boundary collision", () => {
    beforeEach(() => {
      vi.mocked(useGameState.getState).mockReturnValue({
        terrainObstacles: [],
        enemies: [],
      } as unknown as ReturnType<typeof useGameState.getState>);
    });

    it("should detect collision at map boundary", () => {
      const { result } = renderHook(() =>
        useTankCollision({ tankRadius: 1.25 })
      );

      const boundary = GAME_CONSTANTS.HALF_MAP_SIZE - 1;

      // At boundary should collide
      expect(result.current.checkTerrainCollision(boundary + 0.1, 0)).toBe(true);
      expect(result.current.checkTerrainCollision(-(boundary + 0.1), 0)).toBe(true);
      expect(result.current.checkTerrainCollision(0, boundary + 0.1)).toBe(true);
      expect(result.current.checkTerrainCollision(0, -(boundary + 0.1))).toBe(true);
    });

    it("should not collide inside map bounds", () => {
      const { result } = renderHook(() =>
        useTankCollision({ tankRadius: 1.25 })
      );

      expect(result.current.checkTerrainCollision(0, 0)).toBe(false);
      expect(result.current.checkTerrainCollision(10, 10)).toBe(false);
      expect(result.current.checkTerrainCollision(-20, 20)).toBe(false);
    });

    it("should collide at corner boundaries", () => {
      const { result } = renderHook(() =>
        useTankCollision({ tankRadius: 1.25 })
      );

      const boundary = GAME_CONSTANTS.HALF_MAP_SIZE;

      // Corner should collide
      expect(result.current.checkTerrainCollision(boundary, boundary)).toBe(true);
    });
  });

  describe("terrain obstacle collision", () => {
    it("should detect collision with rock obstacle", () => {
      vi.mocked(useGameState.getState).mockReturnValue({
        terrainObstacles: [
          { position: [10, 0.5, 10], type: "rock", size: 3 },
        ],
        enemies: [],
      } as unknown as ReturnType<typeof useGameState.getState>);

      const { result } = renderHook(() =>
        useTankCollision({ tankRadius: 1.25 })
      );

      // Position on top of obstacle should collide
      expect(result.current.checkTerrainCollision(10, 10)).toBe(true);

      // Position close to obstacle should collide
      const obstacleRadius = 3 * GAME_CONSTANTS.OBSTACLE_RADIUS_MULTIPLIER;
      const tankRadius = 1.25;
      const closeDistance = obstacleRadius + tankRadius + 0.05; // Just within collision range
      expect(result.current.checkTerrainCollision(10 + closeDistance, 10)).toBe(true);
    });

    it("should not collide when far from obstacle", () => {
      vi.mocked(useGameState.getState).mockReturnValue({
        terrainObstacles: [
          { position: [10, 0.5, 10], type: "rock", size: 3 },
        ],
        enemies: [],
      } as unknown as ReturnType<typeof useGameState.getState>);

      const { result } = renderHook(() =>
        useTankCollision({ tankRadius: 1.25 })
      );

      // Position far from obstacle should not collide
      expect(result.current.checkTerrainCollision(-20, -20)).toBe(false);
      expect(result.current.checkTerrainCollision(30, 30)).toBe(false);
    });

    it("should handle multiple obstacles", () => {
      vi.mocked(useGameState.getState).mockReturnValue({
        terrainObstacles: [
          { position: [10, 0.5, 10], type: "rock", size: 3 },
          { position: [-10, 0.5, -10], type: "rock", size: 2 },
          { position: [20, 0.5, -15], type: "rock", size: 4 },
        ],
        enemies: [],
      } as unknown as ReturnType<typeof useGameState.getState>);

      const { result } = renderHook(() =>
        useTankCollision({ tankRadius: 1.25 })
      );

      // Collide with first obstacle
      expect(result.current.checkTerrainCollision(10, 10)).toBe(true);
      // Collide with second obstacle
      expect(result.current.checkTerrainCollision(-10, -10)).toBe(true);
      // Collide with third obstacle
      expect(result.current.checkTerrainCollision(20, -15)).toBe(true);
      // No collision in empty area
      expect(result.current.checkTerrainCollision(0, 0)).toBe(false);
    });

    it("should treat obstacles without type as rocks", () => {
      vi.mocked(useGameState.getState).mockReturnValue({
        terrainObstacles: [
          { position: [10, 0.5, 10], size: 3 }, // No type specified
        ],
        enemies: [],
      } as unknown as ReturnType<typeof useGameState.getState>);

      const { result } = renderHook(() =>
        useTankCollision({ tankRadius: 1.25 })
      );

      expect(result.current.checkTerrainCollision(10, 10)).toBe(true);
    });
  });

  describe("turret collision for enemy tanks", () => {
    it("should detect collision with turrets for enemy tanks", () => {
      vi.mocked(useGameState.getState).mockReturnValue({
        terrainObstacles: [],
        enemies: [
          { id: "enemy-1", position: [0, 0.5, 0], type: "tank" },
          { id: "turret-1", position: [10, 0.5, 10], type: "turret" },
        ],
      } as unknown as ReturnType<typeof useGameState.getState>);

      const { result } = renderHook(() =>
        useTankCollision({ tankRadius: 1.25, enemyId: "enemy-1" })
      );

      // Should collide with turret
      expect(result.current.checkTerrainCollision(10, 10)).toBe(true);
    });

    it("should skip self-collision for enemy tanks", () => {
      vi.mocked(useGameState.getState).mockReturnValue({
        terrainObstacles: [],
        enemies: [
          { id: "enemy-1", position: [0, 0.5, 0], type: "turret" },
        ],
      } as unknown as ReturnType<typeof useGameState.getState>);

      const { result } = renderHook(() =>
        useTankCollision({ tankRadius: 1.25, enemyId: "enemy-1" })
      );

      // Should not collide with itself even if it's a turret
      expect(result.current.checkTerrainCollision(0, 0)).toBe(false);
    });

    it("should not check turret collision for player tank", () => {
      vi.mocked(useGameState.getState).mockReturnValue({
        terrainObstacles: [],
        enemies: [
          { id: "turret-1", position: [10, 0.5, 10], type: "turret" },
        ],
      } as unknown as ReturnType<typeof useGameState.getState>);

      // No enemyId means player tank
      const { result } = renderHook(() =>
        useTankCollision({ tankRadius: 1.25 })
      );

      // Player should not collide with turrets through this hook
      // (player collision with turrets is handled separately)
      expect(result.current.checkTerrainCollision(10, 10)).toBe(false);
    });

    it("should only treat turrets as obstacles, not other tanks", () => {
      vi.mocked(useGameState.getState).mockReturnValue({
        terrainObstacles: [],
        enemies: [
          { id: "enemy-1", position: [0, 0.5, 0], type: "tank" },
          { id: "enemy-2", position: [10, 0.5, 10], type: "tank" },
          { id: "turret-1", position: [20, 0.5, 20], type: "turret" },
        ],
      } as unknown as ReturnType<typeof useGameState.getState>);

      const { result } = renderHook(() =>
        useTankCollision({ tankRadius: 1.25, enemyId: "enemy-1" })
      );

      // Should not collide with other tanks
      expect(result.current.checkTerrainCollision(10, 10)).toBe(false);
      // Should collide with turret
      expect(result.current.checkTerrainCollision(20, 20)).toBe(true);
    });
  });

  describe("tank radius configuration", () => {
    it("should use provided tank radius for collision detection", () => {
      vi.mocked(useGameState.getState).mockReturnValue({
        terrainObstacles: [
          { position: [10, 0.5, 10], type: "rock", size: 2 },
        ],
        enemies: [],
      } as unknown as ReturnType<typeof useGameState.getState>);

      const obstacleRadius = 2 * GAME_CONSTANTS.OBSTACLE_RADIUS_MULTIPLIER;

      // Small tank radius
      const { result: smallResult } = renderHook(() =>
        useTankCollision({ tankRadius: 0.5 })
      );
      const smallTotalRange = obstacleRadius + 0.5 + 0.1; // obstacle + tank + safety

      // Large tank radius
      const { result: largeResult } = renderHook(() =>
        useTankCollision({ tankRadius: 2.0 })
      );

      // Position that's in collision range for large but not small
      // Just outside small range (smallTotalRange + 0.5), but inside large range
      const testX = 10 + smallTotalRange + 0.5;

      expect(smallResult.current.checkTerrainCollision(testX, 10)).toBe(false);
      expect(largeResult.current.checkTerrainCollision(testX, 10)).toBe(true);
    });
  });

  describe("collision vectors memoization", () => {
    it("should provide memoized collision vectors", () => {
      vi.mocked(useGameState.getState).mockReturnValue({
        terrainObstacles: [],
        enemies: [],
      } as unknown as ReturnType<typeof useGameState.getState>);

      const { result, rerender } = renderHook(() =>
        useTankCollision({ tankRadius: 1.25 })
      );

      const firstVectors = result.current.collisionVectors;
      rerender();
      const secondVectors = result.current.collisionVectors;

      // Should be the same object reference (memoized)
      expect(firstVectors).toBe(secondVectors);
    });
  });
});
