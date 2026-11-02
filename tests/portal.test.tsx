import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { datacenterById, dcProvider } from "../src/sim/20-world/datacenters";
import { type GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { addLocation, cancelContract, mountDevice, noticeEnd, revokeCancel } from "../src/sim/90-actions/hardware";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { PortalShell, providerInvoices, providerTickets } from "../src/ui/apps/browser/sites/providers/portal/Portal";
import { routeOf } from "../src/ui/apps/browser/sites/providers/ProviderSite";
import { buyDevice, freeFloor, newGame, withServer } from "./fixtures";

const ok = (r: { ok: boolean; error?: string; id?: string }) => { if (!r.ok) throw new Error(r.error); return r.id!; };
const runTo = (s: GameState, hour: number) => { while (s.hour < hour) tick(s); };
const setup = () => {
  const s: GameState = freeFloor({ ...withServer(newGame(7)), cash: 1_000_000 });
  const fr5 = ok(addLocation(s, "equinox-fr5", "share", 2)), nbg = ok(addLocation(s, "hetzler-nbg", "share", 1));
  const c = (loc: string) => s.contracts.find((x) => x.locationId === loc)!;
  return { s, fr5: c(fr5), nbg: c(nbg) };
};
const spaceLine = (s: GameState, hour: number, dc: string) => s.ledger.find((e) => e.hour === hour && e.key === "ledger.space" && e.params.dc === dc);

describe("customer portal", () => {
  it("waives the month after a retention offer, once per contract and only at the large providers", () => {
    const { s, fr5, nbg } = setup();
    ok(cancelContract(s, fr5.id));
    ok(revokeCancel(s, fr5.id, true));
    expect(fr5).toMatchObject({ endsAt: null, retainedAt: s.hour });
    const first = noticeEnd(s.hour, 0), second = noticeEnd(first, 0);
    runTo(s, second + 1);
    expect(spaceLine(s, first, "equinox-fr5")?.amount).toBe(0);
    expect(spaceLine(s, second, "equinox-fr5")?.amount).toBe(-fr5.monthly);
    ok(cancelContract(s, fr5.id));
    expect(revokeCancel(s, fr5.id, true)).toEqual({ ok: false, error: "error.noRetentionOffer" });
    ok(cancelContract(s, nbg.id));
    expect(revokeCancel(s, nbg.id, true)).toEqual({ ok: false, error: "error.noRetentionOffer" });
    expect(nbg.endsAt).not.toBeNull();
  });

  it("files each provider's monthly charges and remote-hands jobs under that provider", () => {
    const { s, nbg } = setup();
    const rack = s.racks.find((r) => r.locationId === nbg.locationId)!.id;
    ok(mountDevice(s, ok(buyDevice(s, "sw-8", "Sysko", 1, nbg.locationId)), rack, 1));
    const month = noticeEnd(s.hour, 0);
    runTo(s, month + 1);
    const [eq] = providerInvoices(s, "equinox"), [hz] = providerInvoices(s, "hetzler");
    expect(eq.lines.map((e) => e.params.dc)).toEqual(["equinox-fr5"]);
    expect(hz.lines.every((e) => e.params.dc === "hetzler-nbg")).toBe(true);
    expect(hz).toMatchObject({ hour: month, paid: true });
    expect(providerTickets(s, "equinox")).toEqual([]);
    const [ticket] = providerTickets(s, "hetzler");
    expect(ticket.e.params).toMatchObject({ dc: "hetzler-nbg", done: expect.any(Number) });
  });

  it("gives saves from before the retention offer an untouched one", () => {
    const { s } = setup();
    const data = JSON.parse(serialize(s));
    for (const c of data.contracts) delete c.retainedAt;
    expect(deserialize(JSON.stringify(data)).contracts.every((c) => c.retainedAt === null)).toBe(true);
  });

  it("renders every portal page for a signed-in customer", () => {
    const { s, fr5 } = setup();
    runTo(s, noticeEnd(s.hour, 0) + 1);
    const p = dcProvider("equinox"), inv = providerInvoices(s, "equinox")[0];
    const page = (path: string) => {
      const route = routeOf("equinox", path);
      if (route.page !== "account") throw new Error(path);
      return renderToString(<PortalShell game={s} p={p} route={route} go={() => {}} signOut={() => {}} />);
    };
    expect(page("/account")).toContain(datacenterById("equinox-fr5").name);
    expect(page(`/account/contracts/${fr5.id}`)).toContain("Cancel contract");
    expect(page("/account/invoices")).toContain(inv.no);
    expect(page(`/account/invoices/${inv.no}`)).toContain("books-a4");
    expect(page("/account/services")).toContain("Extra power");
    expect(page("/account/tickets")).toContain("No tickets");
    expect(page("/account/profile")).toContain(s.company.name);
  });
});
