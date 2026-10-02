import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Sky, OrbitControls, Environment, Lightformer } from "@react-three/drei";
import Tank from "../models/Tank";
import EnemyTank from "../models/EnemyTank";
import PowerUpItem from "../models/PowerUpItem";
import Ground from "../models/Ground";
import RockField from "../models/environment/RockField";
import ArenaPerimeter from "../models/environment/ArenaPerimeter";
import GrassField from "../models/environment/GrassField";
import FxLayer from "../models/fx/FxLayer";
import ShaderWarmup from "../models/fx/ShaderWarmup";
import SafeZone from "../models/SafeZone";
import {
  Suspense,
  useRef,
  useEffect,
  memo,
  Component,
  ErrorInfo,
  ReactNode,
  useState,
} from "react";
import { useGameState } from "../utils/gameState";
import { shallow } from "zustand/shallow";
import { Vector3, Quaternion, Euler, SpotLight as ThreeSpotLight, PerspectiveCamera } from "three";
import "./GameScene.css";
import { useRespawnManager } from "../utils/respawnManager";
import { debug } from "../utils/debug";
import { globalFPSTracker } from "../utils/fpsTracker";
import MobileJoysticks from "../components/MobileJoysticks";
import { GAME_CONSTANTS } from "../constants/game";
import { useObstacleSpatialHash, useEnemySpatialHash, resetSpatialHashes } from "../hooks/useSpatialHash";
import InstancedProjectiles from "./InstancedProjectiles";
import InstancedHealthBars from "./InstancedHealthBars";

// Custom hook to calculate light intensity based on game level
const useLightIntensity = () => {
  const level = useGameState((state) => state.level);

  // Calculate ambient light intensity (starts at 0.5, decreases to 0.05 by level 40)
  const ambientIntensity = Math.max(0.05, 0.5 - (level / 40) * 0.45);

  // Calculate ambient light color (gradually shifts to blue-ish night tint)
  const nightFactor = Math.min(1, level / 40);
  const ambientR = 1 - nightFactor * 0.9; // 1.0 -> 0.1
  const ambientG = 1 - nightFactor * 0.7; // 1.0 -> 0.3
  const ambientB = 1 - nightFactor * 0.3; // 1.0 -> 0.7

  // Calculate directional light intensity (starts at 1.5, decreases to 0.3 by level 40)
  const directionalIntensity = Math.max(0.3, 1.5 - (level / 40) * 1.2);

  // Calculate spotlight intensity (starts at 1.0, increases to 1.8 by level 40)
  const spotlightIntensity = Math.min(1.8, 1.0 + (level / 40) * 0.8);

  // Calculate spotlight angle (starts at 0.4, increases to 0.7 by level 40)
  const spotlightAngle = Math.min(0.7, 0.4 + (level / 40) * 0.3);

  // Calculate spotlight penumbra (starts at 0.5, increases to 0.8 by level 40)
  const spotlightPenumbra = Math.min(0.8, 0.5 + (level / 40) * 0.3);

  // Calculate spotlight distance (how far it can reach)
  const spotlightDistance = Math.min(30, 15 + (level / 40) * 15);

  // Calculate background sky color (blue to dark blue/black)
  const skyFactor = Math.max(0, 1 - level / 40);
  const r = Math.floor(135 * skyFactor); // 87 in hex
  const g = Math.floor(206 * skyFactor); // CE in hex
  const b = Math.min(
    255,
    Math.floor(235 * skyFactor) + Math.floor((1 - skyFactor) * 51)
  ); // EB -> 33
  const skyColor = `rgb(${r}, ${g}, ${b})`;

  // Calculate fog density (increases with level)
  const fogNear = Math.max(20, 30 - (level / 40) * 15);
  const fogFar = Math.max(50, 100 - (level / 40) * 50);

  // Calculate sky turbidity and rayleigh values for Sky component
  const turbidity = Math.min(20, 10 + (level / 40) * 10); // 10-20, higher is hazier
  const rayleigh = Math.max(0.2, 1 - (level / 40) * 0.8); // 1-0.2, lower makes sky darker blue

  // Adjust sunPosition to set sun lower in the sky as levels progress
  const sunElevation = Math.max(5, 20 - (level / 40) * 15); // 20-5, lower is sunset
  const sunAzimuth = 180; // Fixed azimuth (180 = north)

  // Sun direction shared by the sky dome and the shadow-casting light (slightly
  // off-axis so hull faces pick up a warm key from front-left)
  const elevationRad = (sunElevation * Math.PI) / 180 + 0.35;
  const azimuthRad = Math.PI * 0.8;
  const sunDirection: [number, number, number] = [
    Math.cos(elevationRad) * Math.sin(azimuthRad),
    Math.sin(elevationRad),
    Math.cos(elevationRad) * Math.cos(azimuthRad),
  ];

  // Hemisphere fill: daylight sky/bounce drifting to moonlit blue as levels climb
  const hemiSky = `rgb(${Math.round(190 - nightFactor * 150)}, ${Math.round(
    214 - nightFactor * 140
  )}, ${Math.round(255 - nightFactor * 90)})`;
  const hemiGround = `rgb(${Math.round(92 - nightFactor * 70)}, ${Math.round(
    84 - nightFactor * 60
  )}, ${Math.round(58 - nightFactor * 30)})`;
  const sunColor = `rgb(255, ${Math.round(240 - nightFactor * 70)}, ${Math.round(
    214 - nightFactor * 110
  )})`;

  return {
    ambientIntensity,
    ambientR,
    ambientG,
    ambientB,
    directionalIntensity,
    spotlightIntensity,
    spotlightAngle,
    spotlightPenumbra,
    spotlightDistance,
    skyColor,
    fogNear,
    fogFar,
    turbidity,
    rayleigh,
    sunElevation,
    sunAzimuth,
    sunDirection,
    nightFactor,
    hemiSky,
    hemiGround,
    sunColor,
  };
};

