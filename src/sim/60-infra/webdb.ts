// docs/design/web-hosting.md 4.2: the tables inside a web space's databases as phpMyAdmon shows them. Tables and rows derive
// from the app, the seed and the database's size; only rows the player edited or inserted are stored, in the overlay's rows.
import { md5 } from "../00-core/md5";
import { hashRng, rand, type Rng } from "../00-core/rng";
import { dateOf, yearOf } from "../00-core/time";
import { idNum } from "../10-catalog/usage";
import type { GameState } from "../50-state";
import { accountUse } from "../80-business/readouts";
import type { Webspace } from "./webspace";

// bytes: average row length. weight: share of the database's size. base: rows a fresh install ships with.
// traffic: grows with the site's visits. from: the first year the app creates the table.
// cols: "name type generator"; the first column is the row's key.
interface TableDef { bytes: number; weight: number; base: number; traffic?: true; from?: number; cols: string[] }
type Schema = Record<string, TableDef>;
const T = (bytes: number, weight: number, base: number, cols: string, more: Partial<TableDef> = {}): TableDef =>
  ({ bytes, weight, base, cols: cols.split(", "), ...more });
const traffic = { traffic: true as const };

export const SCHEMAS: Record<string, Schema> = {
  wordpass: {
    wp_commentmeta: T(120, 1, 0, "meta_id bigint(20) id, comment_id bigint(20) int, meta_key varchar(255) pick:akismet_result|akismet_history, meta_value longtext pick:false|true", traffic),
    wp_comments: T(600, 6, 1, "comment_ID bigint(20) id, comment_post_ID bigint(20) int, comment_author tinytext name, comment_author_email varchar(100) email, comment_date datetime date, comment_content text text, comment_approved varchar(20) pick:1|1|1|0|spam", traffic),
    wp_links: T(200, 0, 7, "link_id bigint(20) id, link_url varchar(255) url, link_name varchar(255) title, link_visible varchar(20) =Y"),
    wp_options: T(900, 4, 120, "option_id bigint(20) id, option_name varchar(64) option, option_value longtext word, autoload varchar(20) pick:yes|yes|no"),
    wp_postmeta: T(150, 8, 1, "meta_id bigint(20) id, post_id bigint(20) int, meta_key varchar(255) pick:_edit_lock|_edit_last|_wp_page_template|_thumbnail_id, meta_value longtext int"),
    wp_posts: T(2500, 30, 2, "ID bigint(20) id, post_author bigint(20) =1, post_date datetime date, post_content longtext text, post_title text title, post_status varchar(20) pick:publish|publish|draft|inherit, post_type varchar(20) pick:post|post|page|attachment|revision"),
    wp_term_relationships: T(30, 0.2, 1, "object_id bigint(20) id, term_taxonomy_id bigint(20) int, term_order int(11) =0"),
    wp_term_taxonomy: T(80, 0.05, 2, "term_taxonomy_id bigint(20) id, term_id bigint(20) int, taxonomy varchar(32) pick:category|post_tag, count bigint(20) int"),
    wp_termmeta: T(60, 0.1, 0, "meta_id bigint(20) id, term_id bigint(20) int, meta_key varchar(255) word, meta_value longtext word", { from: 2015 }),
    wp_terms: T(80, 0.05, 2, "term_id bigint(20) id, name varchar(200) title, slug varchar(200) slug, term_group bigint(10) =0"),
    wp_usermeta: T(120, 0.2, 15, "umeta_id bigint(20) id, user_id bigint(20) int, meta_key varchar(255) pick:nickname|first_name|last_name|wp_capabilities|wp_user_level|show_admin_bar_front, meta_value longtext word"),
    wp_users: T(300, 0.05, 1, "ID bigint(20) id, user_login varchar(60) login, user_pass varchar(64) phpass, user_email varchar(100) email, user_registered datetime date, display_name varchar(250) name"),
  },
  joomlah: {
    jos_banner: T(300, 0.2, 0, "bid int(11) id, name varchar(255) title, clicks int(11) int, imageurl varchar(100) slug"),
    jos_categories: T(400, 0.5, 1, "id int(11) id, title varchar(255) title, alias varchar(255) slug, section varchar(50) =1, published tinyint(1) =1"),
    jos_components: T(300, 0, 33, "id int(11) id, name varchar(50) title, link varchar(255) slug, enabled tinyint(4) =1"),
    jos_contact_details: T(500, 0.2, 0, "id int(11) id, name varchar(255) name, email_to varchar(255) email, published tinyint(1) =1"),
    jos_content: T(3000, 30, 0, "id int(11) id, title varchar(255) title, alias varchar(255) slug, introtext mediumtext text, state tinyint(3) pick:1|1|1|0, created datetime date, hits int(11) int"),
    jos_menu: T(400, 0.5, 1, "id int(11) id, menutype varchar(75) =mainmenu, name varchar(255) title, link text slug, published tinyint(1) =1"),
    jos_modules: T(400, 0.3, 18, "id int(11) id, title text title, position varchar(50) pick:left|right|top|user1|footer, module varchar(50) word, published tinyint(1) =1"),
    jos_plugins: T(200, 0, 45, "id int(11) id, name varchar(100) title, element varchar(100) word, folder varchar(100) pick:content|system|authentication|search, published tinyint(3) =1"),
    jos_session: T(300, 3, 0, "session_id varchar(200) hex, username varchar(150) login, time varchar(14) ts, guest tinyint(4) pick:1|1|1|0", traffic),
    jos_users: T(300, 0.5, 1, "id int(11) id, name varchar(255) name, username varchar(150) login, email varchar(100) email, password varchar(100) md5salt, usertype varchar(25) pick:Registered|Registered|Author, registerDate datetime date"),
  },
  drupel: {
    cache: T(3000, 6, 50, "cid varchar(255) slug, data longblob text, expire int(11) ts, created int(11) ts", traffic),
    comment: T(600, 4, 0, "cid int(11) id, nid int(11) int, uid int(11) int, subject varchar(64) title, hostname varchar(128) ip, created int(11) ts", traffic),
    node: T(400, 6, 0, "nid int(10) id, type varchar(32) pick:page|article|article|story, title varchar(255) title, uid int(11) =1, status int(11) pick:1|1|0, created int(11) ts"),
    node_revision: T(2000, 20, 0, "vid int(10) id, nid int(10) int, title varchar(255) title, body longtext text, timestamp int(11) ts"),
    sessions: T(400, 3, 0, "sid varchar(128) hex, uid int(10) int, hostname varchar(128) ip, timestamp int(11) ts", traffic),
    system: T(800, 0, 80, "filename varchar(255) slug, name varchar(255) word, type varchar(12) pick:module|theme, status int(11) pick:1|0"),
    url_alias: T(150, 1, 0, "pid int(10) id, source varchar(255) slug, alias varchar(255) slug"),
    users: T(300, 0.5, 1, "uid int(10) id, name varchar(60) login, pass varchar(128) md5, mail varchar(254) email, created int(11) ts, status tinyint(4) =1"),
    variable: T(500, 2, 200, "name varchar(128) option, value longblob word"),
    watchdog: T(400, 6, 0, "wid int(11) id, uid int(11) int, type varchar(64) pick:php|page not found|user|cron, message longtext text, hostname varchar(128) ip, timestamp int(11) ts", traffic),
  },
  // The shop systems for the player's own billing: a fresh install holds its admin row and its settings.
  whmCache: {
    tblactivitylog: T(300, 6, 0, "id int(10) id, date datetime date, description text text, user text login, ipaddr text ip", traffic),
    tbladmins: T(400, 0, 0, "id int(10) id, roleid int(1) =1, username text login, password text md5, firstname text name, lastname text last, email text email"),
    tblclients: T(800, 6, 0, "id int(10) id, firstname text name, lastname text last, companyname text title, email text email, datecreated date day, status enum pick:Active|Active|Inactive|Closed"),
    tblconfiguration: T(100, 0, 250, "setting text option, value text word"),
    tbldomains: T(300, 3, 0, "id int(10) id, userid int(10) int, domain text domain, registrationdate date day, status enum pick:Active|Active|Expired|Pending"),
    tblhosting: T(500, 6, 0, "id int(10) id, userid int(10) int, packageid int(10) int, domain text domain, regdate date day, amount decimal(10,2) money, domainstatus enum pick:Active|Active|Suspended|Terminated"),
    tblinvoiceitems: T(300, 12, 0, "id int(10) id, invoiceid int(10) int, description text title, amount decimal(10,2) money"),
    tblinvoices: T(300, 8, 0, "id int(10) id, userid int(10) int, date date day, duedate date day, total decimal(10,2) money, status text pick:Paid|Paid|Paid|Unpaid|Cancelled"),
    tblorders: T(300, 4, 0, "id int(10) id, ordernum bigint(10) int, userid int(10) int, date datetime date, amount decimal(10,2) money, status text pick:Active|Active|Pending|Fraud"),
    tblproducts: T(800, 0, 0, "id int(10) id, type text pick:hostingaccount|reselleraccount|server, name text title, paytype text pick:recurring|onetime"),
    tblticketreplies: T(1500, 6, 0, "id int(10) id, tid int(10) int, date datetime date, message text text, admin text name"),
    tbltickets: T(1500, 3, 0, "id int(10) id, tid text hex, userid int(10) int, date datetime date, title text title, status text pick:Closed|Closed|Answered|Open"),
  },
  modemBill: {
    admin: T(300, 0, 0, "admin_id int(11) id, admin_username varchar(32) login, admin_password varchar(32) md5, admin_realname varchar(64) name, admin_email varchar(64) email"),
    client_info: T(800, 6, 0, "client_id int(11) id, client_fname varchar(64) name, client_lname varchar(64) last, client_email varchar(64) email, client_status tinyint(1) pick:1|1|0"),
    client_invoice: T(300, 8, 0, "invoice_id int(11) id, client_id int(11) int, invoice_date int(11) ts, invoice_amount decimal(10,2) money, invoice_paid tinyint(1) pick:1|1|0"),
    client_package: T(500, 6, 0, "cp_id int(11) id, client_id int(11) int, domain_name varchar(255) domain, cp_status tinyint(1) pick:1|1|0"),
    config: T(100, 0, 120, "config_name varchar(64) option, config_value text word"),
  },
  clientExit: {
    domains: T(300, 3, 0, "id int(11) id, customerid int(11) int, domainname varchar(255) domain, status tinyint(4) pick:1|1|0"),
    invoice: T(300, 8, 0, "id int(11) id, customerid int(11) int, billdate date day, amount decimal(10,2) money, status tinyint(4) pick:1|1|0"),
    package: T(500, 6, 0, "id int(11) id, customerid int(11) int, planid int(11) int, status tinyint(4) pick:1|1|0"),
    setting: T(100, 0, 300, "name varchar(64) option, value text word"),
    users: T(400, 6, 0, "id int(11) id, groupid int(11) pick:1|1|1|2, firstname varchar(64) name, lastname varchar(64) last, email varchar(64) email, password varchar(64) md5"),
  },
  blessta: {
    clients: T(500, 6, 0, "id int(10) id, id_code int(10) int, user_id int(10) int, status enum pick:active|active|inactive"),
    invoices: T(300, 8, 0, "id int(10) id, client_id int(10) int, date_billed datetime date, total decimal(12,4) money, status enum pick:active|active|void"),
    services: T(500, 6, 0, "id int(10) id, client_id int(10) int, pricing_id int(10) int, status enum pick:active|active|suspended|canceled"),
    settings: T(100, 0, 200, "key varchar(255) option, value text word"),
    staff: T(300, 0, 0, "id int(10) id, user_id int(10) int, first_name varchar(64) name, last_name varchar(64) last, email varchar(255) email"),
    users: T(300, 6, 0, "id int(10) id, username varchar(64) login, password varchar(64) bcrypt, date_added datetime date"),
  },
  hostBull: {
    hb_accounts: T(500, 6, 0, "id int(11) id, client_id int(11) int, domain varchar(255) domain, status varchar(20) pick:Active|Active|Suspended|Terminated"),
    hb_admin_access: T(300, 0, 0, "id int(11) id, username varchar(64) login, password varchar(64) md5, firstname varchar(64) name, lastname varchar(64) last, email varchar(128) email"),
    hb_client_details: T(800, 6, 0, "id int(11) id, firstname varchar(64) name, lastname varchar(64) last, email varchar(128) email, datecreated date day"),
    hb_configuration: T(100, 0, 300, "setting varchar(64) option, value text word"),
    hb_invoices: T(300, 8, 0, "id int(11) id, client_id int(11) int, date date day, total decimal(10,2) money, status varchar(20) pick:Paid|Paid|Unpaid|Cancelled"),
  },
  ubersmyth: {
    admins: T(300, 0, 0, "id int(11) id, login varchar(64) login, password varchar(64) md5, email varchar(128) email"),
    clients: T(800, 6, 0, "clientid int(11) id, first varchar(64) name, last varchar(64) last, email varchar(128) email, active tinyint(1) pick:1|1|0"),
    invoices: T(300, 8, 0, "invid int(11) id, clientid int(11) int, date int(11) ts, amount decimal(10,2) money, paid tinyint(1) pick:1|1|0"),
    packages: T(500, 6, 0, "packid int(11) id, clientid int(11) int, desserv varchar(255) domain, active tinyint(1) pick:1|1|0"),
    settings: T(100, 0, 200, "name varchar(64) option, value text word"),
    tickets: T(1500, 3, 0, "ticketid int(11) id, clientid int(11) int, subject varchar(255) title, status tinyint(1) pick:0|0|1"),
  },
  boxBillin: {
    admin: T(300, 0, 0, "id bigint(20) id, role varchar(30) pick:admin|staff, name varchar(255) name, email varchar(255) email, pass varchar(255) bcrypt"),
    client: T(800, 6, 0, "id bigint(20) id, first_name varchar(100) name, last_name varchar(100) last, email varchar(255) email, created_at varchar(35) date"),
    client_order: T(500, 6, 0, "id bigint(20) id, client_id bigint(20) int, title varchar(255) title, status varchar(50) pick:active|active|suspended|canceled"),
    invoice: T(300, 8, 0, "id bigint(20) id, client_id bigint(20) int, due_at varchar(35) date, status varchar(50) pick:paid|paid|unpaid|refunded"),
    setting: T(100, 0, 150, "param varchar(255) option, value text word"),
  },
};

