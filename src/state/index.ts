// Combined game state store
import { create } from "zustand";
import type { GameState } from "./types";

import { createPlayerSlice } from "./playerSlice";
import { createEnemySlice } from "./enemySlice";
import { createGameFlowSlice } from "./gameFlowSlice";
import { createSafeZoneSlice } from "./safeZoneSlice";
import { createWeaponSlice } from "./weaponSlice";
import { createInputSlice } from "./inputSlice";
import { createTerrainSlice } from "./terrainSlice";
import { createEncounterSlice } from "./encounterSlice";

// Re-export types for convenience
export type {
  GameState,
  PlayerSlice,
  EnemySlice,
  GameFlowSlice,
  SafeZoneSlice,
  WeaponSlice,
  InputSlice,
  TerrainSlice,
  EncounterSlice,
  RedZonePhase,
  Enemy,
  PowerUp,
  SecondaryWeapon,
  UpgradeableStat,
  ObstacleData,
} from "./types";

// Create the combined store using slices
export const useGameState = create<GameState>()((...a) => ({
  ...createPlayerSlice(...a),
  ...createEnemySlice(...a),
  ...createGameFlowSlice(...a),
  ...createSafeZoneSlice(...a),
  ...createWeaponSlice(...a),
  ...createInputSlice(...a),
  ...createTerrainSlice(...a),
  ...createEncounterSlice(...a),
}));

// Bank supply into permanent progression the moment a run ends
useGameState.subscribe((state, prev) => {
  if (state.isGameOver && !prev.isGameOver) {
    state.bankRunSupply();
  }
});

// Default export for backward compatibility
export default useGameState;
