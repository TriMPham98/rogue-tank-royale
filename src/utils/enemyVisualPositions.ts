/**
 * Live visual positions for enemies (updated every frame by EnemyTank).
 * Used by InstancedHealthBars so bars track meshes without thrashing Zustand.
 */
const positions = new Map<string, [number, number, number]>();

export function setEnemyVisualPosition(
  id: string,
  position: [number, number, number]
): void {
  const existing = positions.get(id);
  if (existing) {
    existing[0] = position[0];
    existing[1] = position[1];
    existing[2] = position[2];
  } else {
    positions.set(id, [position[0], position[1], position[2]]);
  }
}

export function getEnemyVisualPosition(
  id: string
): [number, number, number] | undefined {
  return positions.get(id);
}

export function clearEnemyVisualPosition(id: string): void {
  positions.delete(id);
}

export function clearAllEnemyVisualPositions(): void {
  positions.clear();
}
