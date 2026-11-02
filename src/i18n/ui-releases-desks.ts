import type { Dict } from "./lang";

// Headline features of each self-hosted desk release, joined by "|", for the News page of its site.
export default {
  "swnews.ostickit.1.3": () => "Departments and help topics|Canned responses|Client portal to open and check tickets|POP3 and IMAP mail fetch",
  "swnews.ostickit.1.6": () => "Reworked staff control panel|Ban list for unwanted senders|Faster ticket queues",
  "swnews.ostickit.1.7": () => "Ticket filters|SLA plans|Client knowledge base|Dashboard reports",
  "swnews.ostickit.1.9": () => "Client sign-in|User directory and organizations|Custom ticket number formats",
  "swnews.ostickit.1.10": () => "Tasks|Advanced search|Roles and nested departments",
  "swnews.ostickit.1.12": () => "System ban list|Custom queue columns",
  "swnews.ostickit.1.14": () => "Merge and link tickets|SLA schedules|Fetch from a mail folder",
  "swnews.ostickit.1.15": () => "Agent and department visibility|Two-factor sign-in",
  "swnews.ostickit.1.16": () => "Runs on PHP 8|Security fixes",
  "swnews.ostickit.1.17": () => "OAuth2 sign-in for mail accounts|Updated mail library",
  "swnews.ostickit.1.18": () => "New mail library|Security fixes",
  "swnews.freescoot.1.0": () => "Shared mailboxes|Assignment and search|Customer profile with earlier conversations|Modules",
  "swnews.freescoot.1.6": () => "Merge conversations|Faster mail fetch",
  "swnews.freescoot.1.8": () => "Runs on PHP 8|New modules",
} satisfies Dict;
