import { LOCALE, type Dict } from "../lang";

// IA del desk: le pagine IA dei desk ospitati, gli articoli suggeriti e le note e la riga contabile dell’Answer Bot.
export default {
  "ledger.answerBot": (p) => `Answer Bot: ${Number(p.n).toLocaleString(LOCALE)} risoluzioni`,
  "desk.note.botTried": () => "Ha suggerito un articolo",
  "desk.note.botSolved": () => "Risolto con un articolo",
  "ai.feature": () => "Funzionalità",
  "ai.status": () => "Stato",
  "ai.on": () => "Attivo",
  "ai.off": () => "Disattivo",
  "ai.solved": () => "Risoluzioni automatiche questo mese",
  "ai.tried": () => "Ticket passati agli agenti questo mese",
  "ai.fee": () => "Prezzo per risoluzione",
  "ai.zd.group": () => "IA",
  "ai.zd.page.agents": () => "Agenti IA",
  "ai.zd.suggestedArticles": () => "Suggerimenti di articoli",
  "ai.zd.answerBot": () => "Answer Bot",
  "ai.zd.suggested": () => "Articoli suggeriti",
  "ai.fd.page.freddie": () => "Freddie",
  "ai.fd.suggestedArticles": () => "Soluzioni suggerite",
  "ai.fd.answerBot": () => "Freddie Answer Bot",
  "ai.fd.suggested": () => "Soluzioni suggerite",
} satisfies Dict;
