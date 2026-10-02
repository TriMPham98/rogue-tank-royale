/**
 * Instanced grass tufts (crossed alpha cards) with a gentle wind sway.
 * Purely decorative — no collision, no shadow casting.
 */
import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  ShaderChunk,
} from "three";
import { GAME_CONSTANTS } from "../../constants/game";
import { createGrassTexture } from "./groundTextures";
import { fbm2, seededRandom } from "./noise";

const INNER_COUNT = 2400;
const OUTER_COUNT = 900;
const PAD_CLEARANCE = 3.8;

function createTuftGeometry(): BufferGeometry {
  const w = 0.5;
  const h = 0.55;
  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  for (let q = 0; q < 3; q++) {
    const a = (q / 3) * Math.PI;
    const cx = Math.cos(a) * w;
    const cz = Math.sin(a) * w;
    const base = q * 4;
    positions.push(-cx, 0, -cz, cx, 0, cz, cx, h, cz, -cx, h, -cz);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  // Up-facing normals so cards shade like the terrain instead of flickering per facing
  g.setAttribute("normal", new Float32BufferAttribute(new Array(positions.length / 3).fill([0, 1, 0]).flat(), 3));
  g.setIndex(index);
  g.computeBoundingSphere();
  return g;
}

const GrassField = () => {
  const ref = useRef<InstancedMesh>(null);
  const geometry = useMemo(createTuftGeometry, []);
  const timeUniform = useMemo(() => ({ value: 0 }), []);

  const material = useMemo(() => {
    const map = createGrassTexture();
    const m = new MeshStandardMaterial({
      map: map ?? undefined,
      color: map ? "#ffffff" : "#5b7a34",
      alphaTest: 0.45,
      side: DoubleSide,
      roughness: 1,
      metalness: 0,
    });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = timeUniform;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           #ifdef USE_INSTANCING
             float phase = instanceMatrix[3].x * 0.35 + instanceMatrix[3].z * 0.27;
           #else
             float phase = 0.0;
           #endif
           float sway = sin(uTime * 1.6 + phase) * 0.07 + sin(uTime * 3.7 + phase * 1.7) * 0.025;
           transformed.x += sway * uv.y;
           transformed.z += sway * 0.6 * uv.y;`
        );
      // Both card faces keep the up-facing normal (no back-face darkening)
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_begin>",
        ShaderChunk.normal_fragment_begin.replace(
          "float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;",
          "float faceDirection = 1.0;"
        )
      );
    };
    return m;
  }, [timeUniform]);

  const placements = useMemo(() => {
    const rand = seededRandom(512);
    const half = GAME_CONSTANTS.HALF_MAP_SIZE;
    const out: Array<{ x: number; z: number; s: number; r: number; tone: number }> = [];
    let guard = 0;
    while (out.length < INNER_COUNT && guard++ < INNER_COUNT * 6) {
      const x = (rand() - 0.5) * (half * 2 - 1);
      const z = (rand() - 0.5) * (half * 2 - 1);
      if (Math.hypot(x, z) < PAD_CLEARANCE) continue;
      // Clump grass where the ground texture reads as grass, thin it on dirt
      const density = fbm2((x + half) * 0.045, (z + half) * 0.045, 3, 11);
      if (rand() > 1.15 - density) continue;
      out.push({ x, z, s: 0.4 + rand() * 0.55, r: rand() * Math.PI, tone: rand() });
    }
    for (let i = 0; i < OUTER_COUNT; i++) {
      const a = rand() * Math.PI * 2;
      const r = half + 3 + rand() * 22;
      const square = 1 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
      out.push({
        x: Math.cos(a) * r * Math.min(square, 1.2),
        z: Math.sin(a) * r * Math.min(square, 1.2),
        s: 0.6 + rand() * 0.8,
        r: rand() * Math.PI,
        tone: rand(),
      });
    }
    return out;
  }, []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const tmp = new Object3D();
    const c = new Color();
    const green = new Color("#a9c27e");
    const dry = new Color("#d2c894");
    placements.forEach((p, i) => {
      tmp.position.set(p.x, 0, p.z);
      tmp.rotation.set(0, p.r, 0);
      tmp.scale.set(p.s, p.s * (0.8 + p.tone * 0.5), p.s);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
      mesh.setColorAt(i, c.copy(green).lerp(dry, p.tone * p.tone));
    });
    mesh.count = placements.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [placements]);

  useFrame((_, delta) => {
    timeUniform.value += delta;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, INNER_COUNT + OUTER_COUNT]}
      receiveShadow
    />
  );
};

export default GrassField;
