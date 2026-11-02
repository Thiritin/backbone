// Addresses of the four desk sites (docs/design/plans/support-desk.md, The four desks). Each desk has its own page table,
// copied from the real product; <n> is a ticket number, <id> an article, category or mailbox id, <view>, <section>,
// <folder> and <log> name a screen.
import type { DeskId } from "../10-catalog/desks";

const PAGES = {
  ostickit: {
    home: "/", open: "/open.php", status: "/view.php", ticket: "/tickets.php?id=<n>", kb: "/kb/", kbCategory: "/kb/faq.php?cid=<id>", kbFaq: "/kb/faq.php?id=<id>",
    setup: "/setup/", login: "/scp/login.php", scp: "/scp/", dashboard: "/scp/dashboard.php", queue: "/scp/tickets.php?status=<view>",
    staffTicket: "/scp/tickets.php?id=<n>", newTicket: "/scp/tickets.php?a=open", tasks: "/scp/tasks.php", users: "/scp/users.php",
    staffKb: "/scp/kb.php", directory: "/scp/directory.php", profile: "/scp/profile.php",
    admin: "/scp/admin.php", settings: "/scp/settings.php?t=<section>", helpTopics: "/scp/helptopics.php", filters: "/scp/filters.php",
    slas: "/scp/slas.php", pages: "/scp/pages.php", emails: "/scp/emails.php", email: "/scp/emails.php?id=<id>", banlist: "/scp/banlist.php",
    templates: "/scp/templates.php", diagnostic: "/scp/emailtest.php", staff: "/scp/staff.php", teams: "/scp/teams.php",
    departments: "/scp/departments.php", logs: "/scp/logs.php",
  },
  zendusk: {
    hc: "/hc", hcCategory: "/hc/categories/<id>", hcArticle: "/hc/articles/<id>", hcNew: "/hc/requests/new", hcRequests: "/hc/requests",
    hcRequest: "/hc/requests/<n>", signIn: "/access/login",
    agent: "/agent", view: "/agent/filters/<view>", ticket: "/agent/tickets/<n>", users: "/agent/users", organizations: "/agent/organizations",
    reporting: "/agent/reporting", search: "/agent/search", admin: "/agent/admin", adminScreen: "/agent/admin/<section>", start: "/agent/get-started",
  },
  freshdusk: {
    portal: "/support/home", portalNew: "/support/tickets/new", portalTickets: "/support/tickets", portalTicket: "/support/tickets/<n>",
    solutions: "/support/solutions", solution: "/support/solutions/articles/<id>", login: "/support/login",
    dashboard: "/helpdesk", tickets: "/helpdesk/tickets", view: "/helpdesk/tickets/view/<view>", ticket: "/helpdesk/tickets/<n>",
    newTicket: "/helpdesk/tickets/new", ticketMint: "/a/tickets/<n>", contacts: "/contacts", companies: "/companies",
    agentSolutions: "/solution/categories", reports: "/reports", admin: "/admin", adminScreen: "/admin/<section>",
  },
  freescoot: {
    dashboard: "/", login: "/login", mailbox: "/mailbox/<id>", folder: "/mailbox/<id>/<folder>", conversation: "/conversation/<n>",
    customers: "/customers", search: "/search", reports: "/reports", settings: "/app-settings/<section>", mailboxes: "/mailboxes",
    mailboxSettings: "/mailbox/settings/<id>", connection: "/mailbox/connection-settings/<id>/<section>", autoReply: "/mailbox/auto-reply/<id>",
    users: "/users", modules: "/modules", logs: "/logs/<log>", system: "/system",
  },
} as const satisfies Record<DeskId, Record<string, string>>;

export type DeskPage<D extends DeskId = DeskId> = keyof (typeof PAGES)[D] & string;
export type DeskArgs = Partial<Record<"n" | "id" | "view" | "section" | "folder" | "log", string>>;
export interface DeskRoute { page: string; args: DeskArgs }

export const deskPages = <D extends DeskId>(desk: D): DeskPage<D>[] => Object.keys(PAGES[desk]) as DeskPage<D>[];

const slot = (v: string): string | null => /^<(\w+)>$/.exec(v)?.[1] ?? null;
const trim = (p: string): string => (p.length > 1 ? p.replace(/\/+$/, "") : p);

export function deskPath<D extends DeskId>(desk: D, page: DeskPage<D>, args: DeskArgs = {}): string {
  const tpl: string = (PAGES[desk] as Record<string, string>)[page];
  return tpl.replace(/<(\w+)>/g, (_, k: keyof DeskArgs) => encodeURIComponent(args[k] ?? ""));
}

// The args a path carries when it fits the template exactly, else null. Query keys the template does not name are ignored.
function fit(tpl: string, path: string): DeskArgs | null {
  const [tp, tq = ""] = tpl.split("?"), [pp, pq = ""] = path.split("?");
  const ts = trim(tp).split("/"), ps = trim(pp).split("/"), args: Record<string, string> = {};
  if (ps.length !== ts.length) return null;
  for (let i = 0; i < ts.length; i++) {
    const k = slot(ts[i]);
    if (k) { if (!ps[i]) return null; args[k] = decodeURIComponent(ps[i]); } else if (ts[i] !== ps[i]) return null;
  }
  const q = new URLSearchParams(pq);
  for (const [key, want] of new URLSearchParams(tq)) {
    const k = slot(want), got = q.get(key);
    if (k) { if (!got) return null; args[k] = got; } else if (got !== want) return null;
  }
  return args;
}

// Templates with more query keys and fewer slots first, so /scp/tickets.php?id=5 is a ticket and /mailbox/settings/1 no folder.
const weight = (tpl: string): number => (tpl.split("?")[1]?.split("&").length ?? 0) * 10 - (tpl.match(/</g)?.length ?? 0);
const ORDER = Object.fromEntries((Object.keys(PAGES) as DeskId[]).map((d) => [d, Object.entries(PAGES[d] as Record<string, string>).sort((a, b) => weight(b[1]) - weight(a[1]))]));

export function parseDesk(desk: DeskId, path: string): DeskRoute | null {
  for (const [page, tpl] of ORDER[desk]) {
    const args = fit(tpl, path);
    if (args) return { page, args };
  }
  return null;
}
