type Params = Record<string, string | number>;
const vms = (p: Params) => `${p.count} ${p.count === 1 ? "VM" : "VMs"}`;

// The alarms a hypervisor console lists for a cluster, its hosts and its VMs (sim/60-infra/alarms.ts).
export const ALARMS_EN: Record<string, (p: Params) => string> = {
  "alarm.hostDown": (p) => `Host ${p.host} is not responding with ${vms(p)} on it.`,
  "alarm.hostMaintenance": (p) => `Host ${p.host} is ${p.state === "draining" ? "draining" : "in maintenance"} with ${vms(p)} on it.`,
  "alarm.memoryFull": (p) => `Host ${p.host} uses ${p.used} GB of ${p.capacity} GB memory and is frozen.`,
  "alarm.memoryHigh": (p) => `Host memory usage on ${p.host} is at ${p.percent}%.`,
  "alarm.memoryOverallocated": (p) => `Host ${p.host} has ${p.allocated} GB memory allocated of ${p.capacity} GB installed.`,
  "alarm.cpuContention": (p) => `Host ${p.host} runs ${p.used} busy vCPUs on ${p.capacity} cores.`,
  "alarm.cpuOvercommitted": (p) => `Host ${p.host} has ${p.allocated} vCPUs allocated on ${p.capacity} cores, over ${p.ratio} per core.`,
  "alarm.diskFull": (p) => `Datastore on ${p.host} is full at ${p.percent}%.`,
  "alarm.diskHigh": (p) => `Datastore usage on ${p.host} is at ${p.percent}%.`,
  "alarm.vmStuck": (p) => `Virtual machine ${p.vm} could not be restarted on another host.`,
  "alarm.noFailover": (p) => `Insufficient resources to fail over ${p.host}: ${p.need} GB memory allocated, ${p.free} GB free on the other hosts.`,
  "alarm.feedHigh": (p) => `Feed ${p.feed} of ${p.rack} is at ${p.percent}% of its limit.`,
  "alarm.noFeedFailover": (p) => `Insufficient power to fail over ${p.rack}: feeds A and B together draw ${p.percent}% of one feed's limit.`,
};
