import { describe, expect, it } from "vitest";
import { en } from "../src/i18n/en";
import { SKILLS } from "../src/sim/10-catalog/research";
import { PROFILES } from "../src/sim/10-catalog/economy";
import { SITES } from "../src/sim/10-catalog/sites";
import { LINE_NAME, specText } from "../src/sim/30-market/spec";

describe("catalog text", () => {
  it("reads from the dictionary", () => {
    for (const s of SKILLS) expect([s.name, s.about]).toEqual([en[`sim.skill.${s.id}.name`]({}), en[`sim.skill.${s.id}.about`]({})]);
    for (const p of PROFILES) expect(p.name).toBe(en[`sim.profile.${p.id}.name`]({}));
    for (const [id, site] of Object.entries(SITES)) {
      expect(site.tagline).toBe(en[`sim.site.${id}.tagline`]({}));
      expect(site.features.every((f) => !f.startsWith("sim."))).toBe(true);
    }
    expect(LINE_NAME.webHosting).toBe("Web hosting");
  });

  it("writes spec lines with plurals", () => {
    expect(specText("dns", { zones: 1 } as never)).toBe("DNS hosting, 1 zone");
  });
});
