import { LOCALE, type Dict } from "./lang";

// Desk AI: the AI pages of the hosted desks, the suggested articles and the answer bot's notes and ledger line.
const n = (x: unknown) => Number(x).toLocaleString(LOCALE);
const m = (x: unknown) => (Number(x) / 1e6).toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

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
  "ledger.deskAiAddon": (p) => `${p.name} AI add-on`,
  "ai.addonOf": (p) => `${p.name} AI add-on`,
  "ai.openPage": () => "AI settings",
  "ai.drafts": () => "Drafts this month",
  "ai.agentReplies": () => "Agent replies this month",
  "ai.tokenCost": () => "Token cost this month",
  "ai.addonFee": () => "Add-on per month",
  "ai.draft": () => "Draft",
  "ai.sendDraft": () => "Send draft",
  "ai.zd.autoAnswer": () => "AI agents",
  "ai.zd.drafting": () => "Reply suggestions",
  "ai.fd.autoAnswer": () => "Freddie AI Agent",
  "ai.fd.drafting": () => "Freddie Copilot",
  "ledger.deskAi": (p) => `Desk AI: ${n(p.attempts)} replies, ${n(p.drafts)} drafts, ${m(p.tokens)}M tokens`,
} satisfies Dict;
