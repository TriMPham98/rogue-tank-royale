import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Box, Cylinder, Sphere } from "@react-three/drei";
import { Vector3, Group, Quaternion, MeshStandardMaterial } from "three";
import { Enemy, useGameState } from "../utils/gameState";
import Projectile from "./Projectile";
import { debug } from "../utils/debug";
import { GAME_CONSTANTS } from "../constants/game";
import { useTankCollision } from "../hooks/useTankCollision";
import { useProjectileManager } from "../hooks/useProjectileManager";

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

  const isBomber = enemy.type === "bomber";
  const tankRadius = isBomber ? GAME_CONSTANTS.BOMBER_RADIUS : GAME_CONSTANTS.TANK_RADIUS;

  // Use shared hooks for collision detection and projectile management
  const { checkTerrainCollision } = useTankCollision({
    tankRadius,
    enemyId: enemy.id,
  });
  const {
    projectiles,
    spawnProjectile,
    removeProjectile,
    canShoot,
    recordShot,
  } = useProjectileManager();

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

  const [healthPercent, setHealthPercent] = useState(1);

  const damageEnemy = useGameState((state) => state.damageEnemy);
  const updateEnemyPosition = useGameState(
    (state) => state.updateEnemyPosition
  );
  const isPaused = useGameState((state) => state.isPaused);
  const isGameOver = useGameState((state) => state.isGameOver);
  const getState = useRef(useGameState.getState).current;

  const maxHealthRef = useRef(enemy.health);

  const isTank = enemy.type === "tank";
  const moveSpeed = enemy.speed || (isBomber ? GAME_CONSTANTS.ENEMY_BOMBER_BASE_SPEED : GAME_CONSTANTS.ENEMY_TANK_BASE_SPEED);

  useEffect(() => {
    maxHealthRef.current = enemy.health;
  }, []);

  useFrame((state, delta) => {
    if (isPaused || isGameOver || !tankRef.current) return;

    if (!isBomber && !turretRef.current) return;

    const playerTankPosition = getState().playerTankPosition;
    if (!playerTankPosition) return;

    // --- Health Update ---
    const enemies = getState().enemies;
    const currentEnemy = enemies.find((e) => e.id === enemy.id);
    if (currentEnemy) {
      const newHealthPercent = currentEnemy.health / maxHealthRef.current;
      if (newHealthPercent !== healthPercent) {
        setHealthPercent(newHealthPercent);
      }
    } else {
      return;
    }

    const currentPositionVec = tankRef.current.position;
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

        spawnProjectile(shootPosition, projectileRotation);
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

          if (isBomber) {
            tankRef.current.position.y =
              0.2 + Math.sin(state.clock.getElapsedTime() * 4) * 0.1;
          }

          if (Math.random() < 0.1) {
            const newPosition: [number, number, number] = [
              tankRef.current.position.x,
              tankRef.current.position.y,
              tankRef.current.position.z,
            ];
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

  const handleHit = useCallback(
    (damage: number) => {
      damageEnemy(enemy.id, damage);
    },
    [damageEnemy, enemy.id]
  );

  const bomberBaseRadius = 1.2;
  const bomberBaseBottomRadius = 1.4;
  const bomberBaseHeight = 0.3;
  const bomberCockpitSize = 0.8;
  const bomberThrusterRadius = 0.3;
  const bomberThrusterHeight = 0.6;

  return (
    <>
      <group
        ref={tankRef}
        position={initialPosition}
        name={`enemy-${enemy.id}-${enemy.type}`}>
        {isBomber ? (
          <>
            <Cylinder
              args={[
                bomberBaseRadius,
                bomberBaseBottomRadius,
                bomberBaseHeight,
                8,
              ]}
              position={[0, bomberBaseHeight / 2, 0]}
              castShadow
              receiveShadow
              onClick={() => handleHit(25)}>
              <meshStandardMaterial
                color="#4A4A4A"
                roughness={0.5}
                metalness={0.7}
              />
            </Cylinder>
            <Box
              args={[
                bomberCockpitSize,
                bomberCockpitSize * 0.5,
                bomberCockpitSize,
              ]}
              position={[0, bomberBaseHeight + bomberCockpitSize * 0.25, 0]}
              rotation={[0, Math.PI / 4, 0]}
              castShadow
              onClick={() => handleHit(25)}>
              <meshStandardMaterial
                color="#FFD700"
                roughness={0.3}
                metalness={0.5}
              />
            </Box>
            <Cylinder
              args={[
                bomberThrusterRadius,
                bomberThrusterRadius,
                bomberThrusterHeight,
                6,
              ]}
              position={[
                0,
                bomberBaseHeight / 2 + 0.1,
                -bomberBaseRadius * 0.8,
              ]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow
              onClick={() => handleHit(25)}>
              <meshStandardMaterial
                color="darkgray"
                roughness={0.4}
                metalness={0.6}
              />
            </Cylinder>
            <Box
              args={[0.2, 0.4, bomberBaseRadius * 0.8]}
              position={[bomberBaseRadius * 0.8, bomberBaseHeight / 2 + 0.2, 0]}
              rotation={[0, 0, Math.PI / 6]}
              castShadow
              onClick={() => handleHit(25)}>
              <meshStandardMaterial
                color="#4A4A4A"
                roughness={0.5}
                metalness={0.7}
              />
            </Box>
            <Box
              args={[0.2, 0.4, bomberBaseRadius * 0.8]}
              position={[
                -bomberBaseRadius * 0.8,
                bomberBaseHeight / 2 + 0.2,
                0,
              ]}
              rotation={[0, 0, -Math.PI / 6]}
              castShadow
              onClick={() => handleHit(25)}>
              <meshStandardMaterial
                color="#4A4A4A"
                roughness={0.5}
                metalness={0.7}
              />
            </Box>
            <Sphere
              args={[bomberBaseRadius * 1.1, 24, 24]}
              position={[0, bomberBaseHeight / 2, 0]}
              renderOrder={1}>
              <meshStandardMaterial
                ref={flashMaterialRef}
                color="red"
                emissive="red"
                emissiveIntensity={0}
                transparent={true}
                opacity={0}
                depthWrite={false}
              />
            </Sphere>
          </>
        ) : (
          <>
            <Box
              args={isTank ? [1.5, 0.5, 2] : [1.8, 0.7, 1.8]}
              castShadow
              receiveShadow
              onClick={() => handleHit(25)}>
              <meshStandardMaterial color={isTank ? "red" : "darkblue"} />
            </Box>
            <group position={[0, isTank ? 0.25 : 0.35, 0]} ref={turretRef}>
              {/* Turret Connecting Cylinder */}
              <Cylinder
                args={isTank ? [0.5, 0.5, 0.15, 16] : [0.6, 0.6, 0.2, 16]}
                position={[0, isTank ? 0.075 : 0.1, 0]}
                castShadow
                onClick={() => handleHit(25)}>
                <meshStandardMaterial
                  color={isTank ? "darkred" : "royalblue"}
                />
              </Cylinder>
              <Cylinder
                args={isTank ? [0.6, 0.7, 0.4, 16] : [0.7, 0.8, 0.5, 16]}
                position={[0, 0.2, 0]}
                castShadow
                onClick={() => handleHit(25)}>
                <meshStandardMaterial
                  color={isTank ? "darkred" : "royalblue"}
                />
              </Cylinder>
              <Cylinder
                args={[0.3, 0.3, 0.1, 16]}
                position={[0, 0.45, -0.2]}
                castShadow
                onClick={() => handleHit(25)}>
                <meshStandardMaterial
                  color={isTank ? "darkred" : "royalblue"}
                />
              </Cylinder>
              <Cylinder
                args={isTank ? [0.1, 0.1, 1.5, 16] : [0.12, 0.12, 2, 16]}
                position={[0, 0.2, isTank ? 1 : 1.2]}
                rotation={[Math.PI / 2, 0, 0]}
                castShadow
                onClick={() => handleHit(25)}>
                <meshStandardMaterial color={isTank ? "darkgray" : "navy"} />
              </Cylinder>
              <Cylinder
                args={isTank ? [0.15, 0.15, 0.2, 16] : [0.18, 0.18, 0.25, 16]}
                position={[0, 0.2, isTank ? 1.85 : 2.35]}
                rotation={[Math.PI / 2, 0, 0]}
                castShadow
                onClick={() => handleHit(25)}>
                <meshStandardMaterial color={isTank ? "black" : "darkgray"} />
              </Cylinder>
              <Cylinder
                args={[0.02, 0.02, 1, 8]}
                position={[0.3, 0.65, -0.3]}
                rotation={[0, 0, 0]}
                castShadow
                onClick={() => handleHit(25)}>
                <meshStandardMaterial color="gray" />
              </Cylinder>
              <Box
                args={[0.2, 0.3, 0.8]}
                position={[isTank ? 0.55 : 0.65, 0.2, 0]}
                castShadow
                onClick={() => handleHit(25)}>
                <meshStandardMaterial
                  color={isTank ? "darkred" : "royalblue"}
                />
              </Box>
              <Box
                args={[0.2, 0.3, 0.8]}
                position={[isTank ? -0.55 : -0.65, 0.2, 0]}
                castShadow
                onClick={() => handleHit(25)}>
                <meshStandardMaterial
                  color={isTank ? "darkred" : "royalblue"}
                />
              </Box>
              <Box
                args={[0.2, 0.1, 0.1]}
                position={[0, isTank ? 0.4 : 0.41, isTank ? 0.4 : 0.5]} // Increased y-position for blue turret to fix z-flickering
                castShadow
                onClick={() => handleHit(25)}>
                <meshStandardMaterial color="black" />
              </Box>
            </group>
            {isTank ? (
              <>
                <Box
                  args={[0.3, 0.2, 2.2]}
                  position={[-0.7, -0.3, 0]}
                  castShadow
                  receiveShadow
                  onClick={() => handleHit(25)}>
                  <meshStandardMaterial color="black" />
                </Box>
                <Box
                  args={[0.3, 0.2, 2.2]}
                  position={[0.7, -0.3, 0]}
                  castShadow
                  receiveShadow
                  onClick={() => handleHit(25)}>
                  <meshStandardMaterial color="black" />
                </Box>
              </>
            ) : (
              <Box
                args={[1.8, 0.3, 1.8]}
                position={[0, -0.15, 0]}
                castShadow
                receiveShadow
                onClick={() => handleHit(25)}>
                <meshStandardMaterial color="navy" />
              </Box>
            )}
          </>
        )}

        {/* Health Bar */}
        <Box
          args={[1, 0.1, 0.1]}
          position={[
            0,
            isBomber
              ? bomberBaseHeight + bomberCockpitSize * 0.5 + 0.2
              : isTank
              ? 1.2
              : 1.5,
            0,
          ]}
          renderOrder={1}>
          <meshBasicMaterial color="red" transparent depthTest={false} />
        </Box>
        <Box
          args={[healthPercent, 0.1, 0.1]}
          position={[
            -(1 - healthPercent) / 2,
            isBomber
              ? bomberBaseHeight + bomberCockpitSize * 0.5 + 0.2
              : isTank
              ? 1.2
              : 1.5,
            0.001,
          ]}
          renderOrder={2}>
          <meshBasicMaterial color="lime" transparent depthTest={false} />
        </Box>
      </group>

      {/* Enemy Projectiles */}
      {projectiles.map((projectile) => {
        const playerLevel = getState().playerLevel;
        let damage = 5; // Default damage for early game
        if (playerLevel > 15) {
          damage = 10;
        }
        if (playerLevel > 25) {
          damage = 15;
        }
        if (playerLevel > 40) {
          damage = 20;
        }
        if (playerLevel > 50) {
          damage = 25;
        }
        if (playerLevel > 60) {
          damage = 30; // End game damage
        }
        return (
          <Projectile
            key={projectile.id}
            id={projectile.id}
            position={projectile.position}
            rotation={projectile.rotation}
            damage={damage}
            onRemove={removeProjectile}
            isEnemy={true}
          />
        );
      })}
    </>
  );
};

export default EnemyTank;
