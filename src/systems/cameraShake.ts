/**
 * Camera feedback shared by gameplay code: `kick` is a directional pitch
 * jolt (cannon recoil), `trauma` is random shake that decays quadratically.
 * <CameraShake /> applies both on top of the follow camera each frame.
 */
export const cameraShake = {
  kick: 0,
  trauma: 0,

  addKick(amount: number): void {
    this.kick = Math.min(1, this.kick + amount);
  },

  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  },

  reset(): void {
    this.kick = 0;
    this.trauma = 0;
  },
};
