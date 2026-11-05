// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { hourOf } from "../src/sim/00-core/time";
import type { Listing } from "../src/sim/10-catalog/used";
import { openAccount } from "../src/sim/46-finance/bank";
import type { GameState } from "../src/sim/50-state";
import { usedTick } from "../src/sim/80-business/used";
import { Craigslost } from "../src/ui/apps/browser/sites/market/craigslost";
import { Upgrades } from "../src/ui/apps/locations/RackView";
import { useStore } from "../src/ui/store";
import { readyGame } from "./fixtures";

afterEach(cleanup);
const banked = (s: GameState): GameState => ({ ...s, cash: 100_000, bank: { ...openAccount(s, "sparklasse"), welcomed: true } });
const confirm = () => fireEvent.click(document.querySelector(".pay-step-buttons button.primary")!);

describe("outcome after the bought thing leaves the page", () => {
  it("keeps Ordered and the invoice on the basement circuit row once the circuit is in", () => {
    useStore.setState({ game: banked(readyGame(3)) });
    const loc = () => useStore.getState().game.locations.find((l) => l.space === "basement")!;
    const { rerender } = render(<Upgrades loc={loc()} />);
    fireEvent.click(screen.getByRole("button", { name: t("locations-2.buy") }));
    confirm();
    rerender(<Upgrades loc={loc()} />);
    expect(loc().extraCircuit).toBe(true);
    expect(document.querySelector(".order-done")?.textContent).toContain(t("purchase.done.ordered"));
  });

  it("keeps Ordered and the invoice on a chat post that left the market", () => {
    const s = banked({ ...readyGame(1), hour: hourOf(new Date(Date.UTC(2008, 2, 1))) });
    let l: Listing | undefined;
    for (let m = 0; m < 24 && !l; m++) {
      usedTick(s);
      l = s.used.find((x) => x.channel === "chat");
      if (!l) s.hour += 24 * 31;
    }
    s.hour = l!.postedAt + 24;
    useStore.setState({ game: s });
    const path = `/p/${encodeURIComponent(l!.id)}`, go = () => {};
    const { rerender } = render(<Craigslost game={useStore.getState().game} path={path} year={2008} go={go} />);
    fireEvent.click(screen.getByRole("button", { name: t("shop.buy") }));
    confirm();
    rerender(<Craigslost game={useStore.getState().game} path={path} year={2008} go={go} />);
    expect(screen.queryByText(t("cl.notFound"))).toBeNull();
    expect(document.querySelector(".order-done")?.textContent).toContain(t("purchase.done.ordered"));
  });
});
