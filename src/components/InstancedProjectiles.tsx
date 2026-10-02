/**
 * InstancedMesh-based projectile renderer
 * Renders all projectiles using a single draw call per type
 */
import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, Object3D } from "three";
import { useGameState } from "../utils/gameState";
import { getProjectilePool, resetProjectilePool, PooledProjectile } from "../systems/ProjectilePool";
import { getObstacleHash } from "../utils/spatialHash";
import { GAME_CONSTANTS } from "../constants/game";
import { fx, FX_COLORS } from "../models/fx/fxSystem";
import {
  getCoreGeometry,
  getCoreMaterial,
  getTrailGeometry,
  getTrailMaterial,
} from "../models/fx/tracers";

const PLAYER_CORE_COLOR = "#fff1b8";
const PLAYER_TRAIL_COLOR = "#ffb648";
const ENEMY_CORE_COLOR = "#ffd0c4";
const ENEMY_TRAIL_COLOR = "#ff3b2e";

const PLAYER_RADIUS = 0.11;
const ENEMY_RADIUS = 0.1;
const MAX_DISTANCE = 50;
const ENEMY_SPEED = 12;
const PLAYER_COLLISION_RADIUS = 1.8;

interface InstancedProjectilesProps {
  maxPlayerProjectiles?: number;
  maxEnemyProjectiles?: number;
}

