// Vehicle-vs-vehicle collision (player <-> enemies, enemies <-> enemies).
// Rocks and map edges live in useTankCollision; this only handles hulls.
import { GAME_CONSTANTS } from "../constants/game";
import { useGameState } from "./gameState";
import { getEnemyVisualPosition } from "./enemyVisualPositions";
import { enemyBodyRadius } from "./enemyHitbox";

const HULL_GAP = 0.15;

/**
 * True when moving from (fromX, fromZ) to (toX, toZ) would push this hull
 * into another vehicle. A move that *increases* separation from an
 * overlapping vehicle is always allowed, so spawn overlaps can untangle.
 *
 * `selfId` undefined means the player tank. Bombers are never blockers or
 * blocked: they have to reach the player to detonate.
 */
export const checkVehicleCollision = (
  selfId: string | undefined,
  selfRadius: number,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number
): boolean => {
  const state = useGameState.getState();

  const blocks = (ox: number, oz: number, otherRadius: number) => {
    const minDist = selfRadius + otherRadius + HULL_GAP;
    const ndx = toX - ox;
    const ndz = toZ - oz;
    const newDistSq = ndx * ndx + ndz * ndz;
    if (newDistSq >= minDist * minDist) return false;
    const cdx = fromX - ox;
    const cdz = fromZ - oz;
    return newDistSq < cdx * cdx + cdz * cdz;
  };

  if (selfId !== undefined) {
    const self = state.enemies.find((e) => e.id === selfId);
    if (self?.type === "bomber") return false;
    const [px, , pz] = state.playerTankPosition;
    if (blocks(px, pz, GAME_CONSTANTS.TANK_RADIUS)) return true;
  }

  for (const enemy of state.enemies) {
    if (enemy.id === selfId || enemy.type === "bomber") continue;
    const at = getEnemyVisualPosition(enemy.id) ?? enemy.position;
    if (blocks(at[0], at[2], enemyBodyRadius(enemy.type))) return true;
  }
  return false;
};

/**
 * Resolve a move against `isBlocked`, sliding along X or Z when the full
 * step is blocked so hulls glance off each other instead of sticking.
 * Returns the accepted position, or null when every option is blocked.
 */
export const resolveMove = (
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  isBlocked: (x: number, z: number) => boolean
): [number, number] | null => {
  if (!isBlocked(toX, toZ)) return [toX, toZ];
  if (toX !== fromX && !isBlocked(toX, fromZ)) return [toX, fromZ];
  if (toZ !== fromZ && !isBlocked(fromX, toZ)) return [fromX, toZ];
  return null;
};
