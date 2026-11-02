import { LOCALE, type Dict } from "../lang";

// IA do desk: as páginas de IA dos desks hospedados, os artigos sugeridos e as notas e a linha contábil do Answer Bot.
const n = (x: unknown) => Number(x).toLocaleString(LOCALE);
const m = (x: unknown) => (Number(x) / 1e6).toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default {
  "ledger.answerBot": (p) => `Answer Bot: ${Number(p.n).toLocaleString(LOCALE)} resoluções`,
  "desk.note.botTried": () => "Sugeriu um artigo",
  "desk.note.botSolved": () => "Resolvido com um artigo",
  "ai.feature": () => "Recurso",
  "ai.status": () => "Status",
  "ai.on": () => "Ativado",
  "ai.off": () => "Desativado",
  "ai.solved": () => "Resoluções automáticas este mês",
  "ai.tried": () => "Tickets passados a agentes este mês",
  "ai.fee": () => "Preço por resolução",
  "ai.zd.group": () => "IA",
  "ai.zd.page.agents": () => "Agentes de IA",
  "ai.zd.suggestedArticles": () => "Sugestões de artigos",
  "ai.zd.answerBot": () => "Answer Bot",
  "ai.zd.suggested": () => "Artigos sugeridos",
  "ai.fd.page.freddie": () => "Freddie",
  "ai.fd.suggestedArticles": () => "Soluções sugeridas",
  "ai.fd.answerBot": () => "Freddie Answer Bot",
  "ai.fd.suggested": () => "Soluções sugeridas",
  "ledger.deskAiAddon": (p) => `Complemento de IA do ${p.name}`,
  "ai.addonOf": (p) => `Complemento de IA do ${p.name}`,
  "ai.openPage": () => "Configurações de IA",
  "ai.drafts": () => "Rascunhos este mês",
  "ai.agentReplies": () => "Respostas do agente este mês",
  "ai.tokenCost": () => "Custo de tokens este mês",
  "ai.addonFee": () => "Complemento por mês",
  "ai.draft": () => "Rascunho",
  "ai.sendDraft": () => "Enviar rascunho",
  "ai.zd.autoAnswer": () => "Agentes de IA",
  "ai.zd.drafting": () => "Sugestões de resposta",
  "ai.fd.autoAnswer": () => "Freddie AI Agent",
  "ai.fd.drafting": () => "Freddie Copilot",
  "ledger.deskAi": (p) => `IA do desk: ${n(p.attempts)} respostas, ${n(p.drafts)} rascunhos, ${m(p.tokens)} M de tokens`,
} satisfies Dict;
