// docs/design/plans/webmail-server.md, milestone 6: the Sieve script of a mailbox on the own server. The script is a view of
// the mailbox's server filters and vacation; parseSieve reads back the bounded grammar toSieve writes, in Squarecube's layout.
import { dateOf, hourOf } from "../00-core/time";
import { protectedHost } from "../42-mail/deliver";
import { foldersOf, tenantOf } from "../42-mail/model";
import type { MailAct, MailCond, MailRule } from "../42-mail/types";
import type { GameState } from "../50-state";

export interface SieveVacation { on: boolean; subject: string; text: string; until: number | null }
export type SieveRule = Omit<MailRule, "id">;
export interface SieveError { line: number; key: string; p: Record<string, string> }
export type SieveParse = { ok: true; rules: SieveRule[]; vacation: SieveVacation | null } | { ok: false; error: SieveError };

const q = (v: string) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const day = (hour: number) => dateOf(hour).toISOString().slice(0, 10);
const HEADER: Record<string, MailCond["field"]> = { subject: "subject", from: "from", sender: "from", to: "to", cc: "to" };
const FLAG = { read: "\\Seen", star: "\\Flagged" } as const;

// A :matches pattern the rule model carries: a leading or trailing `*`, or both.
export function matchPattern(v: string): { op: "contains" | "is" | "starts" | "ends"; value: string } | null {
  const m = /^(\*?)([^*?]+)(\*?)$/.exec(v);
  return m && { op: m[1] && m[3] ? "contains" : m[3] ? "starts" : m[1] ? "ends" : "is", value: m[2] };
}
export const toPattern = (c: MailCond): string => (c.op === "starts" ? `${c.value}*` : c.op === "ends" ? `*${c.value}` : String(c.value));

function cond(c: MailCond): string {
  if (c.op === "over") return `size :over ${c.value}K`;
  return `header ${c.op === "starts" || c.op === "ends" ? ":matches" : `:${c.op}`} ${q(c.field)} ${q(toPattern(c))}`;
}

function act(a: MailAct, folder: (id: string) => string): string | null {
  if (a.do === "move") return `fileinto ${q(folder(a.folder))};`;
  if (a.do === "trash" || a.do === "junk") return `fileinto ${q(folder(a.do))};`;
  if (a.do === "read" || a.do === "star") return `addflag ${q(FLAG[a.do])};`;
  if (a.do === "forward") return `redirect ${q(a.to)};`;
  return a.do === "stop" ? "stop;" : null;
}

// A disabled rule keeps its test behind `if false #`, the way Squarecube's managesieve writes it.
const head = (on: boolean, test: string) => (on ? `if ${test}` : `if false # ${test}`);

export function toSieve(rules: SieveRule[], vacation: SieveVacation | null, folder: (id: string) => string, days: number | null = null): string {
  const req = new Set<string>(), out: string[] = [];
  if (vacation) {
    req.add("vacation");
    if (vacation.until !== null) { req.add("date"); req.add("relational"); }
    const test = vacation.until === null ? "true" : `currentdate :value "le" "date" ${q(day(vacation.until - 1))}`;
    out.push("# rule:[Out of Office]", head(vacation.on, test), "{", `\tvacation${days ? ` :days ${days}` : ""} :subject ${q(vacation.subject)} ${q(vacation.text)};`, "}");
  }
  for (const r of rules) {
    const tests = r.conds.map(cond), lines = r.acts.map((a) => act(a, folder)).filter((x): x is string => !!x);
    for (const l of lines) if (l.startsWith("fileinto")) req.add("fileinto"); else if (l.startsWith("addflag")) req.add("imap4flags");
    const test = tests.length === 1 ? tests[0] : `${r.match === "any" ? "anyof" : "allof"} (${tests.join(", ")})`;
    out.push(`# rule:[${r.name}]`, head(r.on, test), "{", ...lines.map((l) => `\t${l}`), "}");
  }
  const order = ["fileinto", "imap4flags", "vacation", "date", "relational"].filter((x) => req.has(x));
  return [...(order.length ? [`require [${order.map(q).join(",")}];`] : []), ...out].join("\n") + "\n";
}

type Tok = { k: "id" | "tag" | "str" | "num" | "p" | "off" | "name" | "end"; v: string; n: number; line: number };

