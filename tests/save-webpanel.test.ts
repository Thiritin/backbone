import { describe, expect, it } from "vitest";
import { newGame } from "../src/sim/50-state";
import { deserialize, serialize } from "../src/sim/91-save/save";

describe("web panel state in saves", () => {
  it("loads an old save without it with the defaults", () => {
    const raw = JSON.parse(serialize(newGame(1))) as Record<string, unknown>;
    delete raw.webpanel;
    const s = deserialize(JSON.stringify(raw));
    expect(s.webpanel).toEqual(newGame(1).webpanel);
  });

  it("round trips what the player set and fills later sub-fields", () => {
    const s = newGame(1);
    s.webpanel = { ...s.webpanel, phpPool: { clu1: ["5.2"] }, phpOf: { svc1: "5.2" } };
    const raw = JSON.parse(serialize(s)) as { webpanel: Record<string, unknown> };
    delete raw.webpanel.phpBroken;
    const back = deserialize(JSON.stringify(raw));
    expect(back.webpanel.phpPool).toEqual({ clu1: ["5.2"] });
    expect(back.webpanel.phpOf).toEqual({ svc1: "5.2" });
    expect(back.webpanel.phpBroken).toEqual({});
  });
});
