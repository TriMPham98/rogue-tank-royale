// Input state slice
import type { StateCreator } from "zustand";
import type { GameState, InputSlice } from "./types";

export const createInputSlice: StateCreator<
  GameState,
  [],
  [],
  InputSlice
> = (set) => ({
  forward: 0,
  strafe: 0,
  moveX: 0,
  moveZ: 0,
  turretRotation: null,
  isFiring: false,

  setInput: (input) =>
    set(() => {
      const newState: Partial<InputSlice> = {};

      if (input.forward !== undefined && input.forward !== null) {
        newState.forward = input.forward;
      }

      if (input.strafe !== undefined && input.strafe !== null) {
        newState.strafe = input.strafe;
      }

      if (input.moveX !== undefined && input.moveX !== null) {
        newState.moveX = input.moveX;
      }

      if (input.moveZ !== undefined && input.moveZ !== null) {
        newState.moveZ = input.moveZ;
      }

      if (input.turretRotation !== undefined) {
        newState.turretRotation = input.turretRotation;
      }

      if (input.isFiring !== undefined) {
        newState.isFiring = input.isFiring;
      }

      return newState;
    }),
});

// Initial input state for reset
export const initialInputState: InputSlice = {
  forward: 0,
  strafe: 0,
  moveX: 0,
  moveZ: 0,
  turretRotation: null,
  isFiring: false,
  setInput: () => {},
};
