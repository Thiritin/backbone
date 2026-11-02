import { LOCALE, type Dict } from "../lang";

// IA do desk: as páginas de IA dos desks hospedados, os artigos sugeridos e as notas e a linha contábil do Answer Bot.
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
} satisfies Dict;
