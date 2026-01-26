import React, { useRef, useState, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Box, Cylinder, Sphere } from "@react-three/drei";
import { Group, Vector3, Quaternion, Euler } from "three";
import { useKeyboardControls } from "../hooks/useKeyboardControls";
import { useGameState, SecondaryWeapon } from "../utils/gameState";
import { debug } from "../utils/debug";
import { useSound, resetSoundTimer } from "../utils/sound";
import Projectile from "./Projectile";
import SniperRifle from "./SniperRifle";
import Shotgun from "./Shotgun";
import LaserWeapon from "./LaserWeapon";
import RocketLauncher from "./RocketLauncher";
import TeslaCoil from "./TeslaCoil";
import { WeaponInstance } from "../utils/weapons";
import { GAME_CONSTANTS } from "../constants/game";
import { useTankCollision } from "../hooks/useTankCollision";
import { useProjectileManager } from "../hooks/useProjectileManager";

interface TankProps {
  position: [number, number, number];
  isFirstPerson?: boolean;
}

const SIDE_WEAPON_DISTANCE = GAME_CONSTANTS.SIDE_WEAPON_DISTANCE;
const SIDE_WEAPON_Y_OFFSET = GAME_CONSTANTS.SIDE_WEAPON_Y_OFFSET;
const MAX_SIDE_WEAPONS = GAME_CONSTANTS.MAX_SIDE_WEAPONS;

type WeaponComponentType = React.ComponentType<{
  weaponInstance: WeaponInstance;
  position: [number, number, number];
  rotation: number;
}>;

const WeaponComponents: Record<string, WeaponComponentType> = {
  sniper: SniperRifle,
  shotgun: Shotgun,
  laser: LaserWeapon,
  rocket: RocketLauncher,
  tesla: TeslaCoil,
};

