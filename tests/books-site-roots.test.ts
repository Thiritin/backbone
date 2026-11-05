import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SITES = "src/ui/apps/browser/sites";
const ROOTS: Record<string, string> = {
  wrm: `${SITES}/books/wizo.css`,
  sg: `${SITES}/books/saga.css`,
  om: `${SITES}/books/orgamin.css`,
  lo: `${SITES}/books/lexoffize.css`,
  gn: `${SITES}/books/gnucache.css`,
  ed: `${SITES}/books/sevdeck.css`,
  kx: `${SITES}/books/collmix.css`,
  tw: `${SITES}/lexwear/lexwear.css`,
};
const SHARED = `${SITES}/books/books-vendors.css`;

const cssFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? cssFiles(join(dir, e.name)) : e.name.endsWith(".css") ? [join(dir, e.name)] : []));
const classes = (file: string) => {
  const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{[^{}]*\}/g, "{}");
  return [...css.matchAll(/\.([a-z][\w-]*)/g)].map((m) => m[1]);
};

describe("vendor site root classes", () => {
  const all = cssFiles("src/ui");

  it("every site sheet styles its own root prefix", () => {
    for (const [root, file] of Object.entries(ROOTS)) expect(classes(file), file).toContain(root);
  });

  it("prefixes are unique among the eight sites", () => {
    const roots = Object.keys(ROOTS);
    for (const a of roots) for (const b of roots) if (a !== b) expect(a.startsWith(`${b}-`) || a === b, `${a} vs ${b}`).toBe(false);
    expect(new Set(roots).size).toBe(roots.length);
  });

  it.each(Object.entries(ROOTS))("%s is not a selector in any other stylesheet", (root, own) => {
    const clash = all
      .filter((f) => f !== own && f !== SHARED)
      .filter((f) => classes(f).some((c) => c === root || c.startsWith(`${root}-`)));
    expect(clash).toEqual([]);
  });
});
