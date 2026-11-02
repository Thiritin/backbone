import type { Dict } from "./lang";

// Switching mail providers on their sites (docs/design/plans/webmail-consumer.md, section 6).
export default {
  "mailswitch.title": () => "Still at this provider",
  "mailswitch.mail": (p) => (Number(p.n) === 1 ? "1 message has not been imported at the new provider." : `${p.n} messages have not been imported at the new provider.`),
  "mailswitch.roles": () => "A mailbox here is still the primary mailbox or receives sales, support or abuse mail.",
  "mailswitch.collectors": (p) => (Number(p.n) === 1 ? "1 mailbox still collects mail from here." : `${p.n} mailboxes still collect mail from here.`),
  "mailswitch.source": () => "Old address",
  "mailswitch.password": () => "Password",
  "mailswitch.target": () => "Into mailbox",
  "mailswitch.start": () => "Start import",
  "mailswitch.from": () => "From",
  "mailswitch.to": () => "To",
  "mailswitch.status": () => "Status",
  "mailswitch.running": (p) => `Running until ${p.date}`,
  "mailswitch.done": (p) => (Number(p.n) === 1 ? "1 message imported" : `${p.n} messages imported`),
} satisfies Dict;
