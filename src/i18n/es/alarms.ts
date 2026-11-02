import type { Dict, Params } from "../lang";

const vms = (p: Params) => `${p.count} VM`;

export default {
  "alarm.hostDown": (p) => `El host ${p.host} no responde y tiene ${vms(p)}.`,
  "alarm.hostMaintenance": (p) => `El host ${p.host} está ${p.state === "draining" ? "vaciándose" : "en mantenimiento"} y tiene ${vms(p)}.`,
  "alarm.memoryFull": (p) => `El host ${p.host} usa ${p.used} GB de ${p.capacity} GB de memoria y está usando swap.`,
  "alarm.memoryHigh": (p) => `El uso de memoria del host ${p.host} está al ${p.percent} %.`,
  "alarm.memoryOverallocated": (p) => `El host ${p.host} tiene ${p.allocated} GB de memoria asignados de ${p.capacity} GB instalados.`,
  "alarm.cpuContention": (p) => `El host ${p.host} ejecuta ${p.used} vCPU ocupadas en ${p.capacity} núcleos.`,
  "alarm.cpuOvercommitted": (p) => `El host ${p.host} tiene ${p.allocated} vCPU asignadas en ${p.capacity} núcleos, más de ${p.ratio} por núcleo.`,
  "alarm.diskFull": (p) => `El datastore de ${p.host} está lleno al ${p.percent} %.`,
  "alarm.diskHigh": (p) => `El uso del datastore de ${p.host} está al ${p.percent} %.`,
  "alarm.vmStuck": (p) => `La máquina virtual ${p.vm} no pudo reiniciarse en otro host.`,
  "alarm.noFailover": (p) => `Recursos insuficientes para conmutar ${p.host}: ${p.need} GB de memoria asignados, ${p.free} GB libres en los demás hosts.`,
  "alarm.feedHigh": (p) => `La acometida ${p.feed} de ${p.rack} está al ${p.percent}% de su límite.`,
  "alarm.noFeedFailover": (p) => `Potencia insuficiente para conmutar ${p.rack}: las acometidas A y B consumen juntas el ${p.percent}% del límite de una acometida.`,
} satisfies Dict;
