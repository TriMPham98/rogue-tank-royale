// Weapon state slice
import type { StateCreator } from "zustand";
import type { GameState, WeaponSlice, SecondaryWeapon } from "./types";
import { availableWeapons } from "../utils/weapons";

export const createWeaponSlice: StateCreator<
  GameState,
  [],
  [],
  WeaponSlice
> = (set) => ({
  showWeaponSelection: false,
  availableWeapons,
  selectedWeapons: [],

  selectWeapon: (weapon) =>
    set((state) => {
      const weaponInstance = {
        ...weapon,
        instanceId: Math.random().toString(36).substr(2, 9),
      };

      return {
        selectedWeapons: [...state.selectedWeapons, weaponInstance],
        showWeaponSelection: false,
      };
    }),

  closeWeaponSelection: () =>
    set(() => ({
      showWeaponSelection: false,
    })),
});

// Initial weapon state for reset
export const initialWeaponState = {
  showWeaponSelection: false,
  availableWeapons,
  selectedWeapons: [] as SecondaryWeapon[],
};
