import type { Dict, Params } from "../lang";

const vms = (p: Params) => `${p.count} VM`;

export default {
  "alarm.hostDown": (p) => `L'hôte ${p.host} ne répond pas, avec ${vms(p)} dessus.`,
  "alarm.hostMaintenance": (p) => `L'hôte ${p.host} est ${p.state === "draining" ? "en cours de vidage" : "en maintenance"}, avec ${vms(p)} dessus.`,
  "alarm.memoryFull": (p) => `L'hôte ${p.host} utilise ${p.used} Go sur ${p.capacity} Go de mémoire et est figé.`,
  "alarm.memoryHigh": (p) => `L'utilisation mémoire de l'hôte ${p.host} est à ${p.percent} %.`,
  "alarm.memoryOverallocated": (p) => `L'hôte ${p.host} a ${p.allocated} Go de mémoire alloués pour ${p.capacity} Go installés.`,
  "alarm.cpuContention": (p) => `L'hôte ${p.host} fait tourner ${p.used} vCPU occupés sur ${p.capacity} cœurs.`,
  "alarm.cpuOvercommitted": (p) => `L'hôte ${p.host} a ${p.allocated} vCPU alloués sur ${p.capacity} cœurs, soit plus de ${p.ratio} par cœur.`,
  "alarm.diskFull": (p) => `Le datastore de ${p.host} est plein à ${p.percent} %.`,
  "alarm.diskHigh": (p) => `L'utilisation du datastore de ${p.host} est à ${p.percent} %.`,
  "alarm.vmStuck": (p) => `La machine virtuelle ${p.vm} n'a pas pu être redémarrée sur un autre hôte.`,
  "alarm.noFailover": (p) => `Ressources insuffisantes pour basculer ${p.host} : ${p.need} Go de mémoire alloués, ${p.free} Go libres sur les autres hôtes.`,
  "alarm.feedHigh": (p) => `L'arrivée ${p.feed} de ${p.rack} est à ${p.percent} % de sa limite.`,
  "alarm.noFeedFailover": (p) => `Puissance insuffisante pour basculer ${p.rack} : les arrivées A et B tirent ensemble ${p.percent} % de la limite d'une arrivée.`,
} satisfies Dict;
