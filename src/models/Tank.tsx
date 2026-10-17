import React, { useRef, useState, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Vector3, Quaternion, Euler } from "three";
import PlayerTankMesh from "./tankVisuals/PlayerTankMesh";
import { useKeyboardControls } from "../hooks/useKeyboardControls";
import { useGameState, SecondaryWeapon, Enemy } from "../utils/gameState";
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
import { cameraShake } from "../systems/cameraShake";
import { MUZZLE_Z } from "./tankVisuals/playerTankParts";
import { checkVehicleCollision, resolveMove } from "../utils/vehicleCollision";
import { enemyBodyRadius } from "../utils/enemyHitbox";
import { getEnemyVisualPosition } from "../utils/enemyVisualPositions";
import { usePooledProjectiles } from "../hooks/usePooledProjectiles";
import { fx, FX_COLORS } from "./fx/fxSystem";

interface TankProps {
  position: [number, number, number];
  isFirstPerson?: boolean;
}

const SIDE_WEAPON_DISTANCE = GAME_CONSTANTS.SIDE_WEAPON_DISTANCE;

/** Hull heading at the start of every run */
const SPAWN_HEADING = Math.PI;

// Cannon recoil hull rock (damped spring, radians)
const RECOIL_ROCK_IMPULSE = 0.75;
const RECOIL_ROCK_STIFFNESS = 140;
const RECOIL_ROCK_DAMPING = 13;
const SIDE_WEAPON_Y_OFFSET = GAME_CONSTANTS.SIDE_WEAPON_Y_OFFSET;
const MAX_SIDE_WEAPONS = GAME_CONSTANTS.MAX_SIDE_WEAPONS;

// --- Demo / recording mode (?demo=1) ---------------------------------------
// Autopilot for capturing footage: the hull wanders on smooth sine-driven
// steering leashed to a ring around the fight, is pushed off a standoff
// distance from every enemy so it orbits rather than rams, the turret tracks
// the nearest enemy on a damped spring, and the cannon fires only once it's
// on target.
const DEMO =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("demo");

const DEMO_MAX_STEER = 1.1; // rad/s
const DEMO_STEER_SMOOTHING = 2.5; // 1/s, exponential low-pass
const DEMO_MAX_STEER_ACCEL = 2.5; // rad/s^2, caps how fast steer can change
const DEMO_MAX_THROTTLE_RATE = 1.2; // 1/s, caps how fast throttle can change
const DEMO_LEASH = 3; // units from the ring point before steering pulls back
const DEMO_LEASH_FULL = 10; // distance at which the pull fully overrides wander
const DEMO_CLUSTER_RADIUS = 12;
const DEMO_RING_RADIUS = 11; // orbit distance from the enemy cluster centroid
const DEMO_RING_LEAD = 0.35; // rad, ring target leads the tank so it circles
// Standoff, in multiples of contact distance (player + enemy body radius):
// repulsion starts fading in at OUTER, is at full strength by INNER.
const DEMO_STANDOFF_OUTER = 4;
const DEMO_STANDOFF_INNER = 2.5;
const DEMO_REVERSE_THROTTLE = -0.3; // gentle back-off when an enemy is dead ahead

declare global {
  interface Window {
    __demoStats?: { minDist: number; minRatio: number };
    __demoContact?: number | null;
  }
}
const DEMO_TURRET_MAX_VEL = 2.2; // rad/s
const DEMO_TURRET_OMEGA = 5; // critically-damped spring natural frequency
const DEMO_FIRE_TOLERANCE = 0.15; // rad
const DEMO_RETARGET_RATIO = 0.75; // switch only when 25% closer

interface DemoState {
  t: number;
  steer: number;
  throttle: number;
  targetId: string | null;
  turretVel: number;
  aimed: boolean;
  orbitDir: number; // +1 / -1, which way the hull circles the fight
}

const createDemoState = (): DemoState => ({
  t: 0,
  steer: 0,
  throttle: 0.8,
  targetId: null,
  turretVel: 0,
  aimed: false,
  orbitDir: 1,
});

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const smoothstep = (k: number) => k * k * (3 - 2 * k);
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));

/** Where the hull collision code sees this enemy (visual, else logical). */
const demoEnemyPos = (e: Enemy) => getEnemyVisualPosition(e.id) ?? e.position;

/**
 * Point on a ring of DEMO_RING_RADIUS around the centroid of the live enemies
 * clustered near (x, z), placed just ahead of the tank's bearing around that
 * centroid in `orbitDir` so seeking it circles the fight instead of entering.
 */