// The table and columns a shop's admin logs in with; step 4 resets the password through it (web-hosting.md 5, step 7).
export const ADMIN_TABLE: Record<string, { table: string; user: string; pass: string }> = {
  whmCache: { table: "tbladmins", user: "username", pass: "password" },
  modemBill: { table: "admin", user: "admin_username", pass: "admin_password" },
  clientExit: { table: "users", user: "email", pass: "password" },
  blessta: { table: "users", user: "username", pass: "password" },
  hostBull: { table: "hb_admin_access", user: "username", pass: "password" },
  ubersmyth: { table: "admins", user: "login", pass: "password" },
  boxBillin: { table: "admin", user: "email", pass: "pass" },
};

export interface DbColumn { name: string; type: string; gen: string }
export interface DbTable { name: string; rows: number; mb: number; engine: "MyISAM" | "InnoDB"; collation: string; cols: DbColumn[] }
export interface DbRowView { pk: number; values: Record<string, string> }

const MB = 1024 * 1024, PAGE_MB = 16 / 1024;
export const rowKey = (db: string, table: string, pk: number): string => `${db}.${table}.${pk}`;
export const columnsOf = (def: TableDef): DbColumn[] => def.cols.map((c) => {
  const [name, type, ...gen] = c.split(" ");
  return { name, type, gen: gen.join(" ") };
});

