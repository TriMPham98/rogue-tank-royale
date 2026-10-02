import { describe, it, expect } from "vitest";
import {
  enemyHealth,
  enemyFireInterval,
  enemySpeedMultiplier,
  respawnDelayMs,
  bossHealthMultiplier,
  LATE_GAME_START,
} from "./difficulty";

describe("difficulty curve", () => {
  it("keeps the original linear health up to the late-game start", () => {
    expect(enemyHealth("tank", 10)).toBe(50 + 10 * 9);
    expect(enemyHealth("turret", LATE_GAME_START)).toBe(75 + LATE_GAME_START * 9);
  });

  it("ramps health faster than linear in late levels", () => {
    const step = (l: number) => enemyHealth("tank", l + 10) - enemyHealth("tank", l);
    expect(step(40)).toBeGreaterThan(step(20));
    expect(step(60)).toBeGreaterThan(step(40));
  });

  it("shortens enemy fire intervals with a floor", () => {
    expect(enemyFireInterval("tank", 10)).toBe(5);
    expect(enemyFireInterval("tank", 40)).toBeLessThan(5);
    expect(enemyFireInterval("tank", 200)).toBe(2.4);
  });

  it("caps speed and respawn pacing", () => {
    expect(enemySpeedMultiplier(10)).toBe(1);
    expect(enemySpeedMultiplier(500)).toBe(1.5);
    expect(respawnDelayMs(10)).toBe(2500);
    expect(respawnDelayMs(60)).toBe(900);
  });

  it("makes each boss proportionally tougher", () => {
    expect(bossHealthMultiplier(1) - bossHealthMultiplier(0)).toBeLessThan(
      bossHealthMultiplier(3) - bossHealthMultiplier(2)
    );
  });
});
