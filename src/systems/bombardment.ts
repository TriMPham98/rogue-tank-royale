/**
 * Shared artillery queue. The red zone director and boss mortars push shells
 * here; <Bombardment /> renders their telegraphs and resolves the blasts.
 * Plain data, no React state, so gameplay code can drop shells from anywhere.
 */

export type BombSource = "redZone" | "boss";

export interface Bomb {
  x: number;
  z: number;
  /** Seconds since dropped */
  age: number;
  /** Seconds from drop to impact */
  fallTime: number;
  radius: number;
  damage: number;
  source: BombSource;
  whistled: boolean;
}

export const MAX_BOMBS = 48;

const bombs: Bomb[] = [];

export const bombardment = {
  drop(
    x: number,
    z: number,
    opts: { fallTime: number; radius: number; damage: number; source: BombSource }
  ): void {
    if (bombs.length >= MAX_BOMBS) return;
    bombs.push({ x, z, age: 0, whistled: false, ...opts });
  },

  /** Live shells; mutated in place by the renderer. */
  get active(): Bomb[] {
    return bombs;
  },

  reset(): void {
    bombs.length = 0;
  },
};
