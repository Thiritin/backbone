import { LOCALE, type Dict } from "../lang";

// IA del desk: las páginas de IA de los desks alojados, los artículos sugeridos y las notas y la línea contable del Answer Bot.
export default {
  "ledger.answerBot": (p) => `Answer Bot: ${Number(p.n).toLocaleString(LOCALE)} resoluciones`,
  "desk.note.botTried": () => "Sugirió un artículo",
  "desk.note.botSolved": () => "Resuelto con un artículo",
  "ai.feature": () => "Función",
  "ai.status": () => "Estado",
  "ai.on": () => "Activado",
  "ai.off": () => "Desactivado",
  "ai.solved": () => "Resoluciones automáticas este mes",
  "ai.tried": () => "Tickets pasados a agentes este mes",
  "ai.fee": () => "Precio por resolución",
  "ai.zd.group": () => "IA",
  "ai.zd.page.agents": () => "Agentes de IA",
  "ai.zd.suggestedArticles": () => "Sugerencias de artículos",
  "ai.zd.answerBot": () => "Answer Bot",
  "ai.zd.suggested": () => "Artículos sugeridos",
  "ai.fd.page.freddie": () => "Freddie",
  "ai.fd.suggestedArticles": () => "Soluciones sugeridas",
  "ai.fd.answerBot": () => "Freddie Answer Bot",
  "ai.fd.suggested": () => "Soluciones sugeridas",
} satisfies Dict;
