/**
 * Renders the pooled particle effects from fxSystem in five draw calls.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BoxGeometry,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  NormalBlending,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  Texture,
  UniformsLib,
  UniformsUtils,
} from "three";
import { useGameState } from "../../utils/gameState";
import { ParticlePool, clearAllFx, pools, updateFx } from "./fxSystem";
import { getPuffTexture, getScorchTexture } from "./fxTextures";

type Shape = "glow" | "puff" | "ring" | "scorch";

const VERTEX = /* glsl */ `
  attribute vec3 iPos;
  attribute vec4 iColor;
  attribute vec2 iSizeRot;
  attribute vec4 iVel;
  varying vec2 vUv;
  varying vec4 vColor;
  #include <fog_pars_vertex>
  void main() {
    vUv = position.xy + 0.5;
    vColor = iColor;
    float size = iSizeRot.x;
    float c = cos(iSizeRot.y);
    float s = sin(iSizeRot.y);
    vec2 q = vec2(c * position.x - s * position.y, s * position.x + c * position.y) * size;
  #ifdef FLAT
    vec4 mvPosition = viewMatrix * vec4(iPos + vec3(q.x, 0.0, q.y), 1.0);
  #else
    vec4 mvPosition = viewMatrix * vec4(iPos, 1.0);
    if (iVel.w > 0.0) {
      vec3 vv = (viewMatrix * vec4(iVel.xyz, 0.0)).xyz;
      float l = length(vv.xy);
      vec2 ay = l > 1e-4 ? vv.xy / l : vec2(0.0, 1.0);
      vec2 ax = vec2(ay.y, -ay.x);
      q = ax * position.x * size + ay * position.y * size * (1.0 + iVel.w * l * 6.0);
    }
    mvPosition.xy += q;
  #endif
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  varying vec2 vUv;
  varying vec4 vColor;
  #include <fog_pars_fragment>
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    vec3 shade = vec3(1.0);
  #if SHAPE == 0
    float a = pow(max(1.0 - r, 0.0), 1.7) + smoothstep(0.4, 0.0, r) * 0.5;
  #elif SHAPE == 1
    vec4 t = texture2D(uMap, vUv);
    float a = t.a;
    shade = t.rgb;
  #elif SHAPE == 2
    float a = smoothstep(0.62, 0.9, r) * smoothstep(1.0, 0.93, r);
  #else
    float n = texture2D(uMap, vUv).r;
    float a = smoothstep(1.0, 0.25, r + (n - 0.5) * 0.55);
    shade = vec3(0.7 + n * 0.6);
  #endif
    vec4 col = vec4(vColor.rgb * shade, vColor.a * a);
    if (col.a < 0.004) discard;
  #ifdef USE_FOG
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    #ifdef ADDITIVE
      col.a *= 1.0 - fogFactor;
    #else
      col.rgb = mix(col.rgb, fogColor, fogFactor);
    #endif
  #endif
    gl_FragColor = col;
  }
`;

const SHAPE_ID: Record<Shape, number> = { glow: 0, puff: 1, ring: 2, scorch: 3 };

function createParticleMesh(
  pool: ParticlePool,
  shape: Shape,
  options: { additive: boolean; flat: boolean; map?: Texture | null; renderOrder: number }
): Mesh {
  const quad = new PlaneGeometry(1, 1);
  const geometry = new InstancedBufferGeometry();
  geometry.index = quad.index;
  geometry.setAttribute("position", quad.getAttribute("position"));
  const attr = (array: Float32Array, size: number) => {
    const a = new InstancedBufferAttribute(array, size);
    a.setUsage(DynamicDrawUsage);
    return a;
  };
  geometry.setAttribute("iPos", attr(pool.iPos, 3));
  geometry.setAttribute("iColor", attr(pool.iColor, 4));
  geometry.setAttribute("iSizeRot", attr(pool.iSizeRot, 2));
  geometry.setAttribute("iVel", attr(pool.iVel, 4));
  geometry.instanceCount = 0;

  const defines: Record<string, string | number> = { SHAPE: SHAPE_ID[shape] };
  if (options.flat) defines.FLAT = "";
  if (options.additive) defines.ADDITIVE = "";

  const material = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: UniformsUtils.merge([UniformsLib.fog, { uMap: { value: null } }]),
    defines,
    transparent: true,
    depthWrite: false,
    blending: options.additive ? AdditiveBlending : NormalBlending,
    fog: true,
    // Decals sit on the ground plane; bias them toward the camera instead of z-fighting
    polygonOffset: options.flat,
    polygonOffsetFactor: options.flat ? -2 : 0,
    polygonOffsetUnits: options.flat ? -2 : 0,
  });
  material.uniforms.uMap.value = options.map ?? null;

  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = options.renderOrder;
  return mesh;
}

