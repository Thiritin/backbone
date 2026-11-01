import { describe, expect, it } from "vitest";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { ALERT_KEYS } from "../src/sim/alerts";
import { registered, newGame } from "./fixtures";

describe("dock apps", () => {
  it("starts without Security in the dock and keeps the loans inside Finance", () => {
    const s = registered(newGame(1));
    expect(s.installed).not.toContain("Security");
    expect(s.installed).not.toContain("Bank");
    expect(ALERT_KEYS["event.loanMissed"]).toBe("Finance");
  });

  it("moves an old save's dock from Bank to Security", () => {
    const raw = JSON.parse(serialize(registered(newGame(1))));
    delete raw.registration;
    delete raw.arrived;
    raw.installed = [...raw.installed.filter((id: string) => id !== "Security"), "Bank"];
    const s = deserialize(JSON.stringify(raw));
    expect(s.installed).toContain("Security");
    expect(s.installed).not.toContain("Bank");
  });
});
