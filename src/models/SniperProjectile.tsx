import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Vector3 } from "three";
import { useGameState } from "../utils/gameState";
import { debug } from "../utils/debug";
import { enemyHitRadius } from "../utils/enemyHitbox";
import { fx } from "./fx/fxSystem";
import { getCoreGeometry, getCoreMaterial, getTrailGeometry, getTrailMaterial } from "./fx/tracers";

const SNIPER_SPARK = 0xff7a2a;

interface SniperProjectileProps {
  id: string;
  position: [number, number, number];
  rotation: number;
  damage: number;
  targetId: string | null; // The ID of the enemy to track
  onRemove: (id: string) => void;
  penetrationPower?: number; // Number of enemies the bullet can penetrate
}

const SniperProjectile = ({
  id,
  position,
  rotation,
  damage,
  targetId,
  onRemove,
  penetrationPower = 1, // Default to 1 (no penetration)
}: SniperProjectileProps) => {
  const projectileRef = useRef<Group>(null);
  const hasCollidedRef = useRef(false);
  const initialPositionRef = useRef<[number, number, number]>([...position]);
  const distanceTraveledRef = useRef(0);
  const penetrationsLeftRef = useRef(penetrationPower);
  const hitEnemiesRef = useRef<Set<string>>(new Set());

  // Access state functions
  const damageEnemy = useGameState((state) => state.damageEnemy);
  const playerBulletVelocity = useGameState(
    (state) => state.playerBulletVelocity
  );
  const isPaused = useGameState((state) => state.isPaused);
  const isGameOver = useGameState((state) => state.isGameOver);
  const terrainObstacles = useGameState((state) => state.terrainObstacles);

  // Get direct access to the store for latest enemy positions
  const getState = useRef(useGameState.getState).current;

  // Projectile movement with homing capability
  useFrame((_, delta) => {
    if (
      !projectileRef.current ||
      (hasCollidedRef.current && penetrationsLeftRef.current <= 0) ||
      isPaused ||
      isGameOver
    )
      return;

    // Move projectile with higher velocity (sniper bullets are faster)
    const sniperBulletVelocity = playerBulletVelocity * 1.8;
    projectileRef.current.position.x +=
      Math.sin(rotation) * delta * sniperBulletVelocity;
    projectileRef.current.position.z +=
      Math.cos(rotation) * delta * sniperBulletVelocity;

    // Check map boundaries - Ground is 100x100 centered at origin
    const mapSize = 50; // Half of the total ground size (100/2)
    if (
      Math.abs(projectileRef.current.position.x) > mapSize ||
      Math.abs(projectileRef.current.position.z) > mapSize
    ) {
      debug.log(`Sniper projectile ${id} reached map boundary`);
      onRemove(id);
      return;
    }

    // Enhanced velocity for sniper shots
    const velocity = playerBulletVelocity * 1.5;
    let newDirection = new Vector3(Math.sin(rotation), 0, Math.cos(rotation));

    // Get fresh enemy data for tracking
    const enemies = getState().enemies;
    const targetEnemy = targetId
      ? enemies.find((e) => e.id === targetId)
      : null;

    if (targetEnemy && penetrationsLeftRef.current === penetrationPower) {
      // Only track for first target
      // Calculate direction to target for tracking
      const currentPos = new Vector3(
        projectileRef.current.position.x,
        projectileRef.current.position.y,
        projectileRef.current.position.z
      );

      const targetPos = new Vector3(
        targetEnemy.position[0],
        targetEnemy.position[1] + 1, // Aim at the center of the enemy
        targetEnemy.position[2]
      );

      // Direction to target
      const directionToTarget = targetPos.clone().sub(currentPos).normalize();

      // Blend between straight line and homing (more homing as it gets closer)
      const distanceToTarget = currentPos.distanceTo(targetPos);
      const homingFactor = Math.max(0, Math.min(0.2, 10 / distanceToTarget)); // Increase homing as it gets closer

      // Blend the forward direction with direction to target
      newDirection = newDirection.lerp(directionToTarget, homingFactor);
      newDirection.normalize();

      // Debug tracking
      if (Math.random() < 0.01) {
        debug.log(
          `Sniper bullet tracking: distance=${distanceToTarget.toFixed(
            2
          )}, homing=${homingFactor.toFixed(2)}`
        );
      }
    }

    // Move projectile along calculated direction
    projectileRef.current.position.x += newDirection.x * delta * velocity;
    projectileRef.current.position.z += newDirection.z * delta * velocity;
    // Point the tracer along its actual heading (homing bends it slightly)
    projectileRef.current.rotation.y = Math.atan2(
      Math.sin(rotation) * sniperBulletVelocity + newDirection.x * velocity,
      Math.cos(rotation) * sniperBulletVelocity + newDirection.z * velocity
    );

    // Calculate distance traveled
    const currentPosition = new Vector3(
      projectileRef.current.position.x,
      projectileRef.current.position.y,
      projectileRef.current.position.z
    );
    const initialPosition = new Vector3(
      initialPositionRef.current[0],
      initialPositionRef.current[1],
      initialPositionRef.current[2]
    );
    distanceTraveledRef.current = currentPosition.distanceTo(initialPosition);

    // Remove projectile if it's gone too far (sniper bullets have longer range)
    if (distanceTraveledRef.current > 80) {
      debug.log(`Sniper bullet ${id} reached max range`);
      onRemove(id);
      return;
    }

    // Check for collisions with terrain obstacles
    const projectilePos = new Vector3(
      projectileRef.current.position.x,
      projectileRef.current.position.y,
      projectileRef.current.position.z
    );

    for (const obstacle of terrainObstacles) {
      const obstaclePos = new Vector3(...obstacle.position);
      const distanceToObstacle = obstaclePos.distanceTo(projectilePos);
      const collisionRadius =
        obstacle.type === "rock" ? obstacle.size : obstacle.size * 0.3;

      if (distanceToObstacle < collisionRadius) {
        // Terrain obstacles always stop bullets regardless of penetration power
        debug.log(`Sniper bullet hit terrain obstacle`);
        fx.ricochet(projectilePos.x, projectilePos.y, projectilePos.z, SNIPER_SPARK);
        onRemove(id);
        return;
      }
    }

    // Check for collisions with all enemies
    for (const enemy of enemies) {
      // Skip enemies we've already hit with this bullet
      if (hitEnemiesRef.current.has(enemy.id)) continue;

      const enemyPos = new Vector3(...enemy.position);
      const distanceToEnemy = enemyPos.distanceTo(projectilePos);

      // Sniper bullets have better targeting
      const collisionRadius = enemyHitRadius(enemy.type, 2.0, 1.2);

      if (distanceToEnemy < collisionRadius) {
        hitEnemiesRef.current.add(enemy.id);

        // Apply extra critical hit chance for sniper (50% chance)
        const isCriticalHit = Math.random() < 0.5;
        const finalDamage = isCriticalHit ? damage * 1.5 : damage;

        debug.log(
          `Sniper hit on enemy ${enemy.id}${
            isCriticalHit ? " (CRITICAL HIT!)" : ""
          } - Penetrations left: ${penetrationsLeftRef.current - 1}`
        );

        // Apply damage to the enemy
        fx.impact(projectilePos.x, projectilePos.y, projectilePos.z, SNIPER_SPARK, isCriticalHit ? 1.6 : 1.1);
        damageEnemy(enemy.id, finalDamage);

        // Check if enemy was destroyed
        const updatedEnemies = getState().enemies;
        const enemyDestroyed = !updatedEnemies.some((e) => e.id === enemy.id);

        if (enemyDestroyed) {
          debug.log(`Enemy ${enemy.id} eliminated by sniper`);
        }

        // Reduce penetration power
        penetrationsLeftRef.current--;

        // If no more penetration power, remove the projectile
        if (penetrationsLeftRef.current <= 0) {
          debug.log(`Sniper bullet has no more penetration power`);
          onRemove(id);
          return;
        }

        // We only check one collision per frame, so break after the first hit
        break;
      }
    }
  });

  const color = penetrationPower > 1 ? "#ff6a1a" : "#2aa8ff";
  return (
    <group ref={projectileRef} position={position} rotation={[0, rotation, 0]}>
      <mesh geometry={getTrailGeometry(3.2, 0.36)} material={getTrailMaterial(color)} renderOrder={4} />
      <mesh geometry={getCoreGeometry()} material={getCoreMaterial("#fff3e0")} scale={0.07} />
    </group>
  );
};

export default SniperProjectile;
