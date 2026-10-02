// Consolidated type definitions - Single source of truth

// Enemy types
export type EnemyType = "tank" | "turret" | "bomber" | "boss";

export interface Enemy {
  id: string;
  position: [number, number, number];
  health: number;
  type: EnemyType;
  speed?: number;
  /** Set for enemies whose HUD needs a health fraction (bosses) */
  maxHealth?: number;
}

// Power-up types
export type PowerUpType = "health" | "coin";

export interface PowerUp {
  id: string;
  position: [number, number, number];
  type: PowerUpType;
  value?: number;
}

// Weapon types - Single definition used throughout the app
export interface SecondaryWeapon {
  id: string;
  instanceId?: string; // Unique ID for each weapon instance on the tank
  name: string;
  description: string;
  damage: number;
  cooldown: number;
  range: number;
  projectileSpeed: number;
}

// Alias for backward compatibility
export type WeaponInstance = SecondaryWeapon;

// Weapon selection UI types
export interface WeaponSelectionState {
  availableWeapons: SecondaryWeapon[];
  selectedWeapons: SecondaryWeapon[];
  level: number;
  canSelect: boolean;
}

export interface WeaponSelectionProps {
  onWeaponSelect: (weapon: SecondaryWeapon) => void;
  onClose: () => void;
  state: WeaponSelectionState;
}

// Terrain obstacle types
export type ObstacleType = "rock";

export interface ObstacleData {
  id: string;
  position: [number, number, number];
  type: ObstacleType;
  size: number;
}

// Upgradeable stats
export type UpgradeableStat =
  | "tankSpeed"
  | "fireRate"
  | "cameraRange"
  | "maxHealth"
  | "healthRegen"
  | "turretDamage"
  | "bulletVelocity"
  | "penetration";

// Projectile types
export interface Projectile {
  id: string;
  position: [number, number, number];
  rotation: number;
}

// Position tuple type
export type Position3D = [number, number, number];
export type Position2D = [number, number];
