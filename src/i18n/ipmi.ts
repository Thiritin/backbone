type Params = Record<string, string | number>;

const FAILED: Record<string, string> = {
  hdd: "Hard drive failed", ssd: "SSD failed", nvme: "NVMe drive failed", psu: "Power supply failed", fan: "Fan failed",
  ram: "RAM stick failed", board: "Mainboard failed", cpu: "CPU failed", nic: "Network card failed",
};

// Management controllers, power actions, hangs and pulled plugs.
export const IPMI_EN: Record<string, (p: Params) => string> = {
  "ipmi.log.powerOn": () => "Power on",
  "ipmi.log.shutdown": () => "Graceful shutdown",
  "ipmi.log.pulled": () => "Power lost",
  "ipmi.log.reset": () => "Hard reset",
  "ipmi.log.cycle": () => "Power cycle",
  "ipmi.log.resync": () => "Array resync started",
  "ipmi.log.corrupted": () => "Data corrupted after an unclean stop",
  "ipmi.log.recovered": () => "Data recovered",
  "ipmi.log.hung": () => "Operating system stopped responding",
  "ipmi.log.bmcHung": () => "Management controller stopped responding",
  "ipmi.log.bmcReset": () => "Management controller reset",
  ...Object.fromEntries(Object.entries(FAILED).map(([kind, text]) => [`ipmi.log.failed.${kind}`, () => text])),
  "event.serverHung.title": () => "Server hung",
  "event.serverHung.text": (p) => `${p.device} stopped responding. Its workloads are down until it is reset.`,
  "event.bmcHung.title": () => "Management controller hung",
  "event.bmcHung.text": (p) => `The management controller of ${p.device} stopped responding.`,
  "event.dataCorrupted.title": () => "Data corrupted",
  "event.dataCorrupted.text": (p) => `${p.device} lost power while running. ${p.count} ${Number(p.count) === 1 ? "workload needs" : "workloads need"} to be recovered.`,
  "event.recovered.title": () => "Workload recovered",
  "event.recovered.text": (p) => `A workload on ${p.device} is running again.`,
  "error.alreadyOff": () => "The server is already off.",
  "error.unresponsive": () => "The server does not respond.",
  "error.noBmc": () => "This server has no management controller.",
  "error.bmcHung": () => "The management controller does not respond.",
  "error.bmcFine": () => "The management controller responds.",
  "error.notHung": () => "The server is not hung.",
  "error.notCorrupted": () => "The data is not corrupted.",
  "error.needsRestore": () => "Recovery failed. Restore it from backup.",
  "error.pduInstalled": () => "This rack already has a switched PDU.",
  "error.handsBusy": () => "Someone is already on the way to this server.",
  "error.unplugged": () => "The power cords are already unplugged.",
  "error.plugged": () => "The power cords are already plugged in.",
  "error.recovering": () => "A recovery is already under way.",
};
