import { LOCALE, type Dict } from "../lang";

// IA del desk: le pagine IA dei desk ospitati, gli articoli suggeriti e le note e la riga contabile dell’Answer Bot.
const n = (x: unknown) => Number(x).toLocaleString(LOCALE);
const m = (x: unknown) => (Number(x) / 1e6).toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

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
  "ledger.deskAiAddon": (p) => `Add-on IA di ${p.name}`,
  "ai.addonOf": (p) => `Add-on IA di ${p.name}`,
  "ai.openPage": () => "Impostazioni IA",
  "ai.drafts": () => "Bozze questo mese",
  "ai.agentReplies": () => "Risposte dell’agente questo mese",
  "ai.tokenCost": () => "Costo dei token questo mese",
  "ai.addonFee": () => "Add-on al mese",
  "ai.draft": () => "Bozza",
  "ai.sendDraft": () => "Invia bozza",
  "ai.zd.autoAnswer": () => "Agenti IA",
  "ai.zd.drafting": () => "Suggerimenti di risposta",
  "ai.fd.autoAnswer": () => "Freddie AI Agent",
  "ai.fd.drafting": () => "Freddie Copilot",
  "ledger.deskAi": (p) => `IA del desk: ${n(p.attempts)} risposte, ${n(p.drafts)} bozze, ${m(p.tokens)} M di token`,
} satisfies Dict;
