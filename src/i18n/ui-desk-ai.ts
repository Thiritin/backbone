import { LOCALE, type Dict } from "./lang";

// Desk AI: the AI pages of the hosted desks, the suggested articles and the answer bot's notes and ledger line.
export default {
  "ledger.answerBot": (p) => `Answer bot: ${Number(p.n).toLocaleString(LOCALE)} resolutions`,
  "desk.note.botTried": () => "Suggested an article",
  "desk.note.botSolved": () => "Solved with an article",
  "ai.feature": () => "Feature",
  "ai.status": () => "Status",
  "ai.on": () => "On",
  "ai.off": () => "Off",
  "ai.solved": () => "Automated resolutions this month",
  "ai.tried": () => "Tickets passed to agents this month",
  "ai.fee": () => "Price per resolution",
  "ai.zd.group": () => "AI",
  "ai.zd.page.agents": () => "AI agents",
  "ai.zd.suggestedArticles": () => "Article suggestions",
  "ai.zd.answerBot": () => "Answer Bot",
  "ai.zd.suggested": () => "Suggested articles",
  "ai.fd.page.freddie": () => "Freddie",
  "ai.fd.suggestedArticles": () => "Suggested solutions",
  "ai.fd.answerBot": () => "Freddie Answer Bot",
  "ai.fd.suggested": () => "Suggested solutions",
} satisfies Dict;
