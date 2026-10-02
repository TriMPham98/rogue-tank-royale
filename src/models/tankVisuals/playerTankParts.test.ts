import { describe, it, expect } from "vitest";
import {
  PLAYER_TANK_PARTS,
  TRACK_BLUEPRINT_PARTS,
  TURRET_OFFSET,
  MUZZLE_Z,
  BARREL_RECOIL,
  type TankPart,
} from "./playerTankParts";

type V = [number, number, number];

// Three.js Euler "XYZ": v' = Rx * Ry * Rz * v
const rotate = (v: V, [rx, ry, rz]: V): V => {
  let [x, y, z] = v;
  [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
  [x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
  [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
  return [x, y, z];
};
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: V): V => {
  const l = Math.hypot(...a);
  return [a[0] / l, a[1] / l, a[2] / l];
};

interface Face {
  part: string;
  normal: V;
  poly: V[];
}

/** Every planar face of a part in hull space (box sides, cylinder caps). */
const facesOf = (p: TankPart): Face[] => {
  const offset: V = p.group === "hull" ? [0, 0, 0] : TURRET_OFFSET;
  const rot = p.rot ?? [0, 0, 0];
  const toWorld = (v: V) => add(add(rotate(v, rot), p.pos), offset);
  const polys: V[][] = [];
  if (p.kind === "box") {
    const [hx, hy, hz] = p.size.map((s) => s / 2) as V;
    const c = (x: number, y: number, z: number): V => [x * hx, y * hy, z * hz];
    polys.push(
      [c(1, -1, -1), c(1, 1, -1), c(1, 1, 1), c(1, -1, 1)],
      [c(-1, -1, -1), c(-1, -1, 1), c(-1, 1, 1), c(-1, 1, -1)],
      [c(-1, 1, -1), c(-1, 1, 1), c(1, 1, 1), c(1, 1, -1)],
      [c(-1, -1, -1), c(1, -1, -1), c(1, -1, 1), c(-1, -1, 1)],
      [c(-1, -1, 1), c(1, -1, 1), c(1, 1, 1), c(-1, 1, 1)],
      [c(-1, -1, -1), c(-1, 1, -1), c(1, 1, -1), c(1, -1, -1)]
    );
  } else {
    for (const [y, r] of [
      [p.h / 2, p.rTop],
      [-p.h / 2, p.rBottom],
    ] as const) {
      const ring: V[] = [];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        ring.push([Math.cos(a) * r, y, Math.sin(a) * r]);
      }
      polys.push(ring);
    }
  }
  return polys.map((local) => {
    const poly = local.map(toWorld);
    const normal = norm(cross(sub(poly[1], poly[0]), sub(poly[2], poly[0])));
    return { part: p.id, normal, poly };
  });
};

/** Separating-axis overlap of two convex polygons lying in the same plane. */
const overlapArea = (a: V[], b: V[], n: V): boolean => {
  const u = norm(Math.abs(n[0]) < 0.9 ? cross(n, [1, 0, 0]) : cross(n, [0, 1, 0]));
  const w = cross(n, u);
  const flat = (poly: V[]) => poly.map((v) => [dot(v, u), dot(v, w)] as [number, number]);
  const pa = flat(a);
  const pb = flat(b);
  for (const poly of [pa, pb]) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % poly.length];
      const axis = [y1 - y2, x2 - x1];
      const proj = (pts: [number, number][]) => pts.map(([x, y]) => x * axis[0] + y * axis[1]);
      const ra = proj(pa);
      const rb = proj(pb);
      const len = Math.hypot(axis[0], axis[1]);
      // Require real overlap (not just touching edges)
      if (Math.min(Math.max(...ra), Math.max(...rb)) - Math.max(Math.min(...ra), Math.min(...rb)) < 1e-3 * len) {
        return false;
      }
    }
  }
  return true;
};

