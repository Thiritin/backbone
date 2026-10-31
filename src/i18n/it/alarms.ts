import type { Dict, Params } from "../lang";

const vms = (p: Params) => `${p.count} VM`;

export default {
  "alarm.hostDown": (p) => `L'host ${p.host} non risponde e ospita ${vms(p)}.`,
  "alarm.hostMaintenance": (p) => `L'host ${p.host} è ${p.state === "draining" ? "in svuotamento" : "in manutenzione"} e ospita ${vms(p)}.`,
  "alarm.memoryFull": (p) => `L'host ${p.host} usa ${p.used} GB di ${p.capacity} GB di memoria ed è bloccato.`,
  "alarm.memoryHigh": (p) => `L'uso della memoria dell'host ${p.host} è al ${p.percent}%.`,
  "alarm.memoryOverallocated": (p) => `L'host ${p.host} ha ${p.allocated} GB di memoria allocati su ${p.capacity} GB installati.`,
  "alarm.cpuContention": (p) => `L'host ${p.host} esegue ${p.used} vCPU occupate su ${p.capacity} core.`,
  "alarm.cpuOvercommitted": (p) => `L'host ${p.host} ha ${p.allocated} vCPU allocate su ${p.capacity} core, più di ${p.ratio} per core.`,
  "alarm.diskFull": (p) => `Il datastore su ${p.host} è pieno al ${p.percent}%.`,
  "alarm.diskHigh": (p) => `L'uso del datastore su ${p.host} è al ${p.percent}%.`,
  "alarm.vmStuck": (p) => `La macchina virtuale ${p.vm} non ha potuto essere riavviata su un altro host.`,
  "alarm.noFailover": (p) => `Risorse insufficienti per il failover di ${p.host}: ${p.need} GB di memoria allocati, ${p.free} GB liberi sugli altri host.`,
  "alarm.feedHigh": (p) => `La linea ${p.feed} di ${p.rack} è al ${p.percent}% del suo limite.`,
  "alarm.noFeedFailover": (p) => `Potenza insufficiente per il failover di ${p.rack}: le linee A e B assorbono insieme il ${p.percent}% del limite di una sola linea.`,
} satisfies Dict;
