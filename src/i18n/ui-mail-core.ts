import type { Dict } from "./lang";

export default {
  "mail.folder.inbox": () => "Inbox",
  "mail.folder.sent": () => "Sent",
  "mail.folder.drafts": () => "Drafts",
  "mail.folder.junk": () => "Junk",
  "mail.folder.trash": () => "Trash",
  "mail.folder.archive": () => "Archive",
  "mail.daemon": () => "Mail Delivery System",
  "ticket.mail.mailWelcome.subject": (p) => `Welcome to ${p.provider}`,
  "ticket.mail.mailWelcome.text": (p) => `Your mailbox ${p.address} is ready. Your password is ${p.password}.`,
} satisfies Dict;
