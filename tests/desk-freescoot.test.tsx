// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { hourOf } from "../src/sim/00-core/time";
import { channelsOf } from "../src/sim/40-support/desk-channels";
import { importTicket } from "../src/sim/40-support/desk-work";
import { createTicket, type Ticket } from "../src/sim/40-support/tickets";
import type { GameState } from "../src/sim/50-state";
import { holderOf } from "../src/sim/60-infra/addresses";
import { panelMachine } from "../src/sim/60-infra/licence";
import { resolve } from "../src/sim/80-business/browser";
import { deskPages, deskPath, parseDesk } from "../src/sim/80-business/deskroutes";
import { removeDeskChannel } from "../src/sim/90-actions/desk";
import { DeskSite, deskUrl } from "../src/ui/apps/browser/sites/desk/DeskSite";
import { mid } from "../src/ui/apps/browser/sites/desk/freescoot/FreeScootSite";
import { fetchLog } from "../src/ui/apps/browser/sites/desk/freescoot/Manage";
import { useStore } from "../src/ui/store";
import { DESK_ADMIN, handDesk, readyGame } from "./fixtures";

const panel = (s: GameState) => s.clusters.find((x) => x.kind === "panel")!;
let base: GameState | null = null;
function game(version = "1.0", year = 2019): GameState {
  const s = structuredClone((base ??= readyGame(5)));
  s.hour = hourOf(new Date(Date.UTC(year, 0, 1)));
  s.cash = 1_000_000;
  handDesk(s, panel(s).id, "freescoot");
  s.ips.addresses.push({ id: "ip-desk", ip: "203.0.113.10", v: 4, locationId: s.locations[0].id, holder: holderOf(s, panelMachine(panel(s))!), source: "line", blockId: null, rep: 100, listed: false, spam: 0 } as never);
  s.desk = { ...s.desk!, hosting: { ...(s.desk!.hosting as { kind: "self"; clusterId: string; version: string }), version } };
  return s;
}
const ticket = (s: GameState, kind: Ticket["kind"], i = 0): Ticket => { const tk = createTicket(s, s.customers[i % s.customers.length], kind); importTicket(s, tk, false); return tk; };
const now = (id: string) => useStore.getState().game.tickets.find((x) => x.id === id)!;

let go: string[] = [];
function show(s: GameState, path: string) {
  useStore.setState({ game: s });
  const host = `support.${s.company.domain}`;
  const View = () => {
    const g = useStore((x) => x.game);
    const r = resolve(g, host + path);
    return r.page.kind === "desk" ? <DeskSite game={g} id={r.page.id} host={host} path={path} go={(u) => go.push(u)} /> : <p>{r.page.kind}</p>;
  };
  return render(<View />);
}
const agent = () => sessionStorage.setItem("raid0.ui.desk.agent", "true");
const box = (s: GameState) => mid(channelsOf(s)[0]);

beforeEach(() => { sessionStorage.clear(); go = []; });
afterEach(cleanup);

