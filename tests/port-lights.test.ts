import { describe, expect, it } from "vitest";
import { modelById } from "../src/sim/10-catalog/hardware";
import { portLinks } from "../src/sim/60-infra/usage";
import { setPower } from "../src/sim/90-actions/hardware";
import { readyGame } from "./fixtures";

describe("port lights", () => {
  it("carries the server's traffic on every port from the server to the carrier panel", () => {
    const s = readyGame(1), links = portLinks(s);
    const server = s.devices.find((d) => modelById(d.model).server)!;
    const own = links.get(server.id)!.find((l) => l)!;
    expect(own.mbps).toBeGreaterThan(0);
    expect(own.load).toBeCloseTo(own.mbps / (own.gbit * 1000));
    const gateway = s.devices.find((d) => modelById(d.model).kind === "gateway")!;
    expect(links.get(gateway.id)!.reduce((n, l) => n + (l?.mbps ?? 0), 0)).toBeCloseTo(own.mbps);
    for (const c of s.cables) expect(links.get(c.a.device)![c.a.port] === null).toBe(links.get(c.b.device)![c.b.port] === null);
  });

  it("drops the link on both ends when a device goes off, and free ports stay dark", () => {
    const s = readyGame(1), server = s.devices.find((d) => modelById(d.model).server)!;
    const cable = s.cables.find((c) => c.a.device === server.id || c.b.device === server.id)!;
    const far = cable.a.device === server.id ? cable.b : cable.a;
    expect(portLinks(s).get(far.device)![far.port]).not.toBeNull();
    setPower(s, server.id, false);
    const links = portLinks(s);
    expect(links.get(server.id)!.every((l) => l === null)).toBe(true);
    expect(links.get(far.device)![far.port]).toBeNull();
    const free = modelById(s.devices.find((d) => d.id === far.device)!.model).ports.findIndex((_, p) => !s.cables.some((c) => (c.a.device === far.device && c.a.port === p) || (c.b.device === far.device && c.b.port === p)));
    if (free >= 0) expect(links.get(far.device)![free]).toBeNull();
  });
});
