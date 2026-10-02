/**
 * Player tank geometry as data. One parts list drives three things:
 *  - the in-game mesh (PlayerTankMesh)
 *  - the start-screen blueprint assembly (TankWireframe)
 *  - a unit test that rejects coplanar overlapping faces (z-fighting)
 *
 * Coordinates are hull-local: +z forward, +y up. Turret parts are relative to
 * the turret ring (TURRET_OFFSET); barrel parts are relative to the turret and
 * slide back on recoil. Keep every face at least a few millimetres off any
 * other face it overlaps, or the test will flag it.
 *
 * Deliberately has no three.js / material imports so it can be tested in Node.
 */

export type PartGroup = "hull" | "turret" | "barrel";

export type TankMatKey =
  | "hull"
  | "hullDark"
  | "hullLight"
  | "turret"
  | "metal"
  | "darkMetal"
  | "barrel"
  | "rubber"
  | "glass"
  | "headlight"
  | "accent"
  | "hazard"
  // Per-instance animated materials owned by PlayerTankMesh
  | "optic"
  | "brake"
  | "flash";

type Vec3 = [number, number, number];

interface PartBase {
  id: string;
  group: PartGroup;
  pos: Vec3;
  rot?: Vec3;
  mat: TankMatKey;
  shadow?: boolean;
  /** Assembly start time on the 0..1 build timeline */
  step: number;
  /** Hidden in first-person view (turret shell would block the sight) */
  hideInFpv?: boolean;
}

export interface BoxPart extends PartBase {
  kind: "box";
  size: Vec3;
}

export interface CylPart extends PartBase {
  kind: "cyl";
  rTop: number;
  rBottom: number;
  h: number;
  seg: number;
}

export type TankPart = BoxPart | CylPart;

/** Turret ring position in hull space (matches the turret group in the mesh). */
export const TURRET_OFFSET: Vec3 = [0, 0.5, 0];
/** Barrel axis height in turret space. Tank.tsx spawns shells at y + 0.75. */
export const GUN_AXIS_Y = 0.25;
/** Muzzle distance from the turret centre; shells spawn here. */
export const MUZZLE_Z = 2.9;
/** How far the barrel group slides back at full recoil. */
export const BARREL_RECOIL = 0.38;

/** Track geometry shared with TrackAssembly so the blueprint matches the mesh. */
export const TRACK = {
  x: 0.88,
  y: -0.32,
  length: 2.46,
  roadWheels: 6,
} as const;

const HALF_PI = Math.PI / 2;
const ALONG_Z: Vec3 = [HALF_PI, 0, 0];
const ALONG_X: Vec3 = [0, 0, HALF_PI];

/** Sloped front plate: angle (rad, front edge down), centre, length, thickness. */
const GLACIS = { angle: 0.42, y: 0.2, z: 1.0, length: 0.78, thickness: 0.11 };

/** Point on the glacis top surface at `u` along its slope, raised `lift` off it. */
const onGlacis = (u: number, lift: number): Vec3 => {
  const n = GLACIS.thickness / 2 + lift;
  const c = Math.cos(GLACIS.angle);
  const sn = Math.sin(GLACIS.angle);
  return [0, GLACIS.y + n * c - u * sn, GLACIS.z + n * sn + u * c];
};

const parts: TankPart[] = [];
const box = (
  id: string,
  group: PartGroup,
  size: Vec3,
  pos: Vec3,
  mat: TankMatKey,
  step: number,
  extra: Partial<BoxPart> = {}
) => parts.push({ kind: "box", id, group, size, pos, mat, step, shadow: true, ...extra });
const cyl = (
  id: string,
  group: PartGroup,
  r: number | [number, number],
  h: number,
  pos: Vec3,
  mat: TankMatKey,
  step: number,
  extra: Partial<CylPart> = {}
) => {
  const [rTop, rBottom] = typeof r === "number" ? [r, r] : r;
  parts.push({ kind: "cyl", id, group, rTop, rBottom, h, seg: 14, pos, mat, step, shadow: true, ...extra });
};
const mirror = (fn: (side: 1 | -1, tag: string) => void) => {
  fn(-1, "l");
  fn(1, "r");
};

