import { describe, it, expect, beforeEach } from "vitest";
import { useGameState } from "../state";
import { checkVehicleCollision, resolveMove } from "./vehicleCollision";
import { clearAllEnemyVisualPositions } from "./enemyVisualPositions";

const R = 1.25;

describe("vehicle collision", () => {
  beforeEach(() => {
    clearAllEnemyVisualPositions();
    useGameState.setState({
      playerTankPosition: [0, 0.5, 0],
      enemies: [
        { id: "tank-a", type: "tank", position: [5, 0.5, 0], health: 100 },
        { id: "bomber-a", type: "bomber", position: [-5, 0.5, 0], health: 50 },
      ],
    });
  });

  it("stops the player driving into an enemy tank", () => {
    expect(checkVehicleCollision(undefined, R, 2.5, 0, 2.6, 0)).toBe(true);
  });

  it("lets the player pass through bombers so they can still detonate", () => {
    expect(checkVehicleCollision(undefined, R, -2.5, 0, -4.9, 0)).toBe(false);
  });

  it("stops an enemy tank driving into the player", () => {
    expect(checkVehicleCollision("tank-a", R, 3, 0, 2.6, 0)).toBe(true);
  });

  it("never blocks bombers", () => {
    expect(checkVehicleCollision("bomber-a", R, -1, 0, -0.5, 0)).toBe(false);
  });

  it("allows moves that separate already-overlapping hulls", () => {
    expect(checkVehicleCollision(undefined, R, 4, 0, 3.8, 0)).toBe(false);
  });

  it("slides along an axis when the full step is blocked", () => {
    const blockedX = (x: number) => x > 1;
    expect(resolveMove(0, 0, 2, 2, (x) => blockedX(x))).toEqual([0, 2]);
    expect(resolveMove(0, 0, 2, 0, () => true)).toBeNull();
  });
});
