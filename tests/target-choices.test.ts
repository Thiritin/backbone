import { describe, expect, it } from "vitest";
import { hostChoices, hostOwner } from "../src/sim/43-pear-mail/check";
import { zoneChoices } from "../src/sim/60-infra/zone-choices";
import { readyGame } from "./fixtures";

describe("target choices", () => {
  it("list every provider's mail host for the protocol, each one a host the check knows", () => {
    const s = readyGame(3);
    for (const p of ["pop", "imap", "smtp"] as const) {
      const hosts = hostChoices(s, p);
      expect(hosts.length).toBeGreaterThan(0);
      for (const h of hosts) expect(hostOwner(s, h, p)).not.toBeNull();
    }
  });

  it("offer a zone's default and current values for the record type", () => {
    const s = readyGame(3), zone = "kunde.example";
    const mx = zoneChoices(s, zone, "MX", [{ id: "r1", type: "MX", name: "@", ttl: 3600, data: "20 mx.other.example" }]);
    expect(mx).toEqual([`10 mail.${zone}`, "20 mx.other.example"]);
    expect(zoneChoices(s, zone, "NS", [])).toEqual([`ns1.${zone}`, `ns2.${zone}`]);
  });
});