// ---------------------------------------------------------------------------
// Hull
// ---------------------------------------------------------------------------
// Upper hull sits high so the turret ring is a short collar, not a neck
box("lowerHull", "hull", [1.3, 0.36, 2.3], [0, -0.12, 0], "hullDark", 0);
box("upperHull", "hull", [1.86, 0.32, 1.84], [0, 0.21, -0.18], "hull", 0.04);
box("glacis", "hull", [1.8, GLACIS.thickness, GLACIS.length], [0, GLACIS.y, GLACIS.z], "hull", 0.08, {
  rot: [GLACIS.angle, 0, 0],
});
box("noseUndercut", "hull", [1.26, 0.24, 0.22], [0, -0.17, 1.24], "hullDark", 0.08, { rot: [-0.5, 0, 0] });
box("engineDeck", "hull", [1.6, 0.04, 0.76], [0, 0.385, -0.66], "hull", 0.34);
for (let i = 0; i < 6; i++) {
  box(`deckSlat${i}`, "hull", [1.32, 0.03, 0.05], [0, 0.415, -0.36 - i * 0.12], "darkMetal", 0.37, {
    shadow: false,
  });
}
box("rearPlate", "hull", [1.7, 0.32, 0.08], [0, 0.04, -1.145], "hullDark", 0.36);
mirror((s, t) => {
  box(`exhaust_${t}`, "hull", [0.4, 0.12, 0.03], [s * 0.45, 0.05, -1.198], "darkMetal", 0.4, { shadow: false });
  box(`taillight_${t}`, "hull", [0.12, 0.07, 0.03], [s * 0.74, 0.14, -1.197], "brake", 0.42, { shadow: false });
  // Headlights tucked under the glacis overhang
  box(`headlightHousing_${t}`, "hull", [0.16, 0.1, 0.07], [s * 0.62, -0.05, 1.27], "darkMetal", 0.4);
  box(`headlight_${t}`, "hull", [0.12, 0.07, 0.02], [s * 0.62, -0.05, 1.31], "headlight", 0.42, { shadow: false });
  cyl(`towFront_${t}`, "hull", 0.045, 0.14, [s * 0.42, -0.2, 1.33], "darkMetal", 0.44, { rot: ALONG_X, shadow: false });
  cyl(`towRear_${t}`, "hull", 0.045, 0.14, [s * 0.42, -0.14, -1.21], "darkMetal", 0.44, { rot: ALONG_X, shadow: false });

  // Fenders and segmented composite side skirts
  box(`fender_${t}`, "hull", [0.48, 0.035, 2.36], [s * 0.9, 0.085, -0.04], "hullDark", 0.28);
  [-0.88, -0.3, 0.28, 0.86].forEach((z, i) => {
    box(`skirt_${t}${i}`, "hull", [0.07, 0.3, 0.54], [s * 1.12, -0.08, z], "hull", 0.24 + i * 0.015);
  });
  box(`fenderBox_${t}`, "hull", [0.3, 0.13, 0.44], [s * 0.88, 0.17, -0.84], "hullLight", 0.4);

  // Glowing accent strip along the upper hull
  box(`hullAccent_${t}`, "hull", [0.012, 0.02, 1.6], [s * 0.94, 0.26, -0.1], "accent", 0.46, { shadow: false });
});

// Driver's hatch and vision blocks
cyl("driverHatch", "hull", 0.16, 0.04, [-0.34, 0.385, 0.5], "hullDark", 0.46);
[-0.46, -0.34, -0.22].forEach((x, i) => {
  box(`driverPeri${i}`, "hull", [0.08, 0.045, 0.04], [x, 0.395, 0.69], "glass", 0.48, { shadow: false });
});
// Spare track links bolted across the glacis
[-0.5, -0.25, 0, 0.25, 0.5].forEach((x, i) => {
  box(`spareLink${i}`, "hull", [0.2, 0.04, 0.14], onGlacis(0.08, 0.023), "rubber", 0.5, {
    rot: [GLACIS.angle, 0, 0],
  });
  // x is set after the fact: onGlacis only places along the slope
  parts[parts.length - 1].pos[0] = x;
});
cyl("unditchBeam", "hull", 0.06, 1.3, [0, 0.27, -1.27], "hullDark", 0.38, { rot: ALONG_X });

