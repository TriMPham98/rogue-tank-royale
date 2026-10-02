import React, { useRef, useEffect, useMemo } from "react";
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  Vector3,
} from "three";
import { useFrame } from "@react-three/fiber";
import { useGameState } from "../utils/gameState";
import {
  PLAYER_TANK_PARTS,
  TRACK_BLUEPRINT_PARTS,
  TURRET_OFFSET,
  type TankPart,
} from "../models/tankVisuals/playerTankParts";

// Animation states
export enum AnimState {
  IDLE, // Fully assembled, not moving
  ASSEMBLING_LOOP, // Original assembling -> rotating loop
  ROTATING, // Looping rotation
  PAUSED, // Looping pause
  ASSEMBLING_ONCE, // DEPRECATED (Assemble once and then stop)
  ASSEMBLING_TRANSITION,
  ROTATING_TRANSITION,
  PAUSED_TRANSITION,
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Seconds for one assembly pass and one display rotation. */
const ASSEMBLY_SPEED = 0.25;
const ROTATION_SPEED = 0.25;
/** Fraction of the build timeline each part spends flying in. */
const PART_FLIGHT = 0.2;

interface TankWireframeProps {
  animationMode?: AnimState;
  onAnimationComplete?: (finalState: AnimState) => void;
}

interface BlueprintPart {
  part: TankPart;
  target: Vector3;
  from: Vector3;
  geometry: BufferGeometry;
  accent: boolean;
}

/** Every part flies in from outside along the direction it sits from the hull centre. */
const buildBlueprint = (): BlueprintPart[] =>
  [...TRACK_BLUEPRINT_PARTS, ...PLAYER_TANK_PARTS].map((part) => {
    const offset = part.group === "hull" ? [0, 0, 0] : TURRET_OFFSET;
    const target = new Vector3(
      part.pos[0] + offset[0],
      part.pos[1] + offset[1],
      part.pos[2] + offset[2]
    );
    const out = new Vector3(target.x, 0, target.z);
    if (out.lengthSq() < 0.01) out.set(0, 0, 1);
    out.normalize();
    // Everything drops in from above and slightly outward, so no piece
    // sweeps through the camera (which sits ~10 units off the hull's side)
    const from =
      part.group === "hull"
        ? target.clone().addScaledVector(out, 3).add(new Vector3(0, 12, 0))
        : target.clone().addScaledVector(out, 2).add(new Vector3(0, 18, 0));
    const solid =
      part.kind === "box"
        ? new BoxGeometry(...part.size)
        : new CylinderGeometry(part.rTop, part.rBottom, part.h, Math.min(part.seg, 12));
    const geometry = new EdgesGeometry(solid, 20);
    solid.dispose();
    return {
      part,
      target,
      from,
      geometry,
      accent: part.mat === "accent" || part.mat === "optic" || part.mat === "headlight",
    };
  });

/**
 * Start-screen blueprint of the player tank, built from the same parts list as
 * the in-game mesh so the assembly always matches what you drive.
 */
const TankWireframe: React.FC<TankWireframeProps> = ({
  animationMode = AnimState.ASSEMBLING_LOOP,
  onAnimationComplete,
}) => {
  const tankRef = useRef<Group>(null);
  const partRefs = useRef<(Group | null)[]>([]);
  const groundRingRef = useRef<Mesh>(null);
  const stateRef = useRef<AnimState>(animationMode);
  const progressRef = useRef(0);
  const rotationRef = useRef(0);
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(onAnimationComplete);
  onCompleteRef.current = onAnimationComplete;

  const blueprint = useMemo(buildBlueprint, []);
  const materials = useMemo(
    () => ({
      line: new LineBasicMaterial({
        color: "#5fdc5f",
        transparent: true,
        opacity: 0.85,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
      accent: new LineBasicMaterial({
        color: "#7ff6ff",
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
      ring: new MeshBasicMaterial({
        color: "#5fdc5f",
        transparent: true,
        opacity: 0.35,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
      ringGeometry: new RingGeometry(1.9, 2.0, 64),
    }),
    []
  );

  useEffect(
    () => () => {
      blueprint.forEach((b) => b.geometry.dispose());
      Object.values(materials).forEach((m) => m.dispose());
    },
    [blueprint, materials]
  );

  // Reset whenever the requested mode changes
  useEffect(() => {
    stateRef.current = animationMode;
    rotationRef.current = 0;
    progressRef.current =
      animationMode === AnimState.IDLE || animationMode === AnimState.PAUSED ? 1 : 0;
    return () => {
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    };
  }, [animationMode]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const state = stateRef.current;

    switch (state) {
      case AnimState.ASSEMBLING_LOOP:
      case AnimState.ASSEMBLING_ONCE:
      case AnimState.ASSEMBLING_TRANSITION: {
        progressRef.current = Math.min(1, progressRef.current + delta * ASSEMBLY_SPEED);
        if (progressRef.current >= 1) {
          if (state === AnimState.ASSEMBLING_LOOP) {
            stateRef.current = AnimState.ROTATING;
          } else {
            stateRef.current = AnimState.IDLE;
            if (state === AnimState.ASSEMBLING_TRANSITION) {
              useGameState.setState({ isWireframeAssembled: true });
            }
            onCompleteRef.current?.(AnimState.IDLE);
          }
        }
        break;
      }
      case AnimState.ROTATING:
      case AnimState.ROTATING_TRANSITION: {
        rotationRef.current += delta * ROTATION_SPEED;
        if (rotationRef.current >= Math.PI * 2) {
          rotationRef.current = 0;
          const looping = state === AnimState.ROTATING;
          stateRef.current = looping ? AnimState.PAUSED : AnimState.PAUSED_TRANSITION;
          pauseTimeoutRef.current = setTimeout(
            () => {
              if (looping && stateRef.current === AnimState.PAUSED) {
                progressRef.current = 0;
                stateRef.current = AnimState.ASSEMBLING_LOOP;
              } else if (!looping) {
                stateRef.current = AnimState.IDLE;
                onCompleteRef.current?.(AnimState.IDLE);
              }
            },
            looping ? 1000 : 500
          );
        }
        break;
      }
    }

    const current = stateRef.current;
    const progress = current === AnimState.IDLE ? 1 : progressRef.current;

    blueprint.forEach((b, i) => {
      const group = partRefs.current[i];
      if (!group) return;
      const local = Math.max(0, Math.min(1, (progress - b.part.step) / PART_FLIGHT));
      const e = easeOutCubic(local);
      group.position.lerpVectors(b.from, b.target, e);
      group.visible = local > 0;
    });

    if (tankRef.current) {
      tankRef.current.rotation.y = current === AnimState.IDLE ? 0 : rotationRef.current;
      tankRef.current.scale.setScalar(current === AnimState.IDLE ? 1 : 1.5);
    }
    if (groundRingRef.current) {
      const pulse = 0.9 + Math.sin(performance.now() / 400) * 0.1;
      groundRingRef.current.scale.setScalar(progress * pulse + 0.001);
      materials.ring.opacity = 0.15 + progress * 0.25;
    }
  });

  return (
    <group ref={tankRef}>
      {blueprint.map((b, i) => (
        <group
          key={b.part.id}
          ref={(el) => {
            partRefs.current[i] = el;
          }}
          visible={false}>
          <lineSegments
            geometry={b.geometry}
            material={b.accent ? materials.accent : materials.line}
            rotation={b.part.rot ?? [0, 0, 0]}
          />
        </group>
      ))}
      <mesh
        ref={groundRingRef}
        geometry={materials.ringGeometry}
        material={materials.ring}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.56, 0]}
      />
    </group>
  );
};

export default TankWireframe;
