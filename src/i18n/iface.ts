type Params = Record<string, string | number>;

// What ip, ifup and dhclient print on a Lunix server. Program output stays in English, as the real tools print it.
export const IFACE_EN: Record<string, (p: Params) => string> = {
  "term.ifup.parse": (p) => `${p.file}:${p.n}: ${p.why}`,
  "term.ifup.read": (p) => `ifup: couldn't read interfaces file "${p.file}"`,
  "term.ifup.few": () => "too few parameters for iface line",
  "term.ifup.family": () => "unknown address family",
  "term.ifup.method": () => "unknown method",
  "term.ifup.misplaced": () => "misplaced option",
  "term.ifup.missing": (p) => `Missing required variable: ${p.name}`,
  "term.ifup.failed": (p) => `Failed to bring up ${p.dev}.`,
  "term.ip.usage": () => "Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }\nwhere  OBJECT := { link | address | route }",
  "term.ip.object": (p) => `Object "${p.obj}" is unknown, try "ip help".`,
  "term.ip.command": (p) => `Command "${p.cmd}" is unknown, try "ip ${p.obj} help".`,
  "term.ip.device": (p) => `Cannot find device "${p.dev}"`,
  "term.ip.devRequired": () => `Not enough information: "dev" argument is required.`,
  "term.ip.prefix": (p) => `Error: any valid prefix is expected rather than "${p.arg}".`,
  "term.ip.inet": (p) => `Error: inet address is expected rather than "${p.arg}".`,
  "term.ip.exists": () => "RTNETLINK answers: File exists",
  "term.ip.cannotAssign": () => "RTNETLINK answers: Cannot assign requested address",
  "term.ip.unreachable": () => "RTNETLINK answers: Network is unreachable",
  "term.ip.noProcess": () => "RTNETLINK answers: No such process",
  "term.ip.unsupported": () => "RTNETLINK answers: Operation not supported",
  "term.dhclient.none": () => "No DHCPOFFERS received.",
  "term.dhclient.sleep": () => "No working leases in persistent database - sleeping.",
};
