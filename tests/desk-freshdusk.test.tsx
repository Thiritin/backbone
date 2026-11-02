// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { hourOf } from "../src/sim/00-core/time";
import { priorityOf } from "../src/sim/40-support/desk";
import { importTicket } from "../src/sim/40-support/desk-work";
import { createTicket, type Ticket } from "../src/sim/40-support/tickets";
import type { GameState } from "../src/sim/50-state";
import { resolve } from "../src/sim/80-business/browser";
import { deskPages, deskPath } from "../src/sim/80-business/deskroutes";
import { subscribeDesk } from "../src/sim/90-actions/desk-install";
import { setForward } from "../src/sim/90-actions/mailbox";
import { replyTicket, resolveTicket } from "../src/sim/90-actions/support";
import { DeskSite, deskUrl } from "../src/ui/apps/browser/sites/desk/DeskSite";
import { useStore } from "../src/ui/store";
import { readyGame } from "./fixtures";

const HOST = "acme.freshdusk.com";
function game(year: number): GameState {
  const s = readyGame(5);
  s.hour = hourOf(new Date(Date.UTC(year, 2, 1)));
  s.cash = 1_000_000;
  expect(subscribeDesk(s, "acme", "freshdusk").ok).toBe(true);
  return s;
}
const ticket = (s: GameState, kind: Ticket["kind"], i = 0): Ticket => { const tk = createTicket(s, s.customers[i], kind); importTicket(s, tk, false); return tk; };
const now = (id: string) => useStore.getState().game.tickets.find((x) => x.id === id)!;

function show(s: GameState, path: string) {
  useStore.setState({ game: s });
  const View = () => {
    const g = useStore((x) => x.game);
    const r = resolve(g, HOST + path);
    return r.page.kind === "desk" ? <DeskSite game={g} id={r.page.id} host={HOST} path={path} go={() => {}} /> : <p>{r.page.kind}</p>;
  };
  return render(<View />);
}
const agent = () => sessionStorage.setItem("backbone.ui.desk.agent", "true");

beforeEach(() => sessionStorage.clear());
afterEach(cleanup);

