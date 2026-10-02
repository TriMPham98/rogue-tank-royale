import { describe, it, expect } from "vitest";
import { fpvBaseFov, fpvTargetFov } from "./fpvFov";
import { GAME_CONSTANTS } from "../constants/game";

describe("FPV field of view", () => {
  it("lands near the old 65° on a 16:9 screen", () => {
    expect(fpvBaseFov(16 / 9)).toBeGreaterThan(62);
    expect(fpvBaseFov(16 / 9)).toBeLessThan(66);
  });

  it("clamps ultrawide and narrow screens", () => {
    expect(fpvBaseFov(32 / 9)).toBe(GAME_CONSTANTS.FPV_MIN_FOV);
    expect(fpvBaseFov(1)).toBe(GAME_CONSTANTS.FPV_MAX_FOV);
  });

  it("widens with speed up to the boost", () => {
    const base = fpvBaseFov(16 / 9);
    expect(fpvTargetFov(16 / 9, 0)).toBe(base);
    expect(fpvTargetFov(16 / 9, 5)).toBe(base + GAME_CONSTANTS.FPV_SPEED_FOV_BOOST);
  });
});
