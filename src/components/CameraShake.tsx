import { useFrame, useThree } from "@react-three/fiber";
import { cameraShake } from "../systems/cameraShake";
import { useGameState } from "../utils/gameState";

const MAX_KICK = 0.0175; // radians of upward pitch at full kick
const MAX_SHAKE = 0.006; // radians of random jitter at full trauma

/**
 * Rotation-only offsets applied after FollowCamera has posed the camera, so
 * nothing accumulates into its smoothing (third person re-aims with lookAt and
 * first person copies its quaternion every frame).
 * Must be mounted after <FollowCamera /> so its frame callback runs later.
 */
const CameraShake = () => {
  const { camera } = useThree();

  useFrame((state, delta) => {
    const s = useGameState.getState();
    if (s.isPaused || s.isGameOver) return;

    const { kick, trauma } = cameraShake;
    if (kick <= 0.001 && trauma <= 0.001) return;

    const t = state.clock.elapsedTime;
    const jitter = trauma * trauma * MAX_SHAKE;
    camera.rotateX(kick * kick * MAX_KICK + Math.sin(t * 71) * jitter);
    camera.rotateY(Math.sin(t * 53 + 1.3) * jitter);
    camera.rotateZ(Math.sin(t * 61 + 2.1) * jitter * 0.6);

    // Kick snaps back fast, shake settles a little slower
    cameraShake.kick = Math.max(0, kick - delta * 6);
    cameraShake.trauma = Math.max(0, trauma - delta * 3.5);
  });

  return null;
};

export default CameraShake;
