/**
 * Compiles shaders for visuals that only mount mid-fight (weapons, shells,
 * beams, pickups, arcs) right after the scene loads, so the first rocket or
 * laser does not stall a frame while the GPU compiles its program.
 */
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import {
  BoxGeometry,
  InstancedMesh,
  Material,
  Mesh,
  Scene,
  Sprite,
} from "three";
import { Line2, LineGeometry, LineMaterial } from "three-stdlib";
import { getBeamMaterials, getCoreGeometry, getCoreMaterial, getTrailGeometry, getTrailMaterial } from "./tracers";
import { getGlowMaterial } from "./glowMaterials";
import { getPickupAssets } from "../pickups/pickupAssets";
import { ROCKET_MATS, WEAPON_ACCENTS, WEAPON_MATS, getAccentMaterial } from "../weaponVisuals/weaponMaterials";

const ShaderWarmup = () => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const warm = new Scene();
    const box = new BoxGeometry(0.1, 0.1, 0.1);
    const add = (material: Material, instanced = false) => {
      warm.add(instanced ? new InstancedMesh(box, material, 1) : new Mesh(box, material));
    };

    for (const c of ["#fff1b8", "#ffd0c4", "#fff3e0", "#fff0c0"]) {
      add(getCoreMaterial(c), true);
      add(getCoreMaterial(c));
    }
    for (const c of ["#ffb648", "#ff3b2e", "#ff6a1a", "#2aa8ff", "#ffb83d"]) {
      warm.add(new InstancedMesh(getTrailGeometry(1, 0.3), getTrailMaterial(c), 1));
      warm.add(new Mesh(getTrailGeometry(1, 0.3), getTrailMaterial(c)));
    }
    warm.add(new Mesh(getCoreGeometry(), getCoreMaterial("#ffffff")));
    Object.values(getBeamMaterials(WEAPON_ACCENTS.laser)).forEach((m) => add(m));
    Object.values(ROCKET_MATS).forEach((m) => add(m));
    Object.values(WEAPON_MATS).forEach((m) => add(m));
    Object.values(getPickupAssets().material).forEach((m) => add(m));
    add(getAccentMaterial(WEAPON_ACCENTS.laser));
    warm.add(new Sprite(getGlowMaterial("#ffffff")));

    const lineMaterial = new LineMaterial({ color: 0xffffff, linewidth: 2, transparent: true });
    const lineGeometry = new LineGeometry();
    lineGeometry.setPositions([0, 0, 0, 1, 1, 1]);
    warm.add(new Line2(lineGeometry, lineMaterial));

    let cancelled = false;
    // Lights/fog come from the live scene so the programs match exactly
    gl.compileAsync(warm, camera, scene).catch(() => {
      /* best effort; materials still compile lazily on first use */
    }).finally(() => {
      if (cancelled) return;
      box.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
    });
    return () => {
      cancelled = true;
    };
  }, [gl, scene, camera]);

  return null;
};

export default ShaderWarmup;
