// src/components/ShotgunPellet.tsx
import { useRef } from "react";
import { useFrame, RootState } from "@react-three/fiber";
import { Group, Vector3 } from "three";
import { useGameState } from "../utils/gameState";
import { debug } from "../utils/debug";
import { fx, FX_COLORS } from "./fx/fxSystem";
import { getCoreGeometry, getCoreMaterial, getTrailGeometry, getTrailMaterial } from "./fx/tracers";

interface ShotgunPelletProps {
  id: string;
  position: [number, number, number];
  rotation: number;
  damage: number;
  speed: number;
  range: number;
  ttl: number;
  onRemove: (id: string) => void;
}

const ShotgunPellet = ({
  id,
  position,
  rotation,
  damage,
  speed,
  range,
  ttl,
  onRemove,
}: ShotgunPelletProps) => {
  const pelletRef = useRef<Group>(null);
  const hasCollidedRef = useRef<boolean>(false);
  const initialPositionRef = useRef<Vector3>(new Vector3(...position));
  const startTimeRef = useRef<number>(performance.now());

  const damageEnemy = useGameState((state) => state.damageEnemy);
  const isPaused = useGameState((state) => state.isPaused);
  const isGameOver = useGameState((state) => state.isGameOver);
  const terrainObstacles = useGameState((state) => state.terrainObstacles);
  const enemies = useGameState((state) => state.enemies);
  const playerTankPosition = useGameState((state) => state.playerTankPosition);

  useFrame((_state: RootState, delta: number) => {
    const currentPellet = pelletRef.current;
    if (!currentPellet || hasCollidedRef.current || isPaused || isGameOver) {
      return;
    }

    // 1. Check Lifetime (TTL)
    const elapsedTime: number =
      (performance.now() - startTimeRef.current) / 1000;
    if (elapsedTime > ttl) {
      debug.log(`Pellet ${id} removed: TTL expired (${elapsedTime} > ${ttl})`);
      hasCollidedRef.current = true;
      onRemove(id);
      return;
    }

    // 2. Movement
    const moveDistance: number = speed * delta;
    currentPellet.position.x += Math.sin(rotation) * moveDistance;
    currentPellet.position.z += Math.cos(rotation) * moveDistance;
    const currentPosition: Vector3 = currentPellet.position;

    // 3. Check Range
    const distanceTraveled: number = currentPosition.distanceTo(
      initialPositionRef.current
    );
    if (distanceTraveled > range) {
      debug.log(
        `Pellet ${id} removed: Range exceeded (${distanceTraveled} > ${range})`
      );
      hasCollidedRef.current = true;
      onRemove(id);
      return;
    }

    // 5. Check Collisions with Player Tank
    if (playerTankPosition) {
      const playerPos = new Vector3(...playerTankPosition);
      const playerRadius = 1.5; // Player tank collision radius
      const distanceToPlayer = currentPosition.distanceTo(playerPos);

      if (distanceToPlayer < playerRadius + 0.08) {
        debug.log(
          `Pellet ${id} removed: Hit player tank at ${playerPos.x}, ${playerPos.z}`
        );
        hasCollidedRef.current = true;
        onRemove(id);
        return;
      }
    }

    // 6. Check Collisions with Terrain
    for (const obstacle of terrainObstacles) {
      const obstaclePos = new Vector3(
        obstacle.position[0],
        obstacle.position[1],
        obstacle.position[2]
      );
      const obstacleRadius: number = obstacle.size * 0.75;
      const distanceToObstacle: number =
        currentPosition.distanceTo(obstaclePos);

      if (distanceToObstacle < obstacleRadius + 0.08) {
        fx.ricochet(currentPosition.x, currentPosition.y, currentPosition.z, FX_COLORS.spark);
        debug.log(
          `Pellet ${id} removed: Hit terrain at ${obstaclePos.x}, ${obstaclePos.z}`
        );
        hasCollidedRef.current = true;
        onRemove(id);
        return;
      }
    }

    // 7. Check Enemy Collisions
    for (const enemy of enemies) {
      const enemyPos = new Vector3(
        enemy.position[0],
        enemy.position[1],
        enemy.position[2]
      );
      const enemyRadius: number = enemy.type === "tank" ? 1.5 : 1.0;
      const distanceToEnemy: number = currentPosition.distanceTo(enemyPos);

      if (distanceToEnemy < enemyRadius + 0.08) {
        debug.log(
          `Pellet ${id} hit enemy ${enemy.id} at ${enemyPos.x}, ${enemyPos.z}`
        );
        fx.impact(currentPosition.x, currentPosition.y, currentPosition.z, FX_COLORS.spark, 0.6);
        damageEnemy(enemy.id, damage);
        hasCollidedRef.current = true;
        onRemove(id);
        return;
      }
    }
  });

  return (
    <group ref={pelletRef} position={position} rotation={[0, rotation, 0]}>
      <mesh geometry={getTrailGeometry(0.9, 0.2)} material={getTrailMaterial("#ffb83d")} renderOrder={4} />
      <mesh geometry={getCoreGeometry()} material={getCoreMaterial("#fff0c0")} scale={0.05} />
    </group>
  );
};

export default ShotgunPellet;
