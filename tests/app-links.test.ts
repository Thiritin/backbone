import { describe, expect, it } from "vitest";
import { newGame } from "../src/sim/50-state";
import { desktopFiles } from "../src/sim/60-infra/fs";
import { addAppLink, setDocked } from "../src/sim/90-actions/docs";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { registered } from "./fixtures";

describe("app links and dock", () => {
  it("takes an app out of the dock and back", () => {
    const s = registered(newGame(1));
    expect(setDocked(s, "Shop", false).ok).toBe(true);
    expect(s.undocked).toEqual(["Shop"]);
    setDocked(s, "Shop", true);
    expect(s.undocked).toEqual([]);
    expect(setDocked(s, "Nope", false).ok).toBe(false);
  });

  it("puts an app link on the desktop, outside the terminal's Desktop folder", () => {
    const s = registered(newGame(1));
    const { id } = addAppLink(s, "Shop") as { id: string };
    expect(s.docs.find((d) => d.id === id)).toMatchObject({ kind: "app", title: "Shop" });
    expect(desktopFiles(s).some((f) => f.doc.kind === "app")).toBe(false);
    expect(addAppLink(s, "Nope").ok).toBe(false);
  });

  it("gives old saves the Applications app and a full dock", () => {
    const raw = JSON.parse(serialize(registered(newGame(1))));
    delete raw.registration;
    raw.installed = raw.installed.filter((id: string) => id !== "Applications");
    delete raw.undocked;
    const s = deserialize(JSON.stringify(raw));
    expect(s.installed).toContain("Applications");
    expect(s.undocked).toEqual([]);
  });
});