const sinceOf = (s: GameState, ws: Webspace): number => {
  const w = s.workloads.find((x) => x.id === ws.workloadId), v = w && s.services.find((x) => x.id === w.serviceId);
  return v?.startedAt ?? w?.placedAt ?? s.hour;
};
// MySQL made InnoDB the default engine with 5.5; WordPass moved to utf8mb4 in 2015.
export const engineAt = (year: number): DbTable["engine"] => (year < 2011 ? "MyISAM" : "InnoDB");
export const collationAt = (year: number): string => (year < 2008 ? "latin1_swedish_ci" : year < 2015 ? "utf8_general_ci" : "utf8mb4_unicode_ci");

// The schema a database holds: the one stored with it, or the app's for the app's own database.
export function schemaOf(ws: Webspace, db: string): string | null {
  const d = ws.databases[db];
  return d?.schema ?? (ws.app?.db === db ? ws.app.id : null);
}

// The row counts a database derives: fresh-install rows plus its size spread over the tables by weight, more on the
// visitor tables the busier the site is, with ±30% drawn from the seed.
function derivedCounts(s: GameState, ws: Webspace, db: string, schema: Schema, names: string[]): Record<string, number> {
  const w = s.workloads.find((x) => x.id === ws.workloadId)!, [used, cap] = accountUse(s, w).traffic, busy = 0.5 + (cap > 0 ? Math.min(2, used / cap) : 0.5);
  const weight = (n: string) => schema[n].weight * (schema[n].traffic ? busy : 1), total = names.reduce((a, n) => a + weight(n), 0);
  const fixed = names.reduce((a, n) => a + schema[n].base * schema[n].bytes, 0) / MB, spare = Math.max(0, ws.databases[db].mb - fixed);
  const src = ws.databases[db].src ?? `${ws.workloadId}/${db}`;
  return Object.fromEntries(names.map((n) => {
    const jitter = 0.7 + 0.6 * rand(hashRng(s.seed, idNum(src), idNum(n)));
    return [n, schema[n].base + (total ? Math.floor((spare * MB * weight(n)) / total / schema[n].bytes * jitter) : 0)];
  }));
}

