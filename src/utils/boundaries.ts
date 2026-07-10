import { GAME_CONSTANTS } from "../constants/game";

/**
 * Enforces map boundaries on a 3D position (typically [x, y, z] for tank/enemy).
 * Clamps the X and Z coordinates to stay within the playable area,
 * respecting HALF_MAP_SIZE and MAP_BOUNDARY_BUFFER from game constants.
 * Y coordinate is left unchanged.
 *
 * Behavior is identical to previous duplicated implementations in slices and utils.
 */
export const enforceMapBoundaries = (
  position: [number, number, number]
): [number, number, number] => {
  const halfMapSize = GAME_CONSTANTS.HALF_MAP_SIZE;
  const buffer = GAME_CONSTANTS.MAP_BOUNDARY_BUFFER;

  const constrainedPosition: [number, number, number] = [...position];

  // Constrain X position
  if (constrainedPosition[0] < -halfMapSize + buffer) {
    constrainedPosition[0] = -halfMapSize + buffer;
  } else if (constrainedPosition[0] > halfMapSize - buffer) {
    constrainedPosition[0] = halfMapSize - buffer;
  }

  // Constrain Z position
  if (constrainedPosition[2] < -halfMapSize + buffer) {
    constrainedPosition[2] = -halfMapSize + buffer;
  } else if (constrainedPosition[2] > halfMapSize - buffer) {
    constrainedPosition[2] = halfMapSize - buffer;
  }

  return constrainedPosition;
};

/**
 * Checks if the given (x, z) coordinates are within map boundaries.
 * Uses HALF_MAP_SIZE and MAP_BOUNDARY_BUFFER for the inner playable area.
 * Returns true only if strictly inside the buffered bounds.
 */
export const isWithinMapBoundaries = (x: number, z: number): boolean => {
  const halfMapSize = GAME_CONSTANTS.HALF_MAP_SIZE;
  const buffer = GAME_CONSTANTS.MAP_BOUNDARY_BUFFER;
  return (
    x >= -halfMapSize + buffer &&
    x <= halfMapSize - buffer &&
    z >= -halfMapSize + buffer &&
    z <= halfMapSize - buffer
  );
};
