import { describe, expect, it } from "vitest";
import { device, type GameState } from "../src/sim/50-state";
import { releaseOf } from "../src/sim/60-infra/fs";
import { addressOf, ifaceOf, macOf } from "../src/sim/60-infra/lan";
import { linkStatus } from "../src/sim/60-infra/status";
import { complete, runCommand, runLine, type Session } from "../src/sim/60-infra/terminal";
import { createVm } from "../src/sim/90-actions/clusters";
import { setIface } from "../src/sim/90-actions/lan";
import { setRemoteAccess } from "../src/sim/90-actions/routers";
import { reboot } from "../src/sim/90-actions/hardware";
import type { Call } from "../src/sim/90-actions/index";
import { bootedMachine, hypervisor, newGame, readyGame, routerOnLine, withNames } from "./fixtures";
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

describe("network commands on a server", () => {
  const session: Session = { host: "node001", deviceId: "dev3" };
  const run = (s: GameState, line: string) => runLine(() => s, ([fn, ...args]: Call) => fn(s, ...args), session, null, line);
  const serverOf = (s: GameState) => s.devices.find((d) => d.id === "dev3")!;
  const devOf = (s: GameState) => nicNames(releaseOf(s, "dev3").version)[0];

  it("shows the lease in ip a, the default route through the router and the router as name server", () => {
    const s = readyGame(3), dev = devOf(s);
    expect(run(s, "ip a").output).toContain(`    inet 192.168.178.21/24 brd 192.168.178.255 scope global dynamic ${dev}`);
    expect(run(s, "ip route").output[0]).toBe(`default via 192.168.178.1 dev ${dev} proto dhcp`);
    expect(run(s, "cat /etc/resolv.conf").output).toEqual(["nameserver 192.168.178.1"]);
  });

  it("applies an edited interfaces file on ifup and keeps the old setting on a typo", () => {
    const s = readyGame(3), dev = devOf(s);
    run(s, `echo 'iface ${dev} inet stattic' > /etc/network/interfaces`);
    expect(run(s, "/etc/init.d/networking restart").output[0]).toBe("/etc/network/interfaces:1: unknown method");
    expect(serverOf(s).iface).toEqual({ mode: "dhcp" });
    run(s, `echo 'iface ${dev} inet static' > /etc/network/interfaces && echo ' address 192.168.178.5/24' >> /etc/network/interfaces && echo ' gateway 192.168.178.1' >> /etc/network/interfaces`);
    expect(serverOf(s).iface).toEqual({ mode: "dhcp" });
    run(s, `ifup ${dev}`);
    expect(serverOf(s).iface).toEqual({ mode: "static", ip: "192.168.178.5", prefix: 24, gw: "192.168.178.1" });
    expect(addressOf(s, "dev3")).toBe("192.168.178.5");
    expect(linkStatus(s, "dev3").online).toBe(true);
  });

  it("sets a runtime address with ip that the next boot drops, and dhclient takes a lease again", () => {
    const s = readyGame(3), dev = devOf(s);
    run(s, `ip addr add 192.168.178.9/24 dev ${dev}`);
    expect(addressOf(s, "dev3")).toBe("192.168.178.9");
    expect(linkStatus(s, "dev3").online).toBe(false);
    run(s, "ip route add default via 192.168.178.1");
    expect(linkStatus(s, "dev3").online).toBe(true);
    expect(run(s, `dhclient ${dev}`).output.at(-1)).toBe("bound to 192.168.178.21 -- renewal in 432000 seconds.");
    expect(addressOf(s, "dev3")).toBe("192.168.178.21");
    run(s, `ip link set ${dev} down`);
    expect(addressOf(s, "dev3")).toBeNull();
    reboot(s, "dev3");
    expect(ifaceOf(serverOf(s))).toEqual({ mode: "dhcp" });
  });

  it("answers systemctl from Debiant 8 only, and ifconfig in the old layout before 9", () => {
    const s = readyGame(3);
    serverOf(s).os = { ...serverOf(s).os!, version: "7" };
    expect(run(s, "systemctl restart networking").output).toEqual(["bash: systemctl: command not found"]);
    expect(run(s, "/etc/init.d/networking restart").output).toEqual(["Reconfiguring network interfaces...done."]);
    serverOf(s).os = { ...serverOf(s).os!, version: "8" };
    expect(run(s, "systemctl restart networking").output).toEqual([]);
    expect(run(s, "ifconfig").output[0]).toBe(`eth0      Link encap:Ethernet  HWaddr ${macOf(s, "dev3")}`);
  });
});

