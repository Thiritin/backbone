import { LOCALE, type Dict } from "../lang";

// IA del desk: las páginas de IA de los desks alojados, los artículos sugeridos y las notas y la línea contable del Answer Bot.
const n = (x: unknown) => Number(x).toLocaleString(LOCALE);
const m = (x: unknown) => (Number(x) / 1e6).toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

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
  "ledger.deskAiAddon": (p) => `Complemento de IA de ${p.name}`,
  "ai.addonOf": (p) => `Complemento de IA de ${p.name}`,
  "ai.openPage": () => "Ajustes de IA",
  "ai.drafts": () => "Borradores este mes",
  "ai.agentReplies": () => "Respuestas del agente este mes",
  "ai.tokenCost": () => "Coste de tokens este mes",
  "ai.addonFee": () => "Complemento al mes",
  "ai.draft": () => "Borrador",
  "ai.sendDraft": () => "Enviar borrador",
  "ai.zd.autoAnswer": () => "Agentes de IA",
  "ai.zd.drafting": () => "Sugerencias de respuesta",
  "ai.fd.autoAnswer": () => "Freddie AI Agent",
  "ai.fd.drafting": () => "Freddie Copilot",
  "ledger.deskAi": (p) => `IA del desk: ${n(p.attempts)} respuestas, ${n(p.drafts)} borradores, ${m(p.tokens)} M de tokens`,
} satisfies Dict;
