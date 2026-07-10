import { UpgradeableStat } from "./gameState";

export interface StatUpgradeIncrement {
  amount: number;
  maxValue?: number;
}

// Define the increment amounts for each stat
export const STAT_UPGRADE_INCREMENTS: Record<
  UpgradeableStat,
  StatUpgradeIncrement
> = {
  tankSpeed: { amount: 0.5 },
  fireRate: { amount: 0.1, maxValue: 3.0 }, // This is RPS, so fireRate is reduced
  cameraRange: { amount: 2 },
  maxHealth: { amount: 25 },
  healthRegen: { amount: 0.5 },
  turretDamage: { amount: 5 },
  bulletVelocity: { amount: 2 },
  penetration: { amount: 1, maxValue: 3 }, // Reduced max value to 3 but kept increment at 1
};

/**
 * Calculate enhanced weapon range based on camera sensor upgrades.
 *
 * Sensor Range (cameraRange) starts at the initial value of 8.
 * Each upgrade adds +2 to cameraRange (see STAT_UPGRADE_INCREMENTS).
 * The number of sensor upgrades applied = max(0, (currentCameraRange - 8) / 2).
 *
 * Each sensor upgrade provides a 15% multiplicative bonus to weapon/secondary range.
 * Example: 1 upgrade (camera=10) => +15% range; 2 upgrades (camera=12) => +30% range, etc.
 *
 * @param baseRange - The weapon's base range value
 * @param playerCameraRange - The player's current sensor/camera range stat
 * @returns The enhanced range, rounded to 1 decimal place
 */
export const calculateEnhancedWeaponRange = (
  baseRange: number,
  playerCameraRange: number
): number => {
  const baseCameraRange = 8; // Initial camera range
  const cameraUpgrades = Math.max(0, (playerCameraRange - baseCameraRange) / 2);

  // Each camera sensor upgrade increases weapon range by 15%
  const rangeMultiplier = 1 + cameraUpgrades * 0.15;

  return Math.round(baseRange * rangeMultiplier * 10) / 10; // Round to 1 decimal place
};

// Get human-readable display name for each stat
export const getStatDisplayName = (stat: UpgradeableStat): string => {
  switch (stat) {
    case "tankSpeed":
      return "Mobility";
    case "fireRate":
      return "Rate of Fire";
    case "cameraRange":
      return "Sensor Range";
    case "maxHealth":
      return "Armor Plating";
    case "healthRegen":
      return "Repair Systems";
    case "turretDamage":
      return "Firepower";
    case "bulletVelocity":
      return "Muzzle Velocity";
    case "penetration":
      return "Piercing Power";
  }
};

// Get current value of a stat with proper formatting
export const getStatCurrentValue = (
  stat: UpgradeableStat,
  values: {
    playerSpeed: number;
    playerFireRate: number;
    playerCameraRange: number;
    playerMaxHealth: number;
    playerHealthRegen: number;
    playerTurretDamage: number;
    playerBulletVelocity: number;
    playerPenetration: number;
  }
): string => {
  const {
    playerSpeed,
    playerFireRate,
    playerCameraRange,
    playerMaxHealth,
    playerHealthRegen,
    playerTurretDamage,
    playerBulletVelocity,
    playerPenetration,
  } = values;

  switch (stat) {
    case "tankSpeed":
      return `${playerSpeed.toFixed(1)} m/s`;
    case "fireRate":
      return `${(1 / playerFireRate).toFixed(1)} rps`;
    case "cameraRange":
      return `${playerCameraRange.toFixed(0)}m`;
    case "maxHealth":
      return `${playerMaxHealth} HP`;
    case "healthRegen":
      return `${playerHealthRegen.toFixed(1)} HP/s`;
    case "turretDamage":
      return `${playerTurretDamage} DMG`;
    case "bulletVelocity":
      return `${playerBulletVelocity} m/s`;
    case "penetration":
      return `${playerPenetration} Targets`;
  }
};