describe("names and reach from the desk", () => {
  const desk = (s: GameState, line: string) => runCommand(s, null, line);

  it("finds no name on the Fritz!Bocks 5050 and node001.fritz.bocks on a 7390", () => {
    const s = readyGame(3);
    expect(desk(s, "ssh node001").output).toEqual(["ssh: Could not resolve hostname node001: Name or service not known"]);
    expect(desk(s, "ssh 192.168.178.21").session).toEqual({ host: "node001", deviceId: "dev3" });
    expect(complete(s, null, "ssh 192.168.178.2").options).toEqual(["192.168.178.21", "192.168.178.23"]);
    expect(complete(s, null, "ssh 192.168.178.21").line).toBe("ssh 192.168.178.21 ");
    withNames(s);
    expect(desk(s, "ssh node001").session).toEqual({ host: "node001", deviceId: "dev3" });
    expect(desk(s, "ping node001.fritz.bocks").output[0]).toContain("node001.fritz.bocks (192.168.178.21)");
  });

  it("times out on a server whose gateway is wrong", () => {
    const s = readyGame(3);
    setIface(s, "dev3", { mode: "static", ip: "192.168.178.5", prefix: 24, gw: "192.168.178.254" });
    expect(desk(s, "ssh 192.168.178.5").output).toEqual(["ssh: connect to host 192.168.178.5 port 22: Connection timed out"]);
  });

  // The Fritz!Bocks 5050 on the line, a Sysko Edge router S behind it, a Catalust switch and hypervisor node001 with a VM.
  it("resolves a server's name through the own router that leased its address, as it does its VMs'", () => {
    const s = routerOnLine(newGame(5));
    s.homeLine = { id: "dsl-16", next: null };
    s.devices.push(device("rtr", "edge-s", "Sysko", "rack2", 20, null, "rtr", 3000), device("sw", "sw-8", "Sysko", "rack2", 18, null, "sw", 60),
      device("srv", "g1-compute", "Dwell", "rack2", 1, null, "srv", 2500));
    s.devices.find((d) => d.id === "srv")!.hostname = "node001";
    const cable = (a: string, ap: number, b: string, bp: number) => s.cables.push({ id: `cab-${a}`, a: { device: a, port: ap }, b: { device: b, port: bp }, kind: "copper", color: null });
    cable("rtr", 0, "dev5", 0);
    cable("sw", 0, "rtr", 1);
    cable("srv", 0, "sw", 1);
    const made = createVm(s, hypervisor(s, ["srv"]), { vcpu: 1, ramGb: 1, diskGb: 10 }), vm = made.ok ? made.id! : "";
    bootedMachine(s, vm);
    expect(desk(s, "ssh node001").output).toEqual(["ssh: connect to host node001 port 22: Connection timed out"]);
    setRemoteAccess(s, "rtr", true);
    expect(desk(s, "ssh vm001").session).toEqual({ host: "vm001", deviceId: vm });
    expect(desk(s, "ssh node001").session).toEqual({ host: "node001", deviceId: "srv" });
    expect(desk(s, "ssh node001.fritz.bocks").output).toEqual(["ssh: Could not resolve hostname node001.fritz.bocks: Name or service not known"]);
  });
});
