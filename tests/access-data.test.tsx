// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { orderLead } from "../src/sim/30-market/orders";
import { ACCESS_FOLLOW_HOURS, ACCESS_TOPIC, hostFor, nextStep, stepError, stepsDone } from "../src/sim/30-market/manual";
import { seededPassword } from "../src/sim/42-mail/new";
import { rightTemplate, templatesOf } from "../src/sim/40-support/tickets";
import type { GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { confirmOrder, createAccount, provisionOrder, quoteOrder, sendOrderAccess } from "../src/sim/90-actions/orders";
import { replyTicket } from "../src/sim/90-actions/support";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { CustomCompose } from "../src/ui/apps/support/CustomOrder";
import { useStore } from "../src/ui/store";
import { mailed, readyGame } from "./fixtures";

const run = (s: GameState, hours: number) => { for (let i = 0; i < hours; i++) tick(s); };
const ok = (s: GameState, res: { ok: boolean; error?: string }) => {
  if (!res.ok) throw new Error(res.error);
  run(s, 1);
};

// A VPS order taken through quote, account, confirmation and setup.
function provisioned(s: GameState) {
  const r = orderLead(s, "private", "Frankfurt", [], { product: "vps", size: 0, sla: "basic" }, true);
  const id = r.ticketId!, req = () => s.sales.requests.find((x) => x.id === r.id)!, tk = () => s.tickets.find((x) => x.id === id)!;
  s.sales.requests = s.sales.requests.map((x) => (x.id === r.id ? { ...x, budget: 100 } : x));
  ok(s, quoteOrder(s, id, 10));
  for (let i = 0; i < 60 && !stepsDone(s, req()).quote; i++) tick(s);
  ok(s, createAccount(s, id, mailed(s, id)));
  ok(s, confirmOrder(s, id));
  expect(stepError(s, tk(), "access")).toBe("error.needsSetup");
  ok(s, provisionOrder(s, id, hostFor(s, req())!));
  const v = () => s.services.find((x) => x.id === req().serviceId)!;
  return { id, req, tk, v };
}

describe("access data", () => {
  it("gives every service a password, and old saves get one on load", () => {
    const s = readyGame(3);
    const { v } = provisioned(s);
    expect(v().password).toBe(seededPassword(s.seed, Number(v().id.slice(3))));
    const data = JSON.parse(serialize(s));
    data.services = data.services.map((x: { password?: string }) => ({ ...x, password: undefined }));
    const back = deserialize(JSON.stringify(data)).services.find((x) => x.id === v().id)!;
    expect(back.password).toBe(v().password);
  });

  it("sends the access data as the last order step", () => {
    const s = readyGame(3);
    const { id, req, tk, v } = provisioned(s);
    expect(v().accessSent).toBe(false);
    expect(nextStep(s, req())).toBe("access");
    // The ticket shows the step with its button, which queues it.
    useStore.setState({ game: s });
    const View = () => {
      const game = useStore((x) => x.game);
      return <CustomCompose tk={game.tickets.find((x) => x.id === id)!} r={game.sales.requests.find((x) => x.id === req().id)!} />;
    };
    render(<View />);
    expect(screen.getByText(t("support.access"))).toBeTruthy();
    fireEvent.click(screen.getByText(t("support.sendAccess")));
    expect(useStore.getState().game.tickets.find((x) => x.id === id)!.work).toMatchObject({ arg: "access" });
    cleanup();
    ok(s, sendOrderAccess(s, id));
    expect(v().accessSent).toBe(true);
    const mail = req().thread.at(-1)!;
    expect(mail.key).toMatch(/^reply\.order\.access\./);
    expect(mail.params).toMatchObject({ user: "root", password: v().password });
    expect(stepsDone(s, req()).access).toBe(true);
    expect(sendOrderAccess(s, id)).toEqual({ ok: false, error: "error.stepDone" });
    expect(tk().status).not.toBe("resolved");
  });

  it("brings a follow-up ticket a day after the setup when the access data never went out", () => {
    const s = readyGame(3);
    const { req, v } = provisioned(s);
    const c = () => s.customers.find((x) => x.id === v().customerId)!;
    const follow = () => s.tickets.filter((t) => t.serviceId === v().id && t.topic === ACCESS_TOPIC);
    run(s, ACCESS_FOLLOW_HOURS - 2);
    expect(follow()).toHaveLength(0);
    const before = c().happiness;
    run(s, 2);
    expect(follow()).toHaveLength(1);
    expect(c().happiness).toBeLessThan(before);
    run(s, 5);
    expect(follow()).toHaveLength(1);
    // The Zugangsdaten reply answers it and counts as the order's access step.
    const t = follow()[0];
    expect(templatesOf(t)).toContain("access");
    expect(rightTemplate(s, t)).toBe("access");
    ok(s, replyTicket(s, t.id, "access"));
    const reply = s.tickets.find((x) => x.id === t.id)!.replies.at(-1)!;
    expect(reply).toMatchObject({ template: "access", right: true });
    expect(reply.params).toMatchObject({ user: "root", password: v().password });
    expect(v().accessSent).toBe(true);
    expect(stepsDone(s, req()).access).toBe(true);
  });
});