// The tables of a database with their row counts and sizes; an unknown or empty database has none.
export function tablesOf(s: GameState, ws: Webspace, db: string): DbTable[] {
  const d = ws.databases[db], id = schemaOf(ws, db), schema = id ? SCHEMAS[id] : undefined;
  if (!d || !schema) return [];
  const year = yearOf(sinceOf(s, ws)), names = d.tables ? Object.keys(d.tables).filter((n) => schema[n]) : Object.keys(schema).filter((n) => (schema[n].from ?? 0) <= year);
  const counts = d.tables ?? derivedCounts(s, ws, db, schema, names);
  const extra: Record<string, number> = {};
  for (const r of Object.values(ws.rows)) if (r.db === db) extra[r.table] = Math.max(extra[r.table] ?? 0, r.pk);
  const list = names.map((n) => {
    const rows = Math.max(counts[n] ?? 0, extra[n] ?? 0);
    return { name: n, rows, mb: (rows * schema[n].bytes) / MB + PAGE_MB, engine: engineAt(year), collation: collationAt(year), cols: columnsOf(schema[n]) };
  });
  // Scaled so the tables add up to the size the panel shows for the database.
  const raw = list.reduce((a, x) => a + x.mb, 0), k = d.mb > 0 && raw > 0 ? d.mb / raw : 1;
  return list.map((x) => ({ ...x, mb: +(x.mb * k).toFixed(4) }));
}

