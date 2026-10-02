import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  RingGeometry,
} from "three";
import { useGameState } from "../utils/gameState";
import { GAME_CONSTANTS } from "../constants/game";
import { bombardment, MAX_BOMBS } from "../systems/bombardment";
import { getEnemyVisualPosition } from "../utils/enemyVisualPositions";
import { fx } from "./fx/fxSystem";
import SoundManager from "../utils/sound";

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const SHELL_DROP_HEIGHT = 30;

/** Seconds until the next red zone; shrinks with level. */
const nextCooldown = (level: number) =>
  Math.max(
    GAME_CONSTANTS.RED_ZONE_MIN_COOLDOWN,
    GAME_CONSTANTS.RED_ZONE_BASE_COOLDOWN - level * 0.8
  ) * rand(0.8, 1.2);

/**
 * PUBG-style red zone: a circle is marked on the map, a siren sounds, then
 * artillery rains down inside it for a few seconds. Also renders every shell
 * in the shared bombardment queue (boss mortars use the same telegraphs).
 */
const RedZone = () => {
  const getState = useRef(useGameState.getState).current;

  // Director state (refs: no React renders while it ticks)
  const phaseRef = useRef<"idle" | "warning" | "bombing">("idle");
  const timerRef = useRef(0);
  const cooldownRef = useRef(20);
  const bombAccRef = useRef(0);
  const zoneRef = useRef({ x: 0, z: 0, r: 0 });
  const elapsedRef = useRef(0);

  const zoneGroupRef = useRef<Group>(null);
  const zoneDiscRef = useRef<Mesh>(null);
  const zoneEdgeRef = useRef<Mesh>(null);
  const zoneWallRef = useRef<Mesh>(null);
  const markerRingRef = useRef<InstancedMesh>(null);
  const markerFillRef = useRef<InstancedMesh>(null);
  const shellRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  const assets = useMemo(() => {
    const basic = (color: string, opacity: number, additive = false) =>
      new MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
        blending: additive ? AdditiveBlending : undefined,
      });
    const disc = new CircleGeometry(1, 64);
    disc.rotateX(-Math.PI / 2);
    const edge = new RingGeometry(0.97, 1, 96);
    edge.rotateX(-Math.PI / 2);
    const markerRing = new RingGeometry(0.88, 1, 40);
    markerRing.rotateX(-Math.PI / 2);
    const markerFill = new CircleGeometry(1, 32);
    markerFill.rotateX(-Math.PI / 2);
    return {
      disc,
      edge,
      wall: new CylinderGeometry(1, 1, 5, 96, 1, true),
      markerRing,
      markerFill,
      shell: new CylinderGeometry(0.1, 0.16, 0.9, 8),
      discMat: basic("#ff1a12", 0.18),
      edgeMat: basic("#ff3b2a", 0.9, true),
      wallMat: basic("#ff2014", 0.12, true),
      markerRingMat: basic("#ff4a2a", 0.9, true),
      markerFillMat: basic("#ff2a14", 0.28, true),
      shellMat: new MeshBasicMaterial({ color: "#ffb36b", toneMapped: false }),
    };
  }, []);

  useEffect(
    () => () => {
      Object.values(assets).forEach((a) => a.dispose());
    },
    [assets]
  );

  useLayoutEffect(() => {
    [markerRingRef, markerFillRef, shellRef].forEach((r) => {
      if (r.current) r.current.count = 0;
    });
  }, []);

  const resetDirector = () => {
    phaseRef.current = "idle";
    timerRef.current = 0;
    cooldownRef.current = rand(18, 26);
    bombAccRef.current = 0;
  };

  const publish = (phase: "idle" | "warning" | "bombing", secondsLeft: number) => {
    const s = getState();
    const zone = zoneRef.current;
    if (s.redZonePhase !== phase || s.redZoneSecondsLeft !== secondsLeft) {
      s.setRedZone({
        redZonePhase: phase,
        redZoneSecondsLeft: secondsLeft,
        redZoneCenter: [zone.x, zone.z],
        redZoneRadius: phase === "idle" ? 0 : zone.r,
      });
    }
  };

  const pickZone = () => {
    const s = getState();
    const limit = GAME_CONSTANTS.HALF_MAP_SIZE - 4;
    const playableR = s.safeZoneActive ? s.safeZoneRadius : limit;
    const [cx, cz] = s.safeZoneActive ? s.safeZoneCenter : [0, 0];
    const r = Math.min(
      rand(GAME_CONSTANTS.RED_ZONE_MIN_RADIUS, GAME_CONSTANTS.RED_ZONE_MAX_RADIUS),
      Math.max(5, playableR * 0.8)
    );

    let x: number;
    let z: number;
    const a = Math.random() * Math.PI * 2;
    if (Math.random() < 0.55) {
      // Often land it on top of the player so they have to relocate
      const d = Math.sqrt(Math.random()) * r * 0.7;
      x = s.playerTankPosition[0] + Math.cos(a) * d;
      z = s.playerTankPosition[2] + Math.sin(a) * d;
    } else {
      const d = Math.sqrt(Math.random()) * Math.max(0, playableR - r * 0.5);
      x = cx + Math.cos(a) * d;
      z = cz + Math.sin(a) * d;
    }
    zoneRef.current = {
      x: Math.max(-limit, Math.min(limit, x)),
      z: Math.max(-limit, Math.min(limit, z)),
      r,
    };
  };

  const tickDirector = (delta: number) => {
    const s = getState();
    if (s.level < GAME_CONSTANTS.RED_ZONE_ACTIVATION_LEVEL) {
      if (phaseRef.current !== "idle" || s.redZonePhase !== "idle") {
        resetDirector();
        publish("idle", 0);
      }
      return;
    }

    timerRef.current -= delta;

    switch (phaseRef.current) {
      case "idle":
        // Bosses bring their own artillery
        if (s.bossActive || s.bossIncoming) return;
        cooldownRef.current -= delta;
        if (cooldownRef.current <= 0) {
          pickZone();
          phaseRef.current = "warning";
          timerRef.current = GAME_CONSTANTS.RED_ZONE_WARNING_DURATION;
          SoundManager.setVolume("redZoneSiren", 0.7);
          SoundManager.play("redZoneSiren");
        }
        break;
      case "warning":
        if (timerRef.current <= 0) {
          phaseRef.current = "bombing";
          timerRef.current = GAME_CONSTANTS.RED_ZONE_BOMBING_DURATION;
          bombAccRef.current = 0;
        }
        break;
      case "bombing": {
        const rate = Math.min(5, 2.4 + s.level * 0.05);
        bombAccRef.current += delta * rate;
        const zone = zoneRef.current;
        const damage = GAME_CONSTANTS.RED_ZONE_BOMB_BASE_DAMAGE + s.level * 0.6;
        while (bombAccRef.current >= 1) {
          bombAccRef.current -= 1;
          const a = Math.random() * Math.PI * 2;
          const d = Math.sqrt(Math.random()) * zone.r;
          bombardment.drop(zone.x + Math.cos(a) * d, zone.z + Math.sin(a) * d, {
            fallTime: GAME_CONSTANTS.RED_ZONE_BOMB_FALL_TIME * rand(0.9, 1.25),
            radius: GAME_CONSTANTS.RED_ZONE_BOMB_RADIUS,
            damage,
            source: "redZone",
          });
        }
        if (timerRef.current <= 0) {
          phaseRef.current = "idle";
          cooldownRef.current = nextCooldown(s.level);
        }
        break;
      }
    }

    publish(phaseRef.current, phaseRef.current === "idle" ? 0 : Math.ceil(timerRef.current));
  };

  const resolveBombs = (delta: number) => {
    const s = getState();
    const bombs = bombardment.active;
    const [px, , pz] = s.playerTankPosition;

    for (let i = bombs.length - 1; i >= 0; i--) {
      const b = bombs[i];
      b.age += delta;
      const d = Math.hypot(px - b.x, pz - b.z);

      if (!b.whistled && b.age >= b.fallTime - 1.0) {
        b.whistled = true;
        if (d < 18) {
          SoundManager.playSpatial("bombWhistle", 0.6, d, 90);
        }
      }

      if (b.age < b.fallTime) continue;

      fx.blast(b.x, 0.3, b.z, b.radius * 1.15);
      SoundManager.playSpatial("bombBlast", 0.95, d, 35);

      const hitRange = b.radius + GAME_CONSTANTS.TANK_RADIUS * 0.5;
      if (d < hitRange) {
        s.takeDamage(Math.round(b.damage * (1 - 0.5 * (d / hitRange))));
      }

      // Red zone shells don't pick sides
      if (b.source === "redZone") {
        for (const enemy of s.enemies) {
          if (enemy.type === "boss") continue;
          const at = getEnemyVisualPosition(enemy.id) ?? enemy.position;
          if (Math.hypot(at[0] - b.x, at[2] - b.z) < b.radius + 1) {
            s.damageEnemy(enemy.id, b.damage * 4);
          }
        }
      }

      bombs[i] = bombs[bombs.length - 1];
      bombs.pop();
    }
  };

  const drawBombs = () => {
    const ringMesh = markerRingRef.current;
    const fillMesh = markerFillRef.current;
    const shellMesh = shellRef.current;
    if (!ringMesh || !fillMesh || !shellMesh) return;

    const bombs = bombardment.active;
    for (let i = 0; i < bombs.length; i++) {
      const b = bombs[i];
      const p = Math.min(1, b.age / b.fallTime);

      dummy.rotation.set(0, 0, 0);
      dummy.position.set(b.x, 0.08, b.z);
      dummy.scale.setScalar(b.radius);
      dummy.updateMatrix();
      ringMesh.setMatrixAt(i, dummy.matrix);

      dummy.position.y = 0.07;
      dummy.scale.setScalar(Math.max(0.01, b.radius * p));
      dummy.updateMatrix();
      fillMesh.setMatrixAt(i, dummy.matrix);

      dummy.position.set(b.x, 0.4 + SHELL_DROP_HEIGHT * (1 - p * p), b.z);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      shellMesh.setMatrixAt(i, dummy.matrix);
    }
    ringMesh.count = fillMesh.count = shellMesh.count = bombs.length;
    ringMesh.instanceMatrix.needsUpdate = true;
    fillMesh.instanceMatrix.needsUpdate = true;
    shellMesh.instanceMatrix.needsUpdate = true;
  };

  const drawZone = () => {
    const group = zoneGroupRef.current;
    if (!group) return;
    const phase = phaseRef.current;
    group.visible = phase !== "idle";
    if (phase === "idle") return;

    const { x, z, r } = zoneRef.current;
    group.position.set(x, 0, z);
    group.scale.set(r, 1, r);
    const t = elapsedRef.current;
    const pulse = 0.5 + 0.5 * Math.sin(t * (phase === "warning" ? 7 : 3));
    assets.discMat.opacity = phase === "warning" ? 0.08 + pulse * 0.16 : 0.2 + pulse * 0.08;
    assets.edgeMat.opacity = 0.55 + pulse * 0.45;
    assets.wallMat.opacity = phase === "warning" ? 0.05 + pulse * 0.1 : 0.12;
  };

  useFrame((_, rawDelta) => {
    const s = getState();
    if (!s.isGameStarted || s.isPaused || s.isGameOver) return;
    const delta = Math.min(rawDelta, 0.1);
    elapsedRef.current += delta;

    tickDirector(delta);
    resolveBombs(delta);
    drawBombs();
    drawZone();
  });

  return (
    <>
      <group ref={zoneGroupRef} visible={false}>
        <mesh ref={zoneDiscRef} position={[0, 0.05, 0]} geometry={assets.disc} material={assets.discMat} renderOrder={3} />
        <mesh ref={zoneEdgeRef} position={[0, 0.06, 0]} geometry={assets.edge} material={assets.edgeMat} renderOrder={3} />
        <mesh ref={zoneWallRef} position={[0, 2.5, 0]} geometry={assets.wall} material={assets.wallMat} renderOrder={6} />
      </group>
      <instancedMesh
        ref={markerRingRef}
        args={[assets.markerRing, assets.markerRingMat, MAX_BOMBS]}
        frustumCulled={false}
        renderOrder={4}
      />
      <instancedMesh
        ref={markerFillRef}
        args={[assets.markerFill, assets.markerFillMat, MAX_BOMBS]}
        frustumCulled={false}
        renderOrder={4}
      />
      <instancedMesh
        ref={shellRef}
        args={[assets.shell, assets.shellMat, MAX_BOMBS]}
        frustumCulled={false}
      />
    </>
  );
};

export default RedZone;
