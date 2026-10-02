// Persistent between-run progression: banked supply and permanent armory upgrades.
// Lives in its own store so run resets never touch it.
import { create } from "zustand";
import { GAME_CONSTANTS } from "../constants/game";

export type PermUpgradeId =
  | "armor"
  | "engine"
  | "gunnery"
  | "autoloader"
  | "fieldKit"
  | "salvage"
  | "warChest";

export interface PermUpgradeDef {
  id: PermUpgradeId;
  name: string;
  /** Effect of a single level, shown in the armory */
  perLevel: string;
  maxLevel: number;
  baseCost: number;
  costGrowth: number;
}

export const PERM_UPGRADES: PermUpgradeDef[] = [
  // Priced so a first upgrade takes ~2 decent runs and later levels take several
  { id: "armor", name: "Composite Armor", perLevel: "+10 max hull", maxLevel: 10, baseCost: 350, costGrowth: 1.6 },
  { id: "gunnery", name: "Gunnery Training", perLevel: "+6% cannon damage", maxLevel: 10, baseCost: 450, costGrowth: 1.65 },
  { id: "autoloader", name: "Autoloader", perLevel: "+5% fire rate", maxLevel: 6, baseCost: 550, costGrowth: 1.7 },
  { id: "engine", name: "Turbo Engine", perLevel: "+0.2 m/s speed", maxLevel: 5, baseCost: 400, costGrowth: 1.65 },
  { id: "fieldKit", name: "Field Repair Kit", perLevel: "+0.2 HP/s regen", maxLevel: 5, baseCost: 500, costGrowth: 1.7 },
  { id: "salvage", name: "Salvage Crew", perLevel: "+10% supply drops", maxLevel: 10, baseCost: 300, costGrowth: 1.6 },
  { id: "warChest", name: "War Chest", perLevel: "+50 starting supply", maxLevel: 5, baseCost: 380, costGrowth: 1.75 },
];

export type PermUpgradeLevels = Record<PermUpgradeId, number>;

const EMPTY_LEVELS: PermUpgradeLevels = {
  armor: 0,
  engine: 0,
  gunnery: 0,
  autoloader: 0,
  fieldKit: 0,
  salvage: 0,
  warChest: 0,
};

export interface RunReport {
  /** Supply left unspent at the end of the run */
  unspentRaw: number;
  /** Portion of it recovered into the bank */
  unspent: number;
  rankBonus: number;
  bossBonus: number;
  total: number;
}

interface ProgressionState {
  bank: number;
  lifetimeBanked: number;
  upgrades: PermUpgradeLevels;
  lastRun: RunReport | null;
  purchase: (id: PermUpgradeId) => boolean;
  bankRun: (unspent: number, rankReached: number, bossesDefeated: number) => RunReport;
}

const STORAGE_KEY = "rtr-progression-v1";

const load = (): Pick<ProgressionState, "bank" | "lifetimeBanked" | "upgrades"> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        bank: Math.max(0, Math.floor(Number(parsed.bank) || 0)),
        lifetimeBanked: Math.max(0, Math.floor(Number(parsed.lifetimeBanked) || 0)),
        upgrades: { ...EMPTY_LEVELS, ...(parsed.upgrades || {}) },
      };
    }
  } catch {
    // Storage blocked or corrupt: start fresh
  }
  return { bank: 0, lifetimeBanked: 0, upgrades: { ...EMPTY_LEVELS } };
};

const save = (state: Pick<ProgressionState, "bank" | "lifetimeBanked" | "upgrades">) => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        bank: state.bank,
        lifetimeBanked: state.lifetimeBanked,
        upgrades: state.upgrades,
      })
    );
  } catch {
    // Non-fatal: progress just won't survive a reload
  }
};

/** Cost of buying the next level when `level` levels are owned, rounded to 10s. */
export const permUpgradeCost = (def: PermUpgradeDef, level: number): number =>
  Math.round((def.baseCost * Math.pow(def.costGrowth, level)) / 10) * 10;

/** Share of unspent run supply that makes it back to the bank. */
export const SALVAGE_RATE = 0.5;
/** Supply awarded per rank reached, on top of salvaged supply. */
export const RANK_BONUS_PER_LEVEL = 5;
/** Supply awarded per boss destroyed during the run. */
export const BOSS_BANK_BONUS = 150;

export const useProgression = create<ProgressionState>()((set, get) => ({
  ...load(),
  lastRun: null,

  purchase: (id) => {
    const state = get();
    const def = PERM_UPGRADES.find((u) => u.id === id);
    if (!def) return false;
    const level = state.upgrades[id];
    if (level >= def.maxLevel) return false;
    const cost = permUpgradeCost(def, level);
    if (state.bank < cost) return false;

    const next = {
      bank: state.bank - cost,
      lifetimeBanked: state.lifetimeBanked,
      upgrades: { ...state.upgrades, [id]: level + 1 },
    };
    set(next);
    save(next);
    return true;
  },

  bankRun: (unspent, rankReached, bossesDefeated) => {
    const state = get();
    const unspentRaw = Math.max(0, Math.floor(unspent));
    const report: RunReport = {
      unspentRaw,
      unspent: Math.floor(unspentRaw * SALVAGE_RATE),
      rankBonus: Math.max(0, rankReached - 1) * RANK_BONUS_PER_LEVEL,
      bossBonus: bossesDefeated * BOSS_BANK_BONUS,
      total: 0,
    };
    report.total = report.unspent + report.rankBonus + report.bossBonus;

    const next = {
      bank: state.bank + report.total,
      lifetimeBanked: state.lifetimeBanked + report.total,
      upgrades: state.upgrades,
    };
    set({ ...next, lastRun: report });
    save(next);
    return report;
  },
}));

/** Run-start stat bonuses derived from owned armory levels. */
export const getRunBonuses = (upgrades: PermUpgradeLevels = useProgression.getState().upgrades) => ({
  maxHealth: upgrades.armor * 10,
  speed: upgrades.engine * 0.2,
  damageMultiplier: 1 + upgrades.gunnery * 0.06,
  fireRateMultiplier: 1 + upgrades.autoloader * 0.05,
  healthRegen: upgrades.fieldKit * 0.2,
  supplyMultiplier: 1 + upgrades.salvage * 0.1,
  startingSupply: upgrades.warChest * 50,
});

/** Starting player stats for a new run with armory bonuses applied. */
export const getRunStartStats = () => {
  const b = getRunBonuses();
  const baseShotsPerSecond = 1 / GAME_CONSTANTS.PLAYER_INITIAL_FIRE_RATE;
  const shotsPerSecond = Math.min(
    GAME_CONSTANTS.PLAYER_MAX_FIRE_RATE,
    baseShotsPerSecond * b.fireRateMultiplier
  );
  return {
    playerHealth: GAME_CONSTANTS.PLAYER_INITIAL_HEALTH + b.maxHealth,
    playerMaxHealth: GAME_CONSTANTS.PLAYER_INITIAL_HEALTH + b.maxHealth,
    playerSpeed: GAME_CONSTANTS.PLAYER_INITIAL_SPEED + b.speed,
    playerTurretDamage: Math.round(GAME_CONSTANTS.PLAYER_INITIAL_TURRET_DAMAGE * b.damageMultiplier),
    playerFireRate: 1 / shotsPerSecond,
    playerHealthRegen: b.healthRegen,
    coins: b.startingSupply,
  };
};

/** Supply amounts are whole numbers; large balances get thousands separators. */
export const formatSupply = (amount: number): string =>
  Math.floor(amount).toLocaleString("en-US");
