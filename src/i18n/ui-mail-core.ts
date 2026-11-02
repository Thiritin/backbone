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
  "mail.host.gmix": () => "GMix",
  "mail.host.goggle": () => "Goggle Workspace",
  "mail.host.ionose": () => "Hosted Exchange by Ionose",
  "mail.host.lookout": () => "Lookout 365",
  "mail.host.self": () => "Own mail server",
  "mail.footer.gmix": () => "Sent with GMix FreeMix. Get your free address at gmix.com.",
} satisfies Dict;