// The size a fresh install of a schema has, for an installer that creates its tables.
export function freshTables(id: string, year: number): { tables: Record<string, number>; mb: number } {
  const schema = SCHEMAS[id], names = Object.keys(schema).filter((n) => (schema[n].from ?? 0) <= year);
  const tables = Object.fromEntries(names.map((n) => [n, schema[n].base]));
  return { tables, mb: +names.reduce((a, n) => a + (schema[n].base * schema[n].bytes) / MB + PAGE_MB, 0).toFixed(4) };
}

const FIRST = ["anna", "ben", "clara", "david", "eva", "felix", "greta", "hanna", "jonas", "lena", "max", "nina", "paul", "sara", "tom", "uwe"];
const LAST = ["Meyer", "Schmidt", "Weber", "Fischer", "Becker", "Wagner", "Koch", "Richter", "Klein", "Wolf", "Braun", "Lange"];
const WORDS = ["hello", "world", "news", "summer", "garden", "recipe", "update", "photos", "travel", "about", "contact", "offer", "music", "club", "event", "review"];
const OPTIONS = ["siteurl", "home", "blogname", "blogdescription", "users_can_register", "admin_email", "start_of_week", "use_balanceTags", "default_category", "posts_per_page", "date_format", "time_format", "template", "stylesheet", "active_plugins", "permalink_structure"];
const SALT = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const pick = <T>(r: Rng, list: T[]): T => list[Math.floor(rand(r) * list.length)];
const chars = (r: Rng, n: number, set = SALT) => Array.from({ length: n }, () => pick(r, [...set])).join("");
const stamp = (hour: number) => dateOf(hour).toISOString().slice(0, 19).replace("T", " ");

