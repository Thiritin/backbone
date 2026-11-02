// Company email: the contract every mail lane builds on (docs/design/plans/mail-core.md, State).
export type SysFolder = "inbox" | "sent" | "drafts" | "junk" | "trash" | "archive";
export type MailRole = "owner" | "sales" | "support" | "abuse";
export type MailKind = "support" | "order" | "notice" | "licence" | "invoice" | "bank" | "registrar" | "authority" | "host" | "staff"
  | "newsletter" | "promotion" | "spam" | "bounce" | "system" | "reply" | "alert";
export type MailParams = Record<string, string | number>;

// One billing relationship with a provider, and the mailboxes it holds.
export interface MailTenant {
  id: string;                  // "tn1"
  host: string;                // id in MAIL_HOSTS: "gmix", "goggle", "ionose", "lookout" or "self"
  domain: string;              // "gmix.com" for a GMix tenant, else the company domain
  plan: string;                // tier or edition id of the provider
  since: number;
  verified: boolean;           // the domain was proven; GMix tenants always are
  endsAt: number | null;       // cancelled: billing stops here, the boxes go after the provider's grace
  clusterId?: string;          // the mail server of a "self" tenant
  admin: string | null;        // the account id of the tenant's administrator: the first mailbox created in it
  locked?: true;               // the 2022 conversion lock: sign-in is refused and incoming mail bounces, as for a closed box
}

export interface MailAccount {
  id: string;                  // "mb12"
  tenant: string;              // MailTenant.id; the host and the plan come from it
  local: string;               // lower case, before the @
  domain: string;              // copied from the tenant
  title: string;              // sender name shown on outgoing mail, "Support"
  password: string;            // set at creation, plain text like the vault's saved logins
  reset: { code: string; letter: string; tries?: number } | null;  // an open Forgot password request: the code, the id of the letter that carries it, wrong codes so far
  employee: string | null;     // the Employee.id whose mailbox this is, when hiring made it
  shared?: true;               // a shared mailbox: no password and no direct sign-in, opened from the other mailboxes of its tenant
  external?: boolean;          // "Allow external programs to fetch mail": IMAP and POP logins fail while it is false; new GMix boxes start false
  prefs?: Record<string, string | number | boolean>;  // webmail preferences, at most 30 keys; core reads spam, spamAction and imapDelete
  roles: MailRole[];           // roles the player assigned; the name adds more
  aliases: string[];           // extra local parts on the same domain
  quotaMb: number | null;      // null follows the plan; own servers store the player's value
  usedKb: number;              // stored messages plus the folded bucket
  older: { n: number; kb: number }; // mail the retention cap folded away
  forward: { to: string; keep: boolean } | null;
  vacation: { on: boolean; subject: string; text: string; until: number | null } | null;
  trained: number;             // junk reports, raises the filter catch rate on own servers
  junkCaught: number;          // junk the host caught, decaying by 1/30 a day; the Junk folder shows it as a count
  dropped: number;             // inbound messages rejected for this box (full, closed)
  createdAt: number;
  closedAt: number | null;     // set while a box waits for deletion after its tenant ended
}

// accountId is a MailAccount.id, or the reserved "pear" for the client-held folders mail-client stores.
export interface Folder { id: string; accountId: string; name: string; parent: string | null; label?: true; colour?: number; hidden?: true }

export type Attachment = { k: "key"; order: string } | { k: "doc"; id: string } | { k: "invoice"; id: string } | { k: "file"; name: string; kb: number };

