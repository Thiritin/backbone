import type { Dict } from "../lang";

// Figures in the rooms, the order list by the clock and the remote hands rate.
export default {
  "figures.reception": () => "Reception",
  "figures.you": () => "Tu",
  "figures.hover": (p) => `${p.name}, ${p.job}`,
  "figures.chip.current": (p) => `${p.kind} ${p.done} / ${p.total} min`,
  "figures.chip.queued": (p) => `${p.kind} ${p.total} min`,
  "figures.cancel": () => "Annulla",
  "figures.handsRate": () => "Mani remote all'ora",
} satisfies Dict;