// Calculate and format post-upgrade value for a stat
export const getStatPostUpgradeValue = (
  stat: UpgradeableStat,
  values: {
    playerSpeed: number;
    playerFireRate: number;
    playerCameraRange: number;
    playerMaxHealth: number;
    playerHealthRegen: number;
    playerTurretDamage: number;
    playerBulletVelocity: number;
    playerPenetration: number;
  }
): string => {
  const {
    playerSpeed,
    playerFireRate,
    playerCameraRange,
    playerMaxHealth,
    playerHealthRegen,
    playerTurretDamage,
    playerBulletVelocity,
    playerPenetration,
  } = values;

  const increment = STAT_UPGRADE_INCREMENTS[stat];

  switch (stat) {
    case "tankSpeed":
      return `${(playerSpeed + increment.amount).toFixed(1)} m/s`;
    case "fireRate": {
      const currentRPS = 1 / playerFireRate;
      const newRPS = Math.min(
        increment.maxValue || Infinity,
        currentRPS + increment.amount
      );
      return `${newRPS.toFixed(1)} rps`;
    }
    case "cameraRange":
      return `${(playerCameraRange + increment.amount).toFixed(0)}m`;
    case "maxHealth":
      return `${playerMaxHealth + increment.amount} HP`;
    case "healthRegen":
      return `${(playerHealthRegen + increment.amount).toFixed(1)} HP/s`;
    case "turretDamage":
      return `${playerTurretDamage + increment.amount} DMG`;
    case "bulletVelocity":
      return `${playerBulletVelocity + increment.amount} m/s`;
    case "penetration":
      return `${Math.min(
        increment.maxValue || Infinity,
        playerPenetration + increment.amount
      )} Targets`;
  }
};

// Get flavor text description for each stat upgrade
export const getStatDescription = (stat: UpgradeableStat): string => {
  switch (stat) {
    case "tankSpeed":
      return "Enhance chassis servos for faster battlefield repositioning.";
    case "fireRate":
      return "Optimize loading mechanism for increased rounds per second.";
    case "cameraRange":
      return "Upgrade sensor suite for extended tactical awareness (+15% secondary weapon range per upgrade).";
    case "maxHealth":
      return "Reinforce hull structure, increasing damage tolerance.";
    case "healthRegen":
      return "Install nano-repair bots for passive armor regeneration.";
    case "turretDamage":
      return "Calibrate main gun for higher impact kinetic energy.";
    case "bulletVelocity":
      return "Improve projectile propulsion for faster target engagement.";
    case "penetration":
      return "Integrate experimental core-piercing ammunition technology.";
  }
};

// Apply stat upgrade to current values
export const applyStatUpgrade = (
  stat: UpgradeableStat,
  currentValues: {
    playerSpeed: number;
    playerFireRate: number;
    playerCameraRange: number;
    playerMaxHealth: number;
    playerHealthRegen: number;
    playerTurretDamage: number;
    playerBulletVelocity: number;
    playerPenetration: number;
  }
): Partial<typeof currentValues> => {
  const increment = STAT_UPGRADE_INCREMENTS[stat];

  switch (stat) {
    case "tankSpeed":
      return { playerSpeed: currentValues.playerSpeed + increment.amount };
    case "fireRate": {
      // Convert to RPS, increment, then convert back to cooldown
      const currentRPS = 1 / currentValues.playerFireRate;
      const newRPS = Math.min(
        increment.maxValue || Infinity,
        currentRPS + increment.amount
      );
      return { playerFireRate: 1 / newRPS };
    }
    case "cameraRange":
      return {
        playerCameraRange: currentValues.playerCameraRange + increment.amount,
      };
    case "maxHealth":
      return {
        playerMaxHealth: currentValues.playerMaxHealth + increment.amount,
      };
    case "healthRegen":
      return {
        playerHealthRegen: currentValues.playerHealthRegen + increment.amount,
      };
    case "turretDamage":
      return {
        playerTurretDamage: currentValues.playerTurretDamage + increment.amount,
      };
    case "bulletVelocity":
      return {
        playerBulletVelocity:
          currentValues.playerBulletVelocity + increment.amount,
      };
    case "penetration":
      return {
        playerPenetration: Math.min(
          increment.maxValue || Infinity,
          currentValues.playerPenetration + increment.amount
        ),
      };
  }
};