export interface Message {
  id: string;                  // "msg204"
  thread: string;              // the ticket id for a ticket thread, else the id of the first message
  folder: string;              // a SysFolder or a Folder.id
  from: string;                // sender ref: "n:<display name>", "cust:<customer id>", "acct:<account id>", "ext:<address>", "daemon"
  to: string;                  // recipient address as written, so aliases and catch-all stay visible
  cc?: string[];
  bcc?: string[];              // kept on the Sent copy only; the delivered copies do not carry it
  auto?: true;                 // an auto-reply; hosts with loop protection never answer one
  kind: MailKind;
  topic: string;               // template tail for ticket.mail.<topic>.subject/.text; "" for tickets and own text
  p?: MailParams;
  own?: { subject: string; text: string };  // written by the player, at most 2000 characters
  ticket?: string;             // this message is the envelope of that ticket
  att?: Attachment[];
  at: number;                  // arrival in game minutes, so a client's check delay is real
  kb: number;
  read?: true; star?: true; ans?: true; fwd?: true;  // absent means false, which keeps the save small
  flag?: number;               // colour flag 1 to 7, which Pear Mail sets and webmail may ignore
  draft?: true;
  labels?: string[];           // Folder ids with label set, on label hosts only
  prev?: string;               // folder before Trash, used by Restore
  re?: string;                 // id of the message answered
  late?: true;                 // delivered after waiting in the queue
  snooze?: number;             // hour the message returns to the top of the Inbox as unread; it is out of the list until then
  foot?: string;               // i18n key of the host's footer (a free tier's signature), appended when the message is shown
  origin?: string;             // set on client-held copies: the Pear Mail account whose POP download produced it
}

export interface MailCond { field: "from" | "to" | "subject" | "kind" | "size" | "attachment"; op: "contains" | "is" | "starts" | "ends" | "over"; value: string | number }
export type MailAct = { do: "move"; folder: string } | { do: "label"; label: string } | { do: "star" } | { do: "read" } | { do: "forward"; to: string }
  | { do: "trash" } | { do: "junk" } | { do: "notJunk" } | { do: "stop" };
export interface MailRule { id: string; name: string; on: boolean; match: "all" | "any"; conds: MailCond[]; acts: MailAct[] }
export interface ServerFilter extends MailRule { accountId: string }

// An address that delivers a copy to each member mailbox and holds no mail itself (Goggle Groups, a Lookout distribution list).
export interface MailGroup { id: string; tenant: string; local: string; title: string; members: string[]; label: string | null }

// A continuing collect rule: the target mailbox pulls new Inbox mail of another own mailbox (GMix Mail Collector, Gmial Check mail from other accounts).
export interface FetchRule {
  id: string; accountId: string; source: string; proto: "pop" | "imap";
  every: number;               // hours between runs, 1 to 24
  leave: boolean;              // keep the copy on the source
  folder: string | null; label: string | null;  // where the collected mail lands in the target
  lastAt: number; err: string | null;
}

// One delivery outcome, kept for Lookout 365 Message trace: the last 200 entries of the last 7 days.
export interface TraceEntry {
  at: number; from: string; to: string; kind: MailKind; topic: string;
  result: "accepted" | "filtered" | "quarantined" | "queued" | "bounced";
  why: string;                 // reason key tail: ok, filter, junk, full, down, unknown, closed, stale
  account: string | null;
}
// ClientAccount and ClientRule are defined by mail-client (ClientRule extends MailRule with its own actions) and stored in s.pearMail.

export interface DeskChannel {
  id: string; accountId: string; desk: string;
  after: "keep" | "read" | "move" | "delete"; folder: string | null;  // what the desk does with an imported message
  since: number;
  // support-desk adds its own fields (department, mode, fetch interval) beside these.
}

export interface Queued { accountId: string; msg: Message; until: number; why: "down" | "full" }

export interface MailState {
  tenants: MailTenant[];
  accounts: MailAccount[];
  primary: string;                          // account id: owner mail and the last fallback of every role
  catchAll: string | null;                  // account id that takes unknown local parts of the company domain
  contacts: Record<string, string>;         // source id to the address that source writes to, see Routing
  folders: Folder[];                        // custom folders and labels
  msgs: Record<string, Message[]>;          // by account id, newest last
  filters: ServerFilter[];
  queue: Queued[];                          // inbound mail waiting for a down host or a full box
  channels: DeskChannel[];
  groups: MailGroup[];
  snoozed: { account: string; id: string; until: number }[];  // at most 50 per mailbox, flushed by the hourly pass
  fetch: FetchRule[];
  trace: TraceEntry[];
  retired: { address: string; until: number }[];  // addresses removed recently, still written to by old contacts
  seen: number;                             // highest ticket number that has an envelope
}
