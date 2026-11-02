import { LOCALE, type Dict } from "../lang";

// Desk-KI: die KI-Seiten der gehosteten Desks, die Beitragsvorschläge sowie Notizen und Buchungszeile des Answer Bots.
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
} satisfies Dict;
