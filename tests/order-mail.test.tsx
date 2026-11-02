// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { orderLead } from "../src/sim/30-market/orders";
import { view } from "../src/sim/42-mail/model";
import type { GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { TicketSlot } from "../src/ui/apps/mail-kit/TicketSlot";
import { useStore } from "../src/ui/store";
import { readyGame } from "./fixtures";

function order(s: GameState) {
  const r = orderLead(s, "private", "Frankfurt", [], { product: "webHosting", size: 0, sla: "basic" }, true);
  tick(s);
  const m = Object.values(s.mail.msgs).flat().find((x) => x.ticket === r.ticketId)!;
  return { r, m };
}

afterEach(cleanup);

describe("order mail", () => {
  it("shows the customer's request, and a fixed text once the request is gone", () => {
    const s = readyGame(5);
    const { r, m } = order(s);
    expect(view(s, m).text).toContain(r.contact);
    s.sales.requests = s.sales.requests.filter((x) => x.id !== r.id);
    expect(view(s, m).text).toBe(t("ticket.order.text"));
  });

  it("answers an order with its steps and leaves out the generic ticket actions", () => {
    const s = readyGame(5);
    const { m } = order(s);
    useStore.setState({ game: s });
    render(<TicketSlot game={s} message={m} desk={() => null} buttons={(x) => x.actions.map((a) => <button key={a.id}>{a.label}</button>)} />);
    expect(screen.getByText(t("support.quote"))).toBeTruthy();
    expect(screen.queryByText(t("support.action.accept"))).toBeNull();
    expect(screen.getAllByText(t("support.decline"))).toHaveLength(1);
  });
});
