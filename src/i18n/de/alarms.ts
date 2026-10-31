import type { Dict, Params } from "../lang";

const vms = (p: Params) => `${p.count} ${p.count === 1 ? "VM" : "VMs"}`;

export default {
  "alarm.hostDown": (p) => `Host ${p.host} antwortet nicht, ${vms(p)} laufen darauf.`,
  "alarm.hostMaintenance": (p) => `Host ${p.host} ${p.state === "draining" ? "wird geleert" : "ist in Wartung"}, ${vms(p)} laufen darauf.`,
  "alarm.memoryFull": (p) => `Host ${p.host} nutzt ${p.used} GB von ${p.capacity} GB Arbeitsspeicher und hängt.`,
  "alarm.memoryHigh": (p) => `Die Speicherauslastung von Host ${p.host} liegt bei ${p.percent} %.`,
  "alarm.memoryOverallocated": (p) => `Auf Host ${p.host} sind ${p.allocated} GB Arbeitsspeicher vergeben, installiert sind ${p.capacity} GB.`,
  "alarm.cpuContention": (p) => `Host ${p.host} lässt ${p.used} ausgelastete vCPUs auf ${p.capacity} Kernen laufen.`,
  "alarm.cpuOvercommitted": (p) => `Auf Host ${p.host} sind ${p.allocated} vCPUs auf ${p.capacity} Kernen vergeben, mehr als ${p.ratio} pro Kern.`,
  "alarm.diskFull": (p) => `Der Datastore auf ${p.host} ist zu ${p.percent} % voll.`,
  "alarm.diskHigh": (p) => `Die Datastore-Auslastung auf ${p.host} liegt bei ${p.percent} %.`,
  "alarm.vmStuck": (p) => `Die virtuelle Maschine ${p.vm} konnte nicht auf einem anderen Host neu gestartet werden.`,
  "alarm.noFailover": (p) => `Zu wenig Ressourcen für das Failover von ${p.host}: ${p.need} GB Arbeitsspeicher vergeben, ${p.free} GB frei auf den anderen Hosts.`,
  "alarm.feedHigh": (p) => `Einspeisung ${p.feed} von ${p.rack} liegt bei ${p.percent}% ihres Limits.`,
  "alarm.noFeedFailover": (p) => `Zu wenig Leistung für das Failover von ${p.rack}: Einspeisung A und B ziehen zusammen ${p.percent}% des Limits einer Einspeisung.`,
} satisfies Dict;
