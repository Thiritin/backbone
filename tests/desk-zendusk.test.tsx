// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { hourOf } from "../src/sim/00-core/time";
import { importTicket } from "../src/sim/40-support/desk-work";
import { createTicket, type Ticket } from "../src/sim/40-support/tickets";
import type { GameState } from "../src/sim/50-state";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { resolve } from "../src/sim/80-business/browser";
import { deskPages, deskPath } from "../src/sim/80-business/deskroutes";
import { subscribeDesk, verifyForwarding } from "../src/sim/90-actions/desk-install";
import { setForward } from "../src/sim/90-actions/mailbox";
import { replyTicket, resolveTicket } from "../src/sim/90-actions/support";
import { DeskSite, deskUrl } from "../src/ui/apps/browser/sites/desk/DeskSite";
import { useStore } from "../src/ui/store";
import { readyGame } from "./fixtures";

const HOST = "acme.zendusk.com";
let base: GameState | undefined;
function game(year: number): GameState {
  const s = structuredClone((base ??= readyGame(5)));
  s.hour = hourOf(new Date(Date.UTC(year, 2, 1)));
  s.cash = 1_000_000;
  expect(subscribeDesk(s, "acme", "zendusk").ok).toBe(true);
  return s;
}
const ticket = (s: GameState, kind: Ticket["kind"], i = 0): Ticket => { const tk = createTicket(s, s.customers[i], kind); importTicket(s, tk, false); return tk; };
const now = (s: GameState, id: string) => useStore.getState().game.tickets.find((x) => x.id === id) ?? s.tickets.find((x) => x.id === id)!;

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