class Fail { constructor(public e: SieveError) {} }
function fail(line: number, key: string, p: Record<string, string> = {}): never { throw new Fail({ line, key, p }); }

function lex(text: string): Tok[] {
  const out: Tok[] = [];
  let i = 0, line = 1;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\n") { line++; i++; continue; }
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === "#") {
      const end = text.indexOf("\n", i), body = text.slice(i + 1, end < 0 ? text.length : end);
      const name = /^\s*rule:\[(.*)\]\s*$/.exec(body);
      if (name) out.push({ k: "name", v: name[1], n: 0, line });
      i = end < 0 ? text.length : end;
      continue;
    }
    if (text.startsWith("/*", i)) {
      const end = text.indexOf("*/", i + 2);
      if (end < 0) fail(line, "unterminated", {});
      line += text.slice(i, end).split("\n").length - 1;
      i = end + 2;
      continue;
    }
    if (ch === '"') {
      let v = "", j = i + 1;
      const start = line;
      for (; j < text.length && text[j] !== '"'; j++) {
        if (text[j] === "\\" && j + 1 < text.length) j++;
        if (text[j] === "\n") line++;
        v += text[j];
      }
      if (j >= text.length) fail(start, "unterminated", {});
      out.push({ k: "str", v, n: 0, line: start });
      i = j + 1;
      continue;
    }
    const word = /^(:?[A-Za-z_][A-Za-z0-9_]*|\d+[KMG]?)/.exec(text.slice(i));
    if (word) {
      const w = word[1];
      if (/^\d/.test(w)) {
        const unit = { K: 1, M: 1024, G: 1024 * 1024 }[w.slice(-1)];
        out.push({ k: "num", v: w, n: unit ? parseInt(w, 10) * unit : Math.ceil(parseInt(w, 10) / 1024), line });
      } else if (w === "false" && /^[ \t]*#/.test(text.slice(i + 5))) {
        // `if false # <test>`: the test after the hash is the disabled rule's own.
        out.push({ k: "off", v: w, n: 0, line });
        i = text.indexOf("#", i) + 1;
        continue;
      } else out.push({ k: w.startsWith(":") ? "tag" : "id", v: w.toLowerCase(), n: 0, line });
      i += w.length;
      continue;
    }
    if ("[](){},;".includes(ch)) { out.push({ k: "p", v: ch, n: 0, line }); i++; continue; }
    fail(line, "char", { found: ch });
  }
  out.push({ k: "end", v: "", n: 0, line });
  return out;
}

const KNOWN = ["fileinto", "imap4flags", "vacation", "date", "relational", "envelope", "copy", "body", "reject", "mailbox", "variables", "regex"];
const NEEDS: Record<string, string> = { fileinto: "fileinto", addflag: "imap4flags", vacation: "vacation", currentdate: "date" };
const shown = (t: Tok) => (t.k === "end" ? "end of script" : t.k === "str" ? "string" : t.k === "num" ? "number" : `'${t.v}'`);

