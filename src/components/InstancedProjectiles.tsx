/**
 * InstancedMesh-based projectile renderer
 * Renders all projectiles using a single draw call per type
 */
import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import {
  InstancedMesh,
  SphereGeometry,
  MeshStandardMaterial,
  Object3D,
  Color,
} from "three";
import { useGameState } from "../utils/gameState";
import { getProjectilePool, resetProjectilePool, PooledProjectile } from "../systems/ProjectilePool";
import { getObstacleHash } from "../utils/spatialHash";

const PLAYER_PROJECTILE_COLOR = new Color("yellow");
const PLAYER_PROJECTILE_EMISSIVE = new Color("orange");
const ENEMY_PROJECTILE_COLOR = new Color("red");
const ENEMY_PROJECTILE_EMISSIVE = new Color("red");

const PLAYER_RADIUS = 0.25;
const ENEMY_RADIUS = 0.2;
const MAP_SIZE = 50;
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
  const tempObject = useMemo(() => new Object3D(), []);

  const pool = useMemo(() => getProjectilePool(), []);

  // Get game state accessors
  const getState = useRef(useGameState.getState).current;
  const damageEnemy = useGameState((state) => state.damageEnemy);
  const takeDamage = useGameState((state) => state.takeDamage);
  const playerBulletVelocity = useGameState((state) => state.playerBulletVelocity);
  const isPaused = useGameState((state) => state.isPaused);
  const isGameOver = useGameState((state) => state.isGameOver);

  // Create geometries and materials
  const playerGeometry = useMemo(() => new SphereGeometry(PLAYER_RADIUS, 8, 8), []);
  const enemyGeometry = useMemo(() => new SphereGeometry(ENEMY_RADIUS, 8, 8), []);

  const playerMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: PLAYER_PROJECTILE_COLOR,
        emissive: PLAYER_PROJECTILE_EMISSIVE,
        emissiveIntensity: 2,
      }),
    []
  );

  const enemyMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: ENEMY_PROJECTILE_COLOR,
        emissive: ENEMY_PROJECTILE_EMISSIVE,
        emissiveIntensity: 2,
      }),
    []
  );

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

    // Update instanced meshes
    updateInstancedMesh(playerMeshRef.current, playerProjectiles, maxPlayerProjectiles);
    updateInstancedMesh(enemyMeshRef.current, enemyProjectiles, maxEnemyProjectiles);
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
      if (Math.abs(newX) > MAP_SIZE || Math.abs(newZ) > MAP_SIZE) {
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
      if (Math.abs(newX) > MAP_SIZE || Math.abs(newZ) > MAP_SIZE) {
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
          pool.release(projectile);
          continue;
        }
      }

      // Check player collision
      const pdx = playerPosition[0] - newX;
      const pdz = playerPosition[2] - newZ;
      const playerDistSq = pdx * pdx + pdz * pdz;

      if (playerDistSq < PLAYER_COLLISION_RADIUS * PLAYER_COLLISION_RADIUS) {
        takeDamage(projectile.damage);
        pool.release(projectile);
        continue;
      }

      // Update position
      pool.updatePosition(projectile, newX, newZ);
    }
  };

  const updateInstancedMesh = (
    mesh: InstancedMesh | null,
    projectiles: PooledProjectile[],
    maxCount: number
  ) => {
    if (!mesh) return;

    let index = 0;
    for (const projectile of projectiles) {
      if (index >= maxCount) break;

      tempObject.position.set(
        projectile.position[0],
        projectile.position[1],
        projectile.position[2]
      );
      tempObject.updateMatrix();
      mesh.setMatrixAt(index, tempObject.matrix);
      index++;
    }

    // Hide remaining instances by moving them far away
    for (let i = index; i < maxCount; i++) {
      tempObject.position.set(0, -1000, 0);
      tempObject.updateMatrix();
      mesh.setMatrixAt(i, tempObject.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  };

  return (
    <>
      <instancedMesh
        ref={playerMeshRef}
        args={[playerGeometry, playerMaterial, maxPlayerProjectiles]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={enemyMeshRef}
        args={[enemyGeometry, enemyMaterial, maxEnemyProjectiles]}
        frustumCulled={false}
      />
    </>
  );
};

export default InstancedProjectiles;
