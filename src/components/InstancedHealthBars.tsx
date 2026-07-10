/**
 * InstancedMesh-based health bar renderer
 * Renders all enemy health bars using just 2 draw calls (background + foreground)
 */
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import {
  InstancedMesh,
  BoxGeometry,
  MeshBasicMaterial,
  Object3D,
  Color,
} from "three";
import { useGameState } from "../utils/gameState";
import { getEnemyVisualPosition } from "../utils/enemyVisualPositions";

const BAR_WIDTH = 1;
const BAR_HEIGHT = 0.1;
const BAR_DEPTH = 0.1;

const BG_COLOR = new Color("red");
const FG_COLOR = new Color("lime");

// Height offsets for different enemy types (must match EnemyTank mesh layout)
const HEIGHT_OFFSETS: Record<string, number> = {
  tank: 1.2,
  turret: 1.5,
  // bomberBaseHeight(0.3) + bomberCockpitSize(0.8)*0.5 + 0.2
  bomber: 0.9,
};

interface InstancedHealthBarsProps {
  maxEnemies?: number;
}

const InstancedHealthBars = ({ maxEnemies = 25 }: InstancedHealthBarsProps) => {
  const bgMeshRef = useRef<InstancedMesh>(null);
  const fgMeshRef = useRef<InstancedMesh>(null);
  const tempObject = useMemo(() => new Object3D(), []);
  const maxHealthCache = useRef<Map<string, number>>(new Map());
  const getState = useRef(useGameState.getState).current;

  // Create geometry and materials once
  const bgGeometry = useMemo(
    () => new BoxGeometry(BAR_WIDTH, BAR_HEIGHT, BAR_DEPTH),
    []
  );
  const fgGeometry = useMemo(
    () => new BoxGeometry(1, BAR_HEIGHT, BAR_DEPTH),
    []
  );

  const bgMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: BG_COLOR,
        transparent: true,
        depthTest: false,
      }),
    []
  );

  const fgMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: FG_COLOR,
        transparent: true,
        depthTest: false,
      }),
    []
  );

  // Update health bars every frame from live store (avoids React re-renders on moves)
  useFrame(() => {
    if (!bgMeshRef.current || !fgMeshRef.current) return;

    const enemies = getState().enemies;
    const cache = maxHealthCache.current;
    const currentIds = new Set<string>();

    let index = 0;
    for (const enemy of enemies) {
      if (index >= maxEnemies) break;
      currentIds.add(enemy.id);

      if (!cache.has(enemy.id)) {
        cache.set(enemy.id, enemy.health);
      }

      const maxHealth = cache.get(enemy.id) || enemy.health;
      const healthPercent = Math.max(0, Math.min(1, enemy.health / maxHealth));
      const heightOffset = HEIGHT_OFFSETS[enemy.type] || 1.2;
      const visual = getEnemyVisualPosition(enemy.id) ?? enemy.position;

      // Background bar (full width)
      tempObject.position.set(
        visual[0],
        visual[1] + heightOffset,
        visual[2]
      );
      tempObject.scale.set(1, 1, 1);
      tempObject.updateMatrix();
      bgMeshRef.current.setMatrixAt(index, tempObject.matrix);

      // Foreground bar (scaled by health percent)
      tempObject.position.set(
        visual[0] - (1 - healthPercent) * BAR_WIDTH * 0.5,
        visual[1] + heightOffset,
        visual[2] + 0.001
      );
      tempObject.scale.set(healthPercent, 1, 1);
      tempObject.updateMatrix();
      fgMeshRef.current.setMatrixAt(index, tempObject.matrix);

      index++;
    }

    // Drop cache entries for despawned enemies
    for (const id of cache.keys()) {
      if (!currentIds.has(id)) {
        cache.delete(id);
      }
    }

    // Hide unused instances
    for (let i = index; i < maxEnemies; i++) {
      tempObject.position.set(0, -1000, 0);
      tempObject.scale.set(0, 0, 0);
      tempObject.updateMatrix();
      bgMeshRef.current.setMatrixAt(i, tempObject.matrix);
      fgMeshRef.current.setMatrixAt(i, tempObject.matrix);
    }

    bgMeshRef.current.instanceMatrix.needsUpdate = true;
    fgMeshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh
        ref={bgMeshRef}
        args={[bgGeometry, bgMaterial, maxEnemies]}
        frustumCulled={false}
        renderOrder={1}
      />
      <instancedMesh
        ref={fgMeshRef}
        args={[fgGeometry, fgMaterial, maxEnemies]}
        frustumCulled={false}
        renderOrder={2}
      />
    </>
  );
};

export default InstancedHealthBars;