// ---------------------------------------------------------------------------
// Turret (relative to TURRET_OFFSET)
// ---------------------------------------------------------------------------
cyl("turretRing", "turret", 0.66, 0.17, [0, -0.04, 0], "metal", 0.5);
box("turretCore", "turret", [1.3, 0.48, 1.3], [0, 0.18, -0.12], "turret", 0.52, { hideInFpv: true });
mirror((s, t) => {
  // Arrowhead cheek armour
  box(`cheek_${t}`, "turret", [0.56, 0.45, 0.6], [s * 0.4, 0.185, 0.72], "turret", 0.56, {
    rot: [0, s * 0.52, 0],
    hideInFpv: true,
  });
  box(`turretAccent_${t}`, "turret", [0.012, 0.02, 1.0], [s * 0.658, 0.32, -0.2], "accent", 0.7, {
    shadow: false,
    hideInFpv: true,
  });
  box(`bustleRail_${t}`, "turret", [0.04, 0.2, 0.36], [s * 0.62, 0.3, -1.0], "darkMetal", 0.66, {
    shadow: false,
    hideInFpv: true,
  });
  cyl(`antenna_${t}`, "turret", [0.012, 0.02], 0.7, [s * 0.4, 0.937, -1.02], "metal", 0.8, {
    shadow: false,
    hideInFpv: true,
  });
  // Smoke grenade launchers on the cheeks, angled forward and out
  for (let i = 0; i < 4; i++) {
    cyl(`smoke_${t}${i}`, "turret", [0.035, 0.04], 0.14, [s * (0.5 + i * 0.045), 0.46, 0.24 - i * 0.06], "darkMetal", 0.74, {
      rot: [0.6, 0, s * -0.5],
      shadow: false,
      hideInFpv: true,
    });
  }
});
// Gun mantlet runs back to the turret face so the recoiling barrel always
// retracts into armour instead of passing through open space or poking out
box("mantlet", "turret", [0.46, 0.36, 0.56], [0, GUN_AXIS_Y, 0.812], "turret", 0.6, { hideInFpv: true });
box("bustle", "turret", [1.1, 0.32, 0.5], [0, 0.24, -0.98], "turret", 0.6, { hideInFpv: true });
box("bustleRailTop", "turret", [1.28, 0.03, 0.03], [0, 0.41, -1.2], "darkMetal", 0.66, { shadow: false, hideInFpv: true });
box("bustleTarp", "turret", [1.0, 0.18, 0.3], [0, 0.495, -1.0], "hullDark", 0.68, { hideInFpv: true });

// Gunner's primary sight with pulsing lens
box("gunnerSight", "turret", [0.26, 0.18, 0.34], [0.42, 0.505, 0.32], "hullDark", 0.72, { hideInFpv: true });
box("gunnerLens", "turret", [0.18, 0.1, 0.02], [0.42, 0.505, 0.495], "optic", 0.74, { shadow: false, hideInFpv: true });

// Commander's cupola, hatch and periscope ring
cyl("cupola", "turret", 0.2, 0.12, [0.28, 0.485, -0.3], "hullDark", 0.74, { hideInFpv: true });
cyl("cupolaHatch", "turret", 0.17, 0.03, [0.28, 0.562, -0.3], "metal", 0.76, { hideInFpv: true });
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2;
  box(`cupolaPeri${i}`, "turret", [0.07, 0.05, 0.035], [0.28 + Math.sin(a) * 0.205, 0.51, -0.3 + Math.cos(a) * 0.205], "glass", 0.78, {
    rot: [0, a, 0],
    shadow: false,
    hideInFpv: true,
  });
}

