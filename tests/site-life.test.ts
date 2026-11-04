import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { lobbySlots } from "../src/sim/20-world/lobby";
import { REFIT } from "../src/sim/20-world/properties";
import { roomSize } from "../src/sim/20-world/layout";
import { lobbySeats as simLobby } from "../src/sim/60-infra/figures";
import { buyBuilding, refitSection } from "../src/sim/90-actions/properties";
import { SiteBack, SiteFront } from "../src/ui/world/site/Site";
import { lobbySeats, siteOf } from "../src/ui/world/site/layout";
import { buildSite } from "../src/ui/world/site/compound";
import { era, leafPhase, leafVars, seasonClasses, snowCover, snowStep } from "../src/ui/world/site/season";
import { newGame } from "./fixtures";

const at = (y: number, m: number, d: number) => hourOf(new Date(Date.UTC(y, m, d, 12)));

describe("leaf phase", () => {
  it("follows the ring by date", () => {
    expect(leafPhase(at(2010, 0, 15)).now).toBe("bare");
    expect(leafPhase(at(2010, 2, 10)).now).toBe("blossom");
    expect(leafPhase(at(2010, 4, 1)).now).toBe("fresh");
    expect(leafPhase(at(2010, 7, 1)).now).toBe("full");
    expect(leafPhase(at(2010, 9, 1)).now).toBe("autumn");
    expect(leafPhase(at(2010, 10, 10)).now).toBe("falling");
  });
  it("blends over the last 21 days of a palette", () => {
    expect(leafPhase(at(2010, 6, 1)).mix).toBe(0);
    const late = leafPhase(at(2010, 7, 30)).mix;
    expect(late).toBeGreaterThan(0.8);
    expect(late).toBeLessThanOrEqual(1);
    expect(leafPhase(at(2010, 1, 20)).now).toBe("bare");
    expect(leafPhase(at(2010, 1, 27)).mix).toBeGreaterThan(0.8);
  });
  it("hides the leaves in winter and shows them in summer", () => {
    expect(leafVars(at(2010, 0, 15))["--leaf-o"]).toBe(0);
    expect(leafVars(at(2010, 6, 15))["--leaf-o"]).toBe(1);
    expect(leafVars(at(2010, 6, 15))["--bare-o"]).toBe(0);
  });
});

describe("snow cover", () => {
  it("is deterministic and between 0 and 1", () => {
    for (let d = 0; d < 365; d += 7) {
      const h = at(2011, 0, 1) + d * 24, c = snowCover("Frankfurt", h);
      expect(c).toBe(snowCover("Frankfurt", h));
      expect(c >= 0 && c <= 1).toBe(true);
    }
  });
  it("lies in winter more than in summer and steps by cover", () => {
    let winter = 0, summer = 0;
    for (let d = 0; d < 28; d++) { winter += snowCover("Frankfurt", at(2011, 0, 1) + d * 24); summer += snowCover("Frankfurt", at(2011, 6, 1) + d * 24); }
    expect(winter).toBeGreaterThan(summer);
    expect(summer).toBe(0);
    expect([snowStep(0.1), snowStep(0.3), snowStep(0.6), snowStep(0.9)]).toEqual([0, 1, 2, 3]);
  });
  it("names season classes for the root", () => {
    expect(seasonClasses("Frankfurt", at(2011, 6, 15))).toBe("ws-summer");
    expect(seasonClasses("Frankfurt", at(2011, 9, 15))).toContain("ws-autumn");
  });
});

describe("element counts", () => {
  it("keeps every class under its cap with a full lot", () => {
    const CAP = { S: 900, M: 1200, L: 1500 } as const;
    for (const cls of ["S", "M", "L"] as const) {
      const sp = buildSite("business", cls, 4321, 20, 12, false, 3);
      const html = renderToStaticMarkup(createElement("svg", null, createElement(SiteBack, { s: sp, name: "Co", band: "red", month: 6, year: 2020 }), createElement(SiteFront, { s: sp, name: "Co", band: "red", year: 2020 })));
      expect((html.replace(/<defs>.*<\/defs>/g, "").match(/<[a-z]/g) ?? []).length, cls).toBeLessThanOrEqual(CAP[cls]);
    }
  });
});

describe("era", () => {
  it("shifts shapes by year", () => {
    expect([era(at(2006, 5, 1)), era(at(2015, 5, 1)), era(at(2022, 5, 1))]).toEqual(["boxy", "round", "electric"]);
  });
});

describe("lobby seats", () => {
  it("gives S 2, M 4 and L 6 chairs after the receptionist, clear of the door lane", () => {
    for (const [cls, n] of [["S", 2], ["M", 4], ["L", 6]] as const) {
      const slots = lobbySlots(cls, 10);
      expect(slots).toHaveLength(n + 1);
      for (const q of slots.slice(1)) expect(q.x < 3.4 || q.x > 4.8).toBe(true);
    }
  });
  it("seats the sim's overflow where the site draws the chairs", () => {
    const s = newGame(7);
    s.cash = 10_000_000;
    s.hour = hourOf(new Date(Date.UTC(2013, 2, 2, 10)));
    const r = buyBuilding(s, "gallushof");
    if (!r.ok) throw new Error(r.error);
    const p = s.properties.find((x) => x.id === r.id)!, h = refitSection(s, p.id, p.sections.find((x) => x.floor === 1)!.id, "hall");
    if (!h.ok) throw new Error(h.error);
    s.hour += 24 * REFIT.hall.days;
    const loc = s.locations.find((l) => l.id === h.id)!, size = roomSize(loc), sp = siteOf(s, loc, size.w, size.h);
    expect(simLobby(s, loc).map(({ x, y }) => [x + 0.5, y + 0.5])).toEqual(lobbySeats(sp).map(({ x, y }) => [x, y]));
    expect(simLobby(s, loc)).toHaveLength(2);
  });
});
