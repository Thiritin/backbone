import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { en } from "../src/i18n/en";
import { PROFILES } from "../src/sim/10-catalog/economy";

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(join(dir, d.name)) : d.name.endsWith(".ts") ? [join(dir, d.name)] : []));

describe("event keys", () => {
  it("every literal event key the sim emits has a title and a text", () => {
    const keys = new Set(files("src/sim").flatMap((f) => [...readFileSync(f, "utf8").matchAll(/key: "(event\.[A-Za-z.]+)"/g)].map((m) => m[1])));
    const missing = [...keys].filter((k) => !en[`${k}.title`] || !en[`${k}.text`]);
    expect(missing).toEqual([]);
  });

  it("every customer profile has a usage line for its first email", () => {
    expect(PROFILES.filter((p) => !en[`request.use.${p.id}`]).map((p) => p.id)).toEqual([]);
  });
});