/**
 * Image-based lighting from a few soft light cards. Without an environment map,
 * metallic hull and weapon materials reflect pure black and read as flat.
 * Re-rendered (cheaply, 64px) only when the day/night bucket changes.
 */
const BattlefieldEnvironment = ({ nightFactor }: { nightFactor: number }) => {
  const bucket = Math.round(nightFactor * 8) / 8;
  const day = 1 - bucket * 0.85;
  return (
    <Environment key={bucket} resolution={64} frames={1}>
      <color attach="background" args={[0.09 * day, 0.1 * day, 0.11 * day]} />
      <Lightformer form="rect" intensity={1.6 * day} color="#cfe3ff" scale={[30, 30, 1]} position={[0, 12, 0]} />
      <Lightformer form="rect" intensity={2.4 * day} color="#ffe2b8" scale={[10, 4, 1]} position={[-14, 6, 10]} />
      <Lightformer form="rect" intensity={0.8 * day} color="#9fb8ff" scale={[10, 4, 1]} position={[14, 4, -10]} />
      <Lightformer form="rect" intensity={0.55 * day} color="#6b6a45" scale={[40, 40, 1]} position={[0, -6, 0]} />
    </Environment>
  );
};

// Error boundary component to catch and display errors
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    debug.error("Canvas error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            color: "red",
            padding: "20px",
            backgroundColor: "black",
            border: "1px solid red",
            borderRadius: "4px",
          }}>
          <h2>Something went wrong in the 3D scene</h2>
          <p>{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Component to handle the respawning of enemies
const EnemyRespawnManager = () => {
  useRespawnManager();
  return null;
};

// Smoothstep helper for smooth transitions
const smoothstep = (t: number): number => t * t * (3 - 2 * t);

// Component to follow the player's tank with the camera
const FollowCamera = memo(() => {
  const { camera } = useThree();
  const getState = useRef(useGameState.getState).current;
  // Initialize the camera offset to match initial camera position in the Canvas (in front of the tank)
  const offsetRef = useRef(new Vector3(0, 8, 12));
  const targetPositionRef = useRef(new Vector3());
  const initialPositionSetRef = useRef(false);

  // Add state to track the camera animation
  const [isIntroPanComplete, setIsIntroPanComplete] = useState(false);
  const introPanTimeRef = useRef(0);
  const introPanDuration = GAME_CONSTANTS.INTRO_PAN_DURATION;

  // Initial dramatic offset values (higher and farther away)
  const initialHeight = GAME_CONSTANTS.INTRO_CAMERA_HEIGHT;
  const initialDistance = GAME_CONSTANTS.INTRO_CAMERA_DISTANCE;
  const initialFov = GAME_CONSTANTS.INTRO_CAMERA_FOV;

  // Store animation state in a ref to prevent issues with state updates
  const animationStateRef = useRef({
    isRunning: false,
    hasCompleted: false,
  });

  // Pre-allocated refs for FPV state (zero per-frame allocations)
  const fpvTargetPosRef = useRef(new Vector3());
  const fpvTargetQuatRef = useRef(new Quaternion());
  const fpvCurrentPosRef = useRef(new Vector3());
  const fpvCurrentQuatRef = useRef(new Quaternion());
  const fpvLookAtRef = useRef(new Vector3());
  const fpvEulerRef = useRef(new Euler(0, 0, 0, "YXZ"));
  const fpvDirectionRef = useRef(new Vector3());
  const fpvPrevPosRef = useRef(new Vector3());
  const fpvTransitionRef = useRef({
    active: false,
    time: 0,
    startPos: new Vector3(),
    startQuat: new Quaternion(),
    startFov: GAME_CONSTANTS.DEFAULT_CAMERA_FOV as number,
  });
  const fpvPrevFirstPersonRef = useRef(false);
  const fpvInitializedRef = useRef(false);

  // Compute ideal FPV camera pose (horizon-locked via YXZ Euler)
  const computeFPVTarget = (
    playerPos: [number, number, number],
    turretRot: number
  ) => {
    const dir = fpvDirectionRef.current;
    dir.set(Math.sin(turretRot), 0, Math.cos(turretRot));

    const targetPos = fpvTargetPosRef.current;
    targetPos.set(
      playerPos[0] + dir.x * GAME_CONSTANTS.FPV_FORWARD_OFFSET,
      playerPos[1] + GAME_CONSTANTS.FPV_EYE_HEIGHT,
      playerPos[2] + dir.z * GAME_CONSTANTS.FPV_FORWARD_OFFSET
    );

    // Look-at point far ahead for angular stability
    const lookAt = fpvLookAtRef.current;
    lookAt.set(
      targetPos.x + dir.x * GAME_CONSTANTS.FPV_LOOK_AHEAD_DISTANCE,
      targetPos.y + GAME_CONSTANTS.FPV_PITCH_ANGLE * GAME_CONSTANTS.FPV_LOOK_AHEAD_DISTANCE,
      targetPos.z + dir.z * GAME_CONSTANTS.FPV_LOOK_AHEAD_DISTANCE
    );

    // Horizon-locked rotation via YXZ Euler (roll fixed at 0)
    // Three.js cameras look along -Z, so yaw = atan2(-dx, -dz)
    // and positive euler.x pitches upward, so pitch = atan2(dy, horiz)
    const euler = fpvEulerRef.current;
    const dx = lookAt.x - targetPos.x;
    const dy = lookAt.y - targetPos.y;
    const dz = lookAt.z - targetPos.z;
    euler.set(
      Math.atan2(dy, Math.sqrt(dx * dx + dz * dz)),
      Math.atan2(-dx, -dz),
      0,
      "YXZ"
    );
    fpvTargetQuatRef.current.setFromEuler(euler);
  };

  useEffect(() => {
    // Watch for changes to the shouldResetCameraAnimation flag
    const unsubscribe = useGameState.subscribe((state, prevState) => {
      // Trigger reset only when the flag becomes true
      if (
        state.shouldResetCameraAnimation &&
        !prevState.shouldResetCameraAnimation
      ) {
        if (import.meta.env.DEV) {
          console.log("FollowCamera: Resetting animation state due to flag.");
        }
        // Reset animation state
        setIsIntroPanComplete(false);
        introPanTimeRef.current = 0;
        initialPositionSetRef.current = false; // Reset this ref as well

        // Reset the animation state ref
        animationStateRef.current = {
          isRunning: false,
          hasCompleted: false,
        };

        // Reset FPV state
        fpvInitializedRef.current = false;
        fpvPrevFirstPersonRef.current = false;
        fpvTransitionRef.current.active = false;

        // FORCE camera back to initial high/far state
        const playerPosition = state.playerTankPosition;
        if (playerPosition) {
          // Need player position to calculate lookAt
          camera.position.set(
            playerPosition[0],
            playerPosition[1] + initialHeight,
            playerPosition[2] + initialDistance
          );
          camera.lookAt(
            playerPosition[0],
            playerPosition[1],
            playerPosition[2]
          );
          const perspCamera = camera as PerspectiveCamera;
          if (perspCamera.fov !== initialFov) {
            perspCamera.fov = initialFov;
            perspCamera.updateProjectionMatrix();
          }
          camera.rotation.x = -0.2 - Math.PI / 8; // Match initial rotation offset
          if (import.meta.env.DEV) {
            console.log("FollowCamera: Forced camera to initial state.");
          }
        } else {
          if (import.meta.env.DEV) {
            console.warn(
              "FollowCamera: Cannot force initial state, player position unknown during reset."
            );
          }
        }

        // Reset the flag in global state AFTER applying changes
        useGameState.setState({ shouldResetCameraAnimation: false });
      }
    });

    return () => unsubscribe();
    // Add camera to dependency array to ensure it's available
  }, [camera]);

  useFrame((_, delta) => {
    const gameState = getState();

    // Track FPS performance with level and secondary weapon count
    globalFPSTracker.update(
      delta,
      gameState.level,
      gameState.selectedWeapons.length
    );

    const playerPosition = gameState.playerTankPosition;
    const cameraRange = gameState.playerCameraRange;
    const isWireframeAssembled = gameState.isWireframeAssembled;
    const isTerrainReady = gameState.isTerrainReady;
    const isFirstPersonView = gameState.isFirstPersonView;
    const turretRotation = gameState.playerTurretRotation;
    if (playerPosition) {
      // --- FPV transition detection ---
      const justToggled = isFirstPersonView !== fpvPrevFirstPersonRef.current;
      fpvPrevFirstPersonRef.current = isFirstPersonView;

      if (justToggled) {
        // Capture current camera pose as transition start
        const tr = fpvTransitionRef.current;
        tr.active = true;
        tr.time = 0;
        tr.startPos.copy(camera.position);
        tr.startQuat.copy(camera.quaternion);
        tr.startFov = (camera as PerspectiveCamera).fov;
      }

      if (isFirstPersonView) {
        // Compute ideal FPV target pose
        computeFPVTarget(playerPosition, turretRotation);

        const perspCamera = camera as PerspectiveCamera;
        const tr = fpvTransitionRef.current;

        if (tr.active) {
          // --- Transition animation (smoothstep over TRANSITION_DURATION) ---
          tr.time += delta;
          const t = Math.min(tr.time / GAME_CONSTANTS.FPV_TRANSITION_DURATION, 1.0);
          const s = smoothstep(t);

          // Interpolate position
          fpvCurrentPosRef.current.copy(tr.startPos).lerp(fpvTargetPosRef.current, s);
          // Interpolate rotation
          fpvCurrentQuatRef.current.copy(tr.startQuat).slerp(fpvTargetQuatRef.current, s);
          // Interpolate FOV
          perspCamera.fov = tr.startFov + (GAME_CONSTANTS.FPV_FOV - tr.startFov) * s;
          perspCamera.updateProjectionMatrix();

          camera.position.copy(fpvCurrentPosRef.current);
          camera.quaternion.copy(fpvCurrentQuatRef.current);

          if (t >= 1.0) {
            tr.active = false;
            fpvInitializedRef.current = true;
            fpvPrevPosRef.current.copy(fpvTargetPosRef.current);
          }
        } else {
          // --- Steady-state FPV with damping ---
          if (!fpvInitializedRef.current) {
            // First frame in FPV without transition - snap to target
            fpvCurrentPosRef.current.copy(fpvTargetPosRef.current);
            fpvCurrentQuatRef.current.copy(fpvTargetQuatRef.current);
            fpvPrevPosRef.current.copy(fpvTargetPosRef.current);
            fpvInitializedRef.current = true;
          }

          // High-frequency filter: clamp position jumps > 0.5 units/frame
          const jumpDist = fpvTargetPosRef.current.distanceTo(fpvPrevPosRef.current);
          if (jumpDist > 0.5) {
            // Clamp the target to max 0.5 units from previous position
            fpvTargetPosRef.current.copy(fpvPrevPosRef.current).lerp(
              fpvTargetPosRef.current,
              0.5 / jumpDist
            );
          }
          fpvPrevPosRef.current.copy(fpvTargetPosRef.current);

          // Exponential position smoothing
          const posFactor = 1.0 - Math.exp(-GAME_CONSTANTS.FPV_POSITION_LERP_FACTOR * delta);
          fpvCurrentPosRef.current.lerp(fpvTargetPosRef.current, posFactor);

          // Quaternion slerp for rotation smoothing
          const rotFactor = 1.0 - Math.exp(-GAME_CONSTANTS.FPV_ROTATION_LERP_FACTOR * delta);
          fpvCurrentQuatRef.current.slerp(fpvTargetQuatRef.current, rotFactor);

          camera.position.copy(fpvCurrentPosRef.current);
          camera.quaternion.copy(fpvCurrentQuatRef.current);

          perspCamera.fov = GAME_CONSTANTS.FPV_FOV;
          perspCamera.updateProjectionMatrix();
        }
        return; // Skip third-person code
      }

      // --- Transitioning OUT of FPV back to third-person ---
      if (fpvTransitionRef.current.active && !isFirstPersonView) {
        const tr = fpvTransitionRef.current;
        tr.time += delta;
        const t = Math.min(tr.time / GAME_CONSTANTS.FPV_TRANSITION_DURATION, 1.0);
        const s = smoothstep(t);

        // Compute third-person target
        const distanceInFront = cameraRange;
        const tpTargetPos = targetPositionRef.current;
        tpTargetPos.set(
          playerPosition[0] + Math.sin(camera.rotation.y) * distanceInFront,
          playerPosition[1] + 8 + (cameraRange - 12) * 0.3,
          playerPosition[2] + Math.cos(camera.rotation.y) * distanceInFront
        );

        // Interpolate from FPV start pose to third-person target
        fpvCurrentPosRef.current.copy(tr.startPos).lerp(tpTargetPos, s);
        camera.position.copy(fpvCurrentPosRef.current);
        camera.lookAt(playerPosition[0], playerPosition[1], playerPosition[2]);

        const perspCamera = camera as PerspectiveCamera;
        perspCamera.fov = tr.startFov + (GAME_CONSTANTS.DEFAULT_CAMERA_FOV - tr.startFov) * s;
        perspCamera.updateProjectionMatrix();

        if (t >= 1.0) {
          tr.active = false;
          fpvInitializedRef.current = false;
        }
        return; // Skip normal third-person update during transition
      }

      // Reset FPV initialized state when in third person
      if (!isFirstPersonView) {
        fpvInitializedRef.current = false;
      }

      // Existing third-person logic
      {
        const distanceInFront = cameraRange;
        if (animationStateRef.current.hasCompleted) {
          offsetRef.current.x = Math.sin(camera.rotation.y) * distanceInFront;
          offsetRef.current.y = 8 + (cameraRange - 12) * 0.3;
          offsetRef.current.z = Math.cos(camera.rotation.y) * distanceInFront;
        } else if (
          isWireframeAssembled &&
          isTerrainReady &&
          !isIntroPanComplete
        ) {
          animationStateRef.current.isRunning = true;
          introPanTimeRef.current += delta;
          const progress = Math.min(
            introPanTimeRef.current / introPanDuration,
            1.0
          );
          const easeOutProgress = 1 - Math.pow(1 - progress, 3);
          const currentHeight =
            initialHeight + (8 - initialHeight) * easeOutProgress;
          const currentDistance =
            initialDistance +
            (distanceInFront - initialDistance) * easeOutProgress;
          offsetRef.current.x = Math.sin(camera.rotation.y) * currentDistance;
          offsetRef.current.y = currentHeight + (cameraRange - 12) * 0.3;
          offsetRef.current.z = Math.cos(camera.rotation.y) * currentDistance;
          const perspCamera = camera as PerspectiveCamera;
          perspCamera.fov = initialFov + (60 - initialFov) * easeOutProgress;
          perspCamera.updateProjectionMatrix();
          const rotationOffset = (1 - easeOutProgress) * (Math.PI / 8);
          camera.rotation.x = -0.2 - rotationOffset;
          if (progress >= 1.0) {
            setIsIntroPanComplete(true);
            animationStateRef.current.hasCompleted = true;
          }
        } else if (!initialPositionSetRef.current) {
          if (!isWireframeAssembled || !isTerrainReady) {
            camera.position.set(
              playerPosition[0],
              playerPosition[1] + initialHeight,
              playerPosition[2] + initialDistance
            );
            camera.lookAt(
              playerPosition[0],
              playerPosition[1],
              playerPosition[2]
            );
            const perspCamera = camera as PerspectiveCamera;
            if (perspCamera.fov !== initialFov) {
              perspCamera.fov = initialFov;
              perspCamera.updateProjectionMatrix();
            }
            camera.rotation.x = -0.2 - Math.PI / 8;
          }
          initialPositionSetRef.current = true;
        }
        if (
          animationStateRef.current.isRunning ||
          animationStateRef.current.hasCompleted
        ) {
          targetPositionRef.current.set(
            playerPosition[0] + offsetRef.current.x,
            playerPosition[1] + offsetRef.current.y,
            playerPosition[2] + offsetRef.current.z
          );
          const lerpFactor = animationStateRef.current.isRunning ? 0.05 : 0.03;
          camera.position.lerp(targetPositionRef.current, lerpFactor);
          camera.lookAt(
            playerPosition[0],
            playerPosition[1],
            playerPosition[2]
          );
        }
        // Set FOV to 60 in third-person view
        const perspCamera = camera as PerspectiveCamera;
        perspCamera.fov = 60;
        perspCamera.updateProjectionMatrix();
      }
    }
  });

  return null;
});

// Separate component to handle spotlight updates inside the Canvas
const SpotlightUpdater = () => {
  const getState = useRef(useGameState.getState).current;
  const spotLightRef = useRef<ThreeSpotLight>(null);
  const {
    spotlightIntensity,
    spotlightAngle,
    spotlightPenumbra,
    spotlightDistance,
  } = useLightIntensity();

  useFrame(() => {
    const playerTankPosition = getState().playerTankPosition;

    if (spotLightRef.current && playerTankPosition) {
      spotLightRef.current.position.set(
        playerTankPosition[0],
        playerTankPosition[1] + 10,
        playerTankPosition[2]
      );
      spotLightRef.current.intensity = spotlightIntensity;
      spotLightRef.current.angle = spotlightAngle;
      spotLightRef.current.penumbra = spotlightPenumbra;
      spotLightRef.current.distance = spotlightDistance;
    }
  });

  return (
    <spotLight
      ref={spotLightRef}
      position={[0, 10, 0]}
      angle={spotlightAngle}
      penumbra={spotlightPenumbra}
      intensity={spotlightIntensity}
      distance={spotlightDistance}
      castShadow
      shadow-bias={-0.0005}
      shadow-mapSize-width={4096}
      shadow-mapSize-height={4096}
      shadow-radius={2}
      shadow-blurSamples={25}
    />
  );
};

// Additional spotlight for the intro sequence
const IntroSpotlight = () => {
  const { camera } = useThree();
  const getState = useRef(useGameState.getState).current;
  const spotLightRef = useRef<ThreeSpotLight>(null);
  const [isIntroDone, setIsIntroDone] = useState(false);
  const timeRef = useRef(0);
  const introDuration = GAME_CONSTANTS.INTRO_PAN_DURATION;

  useEffect(() => {
    // Watch for changes to the shouldResetCameraAnimation flag
    const unsubscribe = useGameState.subscribe((state) => {
      if (state.shouldResetCameraAnimation) {
        // Reset animation state
        setIsIntroDone(false);
        timeRef.current = 0;
      }
    });

    return () => unsubscribe();
  }, []);

  useFrame((_, delta) => {
    const isGameStarted = getState().isGameStarted;

    if (isGameStarted && !isIntroDone) {
      timeRef.current += delta;
      const progress = Math.min(timeRef.current / introDuration, 1.0);

      if (spotLightRef.current) {
        // Position spotlight above and slightly behind camera to create dramatic lighting
        const cameraPos = camera.position;
        spotLightRef.current.position.set(
          cameraPos.x - Math.sin(camera.rotation.y) * 5,
          cameraPos.y + 10,
          cameraPos.z - Math.cos(camera.rotation.y) * 5
        );

        // Fade out the spotlight as the intro completes
        const fadeOutStart = 0.7; // Start fading at 70% of intro
        if (progress > fadeOutStart) {
          const fadeProgress = (progress - fadeOutStart) / (1 - fadeOutStart);
          spotLightRef.current.intensity = 2.0 * (1 - fadeProgress);
        }

        if (progress >= 1.0) {
          setIsIntroDone(true);
        }
      }
    }
  });

  // Don't render the spotlight once the intro is done
  if (isIntroDone) return null;

  return (
    <spotLight
      ref={spotLightRef}
      position={[0, 50, 0]}
      angle={0.4}
      penumbra={0.4}
      intensity={2.0}
      distance={100}
      color="#ffffff"
      castShadow
      shadow-bias={-0.001}
    />
  );
};

// Component to initialize and maintain spatial hashes for collision optimization
const SpatialHashManager = () => {
  // Initialize spatial hashes for obstacles and enemies
  useObstacleSpatialHash();
  useEnemySpatialHash();

  // Reset spatial hashes on game restart
  useEffect(() => {
    const unsubscribe = useGameState.subscribe((state, prevState) => {
      if (prevState.level > 1 && state.level === 1) {
        resetSpatialHashes();
        debug.log("SpatialHashManager: Reset spatial hashes on game restart");
      }
    });
    return unsubscribe;
  }, []);

  return null;
};

const SceneContent = memo((): JSX.Element => {
  const {
    ambientIntensity,
    directionalIntensity,
    turbidity,
    rayleigh,
    sunDirection,
    nightFactor,
    hemiSky,
    hemiGround,
    sunColor,
  } = useLightIntensity();

  // Optimized: Use shallow selectors instead of manual subscriptions
  const enemies = useGameState((state) => state.enemies, shallow);
  const terrainObstacles = useGameState((state) => state.terrainObstacles, shallow);
  const isFirstPersonView = useGameState((state) => state.isFirstPersonView);
  const powerUps = useGameState((state) => state.powerUps, shallow);

  return (
    <Suspense fallback={null}>
      <SpatialHashManager />
      <EnemyRespawnManager />
      <BattlefieldEnvironment nightFactor={nightFactor} />
      <hemisphereLight
        args={[hemiSky, hemiGround, ambientIntensity * 1.6 + 0.08]}
      />
      <directionalLight
        position={[sunDirection[0] * 45, sunDirection[1] * 45, sunDirection[2] * 45]}
        color={sunColor}
        intensity={directionalIntensity * 1.35}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-far={120}
        shadow-camera-left={-58}
        shadow-camera-right={58}
        shadow-camera-top={58}
        shadow-camera-bottom={-58}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      <SpotlightUpdater />
      <IntroSpotlight />
      <SafeZone />
      <Tank position={[0, 0.5, 0]} isFirstPerson={isFirstPersonView} />
      {enemies.map((enemy) => (
        <EnemyTank key={`enemy-${enemy.id}`} enemy={enemy} />
      ))}
      {/* Primary cannon projectiles + enemy health bars (instanced draw calls) */}
      <InstancedProjectiles />
      <InstancedHealthBars maxEnemies={GAME_CONSTANTS.MAX_ENEMIES + 5} />
      {powerUps.map((powerUp) => (
        <PowerUpItem key={`powerup-${powerUp.id}`} powerUp={powerUp} />
      ))}
      <RockField obstacles={terrainObstacles} />
      <Ground />
      <GrassField />
      <ArenaPerimeter />
      <FxLayer />
      <ShaderWarmup />
      <Sky
        turbidity={turbidity}
        rayleigh={rayleigh}
        sunPosition={sunDirection}
        mieCoefficient={0.006}
        mieDirectionalG={0.85}
      />
      <FollowCamera />
      <OrbitControls enabled={false} />
    </Suspense>
  );
});

// Move terrain obstacle generation to a separate component
const TerrainObstacleGenerator = () => {
  // Get the new action and the reset flag
  const setTerrainObstacles = useGameState(
    (state) => state.setTerrainObstacles
  );
  const isGameOver = useGameState((state) => state.isGameOver);
  const level = useGameState((state) => state.level); // Add level to trigger regeneration on restartGame
  const [isTerrainReadyInternal, setIsTerrainReadyInternal] = useState(false);
  const terrainGeneratedRef = useRef(false);

  useEffect(() => {
    // Only generate terrain if not already generated or game was restarted
    if (terrainGeneratedRef.current && !isGameOver && level > 1) return;

    debug.log("TerrainObstacleGenerator: Starting obstacle generation");

    // Use requestAnimationFrame to defer heavy computation
    // This allows the wireframe animation to run smoothly while terrain is being generated
    const startGenerationTime = performance.now();
    requestAnimationFrame(() => {
      try {
        const obstacleCount = GAME_CONSTANTS.DEFAULT_OBSTACLE_COUNT;
        const spawnClearanceRadius = GAME_CONSTANTS.SPAWN_CLEARANCE_RADIUS;
        let totalAttempts = 0;
        const maxAttempts = GAME_CONSTANTS.MAX_SPAWN_ATTEMPTS;
        const generatedObstacles: Array<{
          // Define local array type
          id: string;
          position: [number, number, number];
          type: "rock";
          size: number;
        }> = [];

        while (
          generatedObstacles.length < obstacleCount && // Check generated length
          totalAttempts < maxAttempts
        ) {
          totalAttempts++;
          let x = (Math.random() - 0.5) * 75;
          let z = (Math.random() - 0.5) * 75;
          const distanceFromSpawn = Math.sqrt(x * x + z * z);
          if (distanceFromSpawn < spawnClearanceRadius) {
            const angle = Math.atan2(z, x);
            x = Math.cos(angle) * spawnClearanceRadius;
            z = Math.sin(angle) * spawnClearanceRadius;
          }
          const size = 1 + Math.random() * 1.2;
          // Check against the locally generated obstacles in this run
          let isTooClose = false;
          const minObstacleSpacing = GAME_CONSTANTS.MIN_OBSTACLE_SPACING;

          for (const existing of generatedObstacles) {
            const dx = existing.position[0] - x;
            const dz = existing.position[2] - z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            const requiredSpace =
              (existing.size + size) * 1.2 + minObstacleSpacing;

            if (distance < requiredSpace) {
              isTooClose = true;
              break;
            }
          }

          if (!isTooClose) {
            const newObstacle = {
              id: `rock-${generatedObstacles.length}-${Date.now()}`,
              position: [x, 0, z] as [number, number, number],
              type: "rock" as const, // Ensure type safety
              size,
            };
            // Add to local array first
            generatedObstacles.push(newObstacle);
          }
        }

        const generationTime = performance.now() - startGenerationTime;
        debug.log(
          `TerrainObstacleGenerator: Generated ${
            generatedObstacles.length
          } obstacles in ${generationTime.toFixed(
            2
          )}ms after ${totalAttempts} attempts`
        );

        // Set the entire array in the state at once
        setTerrainObstacles(generatedObstacles);
        // THEN set the ready flag
        useGameState.setState({ isTerrainReady: true });

        // Mark generation as complete for this instance
        terrainGeneratedRef.current = true;
        setIsTerrainReadyInternal(true); // Update internal state for rendering logic

        debug.log(
          "TerrainObstacleGenerator: Set obstacles and isTerrainReady flag."
        );
      } catch (error) {
        debug.error(
          "TerrainObstacleGenerator: Failed to generate obstacles:",
          error
        );
      }
    });
    // Update dependencies to include level which changes on restart
  }, [setTerrainObstacles, isGameOver, level]);

  // Reset terrain state when game is restarted
  useEffect(() => {
    if (isGameOver) {
      terrainGeneratedRef.current = false;
      setIsTerrainReadyInternal(false); // Reset internal state
      // Global state flags (isTerrainReady, terrainObstacles) are reset by restartGame in gameState.ts
    }
  }, [isGameOver]);

  // Use internal state for the component's own readiness logic
  if (!isTerrainReadyInternal) {
    return null; // Return null instead of placeholder to avoid visual artifacts
  }

  return null;
};

// Main game scene component
const GameScene = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const { skyColor, fogNear, fogFar } = useLightIntensity();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.tabIndex = 0;
      const handleKeyDown = (e: KeyboardEvent) => {
        debug.log("Canvas keydown event:", e.key);
      };
      canvas.addEventListener("keydown", handleKeyDown);
      canvas.focus();
      return () => {
        canvas.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, []);

  return (
    <ErrorBoundary>
      <div
        ref={canvasRef}
        className="canvas-container"
        style={{ width: "100vw", height: "100vh" }}>
        <Canvas
          shadows
          camera={{ position: [0, 40, 60], fov: 60 }}
          style={{ width: "100vw", height: "100vh" }}
          onCreated={() => debug.log("Canvas created")}>
          <color attach="background" args={[skyColor]} />
          <fog attach="fog" args={[skyColor, fogNear, fogFar]} />
          <TerrainObstacleGenerator />
          <SceneContent />
        </Canvas>
        <MobileJoysticks />
      </div>
    </ErrorBoundary>
  );
};

export default GameScene;