function demoAnchor(
  x: number,
  z: number,
  enemies: Enemy[],
  orbitDir: number
): [number, number] {
  let nearest: [number, number, number] | null = null;
  let best = Infinity;
  for (const e of enemies) {
    if (e.health <= 0) continue;
    const p = demoEnemyPos(e);
    const d = (p[0] - x) ** 2 + (p[2] - z) ** 2;
    if (d < best) {
      best = d;
      nearest = p;
    }
  }
  if (!nearest) return [0, 0];
  let sx = 0;
  let sz = 0;
  let n = 0;
  for (const e of enemies) {
    if (e.health <= 0) continue;
    const p = demoEnemyPos(e);
    const dx = p[0] - nearest[0];
    const dz = p[2] - nearest[2];
    if (dx * dx + dz * dz > DEMO_CLUSTER_RADIUS * DEMO_CLUSTER_RADIUS) continue;
    sx += p[0];
    sz += p[2];
    n++;
  }
  const cx = sx / n;
  const cz = sz / n;
  const bearing = Math.atan2(x - cx, z - cz) + orbitDir * DEMO_RING_LEAD;
  return [
    cx + Math.sin(bearing) * DEMO_RING_RADIUS,
    cz + Math.cos(bearing) * DEMO_RING_RADIUS,
  ];
}

/** Advance hull autopilot; writes smoothed `steer` (rad/s) and `throttle`. */
function stepDemoHull(
  d: DemoState,
  delta: number,
  x: number,
  z: number,
  heading: number,
  enemies: Enemy[]
) {
  d.t += delta;
  const t = d.t;
  const wander =
    0.55 * Math.sin(t * 0.31) +
    0.35 * Math.sin(t * 0.73 + 1.3) +
    0.2 * Math.sin(t * 0.17 + 2.1);

  // Standoff: accumulate an away-from-enemies vector weighted by how far each
  // enemy is inside its standoff band, and how much of that is dead ahead.
  const fwdX = Math.sin(heading);
  const fwdZ = Math.cos(heading);
  let repX = 0;
  let repZ = 0;
  let ahead = 0;
  let minDist = Infinity;
  let minContact = 0;
  for (const e of enemies) {
    if (e.health <= 0) continue;
    const p = demoEnemyPos(e);
    const dx = x - p[0];
    const dz = z - p[2];
    const dist = Math.hypot(dx, dz);
    const contact = GAME_CONSTANTS.TANK_RADIUS + enemyBodyRadius(e.type);
    if (dist < minDist) {
      minDist = dist;
      minContact = contact;
    }
    const outer = contact * DEMO_STANDOFF_OUTER;
    if (dist >= outer || dist < 1e-4) continue;
    const inner = contact * DEMO_STANDOFF_INNER;
    const w = smoothstep(clamp01((outer - dist) / (outer - inner)));
    repX += (dx / dist) * w;
    repZ += (dz / dist) * w;
    // cos of angle between heading and the direction to the enemy
    const facing = -(dx * fwdX + dz * fwdZ) / dist;
    if (facing > 0) ahead = Math.max(ahead, w * facing);
  }
  window.__demoStats = {
    minDist,
    minRatio: minContact > 0 ? minDist / minContact : Infinity,
  };
  window.__demoContact = minContact > 0 ? minContact : null;

  const repMag = Math.hypot(repX, repZ);
  const repW = Math.min(1, repMag);

  // Orbit direction follows which way we're already sliding past the
  // threat; otherwise keep the previous choice so it doesn't flip-flop.
  if (repMag > 1e-3) {
    const cross = fwdX * repZ - fwdZ * repX;
    if (Math.abs(cross) > 0.2 * repMag) d.orbitDir = cross > 0 ? 1 : -1;
  }

  const [ax, az] = demoAnchor(x, z, enemies, d.orbitDir);
  const dist = Math.hypot(ax - x, az - z);
  let raw = wander;
  if (dist > DEMO_LEASH) {
    const k = Math.min(1, (dist - DEMO_LEASH) / (DEMO_LEASH_FULL - DEMO_LEASH));
    const w = smoothstep(k);
    const err = wrapAngle(Math.atan2(ax - x, az - z) - heading);
    const seek = Math.max(-1, Math.min(1, err * 1.5));
    raw = wander * (1 - w) + seek * w;
  }

  if (repW > 0) {
    // Head along the tangent of the repulsion (orbit), tilting outward as
    // the push grows so a deep incursion backs out of the ring.
    const away = Math.atan2(repX, repZ);
    const desired = away + d.orbitDir * (Math.PI / 2) * (1 - 0.5 * repW);
    const err = wrapAngle(desired - heading);
    const evade = Math.max(-1, Math.min(1, err * 1.5));
    raw = raw * (1 - repW) + evade * repW;
  }
  raw = Math.max(-DEMO_MAX_STEER, Math.min(DEMO_MAX_STEER, raw * DEMO_MAX_STEER));

  const a = 1 - Math.exp(-DEMO_STEER_SMOOTHING * delta);
  const maxSteerStep = DEMO_MAX_STEER_ACCEL * delta;
  d.steer += Math.max(-maxSteerStep, Math.min(maxSteerStep, (raw - d.steer) * a));

  const cruise = 0.8 + 0.2 * Math.sin(t * 0.29 + Math.sin(t * 0.11) * 2);
  const throttleTarget = cruise * (1 - ahead) + DEMO_REVERSE_THROTTLE * ahead;
  const maxThrottleStep = DEMO_MAX_THROTTLE_RATE * delta;
  d.throttle += Math.max(
    -maxThrottleStep,
    Math.min(maxThrottleStep, (throttleTarget - d.throttle) * a)
  );
}

