import { describe, it, expect, beforeEach } from "vitest";
import {
  PERM_UPGRADES,
  permUpgradeCost,
  useProgression,
  getRunStartStats,
  formatSupply,
  RANK_BONUS_PER_LEVEL,
  BOSS_BANK_BONUS,
} from "./progression";
import { GAME_CONSTANTS } from "../constants/game";

const armor = PERM_UPGRADES.find((u) => u.id === "armor")!;

const resetProgression = () => {
  localStorage.clear();
  useProgression.setState({
    bank: 0,
    lifetimeBanked: 0,
    lastRun: null,
    upgrades: {
      armor: 0,
      engine: 0,
      gunnery: 0,
      autoloader: 0,
      fieldKit: 0,
      salvage: 0,
      warChest: 0,
    },
  });
};

describe("progression", () => {
  beforeEach(resetProgression);

  it("prices upgrades in whole tens that grow per level", () => {
    const costs = [0, 1, 2, 3].map((l) => permUpgradeCost(armor, l));
    costs.forEach((c) => expect(c % 10).toBe(0));
    for (let i = 1; i < costs.length; i++) expect(costs[i]).toBeGreaterThan(costs[i - 1]);
    expect(costs[0]).toBe(armor.baseCost);
  });

  it("banks unspent supply plus rank and boss bonuses, and persists", () => {
    const report = useProgression.getState().bankRun(340, 12, 1);
    expect(report.unspent).toBe(340);
    expect(report.rankBonus).toBe(11 * RANK_BONUS_PER_LEVEL);
    expect(report.bossBonus).toBe(BOSS_BANK_BONUS);
    expect(useProgression.getState().bank).toBe(report.total);
    expect(JSON.parse(localStorage.getItem("rtr-progression-v1")!).bank).toBe(report.total);
  });

  it("refuses purchases it can't afford and deducts on success", () => {
    const { purchase } = useProgression.getState();
    expect(purchase("armor")).toBe(false);

    useProgression.setState({ bank: 1000 });
    expect(purchase("armor")).toBe(true);
    expect(useProgression.getState().upgrades.armor).toBe(1);
    expect(useProgression.getState().bank).toBe(1000 - armor.baseCost);
  });

  it("stops at max level", () => {
    useProgression.setState({
      bank: 1_000_000,
      upgrades: { ...useProgression.getState().upgrades, armor: armor.maxLevel },
    });
    expect(useProgression.getState().purchase("armor")).toBe(false);
  });

  it("applies owned upgrades to run start stats", () => {
    useProgression.setState({
      upgrades: {
        ...useProgression.getState().upgrades,
        armor: 3,
        warChest: 2,
        gunnery: 5,
      },
    });
    const stats = getRunStartStats();
    expect(stats.playerMaxHealth).toBe(GAME_CONSTANTS.PLAYER_INITIAL_HEALTH + 30);
    expect(stats.playerHealth).toBe(stats.playerMaxHealth);
    expect(stats.coins).toBe(100);
    expect(stats.playerTurretDamage).toBe(
      Math.round(GAME_CONSTANTS.PLAYER_INITIAL_TURRET_DAMAGE * 1.3)
    );
  });

  it("formats supply as whole numbers with separators", () => {
    expect(formatSupply(1234.9)).toBe("1,234");
    expect(formatSupply(50)).toBe("50");
  });
});