const Tank = ({ position = [0, 0, 0], isFirstPerson = false }: TankProps) => {
  const tankRef = useRef<Group>(null);
  const turretRef = useRef<Group>(null);
  const [isBraking, setIsBraking] = useState(false);

  const tankRotationRef = useRef(Math.PI);
  const turretRotationRef = useRef(0);
  const positionRef = useRef<[number, number, number]>([...position]);
  const isInitializedRef = useRef(false);
  const _quat = useRef(new Quaternion()).current;
  const _euler = useRef(new Euler()).current;
  const prevPovToggleRef = useRef(false);

  // Use shared hooks for collision detection and projectile management
  const { checkTerrainCollision } = useTankCollision({
    tankRadius: GAME_CONSTANTS.TANK_RADIUS,
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
    targetQuat: new Quaternion(),
  }), []);

  const {
    forward: keyForward,
    backward: keyBackward,
    left: keyLeft,
    right: keyRight,
    turretLeft: keyTurretLeft,
    turretRight: keyTurretRight,
    shoot: keyShoot,
    povToggle,
  } = useKeyboardControls();

  const {
    moveX,
    moveZ,
    turretRotation: touchTurretRotation,
    isFiring: touchIsFiring,
    playerTurretDamage,
    playerSpeed,
    playerFireRate,
    playerHealthRegen,
    playerPenetration,
    isPaused,
    isGameOver,
    updatePlayerPosition,
    updatePlayerTurretRotation,
    healPlayer,
    selectedWeapons,
  } = useGameState();

  const sound = useSound();

  const sideWeapons = selectedWeapons.slice(0, MAX_SIDE_WEAPONS);

  useEffect(() => {
    if (playerHealthRegen <= 0) return;
    const interval = setInterval(() => {
      if (!isPaused && !isGameOver) {
        healPlayer(playerHealthRegen);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [playerHealthRegen, healPlayer, isPaused, isGameOver]);

  // Memoized up vector for rotation
  const upVector = useMemo(() => new Vector3(0, 1, 0), []);

  useEffect(() => {
    if (tankRef.current && !isInitializedRef.current) {
      isInitializedRef.current = true;
      tankRef.current.position.fromArray(position);
      tankRef.current.quaternion.setFromAxisAngle(
        upVector,
        tankRotationRef.current
      );
      const initialPos: [number, number, number] = [
        tankRef.current.position.x,
        tankRef.current.position.y,
        tankRef.current.position.z,
      ];
      positionRef.current = initialPos;
      updatePlayerPosition(initialPos);
      debug.log("Tank initialized at position:", initialPos);
    }
    return () => {
      debug.log("Tank component cleanup - preserve position state");
    };
  }, [position, updatePlayerPosition]);

  useEffect(() => {
    resetSoundTimer("playerCannon");
  }, [playerFireRate]);

  useFrame((state, delta) => {
    if (!tankRef.current || isPaused || isGameOver) return;

    let moved = false;
    const moveSpeed = playerSpeed;
    const turnSpeed = isFirstPerson ? 1.0 : 4.0;
    const turretTurnSpeed = isFirstPerson ? 1.0 : 4.0;

    const currentQuat = tankRef.current.quaternion;

    if (keyLeft) {
      _quat.setFromAxisAngle(upVector, delta * turnSpeed);
      currentQuat.multiply(_quat);
    } else if (keyRight) {
      _quat.setFromAxisAngle(upVector, -delta * turnSpeed);
      currentQuat.multiply(_quat);
    } else if ((moveX !== 0 || moveZ !== 0) && !keyForward && !keyBackward) {
      const targetAngleY = Math.atan2(moveX, moveZ);
      tempVectors.targetQuat.setFromAxisAngle(upVector, targetAngleY);

      const slerpFactor = 1.0 - Math.exp(-turnSpeed * delta * 1.25);
      currentQuat.slerp(tempVectors.targetQuat, slerpFactor);
    }

    _euler.setFromQuaternion(currentQuat, "YXZ");
    tankRotationRef.current = _euler.y;

    let potentialX = tankRef.current.position.x;
    let potentialZ = tankRef.current.position.z;
    let intendedMovementMagnitude = 0;

    if (keyForward || keyBackward) {
      intendedMovementMagnitude = keyForward ? 1 : -1;
      potentialX +=
        Math.sin(tankRotationRef.current) *
        delta *
        moveSpeed *
        intendedMovementMagnitude;
      potentialZ +=
        Math.cos(tankRotationRef.current) *
        delta *
        moveSpeed *
        intendedMovementMagnitude;
    } else if (moveX !== 0 || moveZ !== 0) {
      intendedMovementMagnitude = Math.min(
        1,
        Math.sqrt(moveX * moveX + moveZ * moveZ)
      );
      potentialX +=
        Math.sin(tankRotationRef.current) *
        delta *
        moveSpeed *
        intendedMovementMagnitude;
      potentialZ +=
        Math.cos(tankRotationRef.current) *
        delta *
        moveSpeed *
        intendedMovementMagnitude;
    }

    if (
      intendedMovementMagnitude !== 0 &&
      !checkTerrainCollision(potentialX, potentialZ)
    ) {
      tankRef.current.position.x = potentialX;
      tankRef.current.position.z = potentialZ;
      moved = true;
    } else {
      moved = false;
    }

    setIsBraking(
      keyBackward || (!moved && (keyForward || moveX !== 0 || moveZ !== 0))
    );

    if (turretRef.current) {
      if (keyTurretLeft) turretRotationRef.current += delta * turretTurnSpeed;
      if (keyTurretRight) turretRotationRef.current -= delta * turretTurnSpeed;

      if (touchTurretRotation !== null) {
        const targetAbsoluteAngle = touchTurretRotation;
        const currentTankAngle = tankRotationRef.current;

        let desiredRelativeAngle = targetAbsoluteAngle - currentTankAngle;

        while (desiredRelativeAngle < 0) desiredRelativeAngle += Math.PI * 2;
        while (desiredRelativeAngle >= Math.PI * 2)
          desiredRelativeAngle -= Math.PI * 2;

        const turretLerpFactor = isFirstPerson
          ? 1.0 - Math.exp(-turnSpeed * delta * 1.5)
          : 1.0 - Math.exp(-turnSpeed * delta * 5.0);

        let angleDifference = desiredRelativeAngle - turretRotationRef.current;

        if (angleDifference > Math.PI) angleDifference -= Math.PI * 2;
        if (angleDifference < -Math.PI) angleDifference += Math.PI * 2;

        turretRotationRef.current += angleDifference * turretLerpFactor;

        while (turretRotationRef.current < 0)
          turretRotationRef.current += Math.PI * 2;
        while (turretRotationRef.current >= Math.PI * 2)
          turretRotationRef.current -= Math.PI * 2;
      } else if (keyTurretLeft || keyTurretRight) {
        while (turretRotationRef.current < 0)
          turretRotationRef.current += Math.PI * 2;
        while (turretRotationRef.current >= Math.PI * 2)
          turretRotationRef.current -= Math.PI * 2;
      }

      turretRef.current.rotation.y = turretRotationRef.current;

      // Update the absolute turret rotation in game state for minimap
      let absoluteTurretAngle =
        (tankRotationRef.current + turretRotationRef.current) % (Math.PI * 2);
      while (absoluteTurretAngle < 0) absoluteTurretAngle += Math.PI * 2;
      updatePlayerTurretRotation(absoluteTurretAngle);

      if (
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
      ) {
        // Debug logging kept for development
      }
    }

    const currentTime = state.clock.getElapsedTime();
    const isShootingRequested = keyShoot || touchIsFiring;

    if (canShoot(currentTime, playerFireRate)) {
      const shootPosition: [number, number, number] = [
        tankRef.current.position.x +
          Math.sin(tankRotationRef.current + turretRotationRef.current) * 2.15,
        tankRef.current.position.y + 0.75,
        tankRef.current.position.z +
          Math.cos(tankRotationRef.current + turretRotationRef.current) * 2.15,
      ];
      spawnProjectile(
        shootPosition,
        tankRotationRef.current + turretRotationRef.current
      );
      recordShot(currentTime);

      sound.setVolume("playerCannon", 0.22);
      sound.play("playerCannon");
    }

    if (isShootingRequested) {
      debug.log(`Shoot button pressed (main turret auto-fires)`);
    }

    if (moved) {
      const newPosition: [number, number, number] = [
        tankRef.current.position.x,
        tankRef.current.position.y,
        tankRef.current.position.z,
      ];
      if (
        Math.abs(positionRef.current[0] - newPosition[0]) > 0.01 ||
        Math.abs(positionRef.current[1] - newPosition[1]) > 0.01 ||
        Math.abs(positionRef.current[2] - newPosition[2]) > 0.01
      ) {
        positionRef.current = newPosition;
        updatePlayerPosition(newPosition);
      }
    } else if (tankRef.current) {
      positionRef.current = [
        tankRef.current.position.x,
        tankRef.current.position.y,
        tankRef.current.position.z,
      ];
    }

    if (povToggle && !prevPovToggleRef.current) {
      useGameState.getState().toggleFirstPersonView();
    }
    prevPovToggleRef.current = povToggle;
  });

  // Use refs directly to avoid creating new Vector3 on each render
  const currentTankPosition = positionRef.current;
  const currentTankRotation = tankRotationRef.current;

  const renderedSideWeapons = useMemo(() => {
    return sideWeapons.map((weapon: SecondaryWeapon, index: number) => {
      const WeaponComponent = WeaponComponents[weapon.id];
      if (!WeaponComponent) {
        console.warn(`No component found for weapon ID: ${weapon.id}`);
        return null;
      }

      let offsetX = 0;
      let offsetZ = 0;
      const angle = currentTankRotation;
      const dist = SIDE_WEAPON_DISTANCE;

      switch (index) {
        case 0:
          offsetX = dist * Math.sin(angle);
          offsetZ = dist * Math.cos(angle);
          break;
        case 1:
          offsetX = -dist * Math.sin(angle);
          offsetZ = -dist * Math.cos(angle);
          break;
        case 2:
          offsetX = -dist * Math.cos(angle);
          offsetZ = dist * Math.sin(angle);
          break;
        case 3:
          offsetX = dist * Math.cos(angle);
          offsetZ = -dist * Math.sin(angle);
          break;
      }

      const weaponPosition: [number, number, number] = [
        currentTankPosition[0] + offsetX,
        currentTankPosition[1] + SIDE_WEAPON_Y_OFFSET,
        currentTankPosition[2] + offsetZ,
      ];

      return (
        <WeaponComponent
          key={weapon.instanceId || `side-weapon-${index}`}
          weaponInstance={weapon}
          position={weaponPosition}
          rotation={currentTankRotation}
        />
      );
    });
  }, [sideWeapons, currentTankPosition, currentTankRotation]);

  return (
    <>
      <group
        ref={tankRef}
        position={position}
        rotation={[0, tankRotationRef.current, 0]}>
        <Box
          args={[1.8, 0.6, 2.2]}
          position={[0, 0, 0]}
          castShadow
          receiveShadow>
          <meshStandardMaterial
            color="#2E8B57"
            metalness={0.3}
            roughness={0.7}
          />
        </Box>
        <Box
          args={[1.2, 0.4, 0.5]}
          position={[0, 0.2, -1.35]}
          rotation={[Math.PI / 6, 0, 0]}
          castShadow
          receiveShadow>
          <meshStandardMaterial
            color="#2E8B57"
            metalness={0.3}
            roughness={0.7}
          />
        </Box>
        <Box
          args={[0.5, 0.1, 0.3]}
          position={[-0.5, 0.35, -0.8]}
          castShadow
          receiveShadow>
          <meshStandardMaterial
            color="#257548"
            metalness={0.3}
            roughness={0.7}
          />
        </Box>
        <Box
          args={[0.5, 0.1, 0.3]}
          position={[0.5, 0.35, -0.8]}
          castShadow
          receiveShadow>
          <meshStandardMaterial
            color="#257548"
            metalness={0.3}
            roughness={0.7}
          />
        </Box>
        <Box
          args={[0.8, 0.1, 0.25]}
          position={[0, 0.35, 0.9]}
          castShadow
          receiveShadow>
          <meshStandardMaterial
            color="#257548"
            metalness={0.3}
            roughness={0.7}
          />
        </Box>
        <Box args={[0.15, 0.1, 0.05]} position={[-0.6, 0.1, 1.15]} castShadow>
          <meshStandardMaterial
            color="white"
            emissive="yellow"
            emissiveIntensity={1}
          />
        </Box>
        <Box args={[0.15, 0.1, 0.05]} position={[0.6, 0.1, 1.15]} castShadow>
          <meshStandardMaterial
            color="white"
            emissive="yellow"
            emissiveIntensity={1}
          />
        </Box>
        <Box args={[0.15, 0.1, 0.05]} position={[-0.75, 0.1, -1.15]} castShadow>
          <meshStandardMaterial
            color="red"
            emissive="red"
            emissiveIntensity={isBraking ? 2.5 : 0.8}
          />
        </Box>
        <Box args={[0.15, 0.1, 0.05]} position={[0.75, 0.1, -1.15]} castShadow>
          <meshStandardMaterial
            color="red"
            emissive="red"
            emissiveIntensity={isBraking ? 2.5 : 0.8}
          />
        </Box>
        <Box
          args={[0.4, 0.25, 2.4]}
          position={[-0.8, -0.3, 0]}
          castShadow
          receiveShadow>
          <meshStandardMaterial color="#333333" roughness={0.9} />
        </Box>
        <Box
          args={[0.4, 0.25, 2.4]}
          position={[0.8, -0.3, 0]}
          castShadow
          receiveShadow>
          <meshStandardMaterial color="#333333" roughness={0.9} />
        </Box>
        <Box
          args={[0.2, 0.1, 2.2]}
          position={[-0.8, 0.05, 0]}
          castShadow
          receiveShadow>
          <meshStandardMaterial
            color="#2E8B57"
            metalness={0.3}
            roughness={0.7}
          />
        </Box>
        <Box
          args={[0.2, 0.1, 2.2]}
          position={[0.8, 0.05, 0]}
          castShadow
          receiveShadow>
          <meshStandardMaterial
            color="#2E8B57"
            metalness={0.3}
            roughness={0.7}
          />
        </Box>
        {[...Array(6)].map((_, i) => (
          <Cylinder
            key={`roller-l-${i}`}
            args={[0.12, 0.12, 0.1, 8]}
            position={[-0.8, -0.3, -0.8 + i * 0.36]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
            receiveShadow>
            <meshStandardMaterial
              color="#444444"
              roughness={0.8}
              metalness={0.2}
            />
          </Cylinder>
        ))}
        {[...Array(6)].map((_, i) => (
          <Cylinder
            key={`roller-r-${i}`}
            args={[0.12, 0.12, 0.1, 8]}
            position={[0.8, -0.3, -0.8 + i * 0.36]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
            receiveShadow>
            <meshStandardMaterial
              color="#444444"
              roughness={0.8}
              metalness={0.2}
            />
          </Cylinder>
        ))}
        <group position={[0, 0.5, 0]} ref={turretRef}>
          {!isFirstPerson && (
            <>
              <Cylinder
                args={[0.6, 0.6, 0.2, 20]}
                position={[0, 0.1, 0]}
                castShadow>
                <meshStandardMaterial
                  color="darkolivegreen"
                  metalness={0.4}
                  roughness={0.6}
                />
              </Cylinder>
              <Cylinder
                args={[0.7, 0.8, 0.5, 20]}
                position={[0, 0.25, 0]}
                castShadow>
                <meshStandardMaterial
                  color="darkolivegreen"
                  metalness={0.4}
                  roughness={0.6}
                />
              </Cylinder>
              <Cylinder
                args={[0.35, 0.35, 0.15, 16]}
                position={[0, 0.55, -0.3]}
                castShadow>
                <meshStandardMaterial
                  color="#4a5e2a"
                  metalness={0.4}
                  roughness={0.6}
                />
              </Cylinder>
            </>
          )}
          <Cylinder
            args={[0.12, 0.12, 1.8, 16]}
            position={[0, 0.25, 1.1]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow>
            <meshStandardMaterial
              color="gray"
              metalness={0.5}
              roughness={0.5}
            />
          </Cylinder>
          <Cylinder
            args={[0.18, 0.18, 0.3, 16]}
            position={[0, 0.25, 2]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow>
            <meshStandardMaterial
              color="black"
              metalness={0.6}
              roughness={0.4}
            />
          </Cylinder>
          <Box args={[0.25, 0.35, 1]} position={[-0.65, 0.25, 0]} castShadow>
            <meshStandardMaterial
              color="darkolivegreen"
              metalness={0.4}
              roughness={0.6}
            />
          </Box>
          <Box args={[0.25, 0.35, 1]} position={[0.65, 0.25, 0]} castShadow>
            <meshStandardMaterial
              color="darkolivegreen"
              metalness={0.4}
              roughness={0.6}
            />
          </Box>
          <Cylinder
            args={[0.05, 0.05, 0.2, 8]}
            position={[0.4, 0.55, -0.4]}
            castShadow>
            <meshStandardMaterial
              color="#333"
              metalness={0.8}
              roughness={0.2}
            />
          </Cylinder>
          <Cylinder
            args={[0.02, 0.02, 1.0, 8]}
            position={[0.4, 1.0, -0.4]}
            castShadow>
            <meshStandardMaterial
              color="silver"
              metalness={0.8}
              roughness={0.2}
            />
          </Cylinder>
          {!isFirstPerson && (
            <>
              <Box
                args={[0.25, 0.15, 0.15]}
                position={[0, 0.4, 0.5]}
                castShadow>
                <meshStandardMaterial
                  color="black"
                  emissive="blue"
                  emissiveIntensity={0.3}
                />
              </Box>
              <Sphere args={[0.15, 16, 16]} position={[0, 0.6, 0.2]} castShadow>
                <meshStandardMaterial
                  color="cyan"
                  emissive="cyan"
                  emissiveIntensity={0.6 + Math.sin(Date.now() * 0.005) * 0.4}
                  transparent
                  opacity={0.85}
                />
              </Sphere>
            </>
          )}
          {isFirstPerson && (
            <group position={[0, 0.25, 3.5]}>
              {/* Horizontal bar */}
              <Box args={[0.3, 0.02, 0.02]}>
                <meshStandardMaterial
                  color="#00ff00"
                  emissive="#00ff00"
                  emissiveIntensity={1.5}
                  transparent
                  opacity={0.9}
                />
              </Box>
              {/* Vertical bar */}
              <Box args={[0.02, 0.3, 0.02]}>
                <meshStandardMaterial
                  color="#00ff00"
                  emissive="#00ff00"
                  emissiveIntensity={1.5}
                  transparent
                  opacity={0.9}
                />
              </Box>
            </group>
          )}
        </group>
      </group>

      {projectiles.map((projectile) => (
        <Projectile
          key={projectile.id}
          id={projectile.id}
          position={projectile.position}
          rotation={projectile.rotation}
          damage={playerTurretDamage}
          penetrationPower={playerPenetration}
          onRemove={removeProjectile}
        />
      ))}

      {renderedSideWeapons}
    </>
  );
};

export default Tank;
