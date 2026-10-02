import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useGameState } from "../state";
import { useRespawnManager } from "./respawnManager";
import { getMaxEnemies } from "./difficulty";

describe("respawn reconciler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGameState.getState().restartGame();
    useGameState.setState({
      isGameStarted: true,
      isTerrainReady: true,
      isPaused: false,
      showUpgradeUI: false,
      level: 6,
      enemies: [],
    });
  });
  afterEach(() => vi.useRealTimers());

  it("refills an empty field after a long pause instead of giving up", () => {
    renderHook(() => useRespawnManager());
    // Level-up while the upgrade picker is open (paused) for a long time
    useGameState.setState({ level: 7, isPaused: true, showUpgradeUI: true });
    vi.advanceTimersByTime(30_000);
    expect(useGameState.getState().enemies).toHaveLength(0);

    useGameState.setState({ isPaused: false, showUpgradeUI: false });
    vi.advanceTimersByTime(10_000);
    expect(useGameState.getState().enemies.length).toBe(getMaxEnemies(7));
  });

  it("replaces destroyed enemies", () => {
    renderHook(() => useRespawnManager());
    // Safety-net top-up runs at the respawn cadence (~3.1s at level 6)
    vi.advanceTimersByTime(20_000);
    const max = getMaxEnemies(6);
    expect(useGameState.getState().enemies.length).toBe(max);

    const victim = useGameState.getState().enemies[0];
    useGameState.getState().removeEnemy(victim.id);
    expect(useGameState.getState().enemies.length).toBe(max - 1);
    vi.advanceTimersByTime(10_000);
    expect(useGameState.getState().enemies.length).toBe(max);
  });
});
