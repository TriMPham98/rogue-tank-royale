import { GAME_CONSTANTS } from "../constants/game";
import type { EnemyType } from "../types/index";

/** Bosses are drawn at roughly twice tank scale, so every weapon's hitbox grows with them. */
const BOSS_HITBOX_SCALE = 1.75;

/**
 * Per-weapon collision radius: each weapon tunes its own tank / non-tank radius,
 * bosses scale off the tank value.
 */
export const enemyHitRadius = (
  type: EnemyType,
  tankRadius: number,
  otherRadius: number
): number => {
  if (type === "boss") return tankRadius * BOSS_HITBOX_SCALE;
  return type === "tank" ? tankRadius : otherRadius;
};

/** Body radius used for spatial hashing and movement collision. */
export const enemyBodyRadius = (type: EnemyType): number => {
  switch (type) {
    case "bomber":
      return GAME_CONSTANTS.BOMBER_RADIUS;
    case "turret":
      return GAME_CONSTANTS.TURRET_COLLISION_RADIUS;
    case "boss":
      return GAME_CONSTANTS.BOSS_RADIUS;
    default:
      return GAME_CONSTANTS.TANK_RADIUS;
  }
};

export const isBossLevel = (level: number): boolean =>
  level > 0 && level % GAME_CONSTANTS.BOSS_LEVEL_INTERVAL === 0;
