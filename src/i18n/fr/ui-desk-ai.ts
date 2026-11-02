import { LOCALE, type Dict } from "../lang";

// IA du desk : les pages IA des desks hébergés, les articles suggérés, les notes et la ligne comptable de l’Answer Bot.
const n = (x: unknown) => Number(x).toLocaleString(LOCALE);
const m = (x: unknown) => (Number(x) / 1e6).toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

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
  "ledger.deskAiAddon": (p) => `Module IA ${p.name}`,
  "ai.addonOf": (p) => `Module IA ${p.name}`,
  "ai.openPage": () => "Paramètres IA",
  "ai.drafts": () => "Brouillons ce mois-ci",
  "ai.agentReplies": () => "Réponses de l’agent ce mois-ci",
  "ai.tokenCost": () => "Coût des tokens ce mois-ci",
  "ai.addonFee": () => "Module par mois",
  "ai.draft": () => "Brouillon",
  "ai.sendDraft": () => "Envoyer le brouillon",
  "ai.zd.autoAnswer": () => "Agents IA",
  "ai.zd.drafting": () => "Suggestions de réponse",
  "ai.fd.autoAnswer": () => "Freddie AI Agent",
  "ai.fd.drafting": () => "Freddie Copilot",
  "ledger.deskAi": (p) => `IA du desk : ${n(p.attempts)} réponses, ${n(p.drafts)} brouillons, ${m(p.tokens)} M de tokens`,
} satisfies Dict;
