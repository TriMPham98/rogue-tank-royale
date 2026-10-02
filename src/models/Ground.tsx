import { useEffect, useMemo } from "react";
import { MeshStandardMaterial, Texture } from "three";
import { GAME_CONSTANTS } from "../constants/game";
import {
  createArenaGroundTexture,
  createGroundDetailTexture,
  createPadTexture,
} from "./environment/groundTextures";

/**
 * Multiplies albedo by the tiling detail map (reusing the bump map's UVs) at two
 * scales so the macro texture never reads as a stretched image up close.
 */
function addDetailBreakup(material: MeshStandardMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
       #ifdef USE_BUMPMAP
         float detailFine = texture2D(bumpMap, vBumpMapUv).r;
         float detailBroad = texture2D(bumpMap, vBumpMapUv * 0.11 + 0.37).r;
         diffuseColor.rgb *= mix(0.78, 1.16, detailFine) * mix(0.85, 1.12, detailBroad);
       #endif`
    );
  };
}

const ARENA = GAME_CONSTANTS.MAP_SIZE;

const Ground = () => {
  const textures = useMemo(() => {
    const detail = createGroundDetailTexture();
    const outerDetail = detail?.clone() ?? null;
    if (detail) detail.repeat.set(ARENA / 3.5, ARENA / 3.5);
    if (outerDetail) {
      outerDetail.repeat.set(600 / 3.5, 600 / 3.5);
      outerDetail.needsUpdate = true;
    }
    return {
      arena: createArenaGroundTexture(),
      detail,
      outerDetail,
      pad: createPadTexture(),
    };
  }, []);

  const arenaMaterial = useMemo(() => {
    const m = new MeshStandardMaterial({
      color: "#ffffff",
      map: textures.arena ?? undefined,
      bumpMap: textures.detail ?? undefined,
      bumpScale: 0.6,
      roughness: 0.95,
      metalness: 0,
    });
    if (!textures.arena) m.color.set("#4c6a2c");
    addDetailBreakup(m);
    return m;
  }, [textures]);

  const outerMaterial = useMemo(() => {
    const m = new MeshStandardMaterial({
      color: "#3c4a26",
      bumpMap: textures.outerDetail ?? undefined,
      bumpScale: 0.6,
      roughness: 1,
      metalness: 0,
    });
    addDetailBreakup(m);
    return m;
  }, [textures]);

  const padMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        map: textures.pad ?? undefined,
        color: textures.pad ? "#ffffff" : "#77746c",
        transparent: true,
        roughness: 0.85,
        metalness: 0.05,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    [textures]
  );

  useEffect(
    () => () => {
      for (const t of Object.values(textures)) (t as Texture | null)?.dispose();
      arenaMaterial.dispose();
      outerMaterial.dispose();
      padMaterial.dispose();
    },
    [textures, arenaMaterial, outerMaterial, padMaterial]
  );

  return (
    <group>
      {/* Playable arena */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={arenaMaterial} receiveShadow>
        <planeGeometry args={[ARENA, ARENA]} />
      </mesh>

      {/* Surrounding terrain so the arena never ends in a void */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.02, 0]}
        material={outerMaterial}
        receiveShadow>
        <planeGeometry args={[600, 600]} />
      </mesh>

      {/* Deployment pad at spawn */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 0]}
        material={padMaterial}
        receiveShadow>
        <circleGeometry args={[3.4, 48]} />
      </mesh>
    </group>
  );
};

export default Ground;
