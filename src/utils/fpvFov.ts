import { GAME_CONSTANTS } from "../constants/game";

const DEG = Math.PI / 180;

/**
 * Vertical FOV that yields a fixed horizontal FOV at this aspect ratio, so
 * the gunner sight frames the same width of battlefield on every screen:
 * ultrawide doesn't fisheye, narrow/mobile screens don't tunnel.
 */
export const fpvBaseFov = (aspect: number): number => {
  const h = GAME_CONSTANTS.FPV_HORIZONTAL_FOV * DEG;
  const v = 2 * Math.atan(Math.tan(h / 2) / Math.max(0.5, aspect)) / DEG;
  return Math.min(GAME_CONSTANTS.FPV_MAX_FOV, Math.max(GAME_CONSTANTS.FPV_MIN_FOV, v));
};

/** Base FOV widened slightly with forward speed (0..1 of top speed) for a sense of motion. */
export const fpvTargetFov = (aspect: number, speedFraction: number): number =>
  fpvBaseFov(aspect) +
  GAME_CONSTANTS.FPV_SPEED_FOV_BOOST * Math.max(0, Math.min(1, speedFraction));
