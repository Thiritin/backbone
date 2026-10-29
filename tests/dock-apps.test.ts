import { describe, expect, it } from "vitest";
import { newGame } from "../src/sim/50-state";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { ALERT_KEYS } from "../src/sim/alerts";

describe("dock apps", () => {
  it("starts with Security in the dock and the loans inside Finance", () => {
    const s = newGame(1);
    expect(s.installed).toContain("Security");
    expect(s.installed).not.toContain("Bank");
    expect(ALERT_KEYS["event.loanMissed"]).toBe("Finance");
  });

  it("moves an old save's dock from Bank to Security", () => {
    const raw = JSON.parse(serialize(newGame(1)));
    raw.installed = [...raw.installed.filter((id: string) => id !== "Security"), "Bank"];
    const s = deserialize(JSON.stringify(raw));
    expect(s.installed).toContain("Security");
    expect(s.installed).not.toContain("Bank");
  });
});
