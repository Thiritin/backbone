import type { Dict, Params } from "../lang";

const vms = (p: Params) => `${p.count} ${p.count === 1 ? "VM" : "VMs"}`;

export default {
  "alarm.hostDown": (p) => `O host ${p.host} não responde e tem ${vms(p)}.`,
  "alarm.hostMaintenance": (p) => `O host ${p.host} está ${p.state === "draining" ? "a ser esvaziado" : "em manutenção"} e tem ${vms(p)}.`,
  "alarm.memoryFull": (p) => `O host ${p.host} usa ${p.used} GB de ${p.capacity} GB de memória e está a usar swap.`,
  "alarm.memoryHigh": (p) => `A utilização de memória do host ${p.host} está nos ${p.percent} %.`,
  "alarm.memoryOverallocated": (p) => `O host ${p.host} tem ${p.allocated} GB de memória atribuídos em ${p.capacity} GB instalados.`,
  "alarm.cpuContention": (p) => `O host ${p.host} executa ${p.used} vCPUs ocupados em ${p.capacity} núcleos.`,
  "alarm.cpuOvercommitted": (p) => `O host ${p.host} tem ${p.allocated} vCPUs atribuídos em ${p.capacity} núcleos, mais de ${p.ratio} por núcleo.`,
  "alarm.diskFull": (p) => `O datastore em ${p.host} está cheio a ${p.percent} %.`,
  "alarm.diskHigh": (p) => `A utilização do datastore em ${p.host} está nos ${p.percent} %.`,
  "alarm.vmStuck": (p) => `A máquina virtual ${p.vm} não pôde ser reiniciada noutro host.`,
  "alarm.noFailover": (p) => `Recursos insuficientes para o failover de ${p.host}: ${p.need} GB de memória atribuídos, ${p.free} GB livres nos outros hosts.`,
  "alarm.feedHigh": (p) => `A alimentação ${p.feed} de ${p.rack} está a ${p.percent}% do seu limite.`,
  "alarm.noFeedFailover": (p) => `Potência insuficiente para o failover de ${p.rack}: as alimentações A e B consomem juntas ${p.percent}% do limite de uma alimentação.`,
} satisfies Dict;
