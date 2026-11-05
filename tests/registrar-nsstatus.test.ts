import { describe, expect, it } from "vitest";
import { nowMinutes } from "../src/sim/00-core/time";
import { companyDomain } from "../src/sim/30-customers/domains";
import { domainOf, NS_MINUTES, nsMinutesLeft, nsStatus } from "../src/sim/30-customers/registry";
import { resolve } from "../src/sim/80-business/browser";
import { siteStatus } from "../src/sim/80-business/website";
import { tick } from "../src/sim/88-tick/tick";
import { setNameServers } from "../src/sim/90-actions/registrar";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { panelVm, readyGame } from "./fixtures";

const wait = (s: ReturnType<typeof readyGame>, min: number) => { const to = nowMinutes(s) + min; while (nowMinutes(s) < to) tick(s); };
const OWN: [string, string] = ["ns1.mine.de", "ns2.mine.de"];

describe("name server status", () => {
  it("is active for the registrar zone and counts down a change", () => {
    const s = readyGame(11), host = companyDomain(s), d = () => domainOf(s, host)!;
    expect(nsStatus(s, d())).toBe("active");
    expect(setNameServers(s, host, "custom", OWN).ok).toBe(true);
    expect(nsStatus(s, d())).toBe("propagating");
    expect(nsMinutesLeft(s, d())).toBe(NS_MINUTES);
    s.minute += 20;
    expect(nsMinutesLeft(s, d())).toBe(NS_MINUTES - 20);
    expect(resolve(s, host).page.kind).toBe("company");
    s.minute += NS_MINUTES - 20;
    expect(nsStatus(s, d())).toBe("silent");
  });

  it("leaves the domain unreachable until a DNS server runs, then serves it", () => {
    const s = readyGame(12), host = companyDomain(s);
    setNameServers(s, host, "custom", OWN);
    wait(s, NS_MINUTES);
    expect(resolve(s, host).page.kind).toBe("notfound");
    expect(siteStatus(s)).toBe("down");
    panelVm(s, s.clusters.find((c) => c.kind === "cloud")!.id, "powerdnz");
    expect(nsStatus(s, domainOf(s, host)!)).toBe("active");
    expect(resolve(s, host).page.kind).toBe("company");
    expect(siteStatus(s)).toBe("up");
  });

  it("switches back to the registrar and rejects bad hosts", () => {
    const s = readyGame(13), host = companyDomain(s);
    expect(setNameServers(s, host, "custom", ["x", "y"]).ok).toBe(false);
    expect(setNameServers(s, host, "custom", ["a.de", "a.de"]).ok).toBe(false);
    setNameServers(s, host, "custom", OWN);
    wait(s, NS_MINUTES);
    setNameServers(s, host, "company");
    wait(s, NS_MINUTES);
    expect(nsStatus(s, domainOf(s, host)!)).toBe("active");
    expect(resolve(s, host).page.kind).toBe("company");
  });

  it("keeps the saved mode of an old save", () => {
    const s = readyGame(14), host = companyDomain(s);
    const back = deserialize(serialize(s))!;
    expect(domainOf(back, host)!.ns).toBe("company");
    expect(nsStatus(back, domainOf(back, host)!)).toBe("active");
  });
});
