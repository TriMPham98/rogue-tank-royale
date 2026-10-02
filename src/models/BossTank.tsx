import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Box, Cylinder } from "@react-three/drei";
import {
  Vector3,
  Group,
  Quaternion,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  AdditiveBlending,
} from "three";
import EnemyCombatMesh from "./tankVisuals/EnemyCombatMesh";
import { ENEMY_TANK_MATS as T } from "./tankVisuals/tankMaterials";
import GlowSprite from "./fx/GlowSprite";
import { Enemy, useGameState } from "../utils/gameState";
import { GAME_CONSTANTS } from "../constants/game";
import { useTankCollision } from "../hooks/useTankCollision";
import { usePooledProjectiles } from "../hooks/usePooledProjectiles";
import { fx, FX_COLORS } from "./fx/fxSystem";
import { bombardment } from "../systems/bombardment";
import SoundManager from "../utils/sound";
import {
  setEnemyVisualPosition,
  clearEnemyVisualPosition,
} from "../utils/enemyVisualPositions";

/** Visual scale relative to a regular enemy tank */
const BOSS_SCALE = 2.1;
const CANNON_RANGE = 30;
const KEEP_DISTANCE = 11;
const SPREAD = 0.14;

interface BossTankProps {
  enemy: Enemy;
}

/**
 * Heavy assault tank for boss levels: slow, armoured, fires three-shell
 * spreads and calls mortar barrages onto the player. Enrages below 40% hull.
 */
