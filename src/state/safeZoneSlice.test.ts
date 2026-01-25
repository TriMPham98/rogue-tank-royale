import { describe, it, expect } from "vitest";
import { calculateSafeZoneUpdates, initialSafeZoneState } from "./safeZoneSlice";
import { GAME_CONSTANTS } from "../constants/game";

describe("safeZoneSlice", () => {
  describe("calculateSafeZoneUpdates", () => {
    it("should not activate safe zone before level 5", () => {
      const result = calculateSafeZoneUpdates(1, 50, false, [0, 0]);
      expect(result.safeZoneActive).toBe(false);

      const result2 = calculateSafeZoneUpdates(4, 50, false, [0, 0]);
      expect(result2.safeZoneActive).toBe(false);
    });

    it("should activate safe zone at level 5", () => {
      const result = calculateSafeZoneUpdates(5, 50, false, [0, 0]);
      expect(result.safeZoneActive).toBe(true);
    });

    it("should reset radius to max when safe zone is not active", () => {
      const result = calculateSafeZoneUpdates(5, 30, false, [0, 0]);
      expect(result.safeZoneRadius).toBe(GAME_CONSTANTS.SAFE_ZONE_INITIAL_RADIUS);
    });

    it("should calculate correct target radius based on level tier", () => {
      // Level 5: tier 1 (floor(5/5) = 1), so target = 50 - 1*4 = 46
      const result1 = calculateSafeZoneUpdates(5, 50, true, [0, 0]);
      expect(result1.safeZoneTargetRadius).toBe(46);

      // Level 10: tier 2 (floor(10/5) = 2), so target = 50 - 2*4 = 42
      const result2 = calculateSafeZoneUpdates(10, 50, true, [0, 0]);
      expect(result2.safeZoneTargetRadius).toBe(42);

      // Level 15: tier 3 (floor(15/5) = 3), so target = 50 - 3*4 = 38
      const result3 = calculateSafeZoneUpdates(15, 50, true, [0, 0]);
      expect(result3.safeZoneTargetRadius).toBe(38);
    });

    it("should not shrink target radius below minimum", () => {
      // At very high levels, radius should clamp to min
      const result = calculateSafeZoneUpdates(100, 10, true, [0, 0]);
      expect(result.safeZoneTargetRadius).toBeGreaterThanOrEqual(
        GAME_CONSTANTS.SAFE_ZONE_MIN_RADIUS
      );
    });

    it("should snap radius to target on tier boundary levels", () => {
      // Level 10 is a tier boundary (10 % 5 === 0)
      const result = calculateSafeZoneUpdates(10, 50, true, [0, 0]);
      // Should snap to target radius
      expect(result.safeZoneRadius).toBe(result.safeZoneTargetRadius);
    });

    it("should set minimal shrink rate on tier boundary levels", () => {
      const result = calculateSafeZoneUpdates(10, 50, true, [0, 0]);
      expect(result.safeZoneShrinkRate).toBe(0.01);
    });

    it("should preserve center position", () => {
      const center: [number, number] = [10, -5];
      const result = calculateSafeZoneUpdates(5, 50, true, center);
      expect(result.safeZoneCenter).toEqual(center);
    });

    it("should flag pre-zone-change level correctly", () => {
      // Level 4: 4 % 5 === 4 and level >= 4, so isPreZoneChangeLevel = true
      const result4 = calculateSafeZoneUpdates(4, 50, false, [0, 0]);
      expect(result4.isPreZoneChangeLevel).toBe(true);

      // Level 9: 9 % 5 === 4 and level >= 4, so isPreZoneChangeLevel = true
      const result9 = calculateSafeZoneUpdates(9, 50, true, [0, 0]);
      expect(result9.isPreZoneChangeLevel).toBe(true);

      // Level 5: 5 % 5 === 0, so isPreZoneChangeLevel = false
      const result5 = calculateSafeZoneUpdates(5, 50, true, [0, 0]);
      expect(result5.isPreZoneChangeLevel).toBe(false);
    });

    it("should increase damage at higher levels", () => {
      const baseDamage = GAME_CONSTANTS.SAFE_ZONE_BASE_DAMAGE;

      const result5 = calculateSafeZoneUpdates(5, 50, true, [0, 0]);
      const result10 = calculateSafeZoneUpdates(10, 50, true, [0, 0]);
      const result50 = calculateSafeZoneUpdates(50, 20, true, [0, 0]);

      expect(result5.safeZoneDamage).toBeGreaterThanOrEqual(baseDamage);
      expect(result10.safeZoneDamage).toBeGreaterThan(result5.safeZoneDamage);
      expect(result50.safeZoneDamage).toBeGreaterThan(result10.safeZoneDamage);
    });

    it("should apply late game multiplier to damage after level 50", () => {
      const result50 = calculateSafeZoneUpdates(50, 20, true, [0, 0]);
      const result60 = calculateSafeZoneUpdates(60, 20, true, [0, 0]);

      // Late game should have significantly higher damage due to multiplier
      expect(result60.safeZoneDamage).toBeGreaterThan(result50.safeZoneDamage);
    });

    it("should cap shrink rate at maximum", () => {
      // At very high levels the shrink rate should be capped
      const result = calculateSafeZoneUpdates(100, 50, true, [0, 0]);
      expect(result.safeZoneShrinkRate).toBeLessThanOrEqual(
        GAME_CONSTANTS.SAFE_ZONE_MAX_SHRINK_RATE
      );
    });
  });

  describe("initialSafeZoneState", () => {
    it("should have correct initial values", () => {
      expect(initialSafeZoneState.safeZoneRadius).toBe(
        GAME_CONSTANTS.SAFE_ZONE_INITIAL_RADIUS
      );
      expect(initialSafeZoneState.safeZoneCenter).toEqual([0, 0]);
      expect(initialSafeZoneState.safeZoneActive).toBe(false);
      expect(initialSafeZoneState.isPreZoneChangeLevel).toBe(false);
    });
  });
});
