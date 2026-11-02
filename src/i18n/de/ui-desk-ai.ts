import { LOCALE, type Dict } from "../lang";

// Desk-KI: die KI-Seiten der gehosteten Desks, die Beitragsvorschläge sowie Notizen und Buchungszeile des Answer Bots.
const n = (x: unknown) => Number(x).toLocaleString(LOCALE);
const m = (x: unknown) => (Number(x) / 1e6).toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default {
  "ledger.answerBot": (p) => `Answer Bot: ${Number(p.n).toLocaleString(LOCALE)} Lösungen`,
  "desk.note.botTried": () => "Hat einen Beitrag vorgeschlagen",
  "desk.note.botSolved": () => "Mit einem Beitrag gelöst",
  "ai.feature": () => "Funktion",
  "ai.status": () => "Status",
  "ai.on": () => "An",
  "ai.off": () => "Aus",
  "ai.solved": () => "Automatische Lösungen in diesem Monat",
  "ai.tried": () => "An Agenten übergebene Tickets in diesem Monat",
  "ai.fee": () => "Preis pro Lösung",
  "ai.zd.group": () => "KI",
  "ai.zd.page.agents": () => "KI-Agenten",
  "ai.zd.suggestedArticles": () => "Beitragsvorschläge",
  "ai.zd.answerBot": () => "Answer Bot",
  "ai.zd.suggested": () => "Vorgeschlagene Beiträge",
  "ai.fd.page.freddie": () => "Freddie",
  "ai.fd.suggestedArticles": () => "Vorgeschlagene Lösungen",
  "ai.fd.answerBot": () => "Freddie Answer Bot",
  "ai.fd.suggested": () => "Vorgeschlagene Lösungen",
  "ledger.deskAiAddon": (p) => `${p.name} KI-Add-on`,
  "ai.addonOf": (p) => `${p.name} KI-Add-on`,
  "ai.openPage": () => "KI-Einstellungen",
  "ai.drafts": () => "Entwürfe in diesem Monat",
  "ai.agentReplies": () => "Antworten des Agenten in diesem Monat",
  "ai.tokenCost": () => "Token-Kosten in diesem Monat",
  "ai.addonFee": () => "Add-on pro Monat",
  "ai.draft": () => "Entwurf",
  "ai.sendDraft": () => "Entwurf senden",
  "ai.zd.autoAnswer": () => "KI-Agenten",
  "ai.zd.drafting": () => "Antwortvorschläge",
  "ai.fd.autoAnswer": () => "Freddie AI Agent",
  "ai.fd.drafting": () => "Freddie Copilot",
  "ledger.deskAi": (p) => `Desk-KI: ${n(p.attempts)} Antworten, ${n(p.drafts)} Entwürfe, ${m(p.tokens)} Mio. Tokens`,
} satisfies Dict;
