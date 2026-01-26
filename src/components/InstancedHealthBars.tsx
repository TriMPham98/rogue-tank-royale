/**
 * InstancedMesh-based health bar renderer
 * Renders all enemy health bars using just 2 draw calls (background + foreground)
 */
import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import {
  InstancedMesh,
  BoxGeometry,
  MeshBasicMaterial,
  Object3D,
  Color,
} from "three";
import { useGameState } from "../utils/gameState";
import { shallow } from "zustand/shallow";

const BAR_WIDTH = 1;
const BAR_HEIGHT = 0.1;
const BAR_DEPTH = 0.1;

const BG_COLOR = new Color("red");
const FG_COLOR = new Color("lime");

// Height offsets for different enemy types
const HEIGHT_OFFSETS = {
  tank: 1.2,
  turret: 1.5,
  bomber: 0.7, // bomberBaseHeight + bomberCockpitSize * 0.5 + 0.2
};

interface InstancedHealthBarsProps {
  maxEnemies?: number;
}

const InstancedHealthBars = ({ maxEnemies = 25 }: InstancedHealthBarsProps) => {
  const bgMeshRef = useRef<InstancedMesh>(null);
  const fgMeshRef = useRef<InstancedMesh>(null);
  const tempObject = useMemo(() => new Object3D(), []);

  const enemies = useGameState((state) => state.enemies, shallow);
  const maxHealthCache = useRef<Map<string, number>>(new Map());

  // Create geometry and materials
  const bgGeometry = useMemo(() => new BoxGeometry(BAR_WIDTH, BAR_HEIGHT, BAR_DEPTH), []);
  const fgGeometry = useMemo(() => new BoxGeometry(1, BAR_HEIGHT, BAR_DEPTH), []);

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

  // Track max health for each enemy
  useEffect(() => {
    for (const enemy of enemies) {
      if (!maxHealthCache.current.has(enemy.id)) {
        maxHealthCache.current.set(enemy.id, enemy.health);
      }
    }

    // Clean up removed enemies
    const currentIds = new Set(enemies.map((e) => e.id));
    for (const id of maxHealthCache.current.keys()) {
      if (!currentIds.has(id)) {
        maxHealthCache.current.delete(id);
      }
    }
  }, [enemies]);

  // Update health bars every frame
  useFrame(() => {
    if (!bgMeshRef.current || !fgMeshRef.current) return;

    let index = 0;
    for (const enemy of enemies) {
      if (index >= maxEnemies) break;

      const maxHealth = maxHealthCache.current.get(enemy.id) || enemy.health;
      const healthPercent = Math.max(0, Math.min(1, enemy.health / maxHealth));
      const heightOffset = HEIGHT_OFFSETS[enemy.type] || 1.2;

      // Background bar (full width)
      tempObject.position.set(
        enemy.position[0],
        enemy.position[1] + heightOffset,
        enemy.position[2]
      );
      tempObject.scale.set(1, 1, 1);
      tempObject.updateMatrix();
      bgMeshRef.current.setMatrixAt(index, tempObject.matrix);

      // Foreground bar (scaled by health percent)
      tempObject.position.set(
        enemy.position[0] - (1 - healthPercent) * BAR_WIDTH * 0.5,
        enemy.position[1] + heightOffset,
        enemy.position[2] + 0.001 // Slight offset to prevent z-fighting
      );
      tempObject.scale.set(healthPercent, 1, 1);
      tempObject.updateMatrix();
      fgMeshRef.current.setMatrixAt(index, tempObject.matrix);

      index++;
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
