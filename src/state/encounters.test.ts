import { describe, it, expect, beforeEach, vi } from "vitest";
import { useGameState } from "./index";
import { useProgression, SALVAGE_RATE, RANK_BONUS_PER_LEVEL } from "./progression";
import { isBossLevel } from "../utils/enemyHitbox";
import { GAME_CONSTANTS } from "../constants/game";

describe("boss gating", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    useGameState.getState().restartGame();
  });

  it("flags every BOSS_LEVEL_INTERVAL-th level", () => {
    const n = GAME_CONSTANTS.BOSS_LEVEL_INTERVAL;
    expect(isBossLevel(n)).toBe(true);
    expect(isBossLevel(n * 2)).toBe(true);
    expect(isBossLevel(n - 1)).toBe(false);
    expect(isBossLevel(0)).toBe(false);
  });

  it("holds level progress while a boss is alive", () => {
    useGameState.setState({
      level: 10,
      enemiesDefeated: 0,
      enemiesRequiredForNextLevel: 3,
      bossActive: true,
    });
    for (let i = 0; i < 6; i++) useGameState.getState().incrementEnemyDefeatCount();
    vi.runAllTimers();
    expect(useGameState.getState().level).toBe(10);
    expect(useGameState.getState().enemiesDefeated).toBe(2);
  });

  it("advances the level when the boss is destroyed", () => {
    useGameState.setState({
      level: 10,
      enemiesDefeated: 0,
      enemiesRequiredForNextLevel: 5,
      bossActive: true,
      enemies: [
        { id: "boss1", type: "boss", position: [0, 0.5, 10], health: 100, maxHealth: 100 },
      ],
    });
    expect(useGameState.getState().damageEnemy("boss1", 500)).toBe(true);
    vi.runAllTimers();
    const s = useGameState.getState();
    expect(s.bossActive).toBe(false);
    expect(s.bossesDefeated).toBe(1);
    expect(s.level).toBe(11);
    expect(s.showWeaponSelection).toBe(true);
  });

  it("does not offer a secondary weapon on a regular level-up", () => {
    useGameState.setState({ level: 9, bossRewardPending: false });
    useGameState.getState().advanceLevel();
    expect(useGameState.getState().showWeaponSelection).toBe(false);
  });
});

describe("run lifecycle", () => {
  it("bumps runId on every restart and menu return so the scene resets the tank", () => {
    const start = useGameState.getState().runId;
    useGameState.setState({ playerTankPosition: [30, 0.5, -20] });
    useGameState.getState().restartGame();
    expect(useGameState.getState().runId).toBe(start + 1);
    expect(useGameState.getState().playerTankPosition).toEqual([0, 0.5, 0]);
    useGameState.getState().returnToMainMenu();
    expect(useGameState.getState().runId).toBe(start + 2);
  });
});

describe("run banking", () => {
  beforeEach(() => {
    localStorage.clear();
    useProgression.setState({ bank: 0, lastRun: null });
    useGameState.getState().restartGame();
  });

  it("banks supply exactly once when the player dies", () => {
    useGameState.setState({ coins: 200, level: 4, isGameStarted: true });
    useGameState.getState().takeDamage(10_000);
    const banked = useProgression.getState().bank;
    expect(banked).toBe(200 * SALVAGE_RATE + 3 * RANK_BONUS_PER_LEVEL);

    // Leaving to the menu afterwards must not double-bank
    useGameState.getState().returnToMainMenu();
    expect(useProgression.getState().bank).toBe(banked);
  });
});
