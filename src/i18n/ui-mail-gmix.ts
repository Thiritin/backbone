import type { Dict } from "./lang";

export default {
  "mail.gmix.plan.free": () => "FreeMix",
  "mail.gmix.plan.pro": () => "ProMix",
  "mail.gmix.plan.top": () => "TopMix",
  "mail.gmix.folder.inbox": () => "Inbox",
  "mail.gmix.folder.sent": () => "Sent",
  "mail.gmix.folder.drafts": () => "Drafts",
  "mail.gmix.folder.junk": () => "Spam",
  "mail.gmix.folder.trash": () => "Trash",
  "mail.gmix.folder.archive": () => "Archive",
} satisfies Dict;
