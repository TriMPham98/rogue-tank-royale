import { describe, it, expect } from "vitest";
import { bossLoadout, bossHas } from "./bossLoadout";

describe("boss loadout", () => {
  it("starts with only a shotgun at level 10", () => {
    expect(bossLoadout(10)).toEqual(["shotgun"]);
  });

  it("adds the mortar at level 20", () => {
    expect(bossLoadout(20)).toEqual(["shotgun", "mortar"]);
  });

  it("stacks cannon, escort, then overdrive", () => {
    expect(bossLoadout(30)).toContain("cannon");
    expect(bossHas(30, "escort")).toBe(false);
    expect(bossHas(40, "escort")).toBe(true);
    expect(bossHas(40, "overdrive")).toBe(false);
    expect(bossLoadout(50)).toEqual(["shotgun", "mortar", "cannon", "escort", "overdrive"]);
    expect(bossLoadout(90)).toHaveLength(5);
  });
});
