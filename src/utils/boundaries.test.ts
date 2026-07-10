import { describe, it, expect } from "vitest";
import { enforceMapBoundaries, isWithinMapBoundaries } from "./boundaries";
import { GAME_CONSTANTS } from "../constants/game";

const half = GAME_CONSTANTS.HALF_MAP_SIZE;
const buffer = GAME_CONSTANTS.MAP_BOUNDARY_BUFFER;
const limit = half - buffer;

describe("enforceMapBoundaries", () => {
  it("leaves in-bounds positions unchanged", () => {
    expect(enforceMapBoundaries([0, 0.5, 0])).toEqual([0, 0.5, 0]);
    expect(enforceMapBoundaries([10, 1, -10])).toEqual([10, 1, -10]);
  });

  it("clamps X and Z to the buffered map edge", () => {
    expect(enforceMapBoundaries([100, 0.5, 0])).toEqual([limit, 0.5, 0]);
    expect(enforceMapBoundaries([-100, 0.5, 0])).toEqual([-limit, 0.5, 0]);
    expect(enforceMapBoundaries([0, 0.5, 100])).toEqual([0, 0.5, limit]);
    expect(enforceMapBoundaries([0, 0.5, -100])).toEqual([0, 0.5, -limit]);
  });

  it("preserves Y", () => {
    expect(enforceMapBoundaries([200, 3.5, 200])[1]).toBe(3.5);
  });

  it("clamps exactly at the half-map edge", () => {
    expect(enforceMapBoundaries([half, 0, half])).toEqual([limit, 0, limit]);
  });
});

describe("isWithinMapBoundaries", () => {
  it("returns true inside buffered bounds", () => {
    expect(isWithinMapBoundaries(0, 0)).toBe(true);
    expect(isWithinMapBoundaries(limit, limit)).toBe(true);
    expect(isWithinMapBoundaries(-limit, -limit)).toBe(true);
  });

  it("returns false outside buffered bounds", () => {
    expect(isWithinMapBoundaries(half, 0)).toBe(false);
    expect(isWithinMapBoundaries(0, -half)).toBe(false);
    expect(isWithinMapBoundaries(limit + 0.01, 0)).toBe(false);
  });
});
