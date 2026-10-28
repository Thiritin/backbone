import { describe, expect, it } from "vitest";
import { inline, PAGES } from "../src/ui/desktop/intro-text";

describe("intro text", () => {
  it("splits the doc into its pages", () => {
    expect(PAGES.map((p) => p.title)).toEqual(["Welcome", "Pear One", "Your apps", "Automate, then regret it", "Words you will meet", "Open source"]);
    expect(PAGES[2].blocks).toEqual([{ kind: "apps" }]);
    const table = PAGES[4].blocks.find((b) => b.kind === "table");
    expect(table?.kind === "table" && table.rows[0][0]).toEqual([{ text: "Region" }]);
  });

  it("parses bold, strike and the escaped asterisk", () => {
    expect(inline("a ~~x~~ **y** z.\\*")).toEqual([{ text: "a " }, { text: "x", style: "s" }, { text: " " }, { text: "y", style: "b" }, { text: " z." }, { text: "*" }]);
    expect(PAGES[1].blocks.some((b) => b.kind === "p" && b.fine)).toBe(true);
  });
});
