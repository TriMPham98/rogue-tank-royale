// Level difficulty curve: one place for enemy stats, counts and pacing.
//
// Levels 1-20 keep the original linear curve. Past level 20 enemies gain
// quadratic bonus health, fire faster, move faster and hit harder, and the
// field holds more of them, so late runs ramp instead of plateauing.
import { GAME_CONSTANTS } from "../constants/game";
import type { EnemyType } from "../types/index";

/** Level the late-game ramp starts from. */
export const LATE_GAME_START = 20;

const lateLevels = (level: number) => Math.max(0, level - LATE_GAME_START);

/** Quadratic bonus health past LATE_GAME_START (L30 +15, L40 +60, L50 +135, L60 +240). */
const lateHealthBonus = (level: number) => Math.round(0.15 * lateLevels(level) ** 2);

export const enemyHealth = (type: Exclude<EnemyType, "boss">, level: number): number => {
  switch (type) {
    case "bomber":
      return 40 + level * 3 + Math.round(lateHealthBonus(level) * 0.5);
    case "turret":
      return 75 + level * GAME_CONSTANTS.ENEMY_HEALTH_SCALE_PER_LEVEL + lateHealthBonus(level);
    default:
      return 50 + level * GAME_CONSTANTS.ENEMY_HEALTH_SCALE_PER_LEVEL + lateHealthBonus(level);
  }
};

/** Movement multiplier: +1.2%/level past the ramp start, capped at +50%. */
export const enemySpeedMultiplier = (level: number): number =>
  Math.min(1.5, 1 + lateLevels(level) * 0.012);

export const enemySpeed = (type: Exclude<EnemyType, "boss" | "turret">, level: number): number =>
  (type === "bomber" ? 4.0 : 1.3) * enemySpeedMultiplier(level);

/** Seconds between enemy shots; shortens from level 15. */
export const enemyFireInterval = (type: "tank" | "turret", level: number): number => {
  const ramp = Math.max(0, level - 15) * 0.07;
  return type === "tank"
    ? Math.max(2.4, GAME_CONSTANTS.ENEMY_TANK_FIRE_RATE - ramp)
    : Math.max(3.0, GAME_CONSTANTS.ENEMY_TURRET_FIRE_RATE - ramp);
};

/** Enemy shell damage by level (original tiers, extended past 60). */
export const enemyShotDamage = (level: number): number => {
  if (level > 80) return 42;
  if (level > 70) return 36;
  if (level > 60) return 30;
  if (level > 50) return 25;
  if (level > 40) return 20;
  if (level > 25) return 15;
  if (level > 15) return 10;
  return 5;
};

/** Hostiles allowed on the field at once. */
export const getMaxEnemies = (level: number): number => {
  if (level === 1) return 1;
  if (level <= 10) return Math.min(1 + Math.floor(Math.sqrt(level) * 1.25), 15);
  if (level < 40) return Math.min(1 + Math.floor(Math.sqrt(level) * 2), 15);
  if (level < 60) return Math.min(1 + Math.floor(Math.sqrt(level) * 2.3), 20);
  return Math.min(1 + Math.floor(Math.sqrt(level) * 2.6), GAME_CONSTANTS.MAX_ENEMIES);
};

/** Delay before a destroyed enemy is replaced. */
export const respawnDelayMs = (level: number): number =>
  Math.max(4000 - level * 150, level >= 40 ? 900 : 1500);

/** Boss health multiplier over a same-level tank: grows faster each boss. */
export const bossHealthMultiplier = (bossIndex: number): number =>
  GAME_CONSTANTS.BOSS_HEALTH_MULTIPLIER + bossIndex * 3 + bossIndex * bossIndex;
