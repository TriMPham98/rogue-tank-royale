import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Group, Sprite, Vector3 } from "three";
import { useGameState } from "../utils/gameState";
import { debug } from "../utils/debug";
import { fx } from "./fx/fxSystem";
import GlowSprite from "./fx/GlowSprite";
import { getBeamMaterials } from "./fx/tracers";

interface LaserBeamProps {
  startPosition: [number, number, number];
  targetId: string;
  damage: number;
  range: number;
  color: string;
}

const DAMAGE_INTERVAL = 0.1; // Apply damage every 100ms

const LaserBeam = ({
  startPosition,
  targetId,
  damage,
  range,
  color,
}: LaserBeamProps) => {
  const beamRef = useRef<Group>(null);
  const impactRef = useRef<Sprite>(null);
  const lastDamageTimeRef = useRef(0);
  const sparkTimerRef = useRef(0);
  const mats = useMemo(() => getBeamMaterials(color), [color]);
  const colorHex = useMemo(() => parseInt(new Color(color).getHexString(), 16), [color]);

  const damageEnemy = useGameState((state) => state.damageEnemy);
  const isPaused = useGameState((state) => state.isPaused);
  const isGameOver = useGameState((state) => state.isGameOver);
  const terrainObstacles = useGameState((state) => state.terrainObstacles);
  const enemies = useGameState((state) => state.enemies);

  const startVec = useRef(new Vector3()).current;
  const targetCenterVec = useRef(new Vector3()).current;
  const directionVec = useRef(new Vector3()).current;
  const endPointVec = useRef(new Vector3()).current;
  const midPointVec = useRef(new Vector3()).current;
  const obstaclePosVec = useRef(new Vector3()).current;
  const vecToObstacle = useRef(new Vector3()).current;

  useEffect(() => {
    debug.log(`Laser beam created, targeting enemy ${targetId}`);
    if (beamRef.current) {
      beamRef.current.visible = false;
    }
    return () => {
      debug.log(`Laser beam destroyed`);
    };
  }, [targetId]);

  useFrame((state, delta) => {
    if (!beamRef.current) return;
    if (impactRef.current) impactRef.current.visible = false;

    if (isPaused || isGameOver) {
      beamRef.current.visible = false;
      return;
    }

    const targetEnemy = enemies.find((e) => e.id === targetId);

    if (!targetEnemy) {
      beamRef.current.visible = false;
      return;
    }

    startVec.set(...startPosition);
    targetCenterVec.set(
      targetEnemy.position[0],
      targetEnemy.position[1] + 0.5,
      targetEnemy.position[2]
    );

    const distanceToTarget = startVec.distanceTo(targetCenterVec);

    if (distanceToTarget > range) {
      beamRef.current.visible = false;
      return;
    }

    directionVec.copy(targetCenterVec).sub(startVec);

    let effectiveBeamLength = distanceToTarget;
    let isBlocked = false;
    const directionNormalized = directionVec.clone().normalize();

    for (const obstacle of terrainObstacles) {
      obstaclePosVec.set(...obstacle.position);
      const obstacleRadius =
        (obstacle.type === "rock" ? obstacle.size : obstacle.size * 0.7) * 0.5 +
        0.1;

      vecToObstacle.copy(obstaclePosVec).sub(startVec);
      const tca = vecToObstacle.dot(directionNormalized);

      if (tca < 0 || tca > effectiveBeamLength) continue;

      const d2 = vecToObstacle.lengthSq() - tca * tca;
      const radiusSq = obstacleRadius * obstacleRadius;

      if (d2 <= radiusSq) {
        const thc = Math.sqrt(radiusSq - d2);
        const t0 = tca - thc;

        if (t0 >= 0 && t0 < effectiveBeamLength) {
          effectiveBeamLength = t0;
          isBlocked = true;
        }
      }
    }

    const MIN_BEAM_LENGTH = 0.01;
    if (effectiveBeamLength < MIN_BEAM_LENGTH) {
      beamRef.current.visible = false;
      return;
    }

    beamRef.current.visible = true;

    endPointVec
      .copy(startVec)
      .addScaledVector(directionNormalized, effectiveBeamLength);

    midPointVec.copy(startVec).lerp(endPointVec, 0.5);

    beamRef.current.position.copy(midPointVec);

    beamRef.current.rotation.set(0, 0, 0);
    beamRef.current.lookAt(endPointVec);
    beamRef.current.rotateX(Math.PI / 2);

    // Unit-length beam stretched along its axis; thickness shimmers
    const shimmer = 0.85 + Math.random() * 0.3;
    beamRef.current.scale.set(shimmer, effectiveBeamLength, shimmer);

    if (impactRef.current) {
      impactRef.current.visible = true;
      impactRef.current.position.copy(endPointVec);
      impactRef.current.scale.setScalar(0.9 + Math.random() * 0.5);
    }
    sparkTimerRef.current -= delta;
    if (sparkTimerRef.current <= 0) {
      sparkTimerRef.current = 0.06;
      fx.zap(endPointVec.x, endPointVec.y, endPointVec.z, colorHex, isBlocked ? 0.35 : 0.55);
    }

    if (!isBlocked) {
      const currentTime = state.clock.getElapsedTime();
      if (currentTime - lastDamageTimeRef.current >= DAMAGE_INTERVAL) {
        damageEnemy(targetId, damage);
        lastDamageTimeRef.current = currentTime;
      }
    } else {
      lastDamageTimeRef.current = state.clock.getElapsedTime();
    }
  });

  return (
    <>
      <group ref={beamRef} visible={false}>
        <mesh material={mats.haze} renderOrder={5}>
          <cylinderGeometry args={[0.2, 0.2, 1, 10, 1, true]} />
        </mesh>
        <mesh material={mats.glow} renderOrder={5}>
          <cylinderGeometry args={[0.085, 0.085, 1, 10, 1, true]} />
        </mesh>
        <mesh material={mats.core} renderOrder={6}>
          <cylinderGeometry args={[0.028, 0.028, 1, 6, 1, true]} />
        </mesh>
      </group>
      <GlowSprite ref={impactRef} color={color} size={1} opacity={0.9} />
    </>
  );
};

export default LaserBeam;
