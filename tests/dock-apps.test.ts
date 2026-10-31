import { describe, expect, it } from "vitest";
import { newGame } from "../src/sim/50-state";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { ALERT_KEYS } from "../src/sim/alerts";
import { registered } from "./fixtures";
import { setDocked } from "../src/sim/90-actions/docs";
import { appFor } from "../src/ui/apps/registry";

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

  it("docks Chat in new and old saves, renames it by year and lets it leave the dock", () => {
    const s = registered(newGame(1));
    expect(s.installed).toContain("Chat");
    const raw = JSON.parse(serialize(s));
    raw.installed = raw.installed.filter((id: string) => id !== "Chat");
    expect(deserialize(JSON.stringify(raw)).installed).toContain("Chat");
    expect(appFor(s, "Chat").name).toBe("ICU");
    expect(appFor({ ...s, hour: s.hour + 24 * 365 * 4 }, "Chat").name).toBe("Skipe");
    expect(appFor({ ...s, hour: s.hour + 24 * 365 * 12 }, "Chat").name).toBe("Diskord");
    expect(setDocked(s, "Chat", false).ok).toBe(true);
    expect(s.undocked).toContain("Chat");
  });
});
