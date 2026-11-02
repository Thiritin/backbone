// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { hourOf } from "../src/sim/00-core/time";
import { importTicket } from "../src/sim/40-support/desk-work";
import { createTicket, type Ticket } from "../src/sim/40-support/tickets";
import type { GameState } from "../src/sim/50-state";
import { holderOf } from "../src/sim/60-infra/addresses";
import { panelMachine } from "../src/sim/60-infra/licence";
import { resolve } from "../src/sim/80-business/browser";
import { deskPages, deskPath } from "../src/sim/80-business/deskroutes";
import { installDesk } from "../src/sim/90-actions/desk-install";
import { replyTicket } from "../src/sim/90-actions/support";
import { DeskSite, deskUrl } from "../src/ui/apps/browser/sites/desk/DeskSite";
import { useStore } from "../src/ui/store";
import { readyGame } from "./fixtures";

const panel = (s: GameState) => s.clusters.find((x) => x.kind === "panel")!;
function game(version: string): GameState {
  const s = readyGame(5);
  s.hour = hourOf(new Date(Date.UTC(2014, 0, 1)));
  s.cash = 1_000_000;
  expect(installDesk(s, panel(s).id, "ostickit").ok).toBe(true);
  s.ips.addresses.push({ id: "ip-desk", ip: "203.0.113.10", v: 4, locationId: s.locations[0].id, holder: holderOf(s, panelMachine(panel(s))!), source: "line", blockId: null, rep: 100, listed: false, spam: 0 } as never);
  s.desk = { ...s.desk!, hosting: { ...(s.desk!.hosting as { kind: "self"; clusterId: string; version: string }), version } };
  return s;
}
const ticket = (s: GameState, kind: Ticket["kind"], i = 0): Ticket => { const tk = createTicket(s, s.customers[i], kind); importTicket(s, tk, false); return tk; };

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
const agent = () => sessionStorage.setItem("backbone.ui.desk.agent", "true");

beforeEach(() => { sessionStorage.clear(); go = []; });
afterEach(cleanup);

