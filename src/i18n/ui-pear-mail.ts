import type { Dict } from "./lang";

export default {
  "apps.about.Pear Mail": () => "Reads and sends the mail of every account you add.",
  "pearMail.build": (p) => `Pear Mail ${p.version}`,
  "pearMail.welcome.title": () => "Welcome to Pear Mail",
  "pearMail.welcome.add": () => "Add your first account",
  "pearMail.activity.checked": (p) => `Checked mail for ${p.account}: ${p.count} new`,
  "core.notify.newMail": () => "New mail",
  "event.newMail.title": () => "New mail",
  "event.newMail.text": (p) => `A new message arrived in ${p.account}.`,
  "event.newMailMore.title": () => "New mail",
  "event.newMailMore.text": (p) => `${p.count} more new messages arrived in ${p.account}.`,
  "error.mailNoBox": () => "There is no mailbox with this address on the server.",
  "error.mailAuth": () => "The server refused the password.",
  "error.mailExternal": () => "The server does not allow this mail program to connect.",
  "error.mailDown": () => "The mail server is not responding.",
  "error.mailDns": () => "The domain's mail does not reach this server.",
  "error.mailClosed": () => "This mailbox has been closed.",
  "error.mailPoll": () => "The server refused a check this soon after the last one.",
} satisfies Dict;
