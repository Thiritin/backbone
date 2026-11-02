import { deleteFile } from "../src/sim/90-actions/webspace";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { openDesk } from "../src/sim/40-support/desk";
import { createTicket } from "../src/sim/40-support/tickets";
import type { GameState } from "../src/sim/50-state";
import { holderOf } from "../src/sim/60-infra/addresses";
import { panelMachine } from "../src/sim/60-infra/licence";
import { resolve } from "../src/sim/80-business/browser";
import { subscribeDesk } from "../src/sim/90-actions/desk-install";
import { DESK_APPS, DeskSite, deskUrl } from "../src/ui/apps/browser/sites/desk/DeskSite";
import { handDesk, readyGame } from "./fixtures";

const game = (): GameState => { const s = readyGame(5); s.hour = hourOf(new Date(Date.UTC(2014, 0, 1))); s.cash = 1_000_000; return s; };
const panel = (s: GameState) => s.clusters.find((x) => x.kind === "panel")!;
// The panel host's public address, which sets the support A record automatically.
const address = (s: GameState) => {
  s.ips.addresses.push({ id: "ip-desk", ip: "203.0.113.10", v: 4, locationId: s.locations[0].id, holder: holderOf(s, panelMachine(panel(s))!), source: "line", blockId: null, rep: 100, listed: false, spam: 0 } as never);
};
const selfHosted = () => { const s = game(); handDesk(s, panel(s).id, "ostickit"); address(s); return s; };
const fake = { Site: () => <p>osticket staff</p>, staff: "/scp/", ticket: (t: { ref?: string }) => `/scp/tickets.php?id=${t.ref}` };
const render = (s: GameState, path: string) => renderToString(<DeskSite game={s} id={s.desk!.id} host="support.x" path={path} go={() => {}} />);

// OsTickit is the only desk app so far; each test that needs a desk without one takes it out.
const real = DESK_APPS.ostickit;
afterEach(() => { DESK_APPS.ostickit = real; });

describe("desk dispatcher", () => {
  it("answers support.<domain> with the desk once its record resolves, and nothing without a desk", () => {
    const s = game(), host = `support.${s.company.domain}`;
    expect(resolve(s, `${host}/`).page.kind).toBe("notfound");
    handDesk(s, panel(s).id, "ostickit");
    address(s);
    expect(resolve(s, `${host}/scp/`)).toMatchObject({ page: { kind: "desk", id: "ostickit" }, load: "fast" });
  });

  it("answers a hosted desk's tenant address from the start", () => {
    const s = game();
    subscribeDesk(s, "acme", "zendusk");
    expect(resolve(s, "acme.zendusk.com/agent")).toMatchObject({ page: { kind: "desk", id: "zendusk" }, load: "fast" });
    expect(resolve(s, `support.${s.company.domain}/`).page.kind).toBe("notfound");
  });

  it("is down while the desk's web space is offline", () => {
    const s = selfHosted();
    s.security = { ...s.security, offline: [...s.security.offline, panel(s).id] };
    expect(resolve(s, `support.${s.company.domain}/`).load).toBe("down");
  });

  it("draws the desk's app on its pages and not found elsewhere or without an app", () => {
    const s = selfHosted();
    delete DESK_APPS.ostickit;
    expect(render(s, "/scp/")).toContain("Not Found");
    DESK_APPS.ostickit = fake;
    expect(render(s, "/scp/")).toContain("osticket staff");
    expect(render(s, "/nowhere.php?x=1")).toContain("/nowhere.php was not found");
  });
});

describe("Support launcher", () => {
  it("keeps the Support window without a desk app, a legacy desk or a desk address", () => {
    const s = selfHosted();
    delete DESK_APPS.ostickit;
    expect(deskUrl(s)).toBeNull();
    DESK_APPS.ostickit = fake;
    const legacy = game();
    openDesk(legacy, "ostickit");
    expect(deskUrl(legacy)).toBeNull();
    // A desk installed into a web space answers at its folder; once its files are gone it has no address.
    const gone = game(), at = handDesk(gone, panel(gone).id, "ostickit");
    deleteFile(gone, at.ws, `${at.folder}/index.php`);
    expect(deskUrl(gone)).toBeNull();
  });

  it("opens the staff home, a desk ticket at its page, and other mail in the Support window", () => {
    const s = selfHosted(), host = `support.${s.company.domain}`;
    DESK_APPS.ostickit = fake;
    expect(deskUrl(s)).toBe(`${host}/scp/`);
    const tk = createTicket(s, s.customers[0], "howTo");
    tk.channelId = "ch-1"; tk.ref = "178245";
    expect(deskUrl(s, { kind: "ticket", id: tk.id })).toBe(`${host}/scp/tickets.php?id=178245`);
    tk.channelId = null;
    expect(deskUrl(s, { kind: "ticket", id: tk.id })).toBeNull();
    expect(deskUrl(s, { kind: "mailSetup", id: "" })).toBeNull();
    s.security = { ...s.security, offline: [...s.security.offline, panel(s).id] };
    expect(deskUrl(s)).toBe(`${host}/scp/`);
  });
});
