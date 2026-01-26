/**
 * Grid-based spatial hash for O(1) average collision lookups
 * Reduces collision detection from O(n²) to O(n) in practice
 */

export interface SpatialEntity {
  id: string;
  x: number;
  z: number;
  radius: number;
}

export class SpatialHash<T extends SpatialEntity> {
  private cellSize: number;
  private grid: Map<string, T[]>;
  private entityCells: Map<string, string[]>; // Track which cells each entity occupies

  constructor(cellSize: number = 10) {
    this.cellSize = cellSize;
    this.grid = new Map();
    this.entityCells = new Map();
  }

  private getCellKey(x: number, z: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellZ = Math.floor(z / this.cellSize);
    return `${cellX},${cellZ}`;
  }

  private getCellsForEntity(entity: T): string[] {
    const cells: string[] = [];
    const minX = Math.floor((entity.x - entity.radius) / this.cellSize);
    const maxX = Math.floor((entity.x + entity.radius) / this.cellSize);
    const minZ = Math.floor((entity.z - entity.radius) / this.cellSize);
    const maxZ = Math.floor((entity.z + entity.radius) / this.cellSize);

    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        cells.push(`${x},${z}`);
      }
    }
    return cells;
  }

  /**
   * Insert an entity into the spatial hash
   */
  insert(entity: T): void {
    const cells = this.getCellsForEntity(entity);
    this.entityCells.set(entity.id, cells);

    for (const cell of cells) {
      if (!this.grid.has(cell)) {
        this.grid.set(cell, []);
      }
      this.grid.get(cell)!.push(entity);
    }
  }

  /**
   * Remove an entity from the spatial hash
   */
  remove(entityId: string): void {
    const cells = this.entityCells.get(entityId);
    if (!cells) return;

    for (const cell of cells) {
      const entities = this.grid.get(cell);
      if (entities) {
        const index = entities.findIndex((e) => e.id === entityId);
        if (index !== -1) {
          entities.splice(index, 1);
        }
        if (entities.length === 0) {
          this.grid.delete(cell);
        }
      }
    }
    this.entityCells.delete(entityId);
  }

  /**
   * Update an entity's position in the spatial hash
   */
  update(entity: T): void {
    this.remove(entity.id);
    this.insert(entity);
  }

  /**
   * Get all potential collision candidates for a point
   */
  getNearby(x: number, z: number, radius: number = 0): T[] {
    const nearby: T[] = [];
    const seen = new Set<string>();

    const minX = Math.floor((x - radius) / this.cellSize);
    const maxX = Math.floor((x + radius) / this.cellSize);
    const minZ = Math.floor((z - radius) / this.cellSize);
    const maxZ = Math.floor((z + radius) / this.cellSize);

    for (let cellX = minX; cellX <= maxX; cellX++) {
      for (let cellZ = minZ; cellZ <= maxZ; cellZ++) {
        const cell = `${cellX},${cellZ}`;
        const entities = this.grid.get(cell);
        if (entities) {
          for (const entity of entities) {
            if (!seen.has(entity.id)) {
              seen.add(entity.id);
              nearby.push(entity);
            }
          }
        }
      }
    }

    return nearby;
  }

  /**
   * Get entities within a specific radius (with distance check)
   */
  getWithinRadius(x: number, z: number, radius: number): T[] {
    const candidates = this.getNearby(x, z, radius);
    return candidates.filter((entity) => {
      const dx = entity.x - x;
      const dz = entity.z - z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      return distance <= radius + entity.radius;
    });
  }

  /**
   * Clear all entities from the hash
   */
  clear(): void {
    this.grid.clear();
    this.entityCells.clear();
  }

  /**
   * Rebuild the entire hash from a list of entities
   */
  rebuild(entities: T[]): void {
    this.clear();
    for (const entity of entities) {
      this.insert(entity);
    }
  }

  /**
   * Get the number of entities in the hash
   */
  get size(): number {
    return this.entityCells.size;
  }
}

// Singleton instances for game use
let obstacleHash: SpatialHash<SpatialEntity> | null = null;
let enemyHash: SpatialHash<SpatialEntity> | null = null;

export function getObstacleHash(): SpatialHash<SpatialEntity> {
  if (!obstacleHash) {
    obstacleHash = new SpatialHash(15); // Larger cells for obstacles (they're static)
  }
  return obstacleHash;
}

export function getEnemyHash(): SpatialHash<SpatialEntity> {
  if (!enemyHash) {
    enemyHash = new SpatialHash(10); // Smaller cells for enemies (they move)
  }
  return enemyHash;
}

export function resetSpatialHashes(): void {
  obstacleHash?.clear();
  enemyHash?.clear();
}