const BossTank = ({ enemy }: BossTankProps) => {
  const initialPosition = useRef(new Vector3(...enemy.position)).current;
  const tankRef = useRef<Group>(null);
  const turretRef = useRef<Group>(null);
  const ringRef = useRef<Mesh>(null);

  const tankRotationRef = useRef(0);
  const turretRotationRef = useRef(0);
  const trackSpinRef = useRef(0);
  const dustTimerRef = useRef(0);
  const barrageTimerRef = useRef(5);
  const enragedRef = useRef(false);

  const { checkTerrainCollision } = useTankCollision({
    tankRadius: GAME_CONSTANTS.BOSS_RADIUS,
    enemyId: enemy.id,
  });
  const { spawnProjectile, canShoot, recordShot } = usePooledProjectiles({
    isEnemy: true,
    defaultDamage: 8,
    defaultVelocity: 13,
  });

  const v = useMemo(
    () => ({
      player: new Vector3(),
      toPlayer: new Vector3(),
      repel: new Vector3(),
      tmp: new Vector3(),
      barrel: new Vector3(),
      dir: new Vector3(),
    }),
    []
  );
  const quat = useMemo(() => new Quaternion(), []);

  const ring = useMemo(
    () => ({
      geometry: new RingGeometry(2.6, 3.1, 48),
      material: new MeshBasicMaterial({
        color: "#ff2a1a",
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      }),
    }),
    []
  );

  const getState = useRef(useGameState.getState).current;

  useEffect(() => {
    return () => {
      clearEnemyVisualPosition(enemy.id);
      ring.geometry.dispose();
      ring.material.dispose();
    };
  }, [enemy.id, ring]);

  useFrame((state, delta) => {
    const s = getState();
    if (s.isPaused || s.isGameOver || !tankRef.current || !turretRef.current) return;

    const self = s.enemies.find((e) => e.id === enemy.id);
    if (!self) return;

    const pos = tankRef.current.position;
    setEnemyVisualPosition(enemy.id, [pos.x, pos.y, pos.z]);

    const [px, py, pz] = s.playerTankPosition;
    v.player.set(px, py, pz);
    v.toPlayer.copy(v.player).sub(pos).setY(0);
    const distance = v.toPlayer.length();
    v.toPlayer.normalize();

    const healthFraction = self.health / (self.maxHealth || self.health);
    if (!enragedRef.current && healthFraction < 0.4) {
      enragedRef.current = true;
      SoundManager.setVolume("bossAlarm", 0.45);
      SoundManager.play("bossAlarm");
    }
    const enraged = enragedRef.current;
    const t = state.clock.getElapsedTime();

    // --- Turret tracking ---
    const targetTurret = Math.atan2(v.toPlayer.x, v.toPlayer.z) - tankRotationRef.current;
    const turretDiff =
      ((targetTurret - turretRotationRef.current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    turretRotationRef.current += turretDiff * delta * (enraged ? 2.4 : 1.6);
    turretRef.current.rotation.y = turretRotationRef.current;

    // --- Main cannon: three-shell spread ---
    const fireInterval = enraged ? 1.5 : 2.4;
    if (distance < CANNON_RANGE && canShoot(t, fireInterval)) {
      v.barrel.set(0, 0.2, 1.95);
      turretRef.current.localToWorld(v.barrel);
      turretRef.current.getWorldQuaternion(quat);
      v.dir.set(0, 0, 1).applyQuaternion(quat);
      const heading = Math.atan2(v.dir.x, v.dir.z);

      const level = s.level;
      const damage = Math.round(8 + level * 0.35);
      for (const offset of [-SPREAD, 0, SPREAD]) {
        spawnProjectile([v.barrel.x, v.barrel.y, v.barrel.z], heading + offset, damage, 13);
      }
      fx.muzzle(v.barrel.x, v.barrel.y, v.barrel.z, v.dir.x, v.dir.z, FX_COLORS.enemyShot, 2.2);
      const vol = Math.max(0.04, 0.3 * (1 - distance / 50));
      SoundManager.setVolume("playerCannon", vol);
      SoundManager.play("playerCannon");
      recordShot(t);
    }

    // --- Mortar barrage onto the player's position ---
    barrageTimerRef.current -= delta;
    if (barrageTimerRef.current <= 0 && distance < 45) {
      barrageTimerRef.current = enraged ? 6 : 9;
      const shells = enraged ? 7 : 5;
      const damage = GAME_CONSTANTS.RED_ZONE_BOMB_BASE_DAMAGE + s.level * 0.5;
      for (let i = 0; i < shells; i++) {
        // First shell lands on the player; the rest bracket them
        const a = Math.random() * Math.PI * 2;
        const r = i === 0 ? 0 : 3 + Math.random() * 4;
        bombardment.drop(px + Math.cos(a) * r, pz + Math.sin(a) * r, {
          fallTime: 1.4 + i * 0.12,
          radius: 2.8,
          damage,
          source: "boss",
        });
      }
      fx.muzzle(pos.x, pos.y + 2.4, pos.z, 0, 0, FX_COLORS.fire, 1.6);
    }

    // --- Movement: close to medium range, steer around rocks ---
    v.repel.set(0, 0, 0);
    for (const obstacle of s.terrainObstacles) {
      v.tmp.set(pos.x - obstacle.position[0], 0, pos.z - obstacle.position[2]);
      const gap =
        v.tmp.length() -
        (GAME_CONSTANTS.BOSS_RADIUS + obstacle.size * GAME_CONSTANTS.OBSTACLE_RADIUS_MULTIPLIER);
      if (gap < 5) v.repel.add(v.tmp.normalize().multiplyScalar(1 / (gap + 0.1)));
    }
    v.tmp.copy(v.toPlayer).add(v.repel).normalize();
    const targetHeading = Math.atan2(v.tmp.x, v.tmp.z);
    const headingDiff =
      ((targetHeading - tankRotationRef.current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    tankRotationRef.current += headingDiff * delta * 0.8;
    tankRef.current.rotation.y = tankRotationRef.current;

    if (distance > KEEP_DISTANCE) {
      const speed = (enemy.speed ?? GAME_CONSTANTS.BOSS_SPEED) * (enraged ? 1.35 : 1);
      const nx = pos.x + Math.sin(tankRotationRef.current) * delta * speed;
      const nz = pos.z + Math.cos(tankRotationRef.current) * delta * speed;
      if (!checkTerrainCollision(nx, nz)) {
        pos.x = nx;
        pos.z = nz;
        trackSpinRef.current += speed * delta * 1.4;
        dustTimerRef.current -= delta;
        if (dustTimerRef.current <= 0) {
          dustTimerRef.current = 0.1;
          const bx = Math.sin(tankRotationRef.current);
          const bz = Math.cos(tankRotationRef.current);
          fx.dust(nx - bx * 2.2 - bz * 1.4, nz - bz * 2.2 + bx * 1.4, 1.4);
          fx.dust(nx - bx * 2.2 + bz * 1.4, nz - bz * 2.2 - bx * 1.4, 1.4);
        }
        setEnemyVisualPosition(enemy.id, [pos.x, pos.y, pos.z]);
        if (Math.random() < 0.15) {
          s.updateEnemyPosition(enemy.id, [pos.x, pos.y, pos.z]);
        }
      }
    }

    // Danger ring pulses faster when enraged
    if (ringRef.current) {
      const pulse = 0.5 + 0.5 * Math.sin(t * (enraged ? 9 : 3.5));
      ring.material.opacity = 0.25 + pulse * (enraged ? 0.55 : 0.3);
      ringRef.current.rotation.z = t * 0.4;
    }
  });

  const innerLift = 0.5 * (BOSS_SCALE - 1);

  return (
    <group ref={tankRef} position={initialPosition} name={`enemy-${enemy.id}-boss`}>
      <group scale={BOSS_SCALE} position={[0, innerLift, 0]}>
        <EnemyCombatMesh variant="tank" turretRef={turretRef} trackSpinRef={trackSpinRef} />
        {/* Extra armour skirts + rear mortar rack set it apart from regular tanks */}
        <Box args={[0.14, 0.34, 2.1]} position={[-0.92, 0.0, 0]} material={T.hullDark} castShadow />
        <Box args={[0.14, 0.34, 2.1]} position={[0.92, 0.0, 0]} material={T.hullDark} castShadow />
        <Box args={[0.9, 0.18, 0.5]} position={[0, 0.36, -0.82]} material={T.metal} castShadow />
        {[-0.28, 0, 0.28].map((x) => (
          <Cylinder
            key={`mortar-${x}`}
            args={[0.07, 0.08, 0.42, 8]}
            position={[x, 0.6, -0.86]}
            rotation={[-0.35, 0, 0]}
            material={T.barrel}
            castShadow
          />
        ))}
        <GlowSprite color="#ff3020" size={1.1} opacity={0.6} position={[0, 0.95, 0]} />
      </group>
      <mesh
        ref={ringRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.44, 0]}
        geometry={ring.geometry}
        material={ring.material}
        renderOrder={3}
      />
    </group>
  );
};

export default BossTank;
