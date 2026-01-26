/**
 * Projectile Object Pool System
 * Pre-allocates projectile objects and reuses them to reduce GC pressure
 */

export interface PooledProjectile {
  id: string;
  active: boolean;
  position: [number, number, number];
  rotation: number;
  velocity: number;
  damage: number;
  isEnemy: boolean;
  penetrationPower: number;
  hitEnemies: Set<string>;
  initialPosition: [number, number, number];
  createdAt: number;
}

const MAX_PLAYER_PROJECTILES = 100;
const MAX_ENEMY_PROJECTILES = 200;

class ProjectilePool {
  private playerProjectiles: PooledProjectile[] = [];
  private enemyProjectiles: PooledProjectile[] = [];
  private nextId = 0;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    // Pre-allocate player projectiles
    for (let i = 0; i < MAX_PLAYER_PROJECTILES; i++) {
      this.playerProjectiles.push(this.createInactiveProjectile(false));
    }

    // Pre-allocate enemy projectiles
    for (let i = 0; i < MAX_ENEMY_PROJECTILES; i++) {
      this.enemyProjectiles.push(this.createInactiveProjectile(true));
    }
  }

  private createInactiveProjectile(isEnemy: boolean): PooledProjectile {
    return {
      id: `projectile-${this.nextId++}`,
      active: false,
      position: [0, -100, 0], // Off-screen
      rotation: 0,
      velocity: 0,
      damage: 0,
      isEnemy,
      penetrationPower: 0,
      hitEnemies: new Set(),
      initialPosition: [0, -100, 0],
      createdAt: 0,
    };
  }

  /**
   * Spawn a new projectile from the pool
   */
  spawn(
    position: [number, number, number],
    rotation: number,
    velocity: number,
    damage: number,
    isEnemy: boolean,
    penetrationPower: number = 0
  ): PooledProjectile | null {
    const pool = isEnemy ? this.enemyProjectiles : this.playerProjectiles;

    // Find an inactive projectile
    const projectile = pool.find((p) => !p.active);
    if (!projectile) {
      // Pool exhausted - could expand here if needed
      console.warn(`Projectile pool exhausted for ${isEnemy ? "enemy" : "player"} projectiles`);
      return null;
    }

    // Activate and configure the projectile
    projectile.active = true;
    projectile.position = [...position];
    projectile.rotation = rotation;
    projectile.velocity = velocity;
    projectile.damage = damage;
    projectile.isEnemy = isEnemy;
    projectile.penetrationPower = penetrationPower;
    projectile.hitEnemies.clear();
    projectile.initialPosition = [...position];
    projectile.createdAt = performance.now();

    return projectile;
  }

  /**
   * Release a projectile back to the pool
   */
  release(projectile: PooledProjectile): void {
    projectile.active = false;
    projectile.position = [0, -100, 0]; // Move off-screen
    projectile.hitEnemies.clear();
  }

  /**
   * Release a projectile by ID
   */
  releaseById(id: string, isEnemy: boolean): void {
    const pool = isEnemy ? this.enemyProjectiles : this.playerProjectiles;
    const projectile = pool.find((p) => p.id === id);
    if (projectile) {
      this.release(projectile);
    }
  }

  /**
   * Get all active projectiles
   */
  getActiveProjectiles(isEnemy?: boolean): PooledProjectile[] {
    if (isEnemy === undefined) {
      return [
        ...this.playerProjectiles.filter((p) => p.active),
        ...this.enemyProjectiles.filter((p) => p.active),
      ];
    }
    const pool = isEnemy ? this.enemyProjectiles : this.playerProjectiles;
    return pool.filter((p) => p.active);
  }

  /**
   * Get active projectile count
   */
  getActiveCount(isEnemy?: boolean): number {
    if (isEnemy === undefined) {
      return (
        this.playerProjectiles.filter((p) => p.active).length +
        this.enemyProjectiles.filter((p) => p.active).length
      );
    }
    const pool = isEnemy ? this.enemyProjectiles : this.playerProjectiles;
    return pool.filter((p) => p.active).length;
  }

  /**
   * Update projectile position (called from game loop)
   */
  updatePosition(
    projectile: PooledProjectile,
    newX: number,
    newZ: number
  ): void {
    projectile.position[0] = newX;
    projectile.position[2] = newZ;
  }

  /**
   * Reset all projectiles (e.g., on game restart)
   */
  reset(): void {
    for (const p of this.playerProjectiles) {
      this.release(p);
    }
    for (const p of this.enemyProjectiles) {
      this.release(p);
    }
  }

  /**
   * Get pool statistics for debugging
   */
  getStats(): {
    playerActive: number;
    playerTotal: number;
    enemyActive: number;
    enemyTotal: number;
  } {
    return {
      playerActive: this.playerProjectiles.filter((p) => p.active).length,
      playerTotal: this.playerProjectiles.length,
      enemyActive: this.enemyProjectiles.filter((p) => p.active).length,
      enemyTotal: this.enemyProjectiles.length,
    };
  }
}

// Singleton instance
let poolInstance: ProjectilePool | null = null;

export function getProjectilePool(): ProjectilePool {
  if (!poolInstance) {
    poolInstance = new ProjectilePool();
  }
  return poolInstance;
}

export function resetProjectilePool(): void {
  poolInstance?.reset();
}
