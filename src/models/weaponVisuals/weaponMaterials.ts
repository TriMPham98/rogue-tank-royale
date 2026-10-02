/**
 * Secondary weapon palette. Structural parts reuse the player tank materials so
 * the drone pods read as part of the same vehicle; accents are per weapon.
 */
import { AdditiveBlending, Color, MeshBasicMaterial, MeshStandardMaterial } from "three";
import { PLAYER_TANK_MATS } from "../tankVisuals/tankMaterials";

export const WEAPON_MATS = {
  armor: PLAYER_TANK_MATS.turret,
  armorDark: PLAYER_TANK_MATS.hullDark,
  metal: PLAYER_TANK_MATS.metal,
  darkMetal: PLAYER_TANK_MATS.darkMetal,
  barrel: PLAYER_TANK_MATS.barrel,
  hazard: PLAYER_TANK_MATS.hazard,
  copper: new MeshStandardMaterial({ color: "#b8693a", roughness: 0.32, metalness: 0.9 }),
  copperBright: new MeshStandardMaterial({ color: "#e08a4e", roughness: 0.25, metalness: 0.95 }),
  ceramic: new MeshStandardMaterial({ color: "#ddd6c6", roughness: 0.35, metalness: 0.05 }),
  chrome: new MeshStandardMaterial({ color: "#d8dde4", roughness: 0.12, metalness: 1 }),
};

/** Weapon identity colours (also used for muzzle FX). */
export const WEAPON_ACCENTS = {
  rocket: "#ff8a2a",
  laser: "#41f2ff",
  shotgun: "#ffc23d",
  sniper: "#ff3b3b",
  tesla: "#7fd6ff",
} as const;

const accentCache = new Map<string, MeshStandardMaterial>();

/** Shared emissive accent material (strips, lenses, hover rings). */
export function getAccentMaterial(color: string, intensity = 1.8): MeshStandardMaterial {
  const key = `${color}|${intensity}`;
  let m = accentCache.get(key);
  if (!m) {
    m = new MeshStandardMaterial({
      color,
      emissive: new Color(color),
      emissiveIntensity: intensity,
      roughness: 0.3,
      metalness: 0.1,
      toneMapped: false,
    });
    accentCache.set(key, m);
  }
  return m;
}

export function hexToNumber(color: string): number {
  return parseInt(color.slice(1), 16);
}

// Shared rocket materials (one set for every shell in flight)
export const ROCKET_MATS = {
  body: new MeshStandardMaterial({ color: "#d8d2c0", roughness: 0.45, metalness: 0.35 }),
  band: new MeshStandardMaterial({ color: "#56663a", roughness: 0.55, metalness: 0.3 }),
  nose: new MeshStandardMaterial({ color: "#c8461e", roughness: 0.4, metalness: 0.3 }),
  dark: new MeshStandardMaterial({ color: "#2a2d33", roughness: 0.4, metalness: 0.75 }),
  flame: new MeshBasicMaterial({
    color: new Color("#ffb347"),
    transparent: true,
    opacity: 0.9,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }),
};