/**
 * Advance turret autopilot. Returns the new hull-relative turret angle and
 * sets `aimed` when within firing tolerance of a live target.
 */
function stepDemoTurret(
  d: DemoState,
  delta: number,
  x: number,
  z: number,
  heading: number,
  turret: number,
  enemies: Enemy[]
): number {
  let current: Enemy | null = null;
  let currentDist = Infinity;
  let nearest: Enemy | null = null;
  let nearestDist = Infinity;
  for (const e of enemies) {
    if (e.health <= 0) continue;
    const dist = Math.hypot(e.position[0] - x, e.position[2] - z);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = e;
    }
    if (e.id === d.targetId) {
      current = e;
      currentDist = dist;
    }
  }
  const target =
    current && !(nearest && nearestDist < currentDist * DEMO_RETARGET_RATIO)
      ? current
      : nearest;
  d.targetId = target ? target.id : null;

  const desired = target
    ? Math.atan2(target.position[0] - x, target.position[2] - z) - heading
    : 0;
  const err = wrapAngle(desired - turret);

  // Critically-damped spring, velocity-capped: eases in and out, never snaps
  const dt = Math.min(delta, 0.05);
  const w = DEMO_TURRET_OMEGA;
  d.turretVel += (w * w * err - 2 * w * d.turretVel) * dt;
  d.turretVel = Math.max(
    -DEMO_TURRET_MAX_VEL,
    Math.min(DEMO_TURRET_MAX_VEL, d.turretVel)
  );
  d.aimed = target !== null && Math.abs(err) < DEMO_FIRE_TOLERANCE;

  let next = (turret + d.turretVel * dt) % (Math.PI * 2);
  if (next < 0) next += Math.PI * 2;
  return next;
}
// ---------------------------------------------------------------------------

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

  const tankRotationRef = useRef(SPAWN_HEADING);
  const turretRotationRef = useRef(0);
  const trackSpinRef = useRef(0);
  const muzzleFlashRef = useRef(0);
  const recoilRef = useRef(0);
  const rockRef = useRef<Group>(null);
  const rockAngleRef = useRef(0);
  const rockVelRef = useRef(0);
  const rockDirRef = useRef(0);
  const dustTimerRef = useRef(0);
  const positionRef = useRef<[number, number, number]>([...position]);
  const isInitializedRef = useRef(false);
  const _quat = useRef(new Quaternion()).current;
  const _euler = useRef(new Euler()).current;
  const prevPovToggleRef = useRef(false);
  const demoRef = useRef<DemoState>(createDemoState());

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

  // New run: snap the hull back to the spawn pad. The mesh isn't remounted on
  // re-deploy, so without this it stayed wherever the last run ended.
  useEffect(
    () =>
      useGameState.subscribe((state, prev) => {
        if (state.runId === prev.runId || !tankRef.current) return;
        tankRotationRef.current = SPAWN_HEADING;
        turretRotationRef.current = 0;
        rockAngleRef.current = 0;
        rockVelRef.current = 0;
        recoilRef.current = 0;
        demoRef.current = createDemoState();
        tankRef.current.position.set(0, 0.5, 0);
        tankRef.current.quaternion.setFromAxisAngle(upVector, SPAWN_HEADING);
        if (turretRef.current) turretRef.current.rotation.y = 0;
        positionRef.current = [0, 0.5, 0];
        state.updatePlayerPosition([0, 0.5, 0]);
        state.updatePlayerTurretRotation(0);
      }),
    [upVector]
  );

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

    const demoEnemies = DEMO ? useGameState.getState().enemies : null;

    if (demoEnemies) {
      stepDemoHull(
        demoRef.current,
        delta,
        tankRef.current.position.x,
        tankRef.current.position.z,
        tankRotationRef.current,
        demoEnemies
      );
      _quat.setFromAxisAngle(upVector, demoRef.current.steer * delta);
      currentQuat.multiply(_quat);
    } else if (keyLeft) {
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

    if (demoEnemies) {
      intendedMovementMagnitude = demoRef.current.throttle;
      potentialX +=
        Math.sin(tankRotationRef.current) * delta * moveSpeed * intendedMovementMagnitude;
      potentialZ +=
        Math.cos(tankRotationRef.current) * delta * moveSpeed * intendedMovementMagnitude;
    } else if (keyForward || keyBackward) {
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

    const fromX = tankRef.current.position.x;
    const fromZ = tankRef.current.position.z;
    const resolved =
      intendedMovementMagnitude !== 0
        ? resolveMove(fromX, fromZ, potentialX, potentialZ, (x, z) =>
            checkTerrainCollision(x, z) ||
            checkVehicleCollision(undefined, GAME_CONSTANTS.TANK_RADIUS, fromX, fromZ, x, z)
          )
        : null;

    if (resolved) {
      tankRef.current.position.x = resolved[0];
      tankRef.current.position.z = resolved[1];
      moved = true;
      trackSpinRef.current += intendedMovementMagnitude * moveSpeed * delta * 2.4;

      // Kick up dust behind both tracks
      dustTimerRef.current -= delta;
      if (dustTimerRef.current <= 0) {
        dustTimerRef.current = 0.07;
        const yaw = tankRotationRef.current;
        const fwdX = Math.sin(yaw);
        const fwdZ = Math.cos(yaw);
        const back = intendedMovementMagnitude > 0 ? -1.15 : 1.15;
        for (const side of [-0.88, 0.88]) {
          fx.dust(
            tankRef.current.position.x + fwdX * back + fwdZ * side,
            tankRef.current.position.z + fwdZ * back - fwdX * side,
            0.6 + Math.min(1, moveSpeed / 6) * 0.5
          );
        }
      }
    } else {
      moved = false;
    }

    setIsBraking(
      demoEnemies
        ? !moved
        : keyBackward || (!moved && (keyForward || moveX !== 0 || moveZ !== 0))
    );

    if (turretRef.current) {
      if (demoEnemies) {
        turretRotationRef.current = stepDemoTurret(
          demoRef.current,
          delta,
          tankRef.current.position.x,
          tankRef.current.position.z,
          tankRotationRef.current,
          turretRotationRef.current,
          demoEnemies
        );
      } else {
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
    const isShootingRequested = demoEnemies
      ? demoRef.current.aimed
      : keyShoot || touchIsFiring;

    if ((!demoEnemies || isShootingRequested) && canShoot(currentTime, playerFireRate)) {
      const shootPosition: [number, number, number] = [
        tankRef.current.position.x +
          Math.sin(tankRotationRef.current + turretRotationRef.current) * MUZZLE_Z,
        tankRef.current.position.y + 0.75,
        tankRef.current.position.z +
          Math.cos(tankRotationRef.current + turretRotationRef.current) * MUZZLE_Z,
      ];
      spawnProjectile(
        shootPosition,
        tankRotationRef.current + turretRotationRef.current,
        playerTurretDamage
      );
      muzzleFlashRef.current = 1;
      // Recoil: barrel slide, hull rocks away from the shot, camera jolt
      recoilRef.current = 1;
      rockVelRef.current += RECOIL_ROCK_IMPULSE;
      rockDirRef.current = turretRotationRef.current;
      cameraShake.addKick(0.85);
      cameraShake.addTrauma(0.22);
      const aim = tankRotationRef.current + turretRotationRef.current;
      fx.muzzle(
        shootPosition[0],
        shootPosition[1],
        shootPosition[2],
        Math.sin(aim),
        Math.cos(aim),
        FX_COLORS.playerShot
      );
      recordShot(currentTime);

      sound.setVolume("playerCannon", 0.22);
      sound.play("playerCannon");
    }

    // Hull rock: damped spring back to level after each shot
    if (rockRef.current) {
      const dt = Math.min(delta, 0.05);
      const accel =
        -RECOIL_ROCK_STIFFNESS * rockAngleRef.current -
        RECOIL_ROCK_DAMPING * rockVelRef.current;
      rockVelRef.current += accel * dt;
      rockAngleRef.current += rockVelRef.current * dt;
      const a = rockAngleRef.current;
      // Nose lifts when firing forward; the firing side lifts on broadside shots
      rockRef.current.rotation.x = -a * Math.cos(rockDirRef.current);
      rockRef.current.rotation.z = a * Math.sin(rockDirRef.current);
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
        <group ref={rockRef}>
          <PlayerTankMesh
            turretRef={turretRef}
            isFirstPerson={isFirstPerson}
            isBraking={isBraking}
            trackSpinRef={trackSpinRef}
            muzzleFlashRef={muzzleFlashRef}
            recoilRef={recoilRef}
          />
        </group>
      </group>

      {renderedSideWeapons}
    </>
  );
};

export default Tank;
