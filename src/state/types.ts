// State slice types
import type {
  Enemy,
  PowerUp,
  SecondaryWeapon,
  UpgradeableStat,
  ObstacleData,
} from "../types/index";

// Re-export for convenience
export type {
  Enemy,
  PowerUp,
  SecondaryWeapon,
  UpgradeableStat,
  ObstacleData,
};

// Player state slice
export interface PlayerSlice {
  // Stats
  playerHealth: number;
  playerMaxHealth: number;
  playerSpeed: number;
  playerDamage: number;
  playerTurretDamage: number;
  playerFireRate: number;
  playerCameraRange: number;
  playerHealthRegen: number;
  playerBulletVelocity: number;
  playerPenetration: number;
  playerLevel: number;

  // Position
  playerTankPosition: [number, number, number];
  playerTurretRotation: number;

  // Actions
  takeDamage: (amount: number) => void;
  healPlayer: (amount: number) => void;
  updatePlayerPosition: (position: [number, number, number]) => void;
  updatePlayerTurretRotation: (rotation: number) => void;
  upgradeStat: (stat: UpgradeableStat) => void;
}

// Enemy state slice
export interface EnemySlice {
  enemies: Enemy[];
  powerUps: PowerUp[];

  spawnEnemy: (enemy: Omit<Enemy, "id">) => void;
  removeEnemy: (id: string) => void;
  damageEnemy: (id: string, amount: number) => boolean;
  updateEnemyPosition: (id: string, position: [number, number, number]) => void;
  updateEnemyPositions: (
    enemyMoves: { id: string; newPosition: [number, number, number] }[]
  ) => void;
  spawnPowerUp: (powerUp: Omit<PowerUp, "id">) => void;
  collectPowerUp: (id: string, byPlayer?: boolean) => void;
}

// Game flow state slice
export interface GameFlowSlice {
  // Game status
  isGameOver: boolean;
  isPaused: boolean;
  isGameStarted: boolean;
  shouldResetCameraAnimation: boolean;
  isWireframeAssembled: boolean;
  isTerrainReady: boolean;
  isFirstPersonView: boolean;

  // Level progression
  level: number;
  score: number;
  coins: number;
  enemiesDefeated: number;
  enemiesRequiredForNextLevel: number;

  // Upgrade UI
  showUpgradeUI: boolean;
  availableUpgrades: UpgradeableStat[];

  // Mobile orientation
  isLandscapeOrientationRequired: boolean;
  showOrientationWarning: boolean;

  // Actions
  restartGame: () => void;
  togglePause: () => void;
  startGame: () => void;
  returnToMainMenu: () => void;
  advanceLevel: () => void;
  incrementEnemyDefeatCount: () => void;
  increaseScore: (amount: number) => void;
  checkOrientation: () => void;
  setOrientationWarning: (show: boolean) => void;
  toggleFirstPersonView: () => void;
}

// Safe zone state slice
export interface SafeZoneSlice {
  safeZoneRadius: number;
  safeZoneCenter: [number, number];
  safeZoneTargetRadius: number;
  safeZoneShrinkRate: number;
  safeZoneDamage: number;
  safeZoneActive: boolean;
  isPreZoneChangeLevel: boolean;
}

// Weapon state slice
export interface WeaponSlice {
  showWeaponSelection: boolean;
  availableWeapons: SecondaryWeapon[];
  selectedWeapons: SecondaryWeapon[];

  selectWeapon: (weapon: SecondaryWeapon) => void;
  closeWeaponSelection: () => void;
}

// Input state slice
export interface InputSlice {
  forward: number;
  strafe: number;
  moveX: number;
  moveZ: number;
  turretRotation: number | null;
  isFiring: boolean;

  setInput: (input: {
    forward?: number | null;
    strafe?: number | null;
    moveX?: number | null;
    moveZ?: number | null;
    turretRotation?: number | null;
    isFiring?: boolean;
  }) => void;
}

// Terrain state slice
export interface TerrainSlice {
  terrainObstacles: ObstacleData[];
  setTerrainObstacles: (obstacles: ObstacleData[]) => void;
}

// Combined game state type
export type GameState = PlayerSlice &
  EnemySlice &
  GameFlowSlice &
  SafeZoneSlice &
  WeaponSlice &
  InputSlice &
  TerrainSlice;
