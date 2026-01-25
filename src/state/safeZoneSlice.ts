// Safe Zone state slice
import type { StateCreator } from "zustand";
import type { GameState, SafeZoneSlice } from "./types";
import { GAME_CONSTANTS } from "../constants/game";

export const createSafeZoneSlice: StateCreator<
  GameState,
  [],
  [],
  SafeZoneSlice
> = () => ({
  safeZoneRadius: GAME_CONSTANTS.SAFE_ZONE_INITIAL_RADIUS,
  safeZoneCenter: [0, 0],
  safeZoneTargetRadius: GAME_CONSTANTS.SAFE_ZONE_INITIAL_RADIUS,
  safeZoneShrinkRate: GAME_CONSTANTS.SAFE_ZONE_DEFAULT_SHRINK_RATE,
  safeZoneDamage: GAME_CONSTANTS.SAFE_ZONE_BASE_DAMAGE,
  safeZoneActive: false,
  isPreZoneChangeLevel: false,
});

// Initial safe zone state for reset
export const initialSafeZoneState: SafeZoneSlice = {
  safeZoneRadius: GAME_CONSTANTS.SAFE_ZONE_INITIAL_RADIUS,
  safeZoneCenter: [0, 0],
  safeZoneTargetRadius: GAME_CONSTANTS.SAFE_ZONE_INITIAL_RADIUS,
  safeZoneShrinkRate: GAME_CONSTANTS.SAFE_ZONE_DEFAULT_SHRINK_RATE,
  safeZoneDamage: GAME_CONSTANTS.SAFE_ZONE_BASE_DAMAGE,
  safeZoneActive: false,
  isPreZoneChangeLevel: false,
};

// Helper to calculate safe zone updates on level advance
export const calculateSafeZoneUpdates = (
  newLevel: number,
  currentRadius: number,
  safeZoneActive: boolean,
  currentCenter: [number, number]
) => {
  const maxRadius = GAME_CONSTANTS.SAFE_ZONE_INITIAL_RADIUS;
  const minRadius = GAME_CONSTANTS.SAFE_ZONE_MIN_RADIUS;
  const radiusDecrease = GAME_CONSTANTS.SAFE_ZONE_RADIUS_DECREASE_PER_TIER;

  const zoneReductionLevel = Math.floor(newLevel / 5);
  const newTargetRadius = Math.max(
    minRadius,
    maxRadius - zoneReductionLevel * radiusDecrease
  );

  // Estimate total enemies before next zone
  let totalEnemiesBeforeNextZone = 0;
  for (let i = 0; i < zoneReductionLevel; i++) {
    const levelNum = newLevel + i;
    if (levelNum <= 24) {
      totalEnemiesBeforeNextZone += Math.ceil(levelNum / 2);
    } else if (levelNum <= 50) {
      totalEnemiesBeforeNextZone += 12 + Math.ceil((levelNum - 24) / 2);
    } else {
      totalEnemiesBeforeNextZone += 25 + Math.ceil((levelNum - 50) * 1.5);
    }
  }

  const estimatedSecondsToNextZone = totalEnemiesBeforeNextZone * 10;

  let newShrinkRate;
  let newCurrentRadius = currentRadius;

  if (newLevel % 5 === 0 && newLevel > 0) {
    newCurrentRadius = newTargetRadius;
    newShrinkRate = 0.01;
  } else {
    const nextZoneLevel = Math.floor(newLevel / 5) + 1;
    const nextZoneTargetRadius = Math.max(
      minRadius,
      maxRadius - nextZoneLevel * radiusDecrease
    );

    const totalRadiusToShrink = currentRadius - nextZoneTargetRadius;
    const safetyFactor = 0.3;

    let baseShrinkRate =
      totalRadiusToShrink / (estimatedSecondsToNextZone * safetyFactor);

    if (newLevel > 50) {
      const lateGameMultiplier = 1 + (newLevel - 50) * 0.1;
      baseShrinkRate *= lateGameMultiplier;
    }

    const calculatedShrinkRate = Math.max(0.01, baseShrinkRate);
    newShrinkRate = Math.min(
      GAME_CONSTANTS.SAFE_ZONE_MAX_SHRINK_RATE,
      calculatedShrinkRate
    );
  }

  if (!safeZoneActive) {
    newCurrentRadius = maxRadius;
  }

  const shouldActivateSafeZone =
    newLevel >= GAME_CONSTANTS.SAFE_ZONE_ACTIVATION_LEVEL;

  const baseDamage = GAME_CONSTANTS.SAFE_ZONE_BASE_DAMAGE;
  let newSafeZoneDamage = baseDamage + zoneReductionLevel * 0.5;

  if (newLevel > 50) {
    const lateGameLevel = newLevel - 50;
    const lateGameMultiplier = 1 + Math.pow(lateGameLevel * 0.2, 1.5);
    newSafeZoneDamage *= lateGameMultiplier;
  }

  return {
    safeZoneRadius: newCurrentRadius,
    safeZoneCenter: currentCenter,
    safeZoneTargetRadius: newTargetRadius,
    safeZoneShrinkRate: newShrinkRate,
    safeZoneActive: shouldActivateSafeZone,
    safeZoneDamage: newSafeZoneDamage,
    isPreZoneChangeLevel: newLevel % 5 === 4 && newLevel >= 4,
  };
};
