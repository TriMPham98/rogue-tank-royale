import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGameState } from "../utils/gameState";
import * as THREE from "three";
import { useSound } from "../utils/sound";
import { WALL_HEIGHT, createGroundMaterial, createWallMaterial } from "./safeZone/zoneShaders";

const SafeZone = () => {
  const {
    safeZoneRadius,
    safeZoneCenter,
    safeZoneTargetRadius,
    safeZoneShrinkRate,
    safeZoneActive,
    playerTankPosition,
    takeDamage,
    isPaused,
    isGameOver,
    level,
    isPreZoneChangeLevel,
  } = useGameState();

  const { playLoop, stopLoop } = useSound();
  const isSoundPlaying = useRef(false);

  const wallRef = useRef<THREE.Mesh>(null);
  const targetWallRef = useRef<THREE.Mesh>(null);
  const nextWallRef = useRef<THREE.Mesh>(null);

  const lastDamageTime = useRef(0);
  const currentRadiusRef = useRef(safeZoneRadius);
  const isShrinkingRef = useRef(false);
  const targetRadiusRef = useRef(safeZoneTargetRadius);
  const initialRadiusRef = useRef(safeZoneRadius);
  const estimatedTimeToCompleteRef = useRef(0);
  const startShrinkTimeRef = useRef(0);
  const prevLevelRef = useRef(level);
  const isZoneCompletionEnforced = useRef(false);
  const animationTimeRef = useRef(0);
  const lastRadiusUpdateTime = useRef(0);

  const isZoneChangeLevel = level % 5 === 0 && level > 0;
  const currentZoneLevel = Math.floor(level / 5);
  const nextZoneLevel = currentZoneLevel + 1;

  const nextZoneTargetRadius = (() => {
    const maxRadius = 50;
    const minRadius = 5;
    const radiusDecrease = 4;
    return Math.max(minRadius, maxRadius - nextZoneLevel * radiusDecrease);
  })();

  // Unit-radius geometry scaled per frame: no per-frame geometry rebuilds
  const wallGeometry = useMemo(
    () => new THREE.CylinderGeometry(1, 1, WALL_HEIGHT, 96, 1, true),
    []
  );
  const groundGeometry = useMemo(() => new THREE.PlaneGeometry(320, 320), []);
  const materials = useMemo(
    () => ({
      wall: createWallMaterial("#38c8ff", 0.5),
      target: createWallMaterial("#ff4d4d", 0.22),
      next: createWallMaterial("#ff9500", 0),
      ground: createGroundMaterial(),
    }),
    []
  );

  useEffect(
    () => () => {
      wallGeometry.dispose();
      groundGeometry.dispose();
      Object.values(materials).forEach((m) => m.dispose());
    },
    [wallGeometry, groundGeometry, materials]
  );

  useEffect(() => {
    if (level % 5 === 0 && level > 0 && prevLevelRef.current !== level) {
      currentRadiusRef.current = safeZoneTargetRadius;
      initialRadiusRef.current = safeZoneTargetRadius;
      isZoneCompletionEnforced.current = true;
      useGameState.setState({ safeZoneRadius: safeZoneTargetRadius });
    } else {
      isZoneCompletionEnforced.current = false;
    }
    prevLevelRef.current = level;

    if (
      (!isShrinkingRef.current || safeZoneRadius < currentRadiusRef.current) &&
      !isZoneCompletionEnforced.current
    ) {
      currentRadiusRef.current = safeZoneRadius;
      initialRadiusRef.current = safeZoneRadius;
      if (safeZoneRadius > safeZoneTargetRadius) {
        startShrinkTimeRef.current = Date.now() / 1000;
        const radiusDifference = safeZoneRadius - safeZoneTargetRadius;
        estimatedTimeToCompleteRef.current =
          radiusDifference / safeZoneShrinkRate;
      }
    }
    targetRadiusRef.current = safeZoneTargetRadius;
  }, [safeZoneRadius, safeZoneTargetRadius, safeZoneShrinkRate, level]);

  useEffect(() => {
    if (!isPreZoneChangeLevel || !safeZoneActive || isPaused || isGameOver) {
      if (isSoundPlaying.current) {
        stopLoop("zoneWarning");
        isSoundPlaying.current = false;
      }
    } else if (!isSoundPlaying.current) {
      playLoop("zoneWarning", 1.375);
      isSoundPlaying.current = true;
    }
  }, [
    isPreZoneChangeLevel,
    safeZoneActive,
    isPaused,
    isGameOver,
    playLoop,
    stopLoop,
  ]);

  useFrame((state, delta) => {
    if (isPaused || isGameOver || !safeZoneActive) return;

    const currentState = useGameState.getState();
    const currentTime = state.clock.getElapsedTime();
    animationTimeRef.current += delta;

    // Next-tier preview breathes while the warning is active
    const previewOpacity = isPreZoneChangeLevel
      ? 0.1 + 0.4 * Math.abs(Math.sin(Date.now() / 800))
      : 0;
    const urgent = shouldPulse || shouldUrgencyPulse;
    const t = animationTimeRef.current;

    materials.wall.uniforms.uTime.value = t;
    materials.wall.uniforms.uPulse.value = urgent ? 1 : 0;
    materials.wall.uniforms.uOpacity.value = urgent ? getPulseOpacity() : getSafeZoneOpacity();
    materials.target.uniforms.uTime.value = t;
    materials.target.uniforms.uPulse.value = isPreZoneChangeLevel ? 1 : 0;
    materials.target.uniforms.uOpacity.value = isPreZoneChangeLevel ? 0.14 : 0.09;
    materials.next.uniforms.uTime.value = t;
    materials.next.uniforms.uOpacity.value = previewOpacity * 0.8;
    materials.ground.uniforms.uTime.value = t;
    materials.ground.uniforms.uNextAlpha.value = previewOpacity * 2;
    materials.ground.uniforms.uDanger.value = isPreZoneChangeLevel ? 1 : 0;

    if (
      isZoneChangeLevel &&
      currentRadiusRef.current !== targetRadiusRef.current
    ) {
      currentRadiusRef.current = targetRadiusRef.current;
      useGameState.setState({ safeZoneRadius: targetRadiusRef.current });
      return;
    }

    if (currentRadiusRef.current > currentState.safeZoneTargetRadius) {
      isShrinkingRef.current = true;
      const newRadius = Math.max(
        currentState.safeZoneTargetRadius,
        currentRadiusRef.current - currentState.safeZoneShrinkRate * delta * 1.5
      );

      if (Math.abs(currentRadiusRef.current - newRadius) > 0.01) {
        currentRadiusRef.current = newRadius;
        if (state.clock.elapsedTime - lastRadiusUpdateTime.current > 0.2) {
          useGameState.setState({ safeZoneRadius: newRadius });
          lastRadiusUpdateTime.current = state.clock.elapsedTime;
        }
      }

      if (
        Math.abs(currentRadiusRef.current - currentState.safeZoneTargetRadius) <
        0.1
      ) {
        isShrinkingRef.current = false;
      }
    } else {
      isShrinkingRef.current = false;
    }

    if (currentState.safeZoneActive && playerTankPosition) {
      const playerPosition2D = [playerTankPosition[0], playerTankPosition[2]];
      const centerPosition = [
        currentState.safeZoneCenter[0],
        currentState.safeZoneCenter[1],
      ];
      const distance = Math.sqrt(
        Math.pow(playerPosition2D[0] - centerPosition[0], 2) +
          Math.pow(playerPosition2D[1] - centerPosition[1], 2)
      );

      if (distance > currentRadiusRef.current) {
        if (currentTime - lastDamageTime.current >= 1) {
          takeDamage(currentState.safeZoneDamage);
          lastDamageTime.current = currentTime;
        }
      }
    }

    const radius = currentRadiusRef.current;
    const target = currentState.safeZoneTargetRadius;
    wallRef.current?.scale.set(radius, 1, radius);
    materials.wall.uniforms.uRadius.value = radius;
    materials.ground.uniforms.uRadius.value = radius;

    const showTarget = target < radius - 0.05;
    if (targetWallRef.current) {
      targetWallRef.current.visible = showTarget;
      targetWallRef.current.scale.set(target, 1, target);
    }
    materials.target.uniforms.uRadius.value = target;
    materials.ground.uniforms.uTarget.value = showTarget ? target : 0;

    if (nextWallRef.current) {
      nextWallRef.current.visible = isPreZoneChangeLevel;
      nextWallRef.current.scale.set(nextZoneTargetRadius, 1, nextZoneTargetRadius);
    }
    materials.next.uniforms.uRadius.value = nextZoneTargetRadius;
    materials.ground.uniforms.uNext.value = isPreZoneChangeLevel ? nextZoneTargetRadius : 0;
  });

  const getSafeZoneOpacity = () => {
    const baseOpacity = 0.45;
    const zoneIncrease = Math.min(0.35, currentZoneLevel * 0.05);
    const urgencyBonus = isPreZoneChangeLevel ? 0.2 : 0;
    return baseOpacity + zoneIncrease + urgencyBonus;
  };

  const shouldPulse = isZoneChangeLevel && isShrinkingRef.current;
  const shouldUrgencyPulse = isPreZoneChangeLevel && isShrinkingRef.current;

  const getPulseOpacity = () => {
    return getSafeZoneOpacity() * 1.5;
  };

  return safeZoneActive ? (
    <group position={[safeZoneCenter[0], 0, safeZoneCenter[1]]}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.06, 0]}
        geometry={groundGeometry}
        material={materials.ground}
        renderOrder={2}
      />
      <mesh
        ref={wallRef}
        position={[0, WALL_HEIGHT / 2, 0]}
        scale={[safeZoneRadius, 1, safeZoneRadius]}
        geometry={wallGeometry}
        material={materials.wall}
        renderOrder={6}
      />
      <mesh
        ref={targetWallRef}
        position={[0, WALL_HEIGHT / 2, 0]}
        geometry={wallGeometry}
        material={materials.target}
        visible={false}
        renderOrder={6}
      />
      <mesh
        ref={nextWallRef}
        position={[0, WALL_HEIGHT / 2, 0]}
        geometry={wallGeometry}
        material={materials.next}
        visible={false}
        renderOrder={6}
      />
    </group>
  ) : null;
};

export default SafeZone;
