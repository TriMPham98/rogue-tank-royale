// Terrain state slice
import type { StateCreator } from "zustand";
import type { GameState, TerrainSlice, ObstacleData } from "./types";

export const createTerrainSlice: StateCreator<
  GameState,
  [],
  [],
  TerrainSlice
> = (set) => ({
  terrainObstacles: [],

  setTerrainObstacles: (obstacles) =>
    set(() => ({
      terrainObstacles: obstacles,
    })),
});

// Initial terrain state for reset
export const initialTerrainState = {
  terrainObstacles: [] as ObstacleData[],
};