describe("FreeScoot", () => {
  it.each([["1.0", "fs-classic"], ["1.6", "fs-classic"], ["1.8", "fs-current"]] as const)("renders every page of %s in the %s look", (version, look) => {
    const s = game(version, 2023), tk = ticket(s, "howTo");
    agent();
    for (const page of deskPages("freescoot")) {
      const path = deskPath("freescoot", page, { n: tk.ref, id: box(s), folder: "mine", section: "incoming", log: "fetch" });
      const { container, unmount } = show(s, path);
      expect(container.querySelector(`.fs.${look}`), `${version} ${path}`).not.toBeNull();
      unmount();
    }
  });

  it("parses the mailbox permissions path", () => {
    expect(parseDesk("freescoot", "/mailbox/permissions/3")).toEqual({ page: "permissions", args: { id: "3" } });
  });

  it("has no customer side: every page asks for the login", () => {
    const s = game();
    for (const path of ["/", "/conversation/1", "/mailboxes"]) {
      show(s, path);
      expect(screen.getByText(t("fs.login"))).toBeTruthy();
      expect(screen.queryByText(t("fs.nav.manage"))).toBeNull();
      cleanup();
    }
    show(s, "/");
    const form = screen.getByText(t("fs.login")).closest("form")!;
    fireEvent.change(form.querySelector("input[name=email]")!, { target: { value: DESK_ADMIN.email } });
    fireEvent.change(form.querySelector("input[name=password]")!, { target: { value: "wrong" } });
    fireEvent.submit(form);
    expect(screen.getByRole("alert").textContent).toBe(t("desk-setup.login.freescoot"));
    fireEvent.change(form.querySelector("input[name=password]")!, { target: { value: DESK_ADMIN.pass } });
    fireEvent.submit(form);
    expect(screen.getByText(t("fs.openMailbox"))).toBeTruthy();
  });

  it("counts the folders of each mailbox", () => {
    const s = game();
    const a = ticket(s, "howTo", 0), b = ticket(s, "billing", 1), c = ticket(s, "outage", 2);
    ticket(s, "howTo", 3);
    a.assignee = "owner";
    b.assignee = "emp1";
    c.status = "closed";
    ticket(s, "spam", 0);
    agent();
    const { container } = show(s, `/mailbox/${box(s)}`);
    const count = (f: string) => within(within(container.querySelector(".fs-side") as HTMLElement).getByText(t(`fs.folder.${f}`)).closest("a")!).getByText(/\d+/).textContent;
    expect([count("unassigned"), count("mine"), count("assigned"), count("closed"), count("spam")]).toEqual(["1", "1", "2", "1", "1"]);
  });

  it("works a conversation: assign, note, merge from 1.6 and close", () => {
    const s = game("1.6", 2021), tk = ticket(s, "howTo", 0), dup = ticket(s, "howTo", 0);
    agent();
    show(s, `/conversation/${tk.ref}`);
    fireEvent.change(screen.getByLabelText(t("fs.assignee")), { target: { value: "owner" } });
    expect(now(tk.id).assignee).toBe("owner");
    fireEvent.click(screen.getByText(t("fs.note")));
    fireEvent.change(screen.getByLabelText(t("fs.note")), { target: { value: "Called back" } });
    fireEvent.click(screen.getByText(t("fs.addNote")));
    expect(now(tk.id).notes?.some((n) => n.text === "Called back")).toBe(true);
    fireEvent.change(screen.getByLabelText(t("fs.merge")), { target: { value: dup.id } });
    expect(now(dup.id).status).toBe("closed");
    fireEvent.change(screen.getByLabelText(t("fs.col.status")), { target: { value: "closed" } });
    expect(["closed", "resolved"]).toContain(now(tk.id).status);
    cleanup();
    show(game("1.0"), `/conversation/1`);
    expect(screen.queryByLabelText(t("fs.merge"))).toBeNull();
  });

  it("adds a channel from the mailbox form", () => {
    const s = game();
    expect(removeDeskChannel(s, channelsOf(s)[0].id).ok).toBe(true);
    agent();
    show(s, "/mailboxes");
    const pick = screen.getByLabelText(t("fs.newMailbox")) as HTMLSelectElement;
    const id = [...pick.options].find((o) => o.value === s.mail.primary)!.value;
    fireEvent.change(pick, { target: { value: id } });
    fireEvent.click(screen.getByText(t("fs.createMailbox")));
    const chans = channelsOf(useStore.getState().game);
    expect(chans.map((c) => c.accountId)).toContain(id);
    expect(go.at(-1)).toContain("/mailbox/connection-settings/");
  });

  it("logs the scheduled fetches with what each brought in", () => {
    const s = game();
    const ch = channelsOf(s)[0];
    s.mail = { ...s.mail, channels: s.mail.channels.map((c) => (c.id === ch.id ? { ...c, every: 2 } : c)) };
    s.hour += 4;
    ticket(s, "howTo", 0);
    ticket(s, "billing", 1);
    const log = fetchLog(s);
    expect(log.map((r) => r.hour)).toEqual([s.hour - (s.hour % 2), s.hour - (s.hour % 2) - 2, s.hour - (s.hour % 2) - 4].filter((h) => h >= ch.since));
    expect(log[0].n).toBe(2);
    agent();
    show(s, "/logs/fetch");
    expect(screen.getByText(t("fs.fetched", { n: 2 }))).toBeTruthy();
  });

  it("opens the Support tile on the dashboard and a ticket on its conversation", () => {
    const s = game(), tk = ticket(s, "howTo");
    expect(deskUrl(s)).toBe(`support.${s.company.domain}/`);
    expect(deskUrl(s, { kind: "ticket", id: tk.id })).toBe(`support.${s.company.domain}/conversation/${tk.ref}`);
  });
});
