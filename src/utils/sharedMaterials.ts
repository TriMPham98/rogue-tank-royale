/**
 * Shared materials for enemy tanks and other game objects
 * Reusing materials reduces GPU memory and improves batching
 */
import { MeshStandardMaterial, MeshBasicMaterial, Color } from "three";

// Cache for materials to ensure singleton instances
const materialCache = new Map<string, MeshStandardMaterial | MeshBasicMaterial>();

function getOrCreateStandardMaterial(
  key: string,
  config: {
    color: string | number;
    roughness?: number;
    metalness?: number;
    emissive?: string | number;
    emissiveIntensity?: number;
    transparent?: boolean;
    opacity?: number;
  }
): MeshStandardMaterial {
  if (!materialCache.has(key)) {
    const material = new MeshStandardMaterial({
      color: config.color,
      roughness: config.roughness ?? 0.5,
      metalness: config.metalness ?? 0.5,
      emissive: config.emissive ? new Color(config.emissive) : undefined,
      emissiveIntensity: config.emissiveIntensity,
      transparent: config.transparent,
      opacity: config.opacity,
    });
    materialCache.set(key, material);
  }
  return materialCache.get(key) as MeshStandardMaterial;
}

function getOrCreateBasicMaterial(
  key: string,
  config: {
    color: string | number;
    transparent?: boolean;
    opacity?: number;
    depthTest?: boolean;
  }
): MeshBasicMaterial {
  if (!materialCache.has(key)) {
    const material = new MeshBasicMaterial({
      color: config.color,
      transparent: config.transparent,
      opacity: config.opacity,
      depthTest: config.depthTest,
    });
    materialCache.set(key, material);
  }
  return materialCache.get(key) as MeshBasicMaterial;
}

// Enemy Tank Materials
export const ENEMY_MATERIALS = {
  // Red Tank
  tankBody: getOrCreateStandardMaterial("tank-body", { color: "red" }),
  tankTurret: getOrCreateStandardMaterial("tank-turret", { color: "darkred" }),
  tankBarrel: getOrCreateStandardMaterial("tank-barrel", { color: "darkgray" }),
  tankMuzzle: getOrCreateStandardMaterial("tank-muzzle", { color: "black" }),
  tankTrack: getOrCreateStandardMaterial("tank-track", { color: "black" }),
  tankAntenna: getOrCreateStandardMaterial("tank-antenna", { color: "gray" }),
  tankViewport: getOrCreateStandardMaterial("tank-viewport", { color: "black" }),

  // Blue Turret
  turretBody: getOrCreateStandardMaterial("turret-body", { color: "darkblue" }),
  turretTurret: getOrCreateStandardMaterial("turret-turret", { color: "royalblue" }),
  turretBarrel: getOrCreateStandardMaterial("turret-barrel", { color: "navy" }),
  turretMuzzle: getOrCreateStandardMaterial("turret-muzzle", { color: "darkgray" }),
  turretBase: getOrCreateStandardMaterial("turret-base", { color: "navy" }),

  // Bomber
  bomberBody: getOrCreateStandardMaterial("bomber-body", {
    color: "#4A4A4A",
    roughness: 0.5,
    metalness: 0.7,
  }),
  bomberCockpit: getOrCreateStandardMaterial("bomber-cockpit", {
    color: "#FFD700",
    roughness: 0.3,
    metalness: 0.5,
  }),
  bomberThruster: getOrCreateStandardMaterial("bomber-thruster", {
    color: "darkgray",
    roughness: 0.4,
    metalness: 0.6,
  }),

  // Health bars
  healthBarBg: getOrCreateBasicMaterial("health-bar-bg", {
    color: "red",
    transparent: true,
    depthTest: false,
  }),
  healthBarFg: getOrCreateBasicMaterial("health-bar-fg", {
    color: "lime",
    transparent: true,
    depthTest: false,
  }),
};

// Projectile Materials
export const PROJECTILE_MATERIALS = {
  player: getOrCreateStandardMaterial("projectile-player", {
    color: "yellow",
    emissive: "orange",
    emissiveIntensity: 2,
  }),
  enemy: getOrCreateStandardMaterial("projectile-enemy", {
    color: "red",
    emissive: "red",
    emissiveIntensity: 2,
  }),
};

// Get material count for debugging
export function getMaterialCount(): number {
  return materialCache.size;
}

// Clear all materials (for cleanup)
export function clearMaterialCache(): void {
  for (const material of materialCache.values()) {
    material.dispose();
  }
  materialCache.clear();
}