describe("OsTickit", () => {
  it("renders every page in the 1.6 and 1.10 looks, with the version's tabs", () => {
    for (const version of ["1.3", "1.6", "1.10", "1.18"]) {
      const s = game(version), tk = ticket(s, "howTo");
      agent();
      for (const page of deskPages("ostickit")) {
        const { container, unmount } = show(s, deskPath("ostickit", page, { n: tk.ref, id: "email", view: "open", section: "tickets" }));
        expect(container.querySelector(".ost"), `${version} ${page}`).not.toBeNull();
        expect(container.querySelector(".ost-110") !== null).toBe(version === "1.10" || version === "1.18");
        unmount();
      }
      show(s, "/scp/");
      expect(screen.queryByText(t("ost.tab.tasks")) !== null).toBe(version === "1.10" || version === "1.18");
      expect(screen.queryByText(t("ost.tab.users")) !== null).toBe(version !== "1.3" && version !== "1.6");
      cleanup();
    }
  });

  it("asks staff to log in first", () => {
    const s = game("1.6");
    show(s, "/scp/");
    fireEvent.click(screen.getByText(t("ost.login.submit")));
    expect(screen.getByText(t("ost.queue.count", { name: t("ost.queue.open"), n: 0 }))).toBeTruthy();
  });

  it("counts the right tickets in the queue tabs", () => {
    const s = game("1.10");
    const a = ticket(s, "howTo", 0), b = ticket(s, "billing", 1);
    ticket(s, "outage", 2).status = "waiting";
    b.dueAt = s.hour - 1;
    a.assignee = "owner";
    ticket(s, "billing", 0).status = "closed";
    agent();
    show(s, "/scp/tickets.php?status=open");
    for (const [id, n] of [["open", 2], ["answered", 1], ["mine", 1], ["overdue", 1]] as const) expect(screen.getByText(t("ost.queue.count", { name: t(`ost.queue.${id}`), n }))).toBeTruthy();
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });

  it("posts a canned reply with the same outcome as the old thread", () => {
    const s = game("1.10"), tk = ticket(s, "howTo"), twin = structuredClone(s);
    agent();
    show(s, `/scp/tickets.php?id=${tk.ref}`);
    const select = screen.getByLabelText(t("ost.canned")) as HTMLSelectElement;
    const tpl = select.options[1].value;
    fireEvent.change(select, { target: { value: tpl } });
    fireEvent.click(screen.getAllByText(t("ost.postReply")).find((x) => x.tagName === "BUTTON")!);
    expect(replyTicket(twin, tk.id, tpl).ok).toBe(true);
    const after = useStore.getState().game.tickets.find((x) => x.id === tk.id)!, want = twin.tickets.find((x) => x.id === tk.id)!;
    expect([after.status, after.replies.length, after.outcome]).toEqual([want.status, want.replies.length, want.outcome]);
  });

  it("transfers, assigns, notes and bans from the ticket page", () => {
    const s = game("1.6"), tk = ticket(s, "billing");
    agent();
    show(s, `/scp/tickets.php?id=${tk.ref}`);
    fireEvent.click(screen.getByText(t("ost.postNote")));
    fireEvent.change(screen.getByLabelText(t("ost.internalNote")), { target: { value: "Called back" } });
    fireEvent.click(screen.getByText(t("ost.postNoteBtn")));
    expect(screen.getByText("Called back")).toBeTruthy();
    fireEvent.click(screen.getByText(t("ost.assign")));
    fireEvent.change(screen.getByLabelText(t("ost.assignee")), { target: { value: "owner" } });
    fireEvent.click(screen.getByText(t("ost.assignBtn")));
    expect(useStore.getState().game.tickets.find((x) => x.id === tk.id)!.assignee).toBe("owner");
    fireEvent.click(screen.getByText(t("ost.banEmail")));
    expect(useStore.getState().game.tickets.find((x) => x.id === tk.id)!.outcome).toBe("spam");
  });

  it("takes a customer's form ticket as a web ticket and finds it by email and number", () => {
    const s = game("1.10"), c = s.customers[0];
    show(s, "/open.php");
    fireEvent.change(screen.getByLabelText(t("ost.client.email")), { target: { value: c.address.email } });
    fireEvent.change(screen.getByLabelText(t("ost.helpTopic")), { target: { value: "problem" } });
    fireEvent.click(screen.getByText(t("ost.client.create")));
    const tk = useStore.getState().game.tickets.find((x) => x.customerId === c.id && x.kind === "outage")!;
    expect(tk.via).toBe("web");
    expect(screen.getByText(t("ost.client.createdText", { n: tk.ref! }))).toBeTruthy();
    cleanup();
    show(useStore.getState().game, "/view.php");
    fireEvent.change(screen.getByLabelText(t("ost.client.email")), { target: { value: c.address.email } });
    fireEvent.change(screen.getByLabelText(t("ost.client.number")), { target: { value: tk.ref } });
    fireEvent.click(screen.getByText(t("ost.client.accessLink")));
    expect(screen.getByText(t("ost.ticketNo", { n: tk.ref! }))).toBeTruthy();
  });

  it("is the Support launcher's target, with a desk ticket at its staff page", () => {
    const s = game("1.10"), tk = ticket(s, "howTo"), host = `support.${s.company.domain}`;
    expect(deskUrl(s)).toBe(`${host}/scp/`);
    expect(deskUrl(s, { kind: "ticket", id: tk.id })).toBe(`${host}/scp/tickets.php?id=${tk.ref}`);
  });

  it("adds a department on the admin page", () => {
    const s = game("1.10");
    agent();
    show(s, "/scp/departments.php");
    fireEvent.change(screen.getByPlaceholderText(t("ost.name")), { target: { value: "Billing" } });
    fireEvent.click(screen.getByText(t("ost.admin.addDept")));
    expect(within(screen.getAllByRole("table")[0]).getByText("Billing")).toBeTruthy();
  });
});
