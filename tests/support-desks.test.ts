import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { DESK_ROUTE, DESKS, deskHas, type DeskId } from "../src/sim/10-catalog/desks";
import { kindOf } from "../src/ui/apps/support/labels";
import { type GameState } from "../src/sim/50-state";
import { openDesk } from "../src/sim/40-support/desk";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { stepOf } from "../src/ui/apps/guide";
import { supportApp } from "../src/ui/apps/support/desk";
import { FreeScootMark, FreshduskMark, GoggleMark, IonoseMark, LookoutMark, GMixMark, OsTickitMark, PearMailMark, ZenduskMark } from "../src/ui/art/mailmarks";
import { registered, newGame } from "./fixtures";

const at = (y: number, m: number) => hourOf(new Date(Date.UTC(y, m - 1, 1)));
const year = (y: number): GameState => registered({ ...newGame(1), hour: at(y, 1), cash: 1_000_000 });
// The interface follows the desk in use, however it is hosted.
const install = (s: GameState, id: DeskId) => openDesk(s, id);

describe("support desks", () => {
  it("labels every ticket kind in the Support app", () => {
    for (const k of Object.keys(DESK_ROUTE) as (keyof typeof DESK_ROUTE)[]) expect(kindOf(k)?.label).toBeTruthy();
  });

  it("gates the interface by desk and year", () => {
    const s = year(2018);
    for (const f of ["filters", "search", "assign", "templates", "slaTimers", "customerSidebar", "reports"] as const) expect(deskHas(s, f)).toBe(false);
    install(s, "freescoot");
    expect(deskHas(s, "search")).toBe(true);
    expect(deskHas(s, "customerSidebar")).toBe(true);
    for (const f of ["templates", "reports", "slaTimers", "merge"] as const) expect(deskHas(s, f)).toBe(false);
    s.hour = at(2020, 1);
    expect(deskHas(s, "merge")).toBe(true);
    install(s, "zendusk");
    expect(deskHas(s, "reports")).toBe(true);

    const os = year(2005);
    install(os, "ostickit");
    for (const f of ["filters", "search", "assign", "templates", "departments", "portal"] as const) expect(deskHas(os, f)).toBe(true);
    for (const f of ["slaTimers", "reports", "rules", "customerSidebar", "merge"] as const) expect(deskHas(os, f)).toBe(false);
    os.hour = at(2013, 1);
    expect([deskHas(os, "slaTimers"), deskHas(os, "customerSidebar")]).toEqual([true, false]);
    os.hour = at(2019, 1);
    expect([deskHas(os, "customerSidebar"), deskHas(os, "merge")]).toEqual([true, true]);

    const zd = year(2007);
    install(zd, "zendusk");
    expect([deskHas(zd, "templates"), deskHas(zd, "slaTimers"), deskHas(zd, "merge")]).toEqual([true, false, false]);
    zd.hour = at(2013, 1);
    expect([deskHas(zd, "slaTimers"), deskHas(zd, "merge")]).toEqual([true, true]);
  });

  it("shows the app as Email with the provider's mark until a desk is installed", () => {
    const s = year(2012);
    expect(s.company.mail.kind).toBe("free");
    expect(supportApp(s)).toMatchObject({ name: "Email", brand: "GMix", icon: GMixMark, style: "gmix" });
    const mail = (m: GameState["company"]["mail"]) => supportApp({ ...s, company: { ...s.company, mail: m } });
    expect(mail({ kind: "external", provider: "goggleWorkspace", seats: 1 })).toMatchObject({ name: "Email", brand: "Goggle Workspace", icon: GoggleMark, style: "goggle" });
    expect(mail({ kind: "external", provider: "lookout365", seats: 1 })).toMatchObject({ icon: LookoutMark, style: "lookout" });
    expect(mail({ kind: "external", provider: "hostedExchange", seats: 1 })).toMatchObject({ icon: IonoseMark, style: "ionose" });
    expect(mail({ kind: "self", software: "postfixit", clusterId: "c1" })).toMatchObject({ icon: PearMailMark, style: "pear" });
  });

  it("shows the app as Support with the desk's mark once one is installed, whatever the mail", () => {
    const marks = { ostickit: OsTickitMark, zendusk: ZenduskMark, freshdusk: FreshduskMark, freescoot: FreeScootMark };
    for (const d of DESKS) {
      const s = year(2018);
      s.company = { ...s.company, mail: { kind: "external", provider: "goggleWorkspace", seats: 1 } };
      install(s, d.id as DeskId);
      expect(supportApp(s)).toMatchObject({ name: "Support", icon: marks[d.id as keyof typeof marks], style: d.id });
    }
  });

  it("names the dock's mail app in the Getting started steps", () => {
    const s = year(2018);
    for (const id of ["email", "firstCustomer"] as const) expect(stepOf(s, id).text).toContain("in Email.");
    install(s, "zendusk");
    for (const id of ["email", "firstCustomer"] as const) expect(stepOf(s, id).text).toContain("in Support.");
  });

  it("keeps the app id Support in a save and loads a save without a desk as Email", () => {
    const s = year(2007);
    install(s, "zendusk");
    const back = deserialize(serialize(s));
    expect(back.installed).toContain("Support");
    expect(supportApp(back).name).toBe("Support");
    const raw = JSON.parse(serialize(newGame(2)));
    expect(supportApp(deserialize(JSON.stringify(raw))).name).toBe("Email");
  });
});
