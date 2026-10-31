import { describe, expect, it } from "vitest";
import { dhclient, ifconfig, ipAddr, ipCommand, ipRoute, maskOf, nicNames, parseInterfaces, prefixOf, renderInterfaces, type NetView } from "../src/sim/60-infra/ifaces";

const STATIC = { mode: "static" as const, ip: "192.168.178.10", prefix: 24, gw: "192.168.178.1", dns: "192.168.178.1" };
const view = (over: Partial<NetView> = {}): NetView => ({
  nics: [{ name: "eth0", mac: "00:14:22:01:02:03", up: true, carrier: true, addr: { ip: "192.168.178.20", prefix: 24, dynamic: 863990 } }, { name: "eth1", mac: "00:14:22:01:02:04", up: false, carrier: false }],
  dev: "eth0", addr: { ip: "192.168.178.20", prefix: 24, dynamic: 863990 }, gw: "192.168.178.1", up: true, ...over,
});

describe("interface names and masks", () => {
  it("renames eth0 to its slot name from Debiant 9", () => {
    expect(nicNames("8")).toEqual(["eth0", "eth1"]);
    expect(nicNames("9")).toEqual(["enp1s0f0", "enp1s0f1"]);
  });
  it("converts between prefixes and netmasks", () => {
    expect(maskOf(24)).toBe("255.255.255.0");
    expect(maskOf(29)).toBe("255.255.255.248");
    expect(prefixOf("255.255.255.0")).toBe(24);
    expect(prefixOf("255.255.0.255")).toBeNull();
  });
});

describe("/etc/network/interfaces", () => {
  it("reads back what it writes, DHCP, static and bonded", () => {
    expect(parseInterfaces(renderInterfaces("eth0", { mode: "dhcp" }, null), "eth0")).toEqual({ ok: true, iface: { mode: "dhcp" } });
    expect(parseInterfaces(renderInterfaces("eth0", STATIC, null), "eth0")).toEqual({ ok: true, iface: STATIC });
    const bonded = renderInterfaces("bond0", STATIC, { slaves: ["eth0", "eth1"], mode: "balance" });
    expect(bonded).toContain("bond-slaves eth0 eth1");
    expect(parseInterfaces(bonded, "bond0")).toEqual({ ok: true, iface: STATIC });
  });
  it("takes an address with its prefix and leaves an interface without a stanza unconfigured", () => {
    expect(parseInterfaces("iface eth0 inet static\n address 10.0.0.5/16\n", "eth0")).toEqual({ ok: true, iface: { mode: "static", ip: "10.0.0.5", prefix: 16 } });
    expect(parseInterfaces("auto lo\niface lo inet loopback\n", "eth0")).toEqual({ ok: true, iface: { mode: "static" } });
  });
  it("refuses a line it cannot read with ifupdown's error", () => {
    const r = parseInterfaces("auto eth0\niface eth0 inet stattic\n", "eth0");
    expect(r).toEqual({ ok: false, error: ["/etc/network/interfaces:2: unknown method", `ifup: couldn't read interfaces file "/etc/network/interfaces"`] });
    expect(parseInterfaces("address 1.2.3.4\n", "eth0").ok).toBe(false);
    expect(parseInterfaces("iface eth0 inet6 static\n", "eth0").ok).toBe(false);
  });
  it("fails to bring up a static stanza without a valid address", () => {
    expect(parseInterfaces("iface eth0 inet static\n adress 10.0.0.5\n", "eth0")).toEqual({ ok: false, error: ["Missing required variable: address", "Failed to bring up eth0."] });
    expect(parseInterfaces("iface eth0 inet static\n address 10.0.0.300\n netmask 255.255.255.0\n", "eth0").ok).toBe(false);
  });
});

describe("ip, ifconfig and dhclient output", () => {
  it("lists loopback and each port in iproute2's layout", () => {
    const out = ipAddr(view().nics);
    expect(out[0]).toMatch(/^1: lo: <LOOPBACK,UP,LOWER_UP>/);
    expect(out).toContain("    inet 192.168.178.20/24 brd 192.168.178.255 scope global dynamic eth0");
    expect(out.find((l) => l.startsWith("3: eth1"))).toContain("state DOWN");
  });
  it("shows the default route and the connected network", () => {
    expect(ipRoute("eth0", { ip: "10.0.0.5", prefix: 24 }, "10.0.0.1", true)).toEqual(["default via 10.0.0.1 dev eth0", "10.0.0.0/24 dev eth0 proto kernel scope link src 10.0.0.5"]);
    expect(ipRoute("eth0", null, null, true)).toEqual([]);
  });
  it("prints net-tools' old layout before Debiant 9 and the new one after, up interfaces only", () => {
    const old = ifconfig(view().nics, false, false);
    expect(old[0]).toBe("eth0      Link encap:Ethernet  HWaddr 00:14:22:01:02:03");
    expect(old.join("\n")).not.toContain("eth1");
    expect(ifconfig(view().nics, true, true).join("\n")).toContain("eth1: flags=4098<BROADCAST,MULTICAST>  mtu 1500");
  });
  it("prints the DHCP exchange or the retries without an offer", () => {
    expect(dhclient("eth0", { ip: "192.168.178.20", server: "192.168.178.1", renewSec: 432000 }).at(-1)).toBe("bound to 192.168.178.20 -- renewal in 432000 seconds.");
    expect(dhclient("eth0", null)).toContain("No DHCPOFFERS received.");
  });
});

describe("ip changes", () => {
  it("sets a runtime address and a default route through the gateway in its network", () => {
    const added = ipCommand(view(), ["addr", "add", "192.168.178.50/24", "dev", "eth0"]);
    expect(added.runtime).toEqual({ mode: "static", ip: "192.168.178.50", prefix: 24 });
    const bare = view({ addr: { ip: "192.168.178.50", prefix: 24 }, gw: null });
    expect(ipCommand(bare, ["route", "add", "default", "via", "10.0.0.1"]).output).toEqual(["RTNETLINK answers: Network is unreachable"]);
    expect(ipCommand(bare, ["route", "add", "default", "via", "192.168.178.1"]).runtime).toEqual({ mode: "static", ip: "192.168.178.50", prefix: 24, gw: "192.168.178.1" });
    expect(ipCommand(view(), ["route", "add", "default", "via", "192.168.178.1"]).output).toEqual(["RTNETLINK answers: File exists"]);
  });
  it("refuses an unknown device, a bad address and an address it does not hold", () => {
    expect(ipCommand(view(), ["a", "add", "10.0.0.1/24", "dev", "eth7"]).output).toEqual(['Cannot find device "eth7"']);
    expect(ipCommand(view(), ["a", "add", "10.0.0.256/24", "dev", "eth0"]).failed).toBe(true);
    expect(ipCommand(view(), ["addr", "del", "10.0.0.9/24", "dev", "eth0"]).output).toEqual(["RTNETLINK answers: Cannot assign requested address"]);
    expect(ipCommand(view(), ["foo"]).output).toEqual(['Object "foo" is unknown, try "ip help".']);
  });
  it("loses the default route when the link goes down and does not get it back on up", () => {
    const down = ipCommand(view(), ["link", "set", "eth0", "down"]).runtime!;
    expect(down).toEqual({ mode: "static", ip: "192.168.178.20", prefix: 24, down: true });
    expect(ipCommand(view({ gw: null, up: false }), ["link", "set", "eth0", "up"]).runtime).toEqual({ mode: "static", ip: "192.168.178.20", prefix: 24 });
  });
});