// who is the row's person, so its name, login and email agree.
interface Who { first: string; last: string; n: number }
function value(col: DbColumn, r: Rng, pk: number, rows: number, at: number, domain: string, who: Who): string {
  const [gen, arg] = col.gen.startsWith("=") ? ["=", col.gen.slice(1)] : col.gen.split(":");
  const { first, last } = who, login = pk === 1 ? "admin" : `${first}${who.n}`;
  switch (gen) {
    case "=": return arg;
    case "id": return String(pk);
    case "int": return String(1 + Math.floor(rand(r) * Math.max(1, rows)));
    case "pick": return pick(r, arg.split("|"));
    case "name": return first[0].toUpperCase() + first.slice(1);
    case "last": return last;
    case "login": return login;
    case "email": return pk === 1 ? `info@${domain}` : `${first}.${last.toLowerCase()}@${["web.de", "gmx.net", "yahoo.com", "hotmail.com"][who.n % 4]}`;
    case "date": return stamp(at);
    case "day": return stamp(at).slice(0, 10);
    case "ts": return String(Math.floor(dateOf(at).getTime() / 1000));
    case "title": return `${pick(r, WORDS)} ${pick(r, WORDS)}`.replace(/^./, (c) => c.toUpperCase());
    case "text": return `${Array.from({ length: 8 }, () => pick(r, WORDS)).join(" ")} ...`;
    case "slug": return `${pick(r, WORDS)}-${pick(r, WORDS)}`;
    case "word": return pk <= OPTIONS.length && col.name.includes("value") ? pick(r, ["1", "0", domain, `http://${domain}`]) : pick(r, WORDS);
    case "option": return pk <= OPTIONS.length ? OPTIONS[pk - 1] : `_transient_${chars(r, 12, "0123456789abcdef")}`;
    case "hex": return chars(r, 32, "0123456789abcdef");
    case "ip": return `${1 + Math.floor(rand(r) * 222)}.${Math.floor(rand(r) * 256)}.${Math.floor(rand(r) * 256)}.${1 + Math.floor(rand(r) * 254)}`;
    case "money": return (5 + rand(r) * 95).toFixed(2);
    case "domain": return `${pick(r, WORDS)}-${pick(r, WORDS)}.${pick(r, ["de", "com", "net"])}`;
    case "url": return `http://www.${pick(r, WORDS)}.org/`;
    case "md5": return md5(chars(r, 10));
    case "md5salt": return `${md5(chars(r, 10))}:${chars(r, 16, SALT.slice(2))}`;
    case "phpass": return `$P$B${chars(r, 31)}`;
    case "bcrypt": return `$2y$10$${chars(r, 53)}`;
    default: return "";
  }
}

// The rows of a table from offset, with the player's edits on top. Rows are numbered from 1 in the order they were added.
export function rowsOf(s: GameState, ws: Webspace, db: string, table: string, offset = 0, limit = 30): DbRowView[] {
  const t = tablesOf(s, ws, db).find((x) => x.name === table);
  if (!t) return [];
  const since = sinceOf(s, ws), src = ws.databases[db].src ?? `${ws.workloadId}/${db}`, out: DbRowView[] = [];
  for (let pk = offset + 1; pk <= Math.min(t.rows, offset + limit); pk++) {
    const r = hashRng(s.seed, idNum(src), idNum(table), pk), at = Math.floor(since + ((s.hour - since) * pk) / Math.max(1, t.rows));
    const who = { first: pick(r, FIRST), last: pick(r, LAST), n: Math.floor(rand(r) * 99) };
    const values = Object.fromEntries(t.cols.map((c) => [c.name, value(c, r, pk, t.rows, at, ws.domain, who)]));
    out.push({ pk, values: { ...values, ...ws.rows[rowKey(db, table, pk)]?.values } });
  }
  return out;
}

export const rowOf = (s: GameState, ws: Webspace, db: string, table: string, pk: number): DbRowView | null =>
  rowsOf(s, ws, db, table, pk - 1, 1)[0] ?? null;

// The first rows whose column holds the value, searched among the first `max` rows.
export function findRows(s: GameState, ws: Webspace, db: string, table: string, col: string, value: string, max = 5000): DbRowView[] {
  return rowsOf(s, ws, db, table, 0, max).filter((r) => r.values[col] === value);
}

// The functions phpMyAdmon's insert and edit form offers, applied to the typed value at the game's hour.
export const SQL_FUNCTIONS = ["MD5", "UPPER", "LOWER", "NOW", "CURDATE", "UNIX_TIMESTAMP"] as const;
export type SqlFunction = (typeof SQL_FUNCTIONS)[number];
export function applyFunction(fn: SqlFunction | "" | undefined, v: string, hour: number): string {
  switch (fn) {
    case "MD5": return md5(v);
    case "UPPER": return v.toUpperCase();
    case "LOWER": return v.toLowerCase();
    case "NOW": return stamp(hour);
    case "CURDATE": return stamp(hour).slice(0, 10);
    case "UNIX_TIMESTAMP": return String(Math.floor(dateOf(hour).getTime() / 1000));
    default: return v;
  }
}

