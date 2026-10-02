// src/components/RocketProjectile.tsx
import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh, Vector3, Group } from "three";
import { useGameState } from "../utils/gameState";
import { debug } from "../utils/debug";
import { fx } from "./fx/fxSystem";
import GlowSprite from "./fx/GlowSprite";
import { ROCKET_MATS } from "./weaponVisuals/weaponMaterials";

// --- Rocket Projectile Component ---

interface RocketProjectileProps {
  id: string;
  position: [number, number, number];
  rotation: number;
  damage: number;
  targetId: string | null;
  onRemove: (id: string) => void;
}

const GROUND_Y_LEVEL = 0.1;

const RocketProjectile = ({
  id,
  position,
  rotation,
  damage,
  targetId,
  onRemove,
}: RocketProjectileProps) => {
  const projectileGroupRef = useRef<Group>(null);
  const visualGroupRef = useRef<Group>(null); // Inner group for pitch and model details
  const flameRef = useRef<Mesh>(null); // Ref for the flame mesh
  const trailTimerRef = useRef(0);

  const hasExplodedRef = useRef(false);
  const initialPositionRef = useRef<Vector3>(new Vector3(...position));
  const distanceTraveledRef = useRef(0);
  const ageRef = useRef(0);
  const targetPositionRef = useRef<Vector3 | null>(null);

  const maxHeight = 3; // Arc height
  const splashRadius = 5; // Reduced from 10 to 5 for smaller splash damage radius

  const damageEnemy = useGameState((state) => state.damageEnemy);
  const playerBulletVelocity = useGameState(
    (state) => state.playerBulletVelocity
  );
  const isPaused = useGameState((state) => state.isPaused);
  const isGameOver = useGameState((state) => state.isGameOver);
  const terrainObstacles = useGameState((state) => state.terrainObstacles);
  const getState = useRef(useGameState.getState).current;

  useEffect(() => {
    if (targetId) {
      const enemies = getState().enemies;
      const targetEnemy = enemies.find((e) => e.id === targetId);
      if (targetEnemy) {
        targetPositionRef.current = new Vector3(...targetEnemy.position);
        debug.log(
          `Rocket ${id} locked target position at [${targetPositionRef.current.x.toFixed(
            2
          )}, ${targetPositionRef.current.y.toFixed(
            2
          )}, ${targetPositionRef.current.z.toFixed(2)}]`
        );
      } else {
        debug.warn(`Rocket ${id} could not find target enemy ID: ${targetId}`);
        targetPositionRef.current = null; // Target lost or destroyed
      }
    }
  }, [targetId]); // Re-evaluate if targetId changes (though unlikely in current setup)

  const explode = (explosionPos: Vector3) => {
    if (hasExplodedRef.current) return;
    hasExplodedRef.current = true;
    debug.log(
      `Rocket ${id} initiating explosion sequence at [${explosionPos.x.toFixed(
        2
      )}, ${explosionPos.y.toFixed(2)}, ${explosionPos.z.toFixed(2)}]`
    );

    fx.blast(explosionPos.x, explosionPos.y, explosionPos.z, splashRadius);

    // --- Damage Calculation (Functionality unchanged) ---
    const enemies = getState().enemies;
    let hitCount = 0;
    for (const enemy of enemies) {
      const enemyPos = new Vector3(...enemy.position);
      const distanceToExplosion = enemyPos.distanceTo(explosionPos);

      if (distanceToExplosion <= splashRadius) {
        const damageFactor = Math.max(
          0,
          1 - distanceToExplosion / splashRadius
        );
        const splashDamage = damage * damageFactor;
        debug.log(
          `Splash damage to enemy ${enemy.id}: ${splashDamage.toFixed(
            1
          )} at distance ${distanceToExplosion.toFixed(2)}`
        );
        damageEnemy(enemy.id, splashDamage);
        hitCount++;
      }
    }
    debug.log(`Rocket ${id} explosion damaged ${hitCount} enemies.`);
    // --- End Damage Calculation ---

    // Blast visuals live in the shared FX layer, so the shell can go immediately
    onRemove(id);
  };

  useFrame((_, delta) => {
    if (hasExplodedRef.current || isPaused || isGameOver) return;

    // Check if the projectile group still exists before proceeding
    if (!projectileGroupRef.current || !visualGroupRef.current) {
      debug.warn(`Rocket ${id} refs lost unexpectedly. Removing.`);
      onRemove(id);
      return;
    }

    ageRef.current += delta;
    const rocketVelocity = playerBulletVelocity * 0.8; // Speed remains the same

    const prevPosition = projectileGroupRef.current.position.clone();

    // --- Basic Movement (Functionality unchanged) ---
    const moveDirection = new Vector3(
      Math.sin(rotation),
      0,
      Math.cos(rotation)
    );
    const moveDistance = delta * rocketVelocity;
    projectileGroupRef.current.position.addScaledVector(
      moveDirection,
      moveDistance
    );

    // --- Arc Calculation (Functionality unchanged) ---
    const currentPosXZ = new Vector3(
      projectileGroupRef.current.position.x,
      0,
      projectileGroupRef.current.position.z
    );
    const initialPosXZ = new Vector3(
      initialPositionRef.current.x,
      0,
      initialPositionRef.current.z
    );

    let progress = 0;
    if (targetPositionRef.current) {
      const targetPosXZ = new Vector3(
        targetPositionRef.current.x,
        0,
        targetPositionRef.current.z
      );
      const totalDistance = initialPosXZ.distanceTo(targetPosXZ);
      const distanceTraveledXZ = currentPosXZ.distanceTo(initialPosXZ);
      progress =
        totalDistance > 0.01
          ? Math.min(distanceTraveledXZ / totalDistance, 1.0)
          : 1.0; // Prevent division by zero
    } else {
      // Fallback if no target (e.g., target destroyed, or fired without lock)
      const estimatedFlightTime = 4; // Estimate time to reach max range if no target
      progress = Math.min(ageRef.current / estimatedFlightTime, 1);
    }

    const heightFactor = Math.sin(progress * Math.PI); // Parabolic arc
    const calculatedY = initialPositionRef.current.y + maxHeight * heightFactor;
    projectileGroupRef.current.position.y = Math.max(
      GROUND_Y_LEVEL + 0.01,
      calculatedY // Allow hitting ground near end of arc
    );

    // --- Rotation Adjustment (Functionality unchanged) ---
    if (visualGroupRef.current) {
      const velocity = projectileGroupRef.current.position
        .clone()
        .sub(prevPosition);
      if (velocity.lengthSq() > 0.0001) {
        // Avoid calculating angle for tiny movements
        const horizontalVelocity = new Vector3(
          velocity.x,
          0,
          velocity.z
        ).length();
        // Calculate pitch based on vertical vs horizontal speed
        const angle = Math.atan2(velocity.y, horizontalVelocity);
        // Apply pitch to the inner visual group
        visualGroupRef.current.rotation.x = -angle;
      }
    }
    // Keep Y rotation (yaw) on the outer group aligned with initial firing direction
    projectileGroupRef.current.rotation.y = rotation;

    // --- Flame flicker + exhaust trail ---
    if (flameRef.current) {
      const flicker = Math.random() * 0.35 + 0.85;
      flameRef.current.scale.set(flicker, flicker * (0.9 + Math.random() * 0.5), flicker);
    }
    trailTimerRef.current -= delta;
    if (trailTimerRef.current <= 0) {
      trailTimerRef.current = 0.025;
      const p = projectileGroupRef.current.position;
      fx.trail(p.x - Math.sin(rotation) * 0.4, p.y, p.z - Math.cos(rotation) * 0.4);
    }

    // --- Collision and Boundary Checks (Functionality unchanged) ---
    const currentPositionVec = projectileGroupRef.current.position;

    // 1. Ground Collision Check
    if (currentPositionVec.y <= GROUND_Y_LEVEL + 0.05) {
      // Slightly higher threshold
      const explosionPos = currentPositionVec.clone();
      explosionPos.y = GROUND_Y_LEVEL + 0.1; // Ensure explosion starts slightly above ground
      explode(explosionPos);
      return;
    }

    // 2. Map Boundaries
    const mapSize = 50;
    if (
      Math.abs(currentPositionVec.x) > mapSize ||
      Math.abs(currentPositionVec.z) > mapSize
    ) {
      debug.log(`Rocket ${id} hit map boundary.`);
      explode(currentPositionVec);
      return;
    }

    // 3. Max Range
    distanceTraveledRef.current = currentPositionVec.distanceTo(
      initialPositionRef.current
    );
    const maxRange = 60;
    if (distanceTraveledRef.current > maxRange) {
      debug.log(`Rocket ${id} exceeded max range.`);
      explode(currentPositionVec);
      return;
    }

    // 4. Terrain Obstacles
    for (const obstacle of terrainObstacles) {
      const obstaclePos = new Vector3(...obstacle.position);
      // Simple AABB check first for performance
      const size = obstacle.size || 1; // Default size if missing
      if (
        Math.abs(currentPositionVec.x - obstaclePos.x) < size &&
        Math.abs(currentPositionVec.z - obstaclePos.z) < size &&
        Math.abs(currentPositionVec.y - obstaclePos.y) < size * 1.5
      ) {
        // Check Y loosely
        // More accurate distance check if close
        const distanceToObstacle = obstaclePos.distanceTo(currentPositionVec);
        const collisionRadius =
          (obstacle.type === "rock" ? size * 0.8 : size * 0.5) + 0.15; // Add rocket radius

        if (distanceToObstacle < collisionRadius) {
          debug.log(`Rocket ${id} hit terrain obstacle.`);
          explode(currentPositionVec);
          return;
        }
      }
    }

    // 5. Enemy Collision (Direct Hit - triggers explosion)
    const enemies = getState().enemies;
    for (const enemy of enemies) {
      const enemyPos = new Vector3(...enemy.position);
      const collisionRadius = (enemy.type === "tank" ? 1.8 : 1.0) + 0.15; // Add rocket radius
      // Quick check on distance squared
      if (
        enemyPos.distanceToSquared(currentPositionVec) <
        collisionRadius * collisionRadius
      ) {
        debug.log(`Rocket ${id} directly hit enemy ${enemy.id}.`);
        // Explode slightly in front of the enemy center for visual effect
        const directionToEnemy = enemyPos
          .clone()
          .sub(currentPositionVec)
          .normalize();
        const explosionHitPos = currentPositionVec
          .clone()
          .addScaledVector(directionToEnemy, 0.1);
        explode(explosionHitPos);
        return;
      }
    }

    // 6. Proximity to Target (Commit to explosion near target)
    if (targetPositionRef.current && progress >= 0.98) {
      // Explode when very close to target destination
      debug.log(
        `Rocket ${id} reached target proximity (progress ${progress.toFixed(
          2
        )})`
      );
      // Use the stored target position for the explosion center
      const explosionPos = targetPositionRef.current.clone();
      // Ensure explosion happens at current height or slightly above ground, whichever is higher
      explosionPos.y = Math.max(GROUND_Y_LEVEL + 0.1, currentPositionVec.y);
      explode(explosionPos);
      return;
    }
  });

  return (
    <group
      ref={projectileGroupRef}
      position={position}
      rotation={[0, rotation, 0]} // Yaw handled by the outer group
    >
      {/* Inner group handles pitch */}
      <group ref={visualGroupRef}>
        <mesh position={[0, 0, 0.36]} rotation={[Math.PI / 2, 0, 0]} material={ROCKET_MATS.nose} castShadow>
          <coneGeometry args={[0.085, 0.22, 12]} />
        </mesh>
        <mesh position={[0, 0, 0.0]} rotation={[Math.PI / 2, 0, 0]} material={ROCKET_MATS.body} castShadow>
          <cylinderGeometry args={[0.085, 0.085, 0.5, 12]} />
        </mesh>
        <mesh position={[0, 0, 0.17]} rotation={[Math.PI / 2, 0, 0]} material={ROCKET_MATS.band}>
          <cylinderGeometry args={[0.088, 0.088, 0.06, 12]} />
        </mesh>
        <mesh position={[0, 0, -0.29]} rotation={[Math.PI / 2, 0, 0]} material={ROCKET_MATS.dark}>
          <cylinderGeometry args={[0.07, 0.06, 0.08, 12]} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh
            key={i}
            position={[Math.cos((i * Math.PI) / 2) * 0.11, Math.sin((i * Math.PI) / 2) * 0.11, -0.18]}
            rotation={[0, 0, (i * Math.PI) / 2]}
            material={ROCKET_MATS.band}>
            <boxGeometry args={[0.1, 0.015, 0.16]} />
          </mesh>
        ))}
        {/* Exhaust plume + glow (no point light: those trigger material recompiles) */}
        <mesh ref={flameRef} position={[0, 0, -0.5]} rotation={[-Math.PI / 2, 0, 0]} material={ROCKET_MATS.flame}>
          <coneGeometry args={[0.065, 0.38, 10, 1, true]} />
        </mesh>
        <GlowSprite color="#ff9a3a" size={0.9} opacity={0.8} position={[0, 0, -0.38]} />
      </group>
    </group>
  );
};

export default RocketProjectile;