describe("Freshdusk", () => {
  it.each([[2012, "classic"], [2016, "flat"], [2021, "mint"]] as const)("renders every page in %i in the %s look", (year, look) => {
    const s = game(year), tk = ticket(s, "howTo");
    agent();
    const sections = ["helpdesk", "portal", "email", "agents", "groups", "canned", "scenarios", "dispatcher", "supervisor", "observer", "sla", "account"];
    const paths = [...deskPages("freshdusk").map((page) => deskPath("freshdusk", page, { n: tk.ref, id: "upload", view: "all", section: "email" })),
      ...sections.map((section) => deskPath("freshdusk", "adminScreen", { section }))];
    for (const path of paths) {
      const { container, unmount } = show(s, path);
      expect(container.querySelector(`.fd.fd-${look}`), `${year} ${path}`).not.toBeNull();
      unmount();
    }
    show(s, "/admin");
    expect(screen.queryByText(t("fd.admin.dispatcher")) !== null).toBe(look !== "mint");
    expect(screen.queryByText(t("fd.admin.dispatcher.mint")) !== null).toBe(look === "mint");
    expect(screen.queryByLabelText(t("fd.nav.contacts")) !== null).toBe(look === "mint");
  });

  it("asks agents to log in first", () => {
    const s = game(2016);
    show(s, "/helpdesk");
    fireEvent.click(screen.getByText(t("fd.login.submit")));
    expect(screen.getByText(t("fd.dash.summary"))).toBeTruthy();
  });

  it("counts the right tickets in the views", () => {
    const s = game(2016);
    const a = ticket(s, "howTo", 0), b = ticket(s, "billing", 1);
    ticket(s, "outage", 2).status = "waiting";
    a.assignee = "owner";
    b.assignee = "nobody";
    ticket(s, "spam", 0);
    agent();
    show(s, "/helpdesk/tickets");
    const counts = Object.fromEntries([...document.querySelectorAll(".fd-viewlist a")].map((x) => [x.children[0].textContent, Number(x.children[1].textContent)]));
    expect(counts).toMatchObject({ [t("fd.view.new-my-open")]: 1, [t("fd.view.my-open-pending")]: 1, [t("fd.view.all-unresolved")]: 3, [t("fd.view.spam")]: 1 });
  });

  it("changes agent and priority from the properties sidebar on Update", () => {
    const s = game(2016), tk = ticket(s, "howTo");
    agent();
    show(s, `/helpdesk/tickets/${tk.ref}`);
    const props = document.querySelector(".fd-props") as HTMLElement;
    fireEvent.change(within(props).getByLabelText(t("fd.col.agent")), { target: { value: "owner" } });
    fireEvent.change(within(props).getByLabelText(t("fd.col.priority")), { target: { value: "urgent" } });
    expect(now(tk.id).assignee).toBeNull();
    fireEvent.click(screen.getByText(t("fd.update")));
    expect(now(tk.id).assignee).toBe("owner");
    expect(priorityOf(useStore.getState().game, now(tk.id))).toBe("urgent");
  });

  it("runs a scenario's actions in one go", () => {
    const s = game(2021), tk = ticket(s, "billing");
    agent();
    show(s, `/a/tickets/${tk.ref}`);
    fireEvent.change(screen.getByLabelText(t("fd.scenarios")), { target: { value: "escalate" } });
    expect([now(tk.id).assignee, now(tk.id).priority]).toEqual(["owner", "urgent"]);
    fireEvent.change(screen.getByLabelText(t("fd.scenarios")), { target: { value: "toGroup" } });
    expect(now(tk.id).assignee).toBeNull();
  });

  it("sends a canned response and resolves it with the same outcome as the old thread", () => {
    const s = game(2016), tk = ticket(s, "howTo"), twin = structuredClone(s);
    agent();
    show(s, `/helpdesk/tickets/${tk.ref}`);
    fireEvent.click(screen.getByText(t("fd.reply")));
    const select = screen.getByLabelText(t("fd.canned")) as HTMLSelectElement;
    const tpl = select.querySelector("optgroup option") as HTMLOptionElement;
    fireEvent.change(select, { target: { value: tpl.value } });
    fireEvent.change(document.querySelector(".fd-send select")!, { target: { value: "resolved" } });
    fireEvent.click(screen.getByText(t("fd.sendAs", { status: t("fd.status.resolved") })));
    replyTicket(twin, tk.id, tpl.value.slice(4));
    resolveTicket(twin, tk.id);
    const after = now(tk.id), want = twin.tickets.find((x) => x.id === tk.id)!;
    expect([after.status, after.replies.length, after.outcome]).toEqual([want.status, want.replies.length, want.outcome]);
  });

  it("routes new tickets by a Dispatch'r rule made in Admin", () => {
    const s = game(2016);
    agent();
    show(s, "/admin/groups");
    fireEvent.change(screen.getByPlaceholderText(t("fd.name")), { target: { value: "Billing" } });
    fireEvent.click(screen.getByText(t("fd.admin.newGroup")));
    const billing = useStore.getState().game.desk!.departments.find((d) => d.name === "Billing")!;
    cleanup();
    show(useStore.getState().game, "/admin/dispatcher");
    const form = document.querySelector(".fd-rule") as HTMLFormElement;
    fireEvent.change(within(form).getByLabelText(t("fd.rule.conditions")), { target: { value: "billing" } });
    fireEvent.change(within(form).getByLabelText(t("fd.group")), { target: { value: billing.id } });
    fireEvent.change(within(form).getByLabelText(t("fd.col.priority")), { target: { value: "high" } });
    fireEvent.click(within(form).getByText(t("fd.save")));
    expect(screen.getByText(`${t("fd.rule.setGroup", { name: "Billing" })}, ${t("fd.rule.setPriority", { name: t("fd.priority.high") })}`)).toBeTruthy();
    const g = useStore.getState().game, a = ticket(g, "billing"), b = ticket(g, "howTo");
    expect([a.deptId, priorityOf(g, a)]).toEqual([billing.id, "high"]);
    expect(b.deptId).not.toBe(billing.id);
  });

  it("verifies a forwarded support email", () => {
    const s = game(2016), ch = s.mail.channels.find((c) => c.desk === "freshdusk")!;
    expect(setForward(s, ch.accountId, `support@${HOST}`, true).ok).toBe(true);
    agent();
    show(s, "/admin/email");
    fireEvent.click(screen.getByText(t("fd.admin.verify")));
    expect(useStore.getState().game.mail.channels.find((c) => c.id === ch.id)!.verified).toBe(true);
    expect(screen.getByText(t("fd.admin.verified"))).toBeTruthy();
  });

  it("picks and spams tickets in bulk", () => {
    const s = game(2016), a = ticket(s, "howTo", 0), b = ticket(s, "billing", 1);
    agent();
    show(s, "/helpdesk/tickets/view/all-unresolved");
    fireEvent.click(screen.getByLabelText(`#${a.ref}`));
    fireEvent.click(screen.getByText(t("fd.pick")));
    expect(now(a.id).assignee).toBe("owner");
    fireEvent.click(screen.getByLabelText(`#${b.ref}`));
    fireEvent.click(within(document.querySelector(".fd-bulk") as HTMLElement).getByText(t("fd.spam")));
    expect(now(b.id).outcome).toBe("spam");
  });

  it("takes a portal ticket as a web ticket and finds it again", () => {
    const s = game(2016), c = s.customers[0];
    show(s, "/support/tickets/new");
    fireEvent.change(screen.getByLabelText(t("fd.type")), { target: { value: "incident" } });
    fireEvent.change(screen.getByLabelText(t("fd.p.requester")), { target: { value: c.address.email } });
    fireEvent.click(screen.getByText(t("fd.p.submit")));
    const tk = useStore.getState().game.tickets.find((x) => x.customerId === c.id && x.kind === "outage")!;
    expect(tk.via).toBe("web");
    expect(screen.getByText(t("fd.p.sentText", { n: tk.ref! }))).toBeTruthy();
    cleanup();
    show(useStore.getState().game, "/support/tickets");
    fireEvent.change(screen.getByLabelText(t("fd.p.email")), { target: { value: c.address.email } });
    fireEvent.change(screen.getByLabelText(t("fd.p.ticketNo")), { target: { value: tk.ref } });
    fireEvent.click(screen.getByText(t("fd.p.view")));
    expect(screen.getByText(t("fd.p.ticketRef", { n: tk.ref! }))).toBeTruthy();
  });

  it("is the Support launcher's target", () => {
    const s = game(2016), tk = ticket(s, "howTo");
    expect(deskUrl(s)).toBe(`${HOST}/helpdesk`);
    expect(deskUrl(s, { kind: "ticket", id: tk.id })).toBe(`${HOST}/helpdesk/tickets/${tk.ref}`);
  });
});
