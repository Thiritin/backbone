import type { Dict } from "../lang";

// Figures in the rooms, the order list by the clock and the remote hands rate.
export default {
  "figures.reception": () => "Empfang",
  "figures.you": () => "Du",
  "figures.hover": (p) => `${p.name}, ${p.job}`,
  "figures.chip.current": (p) => `${p.kind} ${p.done} / ${p.total} min`,
  "figures.chip.queued": (p) => `${p.kind} ${p.total} min`,
  "figures.cancel": () => "Abbrechen",
  "figures.handsRate": () => "Remote Hands pro Stunde",
} satisfies Dict;
