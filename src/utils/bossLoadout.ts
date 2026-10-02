// Boss weapon progression: each boss tier unlocks one more weapon system,
// so the first boss is a learnable fight and later ones stack threats.
import { GAME_CONSTANTS } from "../constants/game";

export type BossWeapon = "shotgun" | "mortar" | "cannon" | "escort" | "overdrive";

/** Tier at which each weapon comes online (tier 1 = level 10, tier 2 = level 20, ...). */
export const BOSS_WEAPON_UNLOCKS: Record<BossWeapon, number> = {
  shotgun: 1, // L10: close-range pellet spread
  mortar: 2, // L20: telegraphed barrages on the player's position
  cannon: 3, // L30: long-range high-velocity shell, punishes kiting the shotgun
  escort: 4, // L40: periodically calls in a pair of bombers
  overdrive: 5, // L50+: enrages below 40% hull (faster fire, speed, bigger barrages)
};

export const BOSS_WEAPON_LABELS: Record<BossWeapon, string> = {
  shotgun: "SHOTGUN",
  mortar: "MORTAR",
  cannon: "HEAVY CANNON",
  escort: "BOMBER ESCORT",
  overdrive: "OVERDRIVE",
};

export const bossTier = (level: number): number =>
  Math.max(1, Math.floor(level / GAME_CONSTANTS.BOSS_LEVEL_INTERVAL));

export const bossLoadout = (level: number): BossWeapon[] => {
  const tier = bossTier(level);
  return (Object.keys(BOSS_WEAPON_UNLOCKS) as BossWeapon[]).filter(
    (w) => BOSS_WEAPON_UNLOCKS[w] <= tier
  );
};

export const bossHas = (level: number, weapon: BossWeapon): boolean =>
  bossTier(level) >= BOSS_WEAPON_UNLOCKS[weapon];
