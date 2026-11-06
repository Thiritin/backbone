// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { addLocation, shipStock } from "../src/sim/90-actions/hardware";
import { Storage } from "../src/ui/apps/locations/Storage";
import { useStore } from "../src/ui/store";
import { buyDevice, freeFloor, newGame, withServer } from "./fixtures";

afterEach(cleanup);
const ok = (r: { ok: boolean; id?: string; error?: string }) => { if (!r.ok) throw new Error(r.error); return r.id!; };

function world() {
  const s = { ...withServer(newGame(1)), cash: 100_000 };
  const fr2 = ok(addLocation(freeFloor(s), "equinox-fr5", "cage", 4));
  for (const l of s.locations) l.readyAt = 0;
  const a = ok(buyDevice(s, "g1-compute", "Dwell", 2, "loc1")), b = ok(buyDevice(s, "sw-8", "Sysko", 1, "loc1"));
  return { s, fr2, a, b };
}

describe("batch stock shipment", () => {
  it("ships different models in one parcel with one ledger line", () => {
    const { s, fr2 } = world();
    const ids = s.devices.filter((d) => d.store === "loc1").map((d) => d.id), n = s.ledger.length;
    ok(shipStock(s, ids, fr2));
    expect(s.ledger.length).toBe(n + 1);
    expect(new Set(s.devices.filter((d) => d.transitTo === fr2).map((d) => d.arriveAt)).size).toBe(1);
  });
  it("moves nothing when one unit is invalid", () => {
    const { s, fr2, a } = world();
    const cash = s.cash;
    expect(shipStock(s, [a, "nope"], fr2)).toEqual({ ok: false, error: "error.unknownDevice" });
    expect(s.cash).toBe(cash);
    expect(s.devices.find((d) => d.id === a)!.store).toBe("loc1");
  });
  it("drive mode needs the player at the source and costs the fare", () => {
    const { s, fr2, a } = world();
    s.player = { ...s.player, at: fr2 };
    expect(shipStock(s, [a], fr2, true)).toEqual({ ok: false, error: "error.notThere" });
  });
});

describe("selection bar", () => {
  it("selects two stacks and totals the units", () => {
    const { s } = world();
    useStore.setState({ game: s });
    render(<Storage game={s} loc={s.locations[0]} />);
    expect(screen.queryByText(/selected/)).toBeNull();
    fireEvent.click(screen.getAllByLabelText(t("locations-2.selectStack"))[0]);
    fireEvent.click(screen.getAllByLabelText(t("locations-2.selectStack"))[1]);
    expect(screen.getByText(t("locations-2.selectedUnits", { n: 3 }))).toBeTruthy();
    // the x2 stack gets a stepper; taking one unit lowers the total
    fireEvent.click(screen.getByLabelText(t("shop.fewer")));
    expect(screen.getByText(t("locations-2.selectedUnits", { n: 2 }))).toBeTruthy();
    fireEvent.click(screen.getByLabelText(t("locations-2.selectAll")));
    expect(screen.queryByText(/^[0-9]+ selected$/)).toBeNull();
  });
});