// What a typed SQL statement asks for. Only the statements phpMyAdmon runs from its SQL box parse; anything else is a
// syntax error, as MySQL reports it.
export type SqlStatement =
  | { kind: "select"; table: string; where?: [string, string]; offset: number; limit: number }
  | { kind: "update"; table: string; set: Record<string, string>; fns: Record<string, SqlFunction>; where: [string, string] }
  | { kind: "showTables" }
  | { kind: "error"; near: string };

const ident = String.raw`\x60?([A-Za-z0-9_]+)\x60?`, literal = String.raw`(?:'((?:[^'\\]|\\.)*)'|(-?\d+(?:\.\d+)?))`;
const unquote = (q: string | undefined, n: string | undefined) => (q !== undefined ? q.replace(/\\(.)/g, "$1") : n ?? "");
export function parseSql(text: string): SqlStatement {
  const sql = text.trim().replace(/;\s*$/, "");
  const near = (rest: string): SqlStatement => ({ kind: "error", near: rest.slice(0, 40) });
  if (/^show\s+tables$/i.test(sql)) return { kind: "showTables" };
  const where = String.raw`\s+where\s+${ident}\s*=\s*${literal}`;
  let m = new RegExp(String.raw`^select\s+\*\s+from\s+${ident}(?:${where})?(?:\s+limit\s+(\d+)(?:\s*,\s*(\d+))?)?$`, "i").exec(sql);
  if (m) {
    const [, table, col, q, n, a, b] = m;
    return { kind: "select", table, ...(col && { where: [col, unquote(q, n)] as [string, string] }), offset: b ? +a : 0, limit: b ? +b : a ? +a : 30 };
  }
  m = new RegExp(String.raw`^update\s+${ident}\s+set\s+(.+?)${where}$`, "i").exec(sql);
  if (m) {
    const [, table, list, col, q, n] = m, set: Record<string, string> = {}, fns: Record<string, SqlFunction> = {};
    const item = new RegExp(String.raw`^\s*${ident}\s*=\s*(?:([A-Za-z_][A-Za-z0-9_]*)\(\s*${literal}?\s*\)|${literal})\s*(?:,|$)`, "i");
    let rest = list;
    while (rest.trim()) {
      const x = item.exec(rest);
      if (!x) return near(rest.trim());
      const [all, name, fn, fq, fnum, vq, vnum] = x;
      if (fn) {
        const f = fn.toUpperCase() as SqlFunction;
        if (!SQL_FUNCTIONS.includes(f)) return near(`${fn}(`);
        fns[name] = f;
        set[name] = unquote(fq, fnum);
      } else set[name] = unquote(vq, vnum);
      rest = rest.slice(all.length);
    }
    return { kind: "update", table, set, fns, where: [col, unquote(q, n)] };
  }
  return near(sql);
}

// A .sql file phpMyAdmon exported: the tables and rows the database held, small enough to keep in the save.
export interface SqlDump { db: string; schema: string; tables: Record<string, number>; mb: number; src: string; rows: { table: string; pk: number; values: Record<string, string> }[] }

export function dumpOf(s: GameState, ws: Webspace, db: string): SqlDump | null {
  const schema = schemaOf(ws, db) ?? "", d = ws.databases[db];
  if (!d) return null;
  const tables = tablesOf(s, ws, db);
  return {
    db, schema, tables: Object.fromEntries(tables.map((x) => [x.name, x.rows])), mb: +tables.reduce((a, x) => a + x.mb, 0).toFixed(4),
    src: d.src ?? `${ws.workloadId}/${db}`,
    rows: Object.values(ws.rows).filter((r) => r.db === db).map(({ table, pk, values }) => ({ table, pk, values })),
  };
}

// phpMyAdmon's upload limit is PHP's upload_max_filesize, which hosts raised as sites grew.
export const importMaxMb = (year: number): number => (year < 2010 ? 8 : 50);
// A dump is the data without its indexes; gzip packs SQL text to about a seventh.
export const DUMP_SHARE = 0.8, GZIP_SHARE = 0.15;
