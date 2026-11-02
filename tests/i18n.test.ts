import { newGame } from "./fixtures";
import { describe, expect, it } from "vitest";
import { en, t } from "../src/i18n/en";
import { LANGS, loadLang, type Dict } from "../src/i18n/lang";
import { CYCLES } from "../src/sim/10-catalog/cycles";

const packs = import.meta.glob<{ default: Dict }>("../src/i18n/*/*.ts", { eager: true });
const params = (f: (p: never) => string) => new Set(String(f).match(/\bp\.\w+/g) ?? []);

describe("translations", () => {
  it("names every billing cycle", () => {
    expect(CYCLES.filter((c) => !en[`books.cycle.${c}`])).toEqual([]);
  });


  for (const l of Object.keys(LANGS).filter((l) => l !== "en")) {
    const dict: Dict = Object.assign({}, ...Object.entries(packs).filter(([p]) => p.includes(`/i18n/${l}/`)).map(([, m]) => m.default));

    it(`${l} only has keys English has`, () => {
      expect(Object.keys(dict).filter((k) => !en[k])).toEqual([]);
    });

    it(`${l} uses only the parameters English passes`, () => {
      const bad = Object.entries(dict).filter(([k, f]) => [...params(f)].some((x) => !params(en[k]).has(x)));
      expect(bad.map(([k]) => k)).toEqual([]);
    });

    it(`${l} renders every entry`, () => {
      const sample = { n: 2, count: 2, amount: 10, name: "X", month: 0, year: 2005 };
      const renders = (f: Dict[string]) => { try { return typeof f(sample) === "string"; } catch { return false; } };
      const broken = Object.entries(dict).filter(([k, f]) => renders(en[k]) && !renders(f));
      expect(broken.map(([k]) => k)).toEqual([]);
    });
  }
});

it("switches the language t() reads", async () => {
  await loadLang("de");
  expect(t("event.review.title")).toBe("Neue Bewertung");
  await loadLang("en");
  expect(t("event.review.title")).toBe(en["event.review.title"]({}));
});

it("defines every key the code passes to t()", () => {
  const files = import.meta.glob<string>(["../src/**/*.ts", "../src/**/*.tsx", "!../src/i18n/**"], { eager: true, query: "?raw", import: "default" });
  const used = new Set(Object.values(files).flatMap((src) => [...src.matchAll(/\bt\("([\w.-]+)"/g)].map((m) => m[1])));
  expect([...used].filter((k) => !en[k])).toEqual([]);
});

it("names the starting basement in the player's language", async () => {
  await loadLang("de");
  expect(newGame(1).locations[0].name).toBe("Keller");
  await loadLang("en");
  expect(newGame(1).locations[0].name).toBe("Basement");
});