describe("Zendusk", () => {
  it("renders every page in the classic, tabbed and workspace looks", () => {
    for (const [year, look] of [[2008, "classic"], [2014, "lotus"], [2021, "workspace"]] as const) {
      const s = game(year), tk = ticket(s, "howTo");
      agent();
      const sections = ["people", "groups", "views", "macros", "triggers", "automations", "sla", "email", "branding", "subscription"];
      const paths = [...deskPages("zendusk").map((page) => deskPath("zendusk", page, { n: tk.ref, id: "general", view: "all-unsolved", section: "email" })),
        ...sections.map((section) => deskPath("zendusk", "adminScreen", { section }))];
      useStore.setState({ game: s });
      // Static markup is enough to find the look and is cheaper than mounting each page.
      for (const path of paths) {
        const r = resolve(s, HOST + path);
        const html = r.page.kind === "desk" ? renderToString(<DeskSite game={s} id={r.page.id} host={HOST} path={path} go={() => {}} />) : "";
        expect(html, `${year} ${path}`).toContain(`class="zd zd-${look}`);
      }
      show(s, "/agent");
      expect(screen.queryByText(t("zd.nav.manage")) !== null).toBe(look === "classic");
      expect(screen.queryByLabelText(t("zd.nav.adminCenter")) !== null).toBe(look === "workspace");
      cleanup();
      show(s, "/hc");
      expect(screen.queryByText(t("zd.hc.existing")) !== null).toBe(look === "classic");
      cleanup();
    }
  });

  it("asks agents to sign in first", () => {
    const s = game(2014);
    show(s, "/agent");
    fireEvent.click(screen.getByText(t("zd.signIn.submit")));
    expect(screen.getByText(t("zd.home.title"))).toBeTruthy();
  });

  it("counts the right tickets in the views", () => {
    const s = game(2014);
    const a = ticket(s, "howTo", 0), b = ticket(s, "billing", 1);
    ticket(s, "outage", 2).status = "waiting";
    a.assignee = "owner";
    b.unread = false;
    ticket(s, "spam", 0);
    agent();
    show(s, "/agent/filters/all-unsolved");
    const counts = Object.fromEntries([...document.querySelectorAll(".zd-viewlist a")].map((x) => [x.children[0].textContent, Number(x.children[1].textContent)]));
    expect(counts).toMatchObject({ [t("zd.view.your-unsolved")]: 1, [t("zd.view.unassigned")]: 2, [t("zd.view.all-unsolved")]: 3, [t("zd.view.pending")]: 1, [t("zd.view.suspended")]: 1 });
    expect(screen.getByText(t("zd.tickets", { n: 3 }))).toBeTruthy();
  });

  it("applies a reply macro and submits as solved with the same outcome as the old thread", () => {
    const s = game(2014), tk = ticket(s, "howTo"), twin = structuredClone(s);
    agent();
    show(s, `/agent/tickets/${tk.ref}`);
    const select = screen.getByLabelText(t("zd.applyMacro")) as HTMLSelectElement;
    const tpl = select.querySelector("optgroup option") as HTMLOptionElement;
    fireEvent.change(select, { target: { value: tpl.value } });
    fireEvent.change(screen.getByLabelText(t("zd.ticketStatus")), { target: { value: "resolved" } });
    fireEvent.click(screen.getByText(t("zd.submitAs", { status: t("zd.status.solved") })));
    replyTicket(twin, tk.id, tpl.value.slice(4));
    resolveTicket(twin, tk.id);
    const after = now(s, tk.id), want = twin.tickets.find((x) => x.id === tk.id)!;
    expect([after.status, after.replies.length, after.outcome]).toEqual([want.status, want.replies.length, want.outcome]);
  });

  it("runs a ticket action from the macro list like the old button", () => {
    const s = game(2008), tk = ticket(s, "billing"), twin = structuredClone(s);
    agent();
    show(s, `/agent/tickets/${tk.ref}`);
    fireEvent.change(screen.getByLabelText(t("zd.applyMacro")), { target: { value: "action:credit" } });
    fireEvent.click(screen.getByText(t("zd.submit")));
    resolveTicket(twin, tk.id, "credit");
    const after = now(s, tk.id), want = twin.tickets.find((x) => x.id === tk.id)!;
    expect([after.status, after.outcome, after.replies.length]).toEqual([want.status, want.outcome, want.replies.length]);
  });

  it("adds an internal note and files spam under Suspended tickets", () => {
    const s = game(2021), tk = ticket(s, "billing");
    agent();
    show(s, `/agent/tickets/${tk.ref}`);
    fireEvent.click(screen.getByText(t("zd.internalNote")));
    fireEvent.change(screen.getByLabelText(t("zd.internalNote")), { target: { value: "Called back" } });
    fireEvent.click(screen.getByText(t("zd.submit")));
    expect(screen.getByText("Called back")).toBeTruthy();
    fireEvent.click(screen.getByText(t("zd.markSpam")));
    expect(now(s, tk.id).outcome).toBe("spam");
    cleanup();
    show(useStore.getState().game, "/agent/filters/suspended");
    expect(within(document.querySelector(".zd-panel table")!).getByText(`#${tk.ref}`)).toBeTruthy();
  });

  it("verifies forwarding once the mailbox forwards and the test message arrives", () => {
    const s = game(2014), ch = s.mail.channels.find((c) => c.desk === "zendusk")!;
    agent();
    show(s, "/agent/admin/email");
    fireEvent.click(screen.getByText(t("zd.admin.verify")));
    expect(useStore.getState().game.mail.channels.find((c) => c.id === ch.id)!.verified).toBe(false);
    cleanup();
    const g = useStore.getState().game;
    expect(setForward(g, ch.accountId, `support@${HOST}`, true).ok).toBe(true);
    show(g, "/agent/admin/email");
    fireEvent.click(screen.getByText(t("zd.admin.verify")));
    expect(useStore.getState().game.mail.channels.find((c) => c.id === ch.id)!.verified).toBe(true);
    expect(screen.getByText(t("zd.admin.verified"))).toBeTruthy();
    expect(verifyForwarding(useStore.getState().game, "nope").ok).toBe(false);
  });

  it("takes a Help Center request as a web ticket and finds it again", () => {
    const s = game(2014), c = s.customers[0];
    show(s, "/hc/requests/new");
    fireEvent.change(screen.getByLabelText(t("zd.hc.chooseForm")), { target: { value: "problem" } });
    fireEvent.change(screen.getByLabelText(t("zd.hc.yourEmail")), { target: { value: c.address.email } });
    fireEvent.click(screen.getByText(t("zd.submit")));
    const tk = useStore.getState().game.tickets.find((x) => x.customerId === c.id && x.kind === "outage")!;
    expect(tk.via).toBe("web");
    expect(screen.getByText(t("zd.hc.sentText", { n: tk.ref! }))).toBeTruthy();
    cleanup();
    show(useStore.getState().game, "/hc/requests");
    fireEvent.change(screen.getByLabelText(t("zd.hc.yourEmail")), { target: { value: c.address.email } });
    fireEvent.change(screen.getByLabelText(t("zd.hc.requestNo")), { target: { value: tk.ref } });
    fireEvent.click(screen.getByText(t("zd.hc.view")));
    expect(screen.getByText(t("zd.hc.requestRef", { n: tk.ref! }))).toBeTruthy();
  });

  it("adds a trigger and a group in Admin", () => {
    const s = game(2014);
    agent();
    show(s, "/agent/admin/groups");
    fireEvent.change(screen.getByPlaceholderText(t("zd.name")), { target: { value: "Billing" } });
    fireEvent.click(screen.getByText(t("zd.admin.addGroup")));
    const billing = useStore.getState().game.desk!.departments.find((d) => d.name === "Billing")!;
    cleanup();
    show(useStore.getState().game, "/agent/admin/triggers");
    const form = document.querySelector(".zd-trigger") as HTMLFormElement;
    fireEvent.change(within(form).getByLabelText(t("zd.trigger.conditions")), { target: { value: "billing" } });
    fireEvent.change(within(form).getByLabelText(t("zd.group")), { target: { value: billing.id } });
    fireEvent.click(screen.getByText(t("zd.trigger.create")));
    expect(useStore.getState().game.desk!.rules).toEqual([{ when: "billing", set: { deptId: billing.id } }]);
    expect(screen.getByText(t("zd.trigger.setGroup", { name: "Billing" }))).toBeTruthy();
  });

  it("is the Support launcher's target, and old saves load with unverified channels", () => {
    const s = game(2014), tk = ticket(s, "howTo");
    expect(deskUrl(s)).toBe(`${HOST}/agent`);
    expect(deskUrl(s, { kind: "ticket", id: tk.id })).toBe(`${HOST}/agent/tickets/${tk.ref}`);
    const data = JSON.parse(serialize(s));
    for (const c of data.mail.channels) delete c.verified;
    expect(deserialize(JSON.stringify(data)).mail.channels.every((c) => c.verified === false)).toBe(true);
  });
});
