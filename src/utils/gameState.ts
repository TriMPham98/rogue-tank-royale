// Re-export everything from the new state module for backward compatibility
// This file is kept for backward compatibility with existing imports
// New code should import from "../state" directly

export {
  useGameState,
  type GameState,
  type PlayerSlice,
  type EnemySlice,
  type GameFlowSlice,
  type SafeZoneSlice,
  type WeaponSlice,
  type InputSlice,
  type TerrainSlice,
  type Enemy,
  type PowerUp,
  type SecondaryWeapon,
  type UpgradeableStat,
  type ObstacleData,
} from "../state";

// Default export for backward compatibility
export { useGameState as default } from "../state";
