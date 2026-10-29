import { describe, expect, it } from "vitest";
import { modelById } from "../src/sim/10-catalog/hardware";
import { moveInRack, setPlugged, setPower } from "../src/sim/90-actions/hardware";
import { readyGame } from "./fixtures";

describe("moving a device within its rack", () => {
  it("slides an unplugged server to a free position and refuses a plugged-in or blocked one", () => {
    const s = readyGame(4);
    const srv = s.devices.find((d) => d.rackId && modelById(d.model).kind === "server")!;
    const other = s.devices.find((d) => d.rackId === srv.rackId && d.id !== srv.id)!;
    const cables = s.cables.filter((c) => c.a.device === srv.id || c.b.device === srv.id).length;
    expect(moveInRack(s, srv.id, 10)).toEqual({ ok: false, error: "error.unplugFirst" });
    setPower(s, srv.id, false);
    expect(moveInRack(s, srv.id, 10)).toEqual({ ok: false, error: "error.unplugFirst" });
    for (const c of srv.components.filter((c) => c.kind === "psu")) setPlugged(s, srv.id, c.id, false);
    expect(moveInRack(s, srv.id, other.slot)).toEqual({ ok: false, error: "error.slotTaken" });
    expect(moveInRack(s, srv.id, 99)).toEqual({ ok: false, error: "error.outOfBounds" });
    expect(moveInRack(s, srv.id, 10)).toEqual({ ok: true });
    expect(srv.slot).toBe(10);
    expect(s.cables.filter((c) => c.a.device === srv.id || c.b.device === srv.id).length).toBe(cables);
    expect(moveInRack(s, srv.id, 10)).toEqual({ ok: true });
  });
});
