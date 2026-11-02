import { LOCALE, type Dict } from "../lang";

// IA du desk : les pages IA des desks hébergés, les articles suggérés, les notes et la ligne comptable de l’Answer Bot.
export default {
  "ledger.answerBot": (p) => `Answer Bot : ${Number(p.n).toLocaleString(LOCALE)} résolutions`,
  "desk.note.botTried": () => "A suggéré un article",
  "desk.note.botSolved": () => "Résolu avec un article",
  "ai.feature": () => "Fonctionnalité",
  "ai.status": () => "Statut",
  "ai.on": () => "Activé",
  "ai.off": () => "Désactivé",
  "ai.solved": () => "Résolutions automatiques ce mois-ci",
  "ai.tried": () => "Tickets transmis aux agents ce mois-ci",
  "ai.fee": () => "Prix par résolution",
  "ai.zd.group": () => "IA",
  "ai.zd.page.agents": () => "Agents IA",
  "ai.zd.suggestedArticles": () => "Suggestions d’articles",
  "ai.zd.answerBot": () => "Answer Bot",
  "ai.zd.suggested": () => "Articles suggérés",
  "ai.fd.page.freddie": () => "Freddie",
  "ai.fd.suggestedArticles": () => "Solutions suggérées",
  "ai.fd.answerBot": () => "Freddie Answer Bot",
  "ai.fd.suggested": () => "Solutions suggérées",
} satisfies Dict;
