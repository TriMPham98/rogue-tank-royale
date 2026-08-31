import React, { useRef, useState, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Vector3, Quaternion, Euler } from "three";
import PlayerTankMesh from "./tankVisuals/PlayerTankMesh";
import { useKeyboardControls } from "../hooks/useKeyboardControls";
import { useGameState, SecondaryWeapon } from "../utils/gameState";
import { debug } from "../utils/debug";
import { useSound, resetSoundTimer } from "../utils/sound";
import SniperRifle from "./SniperRifle";
import Shotgun from "./Shotgun";
import LaserWeapon from "./LaserWeapon";
import RocketLauncher from "./RocketLauncher";
import TeslaCoil from "./TeslaCoil";
import { WeaponInstance } from "../utils/weapons";
import { GAME_CONSTANTS } from "../constants/game";
import { useTankCollision } from "../hooks/useTankCollision";
import { usePooledProjectiles } from "../hooks/usePooledProjectiles";

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
  const trackSpinRef = useRef(0);
  const muzzleFlashRef = useRef(0);
  const positionRef = useRef<[number, number, number]>([...position]);
  const isInitializedRef = useRef(false);
  const _quat = useRef(new Quaternion()).current;
  const _euler = useRef(new Euler()).current;
  const prevPovToggleRef = useRef(false);

  // Use shared hooks for collision detection and projectile management
  const { checkTerrainCollision } = useTankCollision({
    tankRadius: GAME_CONSTANTS.TANK_RADIUS,
  });
  const { spawnProjectile, canShoot, recordShot } = usePooledProjectiles({
    isEnemy: false,
  });

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
      trackSpinRef.current += intendedMovementMagnitude * moveSpeed * delta * 2.4;
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
        tankRotationRef.current + turretRotationRef.current,
        playerTurretDamage
      );
      muzzleFlashRef.current = 1;
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
        <PlayerTankMesh
          turretRef={turretRef}
          isFirstPerson={isFirstPerson}
          isBraking={isBraking}
          trackSpinRef={trackSpinRef}
          muzzleFlashRef={muzzleFlashRef}
        />
      </group>

      {renderedSideWeapons}
    </>
  );
};

export default Tank;
