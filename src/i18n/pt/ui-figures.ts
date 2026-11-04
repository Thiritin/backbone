import type { Dict } from "../lang";

// Figures in the rooms, the order list by the clock and the remote hands rate.
export default {
  "figures.reception": () => "Receção",
  "figures.you": () => "Você",
  "figures.hover": (p) => `${p.name}, ${p.job}`,
  "figures.chip.current": (p) => `${p.kind} ${p.done} / ${p.total} min`,
  "figures.chip.queued": (p) => `${p.kind} ${p.total} min`,
  "figures.cancel": () => "Cancelar",
  "figures.handsRate": () => "Mãos remotas por hora",
} satisfies Dict;