const findZFighting = (list: readonly TankPart[]) => {
  const faces = list.flatMap(facesOf);
  const hits: string[] = [];
  for (let i = 0; i < faces.length; i++) {
    for (let j = i + 1; j < faces.length; j++) {
      const a = faces[i];
      const b = faces[j];
      if (a.part === b.part) continue;
      if (Math.abs(dot(a.normal, b.normal)) < 0.9999) continue;
      if (Math.abs(dot(a.normal, sub(b.poly[0], a.poly[0]))) > 1e-3) continue;
      if (overlapArea(a.poly, b.poly, a.normal)) hits.push(`${a.part} <-> ${b.part}`);
    }
  }
  return [...new Set(hits)];
};

describe("player tank parts", () => {
  it("has no coplanar overlapping faces (z-fighting)", () => {
    expect(findZFighting(PLAYER_TANK_PARTS)).toEqual([]);
  });

  it("blueprint tracks don't z-fight with the hull either", () => {
    expect(findZFighting([...PLAYER_TANK_PARTS, ...TRACK_BLUEPRINT_PARTS])).toEqual([]);
  });

  it("detects a deliberately coplanar pair (sanity check)", () => {
    const a: TankPart = { kind: "box", id: "a", group: "hull", size: [1, 1, 1], pos: [0, 0, 0], mat: "hull", step: 0 };
    const b: TankPart = { ...a, id: "b", pos: [0.5, 1, 0] };
    expect(findZFighting([a, b])).toEqual(["a <-> b"]);
  });

  it("keeps the recoiling barrel inside the mantlet (no phasing through the turret)", () => {
    const mantlet = PLAYER_TANK_PARTS.find((p) => p.id === "mantlet")!;
    if (mantlet.kind !== "box") throw new Error("mantlet should be a box");
    const front = mantlet.pos[2] + mantlet.size[2] / 2;
    const back = mantlet.pos[2] - mantlet.size[2] / 2;
    for (const p of PLAYER_TANK_PARTS.filter((part) => part.group === "barrel")) {
      if (p.kind !== "cyl") continue;
      for (const shift of [0, BARREL_RECOIL]) {
        const rear = p.pos[2] - p.h / 2 - shift;
        const fore = p.pos[2] + p.h / 2 - shift;
        // Never retracts past the back of the mantlet into open turret space
        expect(rear).toBeGreaterThan(back);
        if (rear < front) {
          // Whatever slides inside must fit within the mantlet's cross-section
          const r = Math.max(p.rTop, p.rBottom);
          expect(r).toBeLessThan(mantlet.size[0] / 2);
          expect(r).toBeLessThan(mantlet.size[1] / 2);
        }
        expect(fore).toBeGreaterThan(rear);
      }
    }
  });

  it("clears the hull when the turret traverses", () => {
    const lowestTurret = Math.min(
      ...PLAYER_TANK_PARTS.filter((p) => p.group !== "hull" && p.id !== "turretRing").map((p) => {
        const half = p.kind === "box" ? p.size[1] / 2 : p.rot ? Math.max(p.rTop, p.rBottom) : p.h / 2;
        return p.pos[1] - half + TURRET_OFFSET[1];
      })
    );
    const tallestHull = Math.max(
      ...PLAYER_TANK_PARTS.filter((p) => p.group === "hull").map((p) => {
        const half = p.kind === "box" ? p.size[1] / 2 : p.rot ? Math.max(p.rTop, p.rBottom) : p.h / 2;
        return p.pos[1] + half;
      })
    );
    expect(lowestTurret).toBeGreaterThan(tallestHull);
  });

  it("has unique ids, steps in range, and the muzzle at MUZZLE_Z", () => {
    const ids = PLAYER_TANK_PARTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    PLAYER_TANK_PARTS.forEach((p) => {
      expect(p.step).toBeGreaterThanOrEqual(0);
      expect(p.step).toBeLessThanOrEqual(0.8);
    });
    const muzzle = PLAYER_TANK_PARTS.find((p) => p.id === "muzzle")!;
    expect(muzzle.kind === "cyl" && muzzle.pos[2] + muzzle.h / 2).toBeCloseTo(2.87, 2);
    expect(MUZZLE_Z).toBeGreaterThan(2.87);
  });
});