// Reads a script in the bounded grammar. `folder` turns a mailbox name into a folder id, or null when there is none.
export function parseSieve(text: string, folder: (name: string) => string | null): SieveParse {
  try {
    const toks = lex(text), req = new Set<string>();
    let i = 0, name = "";
    const peek = () => toks[i], next = () => toks[i++];
    const is = (v: string) => peek().k === "p" && peek().v === v;
    const expect = (v: string, what = `'${v}'`) => { if (!is(v)) fail(peek().line, "syntax", { expected: what, found: shown(peek()) }); i++; };
    const semi = () => expect(";", "end of command ';' or the beginning of a compound block '{'");
    const strings = (): string[] => {
      if (peek().k === "str") return [next().v];
      expect("[");
      const xs: string[] = [];
      do { if (peek().k !== "str") fail(peek().line, "syntax", { expected: "string", found: shown(peek()) }); xs.push(next().v); } while (is(",") && next());
      expect("]");
      return xs;
    };
    const known = (t: Tok, kind: "command" | "test") => {
      const need = NEEDS[t.v];
      if (need && !req.has(need)) fail(t.line, kind === "command" ? "unknownCommand" : "unknownTest", { name: t.v });
    };
    // Tagged and positional arguments up to the end of the command or test.
    const args = (t: Tok, kind: string, tags: string[]) => {
      const tagged: Record<string, Tok | true> = {}, pos: (Tok & { list?: string[] })[] = [];
      while (peek().k === "tag" || peek().k === "str" || peek().k === "num" || is("[")) {
        if (peek().k === "tag") {
          const g = next();
          if (!tags.includes(g.v)) fail(g.line, "tag", { tag: g.v, name: t.v, kind });
          tagged[g.v] = ([":days", ":subject", ":value", ":zone"].includes(g.v) && (peek().k === "num" || peek().k === "str")) ? next() : true;
        } else if (is("[")) { const line = peek().line; pos.push({ k: "str", v: "", n: 0, line, list: strings() }); }
        else pos.push(next());
      }
      return { tagged, pos };
    };
    const count = (t: Tok, kind: string, pos: unknown[], n: number) => { if (pos.length !== n) fail(t.line, "args", { name: t.v, kind, n: String(n), m: String(pos.length) }); };
    const str = (x: Tok & { list?: string[] }, t: Tok, kind: string) => {
      if (x.k !== "str") fail(x.line, "args", { name: t.v, kind, n: "1", m: "0" });
      return x.list ?? [x.v];
    };

    type Test = { conds: MailCond[]; match: "all" | "any"; until?: number | null };
    const one = (allowDate: boolean): MailCond | { until: number | null } => {
      const t = next();
      if (t.k !== "id") fail(t.line, "syntax", { expected: "test", found: shown(t) });
      if (t.v === "header" || t.v === "address") {
        const { tagged, pos } = args(t, "test", [":contains", ":is", ":matches"]);
        count(t, "test", pos, 2);
        const fields = new Set(str(pos[0], t, "test").map((h) => HEADER[h.toLowerCase()]));
        const [field] = [...fields];
        if (fields.size !== 1 || !field) fail(t.line, "header", { name: str(pos[0], t, "test").join(", ") });
        const [v] = str(pos[1], t, "test");
        if (tagged[":matches"]) return { field, ...(matchPattern(v) ?? fail(t.line, "pattern", { v })) };
        return { field, op: tagged[":is"] ? "is" : "contains", value: v };
      }
      if (t.v === "size") {
        const { tagged, pos } = args(t, "test", [":over"]);
        count(t, "test", pos, 1);
        if (!tagged[":over"] || pos[0].k !== "num") fail(t.line, "args", { name: t.v, kind: "test", n: "1", m: "0" });
        return { field: "size", op: "over", value: pos[0].n };
      }
      if (t.v === "true" && allowDate) return { until: null };
      if (t.v === "currentdate" && allowDate) {
        known(t, "test");
        const { tagged, pos } = args(t, "test", [":value", ":zone"]);
        const rel = tagged[":value"];
        if (rel && !req.has("relational")) fail(t.line, "tag", { tag: ":value", name: t.v, kind: "test" });
        count(t, "test", pos, 2);
        const [part] = str(pos[0], t, "test"), [d] = str(pos[1], t, "test"), op = rel === true || !rel ? "" : rel.v;
        if (part !== "date" || !/^\d{4}-\d{2}-\d{2}$/.test(d) || !["le", "lt"].includes(op)) fail(t.line, "args", { name: t.v, kind: "test", n: "2", m: String(pos.length) });
        const at = hourOf(new Date(`${d}T00:00:00Z`));
        return { until: op === "le" ? at + 24 : at };
      }
      return fail(t.line, "unknownTest", { name: t.v });
    };
    const test = (allowDate: boolean): Test => {
      const t = peek();
      if (t.k === "id" && (t.v === "allof" || t.v === "anyof")) {
        i++;
        expect("(");
        const conds: MailCond[] = [];
        do { const c = one(false); conds.push(c as MailCond); } while (is(",") && next());
        expect(")");
        return { conds, match: t.v === "anyof" ? "any" : "all" };
      }
      const c = one(allowDate);
      return "until" in c ? { conds: [], match: "all", until: c.until } : { conds: [c], match: "all" };
    };
    const vacationCmd = (t: Tok, on: boolean, until: number | null): SieveVacation => {
      known(t, "command");
      const { tagged, pos } = args(t, "command", [":days", ":subject"]);
      count(t, "command", pos, 1);
      const sub = tagged[":subject"];
      return { on, subject: sub === true || !sub ? "" : sub.v, text: str(pos[0], t, "command")[0], until };
    };

    const rules: SieveRule[] = [];
    let vacation: SieveVacation | null = null;
    const setVac = (line: number, v: SieveVacation) => { if (vacation) fail(line, "duplicateVacation"); vacation = v; };
    while (peek().k !== "end") {
      const t = next();
      if (t.k === "name") { name = t.v; continue; }
      if (t.k !== "id") fail(t.line, "syntax", { expected: "command", found: shown(t) });
      if (t.v === "require") {
        for (const cap of strings()) { if (!KNOWN.includes(cap)) fail(t.line, "capability", { name: cap }); req.add(cap); }
        semi();
        continue;
      }
      if (t.v === "vacation") { setVac(t.line, vacationCmd(t, true, null)); semi(); continue; }
      if (t.v !== "if") fail(t.line, "unknownCommand", { name: t.v });
      const on = peek().k !== "off";
      if (!on) i++;
      const cond = test(true);
      expect("{");
      const acts: MailAct[] = [];
      let vac: SieveVacation | null = null;
      while (!is("}")) {
        const c = next();
        if (c.k !== "id") fail(c.line, "syntax", { expected: "'}'", found: shown(c) });
        if (c.v === "vacation" && cond.until !== undefined) vac = vacationCmd(c, on, cond.until);
        else if (cond.until !== undefined) fail(c.line, "syntax", { expected: "vacation", found: `'${c.v}'` });
        else if (c.v === "fileinto") {
          known(c, "command");
          const { pos } = args(c, "command", []);
          count(c, "command", pos, 1);
          const [box] = str(pos[0], c, "command"), id = folder(box);
          if (!id) fail(c.line, "mailbox", { name: box });
          acts.push(id === "trash" ? { do: "trash" } : id === "junk" ? { do: "junk" } : { do: "move", folder: id! });
        } else if (c.v === "redirect") {
          const { pos } = args(c, "command", []);
          count(c, "command", pos, 1);
          acts.push({ do: "forward", to: str(pos[0], c, "command")[0] });
        } else if (c.v === "addflag") {
          known(c, "command");
          const { pos } = args(c, "command", []);
          count(c, "command", pos, 1);
          for (const f of str(pos[0], c, "command")) {
            const k = f === FLAG.read ? "read" : f === FLAG.star ? "star" : null;
            if (!k) fail(c.line, "flag", { name: f });
            acts.push({ do: k! });
          }
        } else if (c.v === "stop") acts.push({ do: "stop" });
        else fail(c.line, "unknownCommand", { name: c.v });
        semi();
      }
      i++;
      if (cond.until !== undefined) {
        if (!vac) fail(t.line, "syntax", { expected: "vacation", found: "'}'" });
        setVac(t.line, vac!);
      } else rules.push({ name, on, match: cond.match, conds: cond.conds, acts });
      name = "";
    }
    return { ok: true, rules, vacation };
  } catch (e) {
    if (e instanceof Fail) return { ok: false, error: e.e };
    throw e;
  }
}

// The IMAP name of a folder as Dovecoat lists it: system folders by their fixed names, custom ones as a path.
export function folderPath(s: GameState, accountId: string, id: string): string {
  if (id === "inbox") return "INBOX";
  const f = s.mail.folders.find((x) => x.id === id && x.accountId === accountId);
  if (!f) return id[0].toUpperCase() + id.slice(1);
  return f.parent ? `${folderPath(s, accountId, f.parent)}/${f.name}` : f.name;
}

export const folderByPath = (s: GameState, accountId: string, name: string): string | null =>
  name.toUpperCase() === "INBOX" ? "inbox" : foldersOf(s, accountId).find((f) => !f.label && folderPath(s, accountId, f.id) === name)?.id ?? null;

// The mailbox's script as ManageSieve serves it; hosts with loop protection answer a sender once a week.
export function sieveScript(s: GameState, accountId: string): string {
  const a = s.mail.accounts.find((x) => x.id === accountId), t = a && tenantOf(s, a);
  if (!a || !t) return "";
  const rules = s.mail.filters.filter((f) => f.accountId === accountId);
  return toSieve(rules, a.vacation, (id) => folderPath(s, accountId, id), protectedHost(s, t) ? 7 : null);
}
