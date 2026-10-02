// Encounter state: PUBG-style red zone bombardments and boss fights
import type { StateCreator } from "zustand";
import type { GameState, EncounterSlice, RedZonePhase } from "./types";

export const initialEncounterState = {
  redZonePhase: "idle" as RedZonePhase,
  redZoneCenter: [0, 0] as [number, number],
  redZoneRadius: 0,
  /** Whole seconds left in the current red zone phase (coarse, for UI) */
  redZoneSecondsLeft: 0,
  bossActive: false,
  bossIncoming: false,
  bossSpawnedForLevel: 0,
  bossesDefeated: 0,
  runBanked: false,
};

export const createEncounterSlice: StateCreator<
  GameState,
  [],
  [],
  EncounterSlice
> = (set) => ({
  ...initialEncounterState,

  setRedZone: (update) => set(update),
});