// Loader's hatch
cyl("loaderHatch", "turret", 0.16, 0.04, [-0.28, 0.445, -0.36], "hullDark", 0.76, { hideInFpv: true });

// Commander's independent panoramic sight on a mast
cyl("periMast", "turret", 0.05, 0.22, [-0.4, 0.535, 0.12], "darkMetal", 0.78, { hideInFpv: true });
box("periHead", "turret", [0.2, 0.16, 0.2], [-0.4, 0.73, 0.12], "hullDark", 0.8, { hideInFpv: true });
box("periLens", "turret", [0.12, 0.08, 0.02], [-0.4, 0.73, 0.225], "optic", 0.8, { shadow: false, hideInFpv: true });

// Remote weapon station with coax-style MG
cyl("rwsBase", "turret", 0.1, 0.1, [-0.05, 0.475, -0.6], "metal", 0.8, { hideInFpv: true });
box("rwsBody", "turret", [0.18, 0.14, 0.24], [-0.05, 0.6, -0.6], "hullDark", 0.8, { hideInFpv: true });
cyl("rwsGun", "turret", 0.02, 0.46, [-0.05, 0.61, -0.245], "darkMetal", 0.8, { rot: ALONG_Z, shadow: false, hideInFpv: true });

// ---------------------------------------------------------------------------
// Barrel (relative to turret; recoils along -z)
// ---------------------------------------------------------------------------
cyl("gunSleeve", "barrel", [0.13, 0.15], 0.4, [0, GUN_AXIS_Y, 1.15], "darkMetal", 0.62, { rot: ALONG_Z });
cyl("gunTube", "barrel", 0.085, 1.7, [0, GUN_AXIS_Y, 1.95], "barrel", 0.64, { rot: ALONG_Z });
cyl("fumeExtractor", "barrel", 0.12, 0.32, [0, GUN_AXIS_Y, 1.75], "barrel", 0.66, { rot: ALONG_Z });
[1.45, 2.25, 2.55].forEach((z, i) => {
  cyl(`sleeveBand${i}`, "barrel", 0.095, 0.03, [0, GUN_AXIS_Y, z], "darkMetal", 0.68, { rot: ALONG_Z, shadow: false });
});
box("muzzleSensor", "barrel", [0.04, 0.04, 0.06], [0, GUN_AXIS_Y + 0.11, 2.72], "metal", 0.7, { shadow: false });
cyl("muzzle", "barrel", 0.11, 0.14, [0, GUN_AXIS_Y, 2.8], "darkMetal", 0.7, { rot: ALONG_Z });

export const PLAYER_TANK_PARTS: readonly TankPart[] = parts;

/** Simplified track geometry for the blueprint view (the live mesh uses TrackAssembly). */
export const TRACK_BLUEPRINT_PARTS: readonly TankPart[] = (() => {
  const out: TankPart[] = [];
  for (const [s, t] of [
    [-1, "l"],
    [1, "r"],
  ] as const) {
    const x = s * TRACK.x;
    out.push({ kind: "box", id: `trackBelt_${t}`, group: "hull", size: [0.4, 0.34, TRACK.length], pos: [x, TRACK.y, 0], mat: "rubber", step: 0.12 });
    out.push({ kind: "box", id: `trackRun_${t}`, group: "hull", size: [0.42, 0.08, TRACK.length + 0.04], pos: [x, TRACK.y - 0.18, 0], mat: "rubber", step: 0.14 });
    const half = TRACK.length / 2;
    const zs = [half - 0.16, -half + 0.16];
    for (let i = 0; i < TRACK.roadWheels; i++) {
      zs.push(-half + 0.37 + (i + 0.5) * ((TRACK.length - 0.74) / TRACK.roadWheels));
    }
    zs.forEach((z, i) => {
      const r = i < 2 ? 0.15 : 0.13;
      out.push({ kind: "cyl", id: `wheel_${t}${i}`, group: "hull", rTop: r, rBottom: r, h: 0.44, seg: 12, pos: [x, TRACK.y, z], rot: ALONG_X, mat: "rubber", step: 0.16 + i * 0.008 });
    });
  }
  return out;
})();
