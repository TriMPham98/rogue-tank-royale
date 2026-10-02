import { MeshStandardMaterial, Color } from "three";
import {
  createCamoTexture,
  createPlateTexture,
  createRubberTexture,
  createMetalNoiseTexture,
} from "./tankTextures";

const playerCamo = createCamoTexture("#6a8f48", "#3d5c30", "#2a3f22", "#8fb35e");
const enemyCamo = createCamoTexture("#8f1f1f", "#5c1010", "#2e0808", "#c4453a");
const turretCamo = createCamoTexture("#2a3f66", "#1a2744", "#0e1628", "#4a6ea3");
const bomberPlate = createPlateTexture("#3a3d44", "#8a8e96");
const rubberMap = createRubberTexture();
const metalNoise = createMetalNoiseTexture();

function standard(
  color: string,
  extras: ConstructorParameters<typeof MeshStandardMaterial>[0] = {}
): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    roughness: 0.55,
    metalness: 0.4,
    ...extras,
  });
}

export const PLAYER_TANK_MATS = {
  hull: standard("#d5dec4", {
    map: playerCamo ?? undefined,
    roughness: 0.58,
    metalness: 0.42,
  }),
  hullDark: standard("#3a5230", { roughness: 0.7, metalness: 0.3 }),
  hullLight: standard("#8aa85e", { roughness: 0.5, metalness: 0.35 }),
  turret: standard("#c8d4b4", {
    map: playerCamo ?? undefined,
    roughness: 0.52,
    metalness: 0.45,
  }),
  metal: standard("#6d7380", {
    map: metalNoise ?? undefined,
    roughness: 0.32,
    metalness: 0.82,
  }),
  darkMetal: standard("#2a2d33", { roughness: 0.4, metalness: 0.75 }),
  barrel: standard("#4a4e55", { roughness: 0.35, metalness: 0.85 }),
  rubber: standard("#1a1a1a", {
    map: rubberMap ?? undefined,
    roughness: 0.95,
    metalness: 0.05,
  }),
  wheel: standard("#2b2b2b", { roughness: 0.7, metalness: 0.25 }),
  rim: standard("#5a5e66", { roughness: 0.35, metalness: 0.7 }),
  optic: standard("#3ef0ff", {
    emissive: new Color("#19d4ff"),
    emissiveIntensity: 0.85,
    roughness: 0.15,
    metalness: 0.2,
    transparent: true,
    opacity: 0.92,
  }),
  headlight: standard("#fff4c8", {
    emissive: new Color("#ffd978"),
    emissiveIntensity: 1.6,
    roughness: 0.25,
    metalness: 0.1,
  }),
  glass: standard("#1a2830", {
    roughness: 0.12,
    metalness: 0.15,
    transparent: true,
    opacity: 0.55,
    emissive: new Color("#0a3040"),
    emissiveIntensity: 0.2,
  }),
  hazard: standard("#d4a017", { roughness: 0.45, metalness: 0.2 }),
  accent: standard("#7ff6ff", {
    emissive: new Color("#19d4ff"),
    emissiveIntensity: 2.2,
    roughness: 0.3,
    metalness: 0.1,
    toneMapped: false,
  }),
};

export const ENEMY_TANK_MATS = {
  hull: standard("#c4a0a0", {
    map: enemyCamo ?? undefined,
    roughness: 0.56,
    metalness: 0.4,
  }),
  hullDark: standard("#4a1010", { roughness: 0.68, metalness: 0.35 }),
  turret: standard("#b88888", {
    map: enemyCamo ?? undefined,
    roughness: 0.5,
    metalness: 0.45,
  }),
  metal: standard("#3d3d42", { roughness: 0.38, metalness: 0.8 }),
  barrel: standard("#2a2a2e", { roughness: 0.32, metalness: 0.85 }),
  rubber: standard("#141414", {
    map: rubberMap ?? undefined,
    roughness: 0.95,
    metalness: 0.05,
  }),
  wheel: standard("#222222", { roughness: 0.72, metalness: 0.22 }),
  rim: standard("#4a3030", { roughness: 0.4, metalness: 0.65 }),
  optic: standard("#ff3344", {
    emissive: new Color("#ff1020"),
    emissiveIntensity: 1.1,
    roughness: 0.2,
    metalness: 0.15,
  }),
  hazard: standard("#e8c547", { roughness: 0.4, metalness: 0.15 }),
  light: standard("#ff6655", {
    emissive: new Color("#ff2200"),
    emissiveIntensity: 0.9,
  }),
};

export const EMPLACEMENT_MATS = {
  concrete: standard("#4a5360", { roughness: 0.9, metalness: 0.08 }),
  hull: standard("#9aa8c0", {
    map: turretCamo ?? undefined,
    roughness: 0.55,
    metalness: 0.38,
  }),
  steel: standard("#1e3a5f", { roughness: 0.45, metalness: 0.7 }),
  accent: standard("#4a7ec7", { roughness: 0.4, metalness: 0.55 }),
  barrel: standard("#1a2740", { roughness: 0.3, metalness: 0.85 }),
  optic: standard("#7ec8ff", {
    emissive: new Color("#3aa0ff"),
    emissiveIntensity: 0.9,
    roughness: 0.18,
    metalness: 0.2,
  }),
  hazard: standard("#d4a017", { roughness: 0.45, metalness: 0.2 }),
};

export const BOMBER_MATS = {
  body: standard("#c8cad0", {
    map: bomberPlate ?? undefined,
    roughness: 0.42,
    metalness: 0.72,
  }),
  dark: standard("#2a2d33", { roughness: 0.4, metalness: 0.75 }),
  gold: standard("#e6b422", {
    roughness: 0.28,
    metalness: 0.65,
    emissive: new Color("#8a6200"),
    emissiveIntensity: 0.25,
  }),
  thruster: standard("#ff6a00", {
    emissive: new Color("#ff4400"),
    emissiveIntensity: 1.8,
    roughness: 0.3,
    metalness: 0.2,
  }),
  stripe: standard("#c41e3a", { roughness: 0.45, metalness: 0.25 }),
  glass: standard("#1a1010", {
    roughness: 0.12,
    metalness: 0.2,
    transparent: true,
    opacity: 0.65,
    emissive: new Color("#ff2200"),
    emissiveIntensity: 0.35,
  }),
};

export function createBrakeLightMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: "#ff2a2a",
    emissive: new Color("#ff0000"),
    emissiveIntensity: 0.45,
    roughness: 0.35,
    metalness: 0.1,
  });
}

export function createMuzzleFlashMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: "#ffe08a",
    emissive: new Color("#ffb020"),
    emissiveIntensity: 0,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    roughness: 0.2,
    metalness: 0,
  });
}
