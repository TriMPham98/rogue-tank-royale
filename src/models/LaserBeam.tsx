import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Cylinder } from "@react-three/drei";
import { Vector3, Mesh, Object3D, MathUtils } from "three";
import { useGameState } from "../utils/gameState";
import { debug } from "../utils/debug";

interface LaserBeamProps {
  startPosition: [number, number, number];
  targetId: string;
  rotation: number;
  damage: number;
  range: number;
  color: string;
}

const LaserBeam = ({
  startPosition,
  targetId,
  rotation,
  damage,
  range,
  color,
}: LaserBeamProps) => {
  const beamRef = useRef<Object3D>(null);
  const lastDamageTimeRef = useRef(0);
  const damageIntervalRef = useRef(0.05); // Apply damage every 50ms

  // Access game state
  const damageEnemy = useGameState((state) => state.damageEnemy);
  const isPaused = useGameState((state) => state.isPaused);
  const isGameOver = useGameState((state) => state.isGameOver);
  const terrainObstacles = useGameState((state) => state.terrainObstacles);
  const enemies = useGameState((state) => state.enemies);

  // Effect for logging the beam creation
  useEffect(() => {
    debug.log(`Laser beam created, targeting enemy ${targetId}`);
    return () => {
      debug.log(`Laser beam destroyed`);
    };
  }, [targetId]);

  useFrame((state, delta) => {
    if (!beamRef.current || isPaused || isGameOver) return;

    // Find the target enemy
    const targetEnemy = enemies.find((e) => e.id === targetId);
    if (!targetEnemy) return;

    // Set up vectors
    const start = new Vector3(...startPosition);
    const targetPos = new Vector3(
      targetEnemy.position[0],
      targetEnemy.position[1] + 1, // Aim at center mass
      targetEnemy.position[2]
    );

    // Calculate distance to target
    const distanceToTarget = start.distanceTo(targetPos);

    // Check if target is within range
    if (distanceToTarget > range) return;

    // Check for obstacles between beam and target
    let isBlocked = false;
    for (const obstacle of terrainObstacles) {
      const obstaclePos = new Vector3(...obstacle.position);
      const obstacleRadius =
        obstacle.type === "rock" ? obstacle.size : obstacle.size * 0.3;

      // Simple line-sphere intersection check
      const directionToTarget = targetPos.clone().sub(start).normalize();
      const toObstacle = obstaclePos.clone().sub(start);
      const projectionLength = toObstacle.dot(directionToTarget);

      // Skip if obstacle is behind starting point or beyond target
      if (projectionLength < 0 || projectionLength > distanceToTarget) continue;

      // Calculate closest point on beam line to obstacle
      const closestPoint = start
        .clone()
        .add(directionToTarget.clone().multiplyScalar(projectionLength));
      const distanceToBeam = obstaclePos.distanceTo(closestPoint);

      if (distanceToBeam < obstacleRadius) {
        isBlocked = true;
        break;
      }
    }

    // Position and scale the beam
    if (beamRef.current) {
      // Calculate direction vector from start to target
      const direction = targetPos.clone().sub(start).normalize();

      // Calculate effective beam length based on whether it's blocked
      const beamLength = isBlocked
        ? Math.min(distanceToTarget, 5)
        : distanceToTarget;

      // Calculate the end point of the beam
      const endPoint = start
        .clone()
        .add(direction.clone().multiplyScalar(beamLength));

      // Calculate the midpoint for positioning
      const midPoint = new Vector3(
        (start.x + endPoint.x) / 2,
        (start.y + endPoint.y) / 2,
        (start.z + endPoint.z) / 2
      );

      // Position at midpoint
      beamRef.current.position.copy(midPoint);

      // Properly orient the beam (Cylinder's default orientation is along Y-axis)
      // We need to rotate it to align with our direction vector
      beamRef.current.lookAt(endPoint);

      // Apply additional 90-degree rotation to make the cylinder lie along its length
      beamRef.current.rotateX(MathUtils.degToRad(90));

      // Scale for thickness and length (note the order of x,y,z is different now)
      beamRef.current.scale.set(0.05, beamLength / 2, 0.05);
    }

    // Apply damage to enemy if not blocked and enough time has passed since last damage
    if (!isBlocked) {
      const currentTime = state.clock.getElapsedTime();
      if (currentTime - lastDamageTimeRef.current > damageIntervalRef.current) {
        damageEnemy(targetId, damage);
        lastDamageTimeRef.current = currentTime;
      }
    }
  });

  return (
    <Cylinder
      ref={beamRef}
      args={[1, 1, 1, 8]} // Base cylinder dimensions (will be scaled in useFrame)
      position={startPosition}>
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={2}
        transparent={true}
        opacity={0.7}
      />
    </Cylinder>
  );
};

export default LaserBeam;
