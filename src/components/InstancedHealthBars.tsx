/**
 * InstancedMesh-based health bar renderer
 * Renders all enemy health bars in 2 draw calls (frame + fill). Bars face the
 * camera and the fill shifts green → amber → red as health drops.
 */
import { useRef, useMemo, useLayoutEffect } from "react";
import { useFrame } from "@react-three/fiber";
import {
  InstancedMesh,
  PlaneGeometry,
  MeshBasicMaterial,
  Object3D,
  Color,
  Vector3,
} from "three";
import { useGameState } from "../utils/gameState";
import { getEnemyVisualPosition } from "../utils/enemyVisualPositions";

const BAR_WIDTH = 1.1;
const BAR_HEIGHT = 0.11;
const FRAME_PAD = 0.05;

const HIGH = new Color("#5dff7a");
const MID = new Color("#ffc23d");
const LOW = new Color("#ff3b30");

// Height offsets for different enemy types (must match EnemyTank mesh layout)
const HEIGHT_OFFSETS: Record<string, number> = {
  tank: 1.35,
  turret: 1.6,
  bomber: 1.05,
};

interface InstancedHealthBarsProps {
  maxEnemies?: number;
}

const InstancedHealthBars = ({ maxEnemies = 25 }: InstancedHealthBarsProps) => {
  const bgMeshRef = useRef<InstancedMesh>(null);
  const fgMeshRef = useRef<InstancedMesh>(null);
  const tempObject = useMemo(() => new Object3D(), []);
  const right = useMemo(() => new Vector3(), []);
  const color = useMemo(() => new Color(), []);
  const maxHealthCache = useRef<Map<string, number>>(new Map());
  const getState = useRef(useGameState.getState).current;

  const bgGeometry = useMemo(
    () => new PlaneGeometry(BAR_WIDTH + FRAME_PAD, BAR_HEIGHT + FRAME_PAD),
    []
  );
  // Fill grows from its left edge so scaling never needs a recentring offset
  const fgGeometry = useMemo(() => {
    const g = new PlaneGeometry(BAR_WIDTH, BAR_HEIGHT);
    g.translate(BAR_WIDTH / 2, 0, 0);
    return g;
  }, []);

  const bgMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: "#0b0f0a",
        transparent: true,
        opacity: 0.72,
        depthTest: false,
        toneMapped: false,
      }),
    []
  );

  const fgMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: "#ffffff",
        transparent: true,
        depthTest: false,
        toneMapped: false,
      }),
    []
  );

  // Allocate instance colours up front so the fill material never has to
  // switch shader programs when the first enemy appears
  useLayoutEffect(() => {
    const fg = fgMeshRef.current;
    if (fg && !fg.instanceColor) fg.setColorAt(0, HIGH);
    if (fg) fg.count = 0;
    if (bgMeshRef.current) bgMeshRef.current.count = 0;
  }, []);

  // Update health bars every frame from live store (avoids React re-renders on moves)
  useFrame(({ camera }) => {
    const bg = bgMeshRef.current;
    const fg = fgMeshRef.current;
    if (!bg || !fg) return;

    const enemies = getState().enemies;
    const cache = maxHealthCache.current;
    const currentIds = new Set<string>();
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);

    let index = 0;
    for (const enemy of enemies) {
      if (index >= maxEnemies) break;
      currentIds.add(enemy.id);
      // Bosses get a dedicated HUD bar instead
      if (enemy.type === "boss") continue;

      if (!cache.has(enemy.id)) {
        cache.set(enemy.id, enemy.health);
      }

      const maxHealth = cache.get(enemy.id) || enemy.health;
      const healthPercent = Math.max(0, Math.min(1, enemy.health / maxHealth));
      const heightOffset = HEIGHT_OFFSETS[enemy.type] || 1.2;
      const visual = getEnemyVisualPosition(enemy.id) ?? enemy.position;
      const x = visual[0];
      const y = visual[1] + heightOffset;
      const z = visual[2];

      tempObject.quaternion.copy(camera.quaternion);
      tempObject.position.set(x, y, z);
      tempObject.scale.set(1, 1, 1);
      tempObject.updateMatrix();
      bg.setMatrixAt(index, tempObject.matrix);

      tempObject.position.set(
        x - right.x * BAR_WIDTH * 0.5,
        y - right.y * BAR_WIDTH * 0.5,
        z - right.z * BAR_WIDTH * 0.5
      );
      tempObject.scale.set(Math.max(0.001, healthPercent), 1, 1);
      tempObject.updateMatrix();
      fg.setMatrixAt(index, tempObject.matrix);

      if (healthPercent > 0.5) color.copy(MID).lerp(HIGH, (healthPercent - 0.5) * 2);
      else color.copy(LOW).lerp(MID, healthPercent * 2);
      fg.setColorAt(index, color);

      index++;
    }

    // Drop cache entries for despawned enemies
    for (const id of cache.keys()) {
      if (!currentIds.has(id)) {
        cache.delete(id);
      }
    }

    bg.count = index;
    fg.count = index;
    bg.instanceMatrix.needsUpdate = true;
    fg.instanceMatrix.needsUpdate = true;
    if (fg.instanceColor) fg.instanceColor.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh
        ref={bgMeshRef}
        args={[bgGeometry, bgMaterial, maxEnemies]}
        frustumCulled={false}
        renderOrder={10}
      />
      <instancedMesh
        ref={fgMeshRef}
        args={[fgGeometry, fgMaterial, maxEnemies]}
        frustumCulled={false}
        renderOrder={11}
      />
    </>
  );
};

export default InstancedHealthBars;
