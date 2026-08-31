import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3, Group, Quaternion, MeshStandardMaterial } from "three";
import EnemyCombatMesh from "./tankVisuals/EnemyCombatMesh";
import BomberMesh from "./tankVisuals/BomberMesh";
import { Enemy, useGameState } from "../utils/gameState";
import { debug } from "../utils/debug";
import { GAME_CONSTANTS } from "../constants/game";
import { useTankCollision } from "../hooks/useTankCollision";
import { usePooledProjectiles } from "../hooks/usePooledProjectiles";
import {
  setEnemyVisualPosition,
  clearEnemyVisualPosition,
} from "../utils/enemyVisualPositions";

interface EnemyTankProps {
  enemy: Enemy;
}

const EnemyTank = ({ enemy }: EnemyTankProps) => {
  const initialPosition = useRef(new Vector3(...enemy.position)).current;
  const tankRef = useRef<Group>(null);
  const turretRef = useRef<Group>(null);
  const flashMaterialRef = useRef<MeshStandardMaterial>(null);

  const tankRotationRef = useRef(0);
  const turretRotationRef = useRef(0);
  const trackSpinRef = useRef(0);

  const isBomber = enemy.type === "bomber";
  const tankRadius = isBomber ? GAME_CONSTANTS.BOMBER_RADIUS : GAME_CONSTANTS.TANK_RADIUS;

  // Use shared hooks for collision detection and projectile management
  const { checkTerrainCollision } = useTankCollision({
    tankRadius,
    enemyId: enemy.id,
  });
  const { spawnProjectile, canShoot, recordShot } = usePooledProjectiles({
    isEnemy: true,
    defaultDamage: 5,
    defaultVelocity: 12,
  });

  // Memoized Vector3 objects to avoid creating new ones every frame
  const tempVectors = useMemo(() => ({
    playerPos: new Vector3(),
    directionToPlayer: new Vector3(),
    tankPos: new Vector3(),
    obstaclePos: new Vector3(),
    vectorToTank: new Vector3(),
    attractiveForce: new Vector3(),
    sumRepulsive: new Vector3(),
    netForce: new Vector3(),
    targetDirection: new Vector3(),
    moveDirection: new Vector3(),
    barrelEndLocal: new Vector3(),
    barrelEndWorld: new Vector3(),
    shootDirection: new Vector3(),
  }), []);
  const tempQuat = useMemo(() => new Quaternion(), []);

  const damageEnemy = useGameState((state) => state.damageEnemy);
  const updateEnemyPosition = useGameState(
    (state) => state.updateEnemyPosition
  );
  const isPaused = useGameState((state) => state.isPaused);
  const isGameOver = useGameState((state) => state.isGameOver);
  const getState = useRef(useGameState.getState).current;

  const isTank = enemy.type === "tank";
  const moveSpeed = enemy.speed || (isBomber ? GAME_CONSTANTS.ENEMY_BOMBER_BASE_SPEED : GAME_CONSTANTS.ENEMY_TANK_BASE_SPEED);

  useEffect(() => {
    return () => {
      clearEnemyVisualPosition(enemy.id);
    };
  }, [enemy.id]);

  useFrame((state, delta) => {
    if (isPaused || isGameOver || !tankRef.current) return;

    if (!isBomber && !turretRef.current) return;

    const playerTankPosition = getState().playerTankPosition;
    if (!playerTankPosition) return;

    // --- Alive check ---
    const enemies = getState().enemies;
    const currentEnemy = enemies.find((e) => e.id === enemy.id);
    if (!currentEnemy) {
      return;
    }

    const currentPositionVec = tankRef.current.position;
    // Keep health-bar positions accurate even when not moving / throttled in store
    setEnemyVisualPosition(enemy.id, [
      currentPositionVec.x,
      currentPositionVec.y,
      currentPositionVec.z,
    ]);
    tempVectors.playerPos.set(playerTankPosition[0], playerTankPosition[1], playerTankPosition[2]);

    tempVectors.directionToPlayer
      .copy(tempVectors.playerPos)
      .sub(currentPositionVec)
      .setY(0)
      .normalize();

    const distanceToPlayer = currentPositionVec.distanceTo(tempVectors.playerPos);

    // --- Turret Rotation (Non-Bombers) ---
    if (!isBomber && turretRef.current) {
      const targetTurretRotation = Math.atan2(
        tempVectors.directionToPlayer.x,
        tempVectors.directionToPlayer.z
      );
      const relativeRotation = targetTurretRotation - tankRotationRef.current;
      const turretRotationDiff = relativeRotation - turretRotationRef.current;
      const wrappedTurretDiff =
        ((turretRotationDiff + Math.PI) % (Math.PI * 2)) - Math.PI;
      turretRotationRef.current += wrappedTurretDiff * delta * 3;
      turretRef.current.rotation.y = turretRotationRef.current;
    }

    // --- Shooting (Non-Bombers) ---
    if (!isBomber && turretRef.current) {
      const shootingRange = isTank ? GAME_CONSTANTS.ENEMY_TANK_SHOOTING_RANGE : GAME_CONSTANTS.ENEMY_TURRET_SHOOTING_RANGE;
      const fireRate = isTank ? GAME_CONSTANTS.ENEMY_TANK_FIRE_RATE : GAME_CONSTANTS.ENEMY_TURRET_FIRE_RATE;
      const currentTime = state.clock.getElapsedTime();

      if (distanceToPlayer < shootingRange && canShoot(currentTime, fireRate)) {
        const barrelEndLocalZ = isTank ? 1.75 : 2.2;
        tempVectors.barrelEndLocal.set(0, 0.2, barrelEndLocalZ);
        tempVectors.barrelEndWorld.copy(tempVectors.barrelEndLocal);
        turretRef.current.localToWorld(tempVectors.barrelEndWorld);

        const shootPosition: [number, number, number] = [
          tempVectors.barrelEndWorld.x,
          tempVectors.barrelEndWorld.y,
          tempVectors.barrelEndWorld.z,
        ];

        turretRef.current.getWorldQuaternion(tempQuat);
        tempVectors.shootDirection.set(0, 0, 1).applyQuaternion(tempQuat);
        const projectileRotation = Math.atan2(
          tempVectors.shootDirection.x,
          tempVectors.shootDirection.z
        );

        // Scale damage with player progression (matches prior EnemyTank tiers)
        const playerLevel = getState().playerLevel;
        let damage = 5;
        if (playerLevel > 15) damage = 10;
        if (playerLevel > 25) damage = 15;
        if (playerLevel > 40) damage = 20;
        if (playerLevel > 50) damage = 25;
        if (playerLevel > 60) damage = 30;

        spawnProjectile(shootPosition, projectileRotation, damage, 12);
        recordShot(currentTime);
        debug.log(`Enemy ${enemy.id} (${enemy.type}) fired at player`);
      }
    }

    // --- Movement and Body Rotation (Tank & Bomber) ---
    if (isTank || isBomber) {
      const turnRate = isBomber ? GAME_CONSTANTS.ENEMY_BOMBER_TURN_RATE : GAME_CONSTANTS.ENEMY_TANK_TURN_RATE;

      // Potential Field Parameters
      const max_distance = 5;
      const attraction_strength = 1.0;
      const epsilon = 0.1;

      // Compute attractive force towards player
      tempVectors.attractiveForce
        .copy(tempVectors.directionToPlayer)
        .multiplyScalar(attraction_strength);

      // Compute sum of repulsive forces from obstacles
      tempVectors.sumRepulsive.set(0, 0, 0);
      const terrainObstacles = getState().terrainObstacles;

      // Add repulsion from terrain obstacles
      for (const obstacle of terrainObstacles) {
        tempVectors.obstaclePos.set(
          obstacle.position[0],
          0,
          obstacle.position[2]
        );
        tempVectors.vectorToTank.copy(currentPositionVec).sub(tempVectors.obstaclePos);
        const distance = tempVectors.vectorToTank.length();
        const obstacleRadius = obstacle.size * GAME_CONSTANTS.OBSTACLE_RADIUS_MULTIPLIER;
        const effectiveDistance = distance - (tankRadius + obstacleRadius);
        if (effectiveDistance < max_distance) {
          const repulsiveMagnitude = 1 / (effectiveDistance + epsilon);
          tempVectors.vectorToTank.normalize().multiplyScalar(repulsiveMagnitude);
          tempVectors.sumRepulsive.add(tempVectors.vectorToTank);
        }
      }

      // Add repulsion from blue turrets (enemy type "turret")
      for (const otherEnemy of enemies) {
        // Skip applying repulsion from self
        if (otherEnemy.id === enemy.id) continue;

        // Only consider turrets as obstacles
        if (otherEnemy.type === "turret") {
          tempVectors.obstaclePos.set(
            otherEnemy.position[0],
            0,
            otherEnemy.position[2]
          );
          tempVectors.vectorToTank.copy(currentPositionVec).sub(tempVectors.obstaclePos);
          const distance = tempVectors.vectorToTank.length();
          const turretRadius = GAME_CONSTANTS.TURRET_COLLISION_RADIUS;
          const effectiveDistance = distance - (tankRadius + turretRadius);

          // Apply a stronger repulsion from turrets than from rocks
          if (effectiveDistance < max_distance) {
            // Use a stronger magnitude for turrets
            const repulsiveMagnitude = 1.5 / (effectiveDistance + epsilon);
            tempVectors.vectorToTank.normalize().multiplyScalar(repulsiveMagnitude);
            tempVectors.sumRepulsive.add(tempVectors.vectorToTank);
          }
        }
      }

      // Compute net force
      tempVectors.netForce.copy(tempVectors.attractiveForce).add(tempVectors.sumRepulsive);

      // Determine target direction
      tempVectors.targetDirection.copy(
        tempVectors.netForce.length() > 0 ? tempVectors.netForce.normalize() : tempVectors.directionToPlayer
      );

      // Set target rotation
      const targetRotation = Math.atan2(tempVectors.targetDirection.x, tempVectors.targetDirection.z);

      // Smoothly turn towards target rotation
      const rotationDiff = targetRotation - tankRotationRef.current;
      const wrappedDiff = ((rotationDiff + Math.PI) % (Math.PI * 2)) - Math.PI;
      tankRotationRef.current += wrappedDiff * delta * turnRate;
      tankRef.current.rotation.y = tankRotationRef.current;

      // Determine if the tank should move
      let shouldMove = false;
      if (isBomber) {
        shouldMove = true;
      } else if (isTank) {
        shouldMove = distanceToPlayer > 8;
      }

      if (shouldMove) {
        tempVectors.moveDirection.set(
          Math.sin(tankRotationRef.current),
          0,
          Math.cos(tankRotationRef.current)
        );
        const potentialX =
          currentPositionVec.x + tempVectors.moveDirection.x * delta * moveSpeed;
        const potentialZ =
          currentPositionVec.z + tempVectors.moveDirection.z * delta * moveSpeed;

        if (!checkTerrainCollision(potentialX, potentialZ)) {
          tankRef.current.position.x = potentialX;
          tankRef.current.position.z = potentialZ;
          trackSpinRef.current += moveSpeed * delta * 2.4;

          if (isBomber) {
            tankRef.current.position.y =
              0.2 + Math.sin(state.clock.getElapsedTime() * 4) * 0.1;
          }

          const newPosition: [number, number, number] = [
            tankRef.current.position.x,
            tankRef.current.position.y,
            tankRef.current.position.z,
          ];
          // Always track visual position for instanced health bars
          setEnemyVisualPosition(enemy.id, newPosition);
          // Throttle Zustand writes to avoid re-rendering the full enemy list every frame
          if (Math.random() < 0.1) {
            updateEnemyPosition(enemy.id, newPosition);
          }
        }
      }

      if (isBomber && distanceToPlayer < GAME_CONSTANTS.BOMBER_EXPLOSION_RANGE) {
        debug.log(`Bomber ${enemy.id} exploded on player!`);
        const takeDamage = getState().takeDamage;
        takeDamage(GAME_CONSTANTS.BOMBER_EXPLOSION_DAMAGE);
        damageEnemy(enemy.id, 1000);
      }
    }

    // --- Bomber Flashing Animation ---
    if (isBomber && flashMaterialRef.current) {
      const maxFlashDistance = 15;
      const minFlashDistance = 2;
      const baseFreq = 0.5;
      const freqMultiplier = 1;

      const proximity = Math.max(
        0,
        Math.min(
          1,
          1 -
            (distanceToPlayer - minFlashDistance) /
              (maxFlashDistance - minFlashDistance)
        )
      );

      if (distanceToPlayer < maxFlashDistance) {
        const currentFreq = baseFreq + proximity * freqMultiplier;
        const sineValue = Math.sin(
          state.clock.elapsedTime * Math.PI * 2 * currentFreq
        );
        const flashFactor = (sineValue + 1) / 2;

        const minOpacity = 0.05;
        const maxOpacity = 0.3;
        const minIntensity = 0.1;
        const maxIntensity = 0.4;

        flashMaterialRef.current.opacity =
          minOpacity + flashFactor * (maxOpacity - minOpacity);
        flashMaterialRef.current.emissiveIntensity =
          minIntensity + flashFactor * (maxIntensity - minIntensity);
        flashMaterialRef.current.needsUpdate = true;
      } else {
        flashMaterialRef.current.opacity = 0.0;
        flashMaterialRef.current.emissiveIntensity = 0;
        flashMaterialRef.current.needsUpdate = true;
      }
    }
  });

  return (
    <>
      <group
        ref={tankRef}
        position={initialPosition}
        name={`enemy-${enemy.id}-${enemy.type}`}>
        {isBomber ? (
          <BomberMesh flashMaterialRef={flashMaterialRef} />
        ) : (
          <EnemyCombatMesh
            variant={isTank ? "tank" : "turret"}
            turretRef={turretRef}
            trackSpinRef={trackSpinRef}
          />
        )}

      </group>
    </>
  );
};

export default EnemyTank;