const InstancedProjectiles = ({
  maxPlayerProjectiles = 100,
  maxEnemyProjectiles = 200,
}: InstancedProjectilesProps) => {
  const playerMeshRef = useRef<InstancedMesh>(null);
  const enemyMeshRef = useRef<InstancedMesh>(null);
  const playerTrailRef = useRef<InstancedMesh>(null);
  const enemyTrailRef = useRef<InstancedMesh>(null);
  const tempObject = useMemo(() => new Object3D(), []);

  const pool = useMemo(() => getProjectilePool(), []);

  // Get game state accessors
  const getState = useRef(useGameState.getState).current;
  const damageEnemy = useGameState((state) => state.damageEnemy);
  const takeDamage = useGameState((state) => state.takeDamage);
  const playerBulletVelocity = useGameState((state) => state.playerBulletVelocity);
  const isPaused = useGameState((state) => state.isPaused);
  const isGameOver = useGameState((state) => state.isGameOver);

  // Tracer visuals: hot core + crossed additive streak (shared geometry/materials)
  const coreGeometry = useMemo(() => getCoreGeometry(), []);
  const playerTrailGeometry = useMemo(() => getTrailGeometry(1.8, 0.42), []);
  const enemyTrailGeometry = useMemo(() => getTrailGeometry(1.3, 0.36), []);
  const playerCoreMaterial = useMemo(() => getCoreMaterial(PLAYER_CORE_COLOR), []);
  const enemyCoreMaterial = useMemo(() => getCoreMaterial(ENEMY_CORE_COLOR), []);
  const playerTrailMaterial = useMemo(() => getTrailMaterial(PLAYER_TRAIL_COLOR), []);
  const enemyTrailMaterial = useMemo(() => getTrailMaterial(ENEMY_TRAIL_COLOR), []);

  // Reset pool on game restart
  useEffect(() => {
    const unsubscribe = useGameState.subscribe((state, prevState) => {
      if (prevState.level > 1 && state.level === 1) {
        resetProjectilePool();
      }
    });
    return unsubscribe;
  }, []);

  // Cache obstacle data for collision detection
  const obstacleHashRef = useRef(getObstacleHash());

  // Update projectiles every frame
  useFrame((_, delta) => {
    if (isPaused || isGameOver) return;

    const playerProjectiles = pool.getActiveProjectiles(false);
    const enemyProjectiles = pool.getActiveProjectiles(true);
    const state = getState();

    // Update player projectiles
    updatePlayerProjectiles(playerProjectiles, delta, state);

    // Update enemy projectiles
    updateEnemyProjectiles(enemyProjectiles, delta, state);

    // Update instanced meshes (pool arrays were filtered before the updates above,
    // so re-read to skip projectiles released this frame)
    const livePlayer = pool.getActiveProjectiles(false);
    const liveEnemy = pool.getActiveProjectiles(true);
    updateInstancedMesh(playerMeshRef.current, playerTrailRef.current, livePlayer, maxPlayerProjectiles, PLAYER_RADIUS);
    updateInstancedMesh(enemyMeshRef.current, enemyTrailRef.current, liveEnemy, maxEnemyProjectiles, ENEMY_RADIUS);
  });

  const updatePlayerProjectiles = (
    projectiles: PooledProjectile[],
    delta: number,
    state: ReturnType<typeof getState>
  ) => {
    const velocity = playerBulletVelocity;
    const enemies = state.enemies;
    const obstacleHash = obstacleHashRef.current;

    for (const projectile of projectiles) {
      // Move projectile
      const newX = projectile.position[0] + Math.sin(projectile.rotation) * delta * velocity;
      const newZ = projectile.position[2] + Math.cos(projectile.rotation) * delta * velocity;

      // Check map boundaries
      if (Math.abs(newX) > GAME_CONSTANTS.HALF_MAP_SIZE || Math.abs(newZ) > GAME_CONSTANTS.HALF_MAP_SIZE) {
        pool.release(projectile);
        continue;
      }

      // Check max distance
      const dx = newX - projectile.initialPosition[0];
      const dz = newZ - projectile.initialPosition[2];
      if (dx * dx + dz * dz > MAX_DISTANCE * MAX_DISTANCE) {
        pool.release(projectile);
        continue;
      }

      // Check obstacle collision using spatial hash
      if (obstacleHash.size > 0) {
        const nearbyObstacles = obstacleHash.getNearby(newX, newZ, 3);
        let hitObstacle = false;
        for (const obstacle of nearbyObstacles) {
          const odx = obstacle.x - newX;
          const odz = obstacle.z - newZ;
          if (odx * odx + odz * odz < obstacle.radius * obstacle.radius) {
            hitObstacle = true;
            break;
          }
        }
        if (hitObstacle) {
          fx.ricochet(newX, projectile.position[1], newZ, FX_COLORS.playerShot);
          pool.release(projectile);
          continue;
        }
      }

      // Check enemy collision
      let shouldRelease = false;
      for (const enemy of enemies) {
        if (projectile.hitEnemies.has(enemy.id)) continue;

        const edx = enemy.position[0] - newX;
        const edz = enemy.position[2] - newZ;
        const distSq = edx * edx + edz * edz;
        const collisionRadius = enemy.type === "tank" ? 2.5 : 1.5;

        if (distSq < collisionRadius * collisionRadius) {
          projectile.hitEnemies.add(enemy.id);
          fx.impact(newX, projectile.position[1], newZ, FX_COLORS.playerShot);
          damageEnemy(enemy.id, projectile.damage);
          projectile.penetrationPower--;

          if (projectile.penetrationPower < 0) {
            shouldRelease = true;
            break;
          }
        }
      }

      if (shouldRelease) {
        pool.release(projectile);
        continue;
      }

      // Update position
      pool.updatePosition(projectile, newX, newZ);
    }
  };

  const updateEnemyProjectiles = (
    projectiles: PooledProjectile[],
    delta: number,
    state: ReturnType<typeof getState>
  ) => {
    const playerPosition = state.playerTankPosition;
    if (!playerPosition) return;

    const obstacleHash = obstacleHashRef.current;

    for (const projectile of projectiles) {
      // Move projectile
      const newX = projectile.position[0] + Math.sin(projectile.rotation) * delta * ENEMY_SPEED;
      const newZ = projectile.position[2] + Math.cos(projectile.rotation) * delta * ENEMY_SPEED;

      // Check map boundaries
      if (Math.abs(newX) > GAME_CONSTANTS.HALF_MAP_SIZE || Math.abs(newZ) > GAME_CONSTANTS.HALF_MAP_SIZE) {
        pool.release(projectile);
        continue;
      }

      // Check max distance
      const dx = newX - projectile.initialPosition[0];
      const dz = newZ - projectile.initialPosition[2];
      if (dx * dx + dz * dz > MAX_DISTANCE * MAX_DISTANCE) {
        pool.release(projectile);
        continue;
      }

      // Check obstacle collision using spatial hash
      if (obstacleHash.size > 0) {
        const nearbyObstacles = obstacleHash.getNearby(newX, newZ, 3);
        let hitObstacle = false;
        for (const obstacle of nearbyObstacles) {
          const odx = obstacle.x - newX;
          const odz = obstacle.z - newZ;
          if (odx * odx + odz * odz < obstacle.radius * obstacle.radius) {
            hitObstacle = true;
            break;
          }
        }
        if (hitObstacle) {
          fx.ricochet(newX, projectile.position[1], newZ, FX_COLORS.enemyShot);
          pool.release(projectile);
          continue;
        }
      }

      // Check player collision
      const pdx = playerPosition[0] - newX;
      const pdz = playerPosition[2] - newZ;
      const playerDistSq = pdx * pdx + pdz * pdz;

      if (playerDistSq < PLAYER_COLLISION_RADIUS * PLAYER_COLLISION_RADIUS) {
        fx.impact(newX, projectile.position[1], newZ, FX_COLORS.enemyShot, 0.8);
        takeDamage(projectile.damage);
        pool.release(projectile);
        continue;
      }

      // Update position
      pool.updatePosition(projectile, newX, newZ);
    }
  };

  const updateInstancedMesh = (
    core: InstancedMesh | null,
    trail: InstancedMesh | null,
    projectiles: PooledProjectile[],
    maxCount: number,
    radius: number
  ) => {
    if (!core || !trail) return;

    let index = 0;
    for (const projectile of projectiles) {
      if (index >= maxCount) break;

      tempObject.position.set(
        projectile.position[0],
        projectile.position[1],
        projectile.position[2]
      );
      tempObject.rotation.set(0, projectile.rotation, 0);
      tempObject.scale.setScalar(1);
      tempObject.updateMatrix();
      trail.setMatrixAt(index, tempObject.matrix);
      tempObject.scale.setScalar(radius);
      tempObject.updateMatrix();
      core.setMatrixAt(index, tempObject.matrix);
      index++;
    }

    core.count = index;
    trail.count = index;
    core.instanceMatrix.needsUpdate = true;
    trail.instanceMatrix.needsUpdate = true;
  };

  return (
    <>
      <instancedMesh
        ref={playerTrailRef}
        args={[playerTrailGeometry, playerTrailMaterial, maxPlayerProjectiles]}
        frustumCulled={false}
        renderOrder={4}
      />
      <instancedMesh
        ref={playerMeshRef}
        args={[coreGeometry, playerCoreMaterial, maxPlayerProjectiles]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={enemyTrailRef}
        args={[enemyTrailGeometry, enemyTrailMaterial, maxEnemyProjectiles]}
        frustumCulled={false}
        renderOrder={4}
      />
      <instancedMesh
        ref={enemyMeshRef}
        args={[coreGeometry, enemyCoreMaterial, maxEnemyProjectiles]}
        frustumCulled={false}
      />
    </>
  );
};

export default InstancedProjectiles;