function syncPool(mesh: Mesh, pool: ParticlePool): void {
  const geometry = mesh.geometry as InstancedBufferGeometry;
  geometry.instanceCount = pool.count;
  if (pool.count === 0) return;
  for (const [name, size] of [
    ["iPos", 3],
    ["iColor", 4],
    ["iSizeRot", 2],
    ["iVel", 4],
  ] as const) {
    const a = geometry.getAttribute(name) as InstancedBufferAttribute;
    a.updateRange.offset = 0;
    a.updateRange.count = pool.count * size;
    a.needsUpdate = true;
  }
}

const FxLayer = () => {
  const debrisRef = useRef<InstancedMesh>(null);
  const tmp = useMemo(() => new Object3D(), []);
  const getState = useRef(useGameState.getState).current;

  const meshes = useMemo(
    () => ({
      scorch: createParticleMesh(pools.scorch, "scorch", {
        additive: false,
        flat: true,
        map: getScorchTexture(),
        renderOrder: 1,
      }),
      ring: createParticleMesh(pools.ring, "ring", { additive: true, flat: true, renderOrder: 2 }),
      smoke: createParticleMesh(pools.smoke, "puff", {
        additive: false,
        flat: false,
        map: getPuffTexture(),
        renderOrder: 3,
      }),
      glow: createParticleMesh(pools.glow, "glow", { additive: true, flat: false, renderOrder: 4 }),
    }),
    []
  );

  const debrisGeometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const debrisMaterial = useMemo(
    () => new MeshStandardMaterial({ color: "#2b2622", roughness: 0.8, metalness: 0.4 }),
    []
  );

  useEffect(() => {
    // Effects from a previous run should not leak into a restart
    const unsubscribe = useGameState.subscribe((state, prev) => {
      if (prev.level > 1 && state.level === 1) clearAllFx();
    });
    return () => {
      unsubscribe();
      for (const m of Object.values(meshes)) {
        m.geometry.dispose();
        (m.material as ShaderMaterial).dispose();
      }
    };
  }, [meshes]);

  useFrame((_, delta) => {
    const { isPaused, isGameOver } = getState();
    if (!isPaused && !isGameOver) updateFx(delta);

    syncPool(meshes.scorch, pools.scorch);
    syncPool(meshes.ring, pools.ring);
    syncPool(meshes.smoke, pools.smoke);
    syncPool(meshes.glow, pools.glow);

    const debris = debrisRef.current;
    if (debris) {
      const d = pools.debris;
      for (let i = 0; i < d.count; i++) {
        const i3 = i * 3;
        const fade = Math.min(1, (d.life[i] - d.age[i]) / 0.4);
        tmp.position.set(d.pos[i3], d.pos[i3 + 1], d.pos[i3 + 2]);
        tmp.rotation.set(d.rot[i3], d.rot[i3 + 1], d.rot[i3 + 2]);
        tmp.scale.set(d.scale[i3] * fade, d.scale[i3 + 1] * fade, d.scale[i3 + 2] * fade);
        tmp.updateMatrix();
        debris.setMatrixAt(i, tmp.matrix);
      }
      debris.count = d.count;
      debris.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <primitive object={meshes.scorch} />
      <primitive object={meshes.ring} />
      <primitive object={meshes.smoke} />
      <primitive object={meshes.glow} />
      <instancedMesh
        ref={debrisRef}
        args={[debrisGeometry, debrisMaterial, pools.debris.capacity]}
        frustumCulled={false}
        castShadow
      />
    </>
  );
};

export default FxLayer;
