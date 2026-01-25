// Re-export types from central types location
export type { SecondaryWeapon, WeaponInstance } from "../types/index";
import type { SecondaryWeapon } from "../types/index";

export const availableWeapons: SecondaryWeapon[] = [
  {
    id: "rocket",
    name: "Mortar",
    description:
      "Fires shells that deal high damage and have a large explosion radius. Range enhanced by sensor upgrades.",
    damage: 150,
    cooldown: 5,
    range: 20,
    projectileSpeed: 25,
  },
  {
    id: "laser",
    name: "Laser Cannon",
    description:
      "Fires instant laser beams that deal moderate damage with no travel time. Range enhanced by sensor upgrades.",
    damage: 200,
    cooldown: 1.5,
    range: 15,
    projectileSpeed: 100,
  },
  {
    id: "shotgun",
    name: "Shotgun",
    description:
      "Fires a spread of pellets that deal high damage at close range. Range enhanced by sensor upgrades.",
    damage: 275,
    cooldown: 1.25,
    range: 25,
    projectileSpeed: 30,
  },
  {
    id: "sniper",
    name: "Sniper Rifle",
    description:
      "Fires penetrating bullets with excellent range but slow fire rate. Range enhanced by sensor upgrades.",
    damage: 350,
    cooldown: 3.0,
    range: 50,
    projectileSpeed: 50,
  },
  {
    id: "tesla",
    name: "Tesla Coil",
    description:
      "Emits electricity that chains between nearby enemies. Range enhanced by sensor upgrades.",
    damage: 125,
    cooldown: 1.0,
    range: 7.5,
    projectileSpeed: 80,
  },
];
