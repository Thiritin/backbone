// docs/design/terminal-shell.md, Commands: the line parser and the file commands of the Terminal's shell.
import { t } from "../../i18n/en";
import { dateOf } from "../00-core/time";
import type { GameState } from "../50-state";
import { editFiles } from "../90-actions/files";
import { applyOps, childrenOf, DESK, DESKTOP, homeOf, hostnameOf, nameOf, parentOf, readOnly, releaseOf, resolve, treeOf, under, userOf, type FileOp, type Tree } from "./fs";
import type { CommandResult } from "./terminal";

// One command of a line: its words, an output redirection, and where it sits in the line so a prompt can re-run the rest.
export interface Segment { words: string[]; redirect: { to: string; append: boolean } | null; then: "&&" | ";" | null; start: number; end: number }

// Splits a line at && and ; into commands, with quotes, backslash escapes, > and >>. Pipes, globs and variables are not shell syntax here.
export function parseLine(line: string): Segment[] {
  const out: Segment[] = [];
  let words: string[] = [], word: string | null = null, redirect: Segment["redirect"] = null, pending: boolean | null = null, start = 0;
  const flush = () => {
    if (word === null) return;
    if (pending !== null) { redirect = { to: word, append: pending }; pending = null; } else words.push(word);
    word = null;
  };
  const close = (then: Segment["then"], end: number) => {
    flush();
    if (words.length || redirect) out.push({ words, redirect, then, start, end });
    words = []; redirect = null; pending = null;
  };
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" || c === '"') {
      const shut = line.indexOf(c, i + 1), stop = shut < 0 ? line.length : shut;
      word = (word ?? "") + line.slice(i + 1, stop);
      i = stop;
    } else if (c === "\\" && i + 1 < line.length) word = (word ?? "") + line[++i];
    else if (/\s/.test(c)) flush();
    else if (c === ";" || (c === "&" && line[i + 1] === "&")) {
      close(c === ";" ? ";" : "&&", i);
      if (c === "&") i++;
      start = i + 1;
    } else if (c === ">") {
      flush();
      pending = line[i + 1] === ">";
      if (pending) i++;
    } else word = (word ?? "") + c;
  }
  close(null, line.length);
  return out;
}

const lines = (key: string, p: Record<string, string | number> = {}) => t(key, p).split("\n");
const why = (k: "noent" | "isdir" | "notdir" | "exists" | "notempty" | "perm") => t(`term.fs.${k}`);
const kindOf = (tree: Tree, p: string) => (tree[p] === undefined ? null : tree[p] === true ? "dir" : "file");
// A file's text as screen lines, without the empty line after its final newline.
const textLines = (text: string) => (text ? text.replace(/\n$/, "").split("\n") : []);

function when(hour: number) {
  const [wd, day, mon, year, time] = dateOf(hour).toUTCString().replace(",", "").split(" ");
  return { wd, day, mon, year, time };
}

// Splits leading -abc flags from the operands.
function flagsOf(args: string[]): { flags: Set<string>; rest: string[] } {
  const flags = new Set<string>(), rest: string[] = [];
  for (const a of args) {
    if (a.startsWith("-") && a.length > 1 && !rest.length) for (const f of a.slice(1)) flags.add(f);
    else rest.push(a);
  }
  return { flags, rest };
}

// The commands that read or change files, and the small ones about the machine. Null when the word is none of them.
export function fileCommand(s: GameState, host: string, cwd: string, cmd: string, args: string[]): CommandResult | null {
  const home = homeOf(host), tree = treeOf(s, host), at = (a: string) => resolve(cwd, a, home);
  const out: string[] = [], ops: FileOp[] = [];
  // Each change applies to the tree at once, so later operands of the same command see it.
  const change = (op: FileOp) => { applyOps(tree, [op]); ops.push(op); };
  let failed = false;
  const err = (key: string, p: Record<string, string>) => { out.push(t(key, p)); failed = true; };
  const done = (): CommandResult => ({ output: out, failed, action: ops.length ? [editFiles, host, ops] : undefined });
  const { flags, rest } = flagsOf(args);
  // Getting started on the desk, or a folder holding it.
  const guarded = (p: string) => under(tree, p).some((x) => readOnly(s, host, x));
  const operand = () => {
    if (rest.length) return false;
    err("term.fs.operand", { cmd });
    return true;
  };

  switch (cmd) {
    case "pwd": return { output: [cwd] };
    case "whoami": return { output: [userOf(host)] };
    case "hostname": return { output: [hostnameOf(s, host)] };
    case "uname": {
      if (!flags.has("a")) return { output: ["Lunix"] };
      const r = releaseOf(s, host);
      return { output: [`Lunix ${hostnameOf(s, host)} ${r.kernel}-amd64 #1 SMP Debiant ${r.kernel} (${r.year}) x86_64 GNU/Lunix ${r.version} (${r.codename})`] };
    }
    case "date": {
      const d = when(s.hour);
      return { output: [`${d.wd} ${d.mon} ${d.day} ${d.time} UTC ${d.year}`] };
    }
    case "echo": return { output: [args.join(" ")] };
    case "cd": {
      const to = rest[0] ? at(rest[0]) : home, k = kindOf(tree, to);
      if (k !== "dir") return { output: [t("term.fs.cd", { path: rest[0], why: why(k ? "notdir" : "noent") })], failed: true };
      return { output: [], cwd: to };
    }
    case "ls": {
      const d = when(s.hour), user = userOf(host);
      const row = (name: string, p: string) => {
        if (!flags.has("l")) return name;
        const dir = tree[p] === true;
        return t("term.ls.long", { mode: dir ? "drwxr-xr-x" : readOnly(s, host, p) ? "-r--r--r--" : "-rw-r--r--", links: dir ? 2 : 1, user, size: dir ? 4096 : String(tree[p]).length, date: `${d.mon} ${d.day.padStart(2)} ${d.time.slice(0, 5)}`, name });
      };
      const targets = rest.length ? rest : ["."];
      targets.forEach((a, i) => {
        const p = at(a), k = kindOf(tree, p);
        if (!k) return err("term.fs.ls", { path: a, why: why("noent") });
        if (k === "file") return out.push(row(a, p));
        const names = [...(flags.has("a") ? [".", ".."] : []), ...childrenOf(tree, p).filter((n) => flags.has("a") || !n.startsWith("."))];
        const rows = names.map((n) => row(n, n === "." ? p : n === ".." ? parentOf(p) : `${p === "/" ? "" : p}/${n}`));
        if (targets.length > 1) out.push(...(i ? [""] : []), `${a}:`);
        if (flags.has("l")) out.push(...rows);
        else if (rows.length) out.push(rows.join("  "));
      });
      return done();
    }
    case "cat":
      for (const a of rest) {
        const k = kindOf(tree, at(a));
        if (k === "file") out.push(...textLines(String(tree[at(a)])));
        else err("term.fs.cat", { path: a, why: why(k ? "isdir" : "noent") });
      }
      return done();
    case "touch":
      if (operand()) return done();
      for (const a of rest) {
        const p = at(a);
        if (kindOf(tree, p)) continue;
        if (kindOf(tree, parentOf(p)) !== "dir") err("term.fs.touch", { path: a, why: why(kindOf(tree, parentOf(p)) ? "notdir" : "noent") });
        else change(["write", p, ""]);
      }
      return done();
    case "mkdir":
      if (operand()) return done();
      for (const a of rest) {
        const p = at(a), k = kindOf(tree, p);
        if (k && !(flags.has("p") && k === "dir")) { err("term.fs.mkdir", { path: a, why: why("exists") }); continue; }
        const chain: string[] = [];
        let up = p;
        while (!kindOf(tree, up)) { chain.unshift(up); up = parentOf(up); }
        if (kindOf(tree, up) === "file") { err("term.fs.mkdir", { path: a, why: why("notdir") }); continue; }
        if (host === DESK && chain.some((c) => c.startsWith(`${DESKTOP}/`))) { err("term.fs.mkdir", { path: a, why: why("perm") }); continue; }
        if (chain.length > 1 && !flags.has("p")) { err("term.fs.mkdir", { path: a, why: why("noent") }); continue; }
        for (const c of chain) change(["mkdir", c]);
      }
      return done();
    case "rm":
      if (!flags.has("f") && operand()) return done();
      for (const a of rest) {
        const p = at(a), k = kindOf(tree, p);
        if (p === "/") { err("term.fs.root", {}); continue; }
        if (!k) { if (!flags.has("f")) err("term.fs.rm", { path: a, why: why("noent") }); continue; }
        if (k === "dir" && !flags.has("r") && !flags.has("R")) { err("term.fs.rm", { path: a, why: why("isdir") }); continue; }
        if (guarded(p)) { err("term.fs.rm", { path: a, why: why("perm") }); continue; }
        change(["rm", p]);
      }
      return done();
    case "rmdir":
      if (operand()) return done();
      for (const a of rest) {
        const p = at(a), k = kindOf(tree, p);
        if (k !== "dir") err("term.fs.rmdir", { path: a, why: why(k ? "notdir" : "noent") });
        else if (childrenOf(tree, p).length) err("term.fs.rmdir", { path: a, why: why("notempty") });
        else change(["rm", p]);
      }
      return done();
    case "mv":
    case "cp": {
      if (rest.length < 2) return { output: lines("term.fs.operand", { cmd }), failed: true };
      const dest = rest.at(-1)!, d = at(dest), many = rest.length > 2;
      if (many && kindOf(tree, d) !== "dir") return { output: lines("term.fs.target", { cmd, path: dest }), failed: true };
      for (const a of rest.slice(0, -1)) {
        const p = at(a), k = kindOf(tree, p), to = kindOf(tree, d) === "dir" ? `${d === "/" ? "" : d}/${nameOf(p)}` : d;
        if (!k) { err("term.fs.stat", { cmd, path: a, why: why("noent") }); continue; }
        if (cmd === "cp" && k === "dir" && !flags.has("r") && !flags.has("R")) { err("term.fs.omit", { path: a }); continue; }
        if (to === p || to.startsWith(`${p}/`)) { err("term.fs.into", { cmd, from: a, to: dest }); continue; }
        if (kindOf(tree, parentOf(to)) !== "dir") { err("term.fs.create", { cmd, path: dest, why: why("noent") }); continue; }
        if ((cmd === "mv" && guarded(p)) || guarded(to)) { err("term.fs.move", { cmd, from: a, to: dest, why: why("perm") }); continue; }
        change([cmd === "mv" ? "move" : "copy", p, to]);
      }
      return done();
    }
    case "edit": {
      if (rest.length !== 1) return { output: lines("term.edit.usage"), failed: true };
      const p = at(rest[0]), k = kindOf(tree, p);
      const no = k === "dir" ? "isdir" : readOnly(s, host, p) ? "perm" : !k && kindOf(tree, parentOf(p)) !== "dir" ? "noent" : null;
      if (no) return { output: [t("term.fs.edit", { path: rest[0], why: why(no) })], failed: true };
      return { output: [], edit: { path: p, name: rest[0], text: k ? String(tree[p]) : "" } };
    }
    default: return null;
  }
}

// Sends a command's output into a file instead of the screen; a failed command's errors stay on the screen.
// ponytail: a command that also changes the game keeps its output on the screen, since a result carries one action.
export function redirect(s: GameState, host: string, cwd: string, r: CommandResult, to: { to: string; append: boolean }): CommandResult {
  if (r.failed || r.action) return r;
  const tree = treeOf(s, host), p = resolve(cwd, to.to, homeOf(host));
  const k = kindOf(tree, p), parent = kindOf(tree, parentOf(p));
  if (k === "dir" || parent !== "dir") return { ...r, output: [t("term.fs.redirect", { path: to.to, why: why(k ? "isdir" : parent ? "notdir" : "noent") })], failed: true };
  if (readOnly(s, host, p)) return { ...r, output: [t("term.fs.redirect", { path: to.to, why: why("perm") })], failed: true };
  const text = r.output.length ? `${r.output.join("\n")}\n` : "";
  return { ...r, output: [], action: [editFiles, host, [[to.append ? "append" : "write", p, text]]] };
}

// Tab after a file command: the word completes to the names in its directory, a directory with a slash, spaces escaped.
export function completePath(s: GameState, host: string, cwd: string, word: string): string[] {
  const tree = treeOf(s, host), cut = word.lastIndexOf("/") + 1, dir = word.slice(0, cut), part = unescape(word.slice(cut));
  const base = resolve(cwd, unescape(dir) || ".", homeOf(host));
  if (tree[base] !== true) return [];
  return childrenOf(tree, base).filter((n) => n.startsWith(part) && (part.startsWith(".") || !n.startsWith(".")))
    .map((n) => `${dir}${n.replace(/([\s\\'"])/g, "\\$1")}${tree[`${base === "/" ? "" : base}/${n}`] === true ? "/" : ""}`);
}

const unescape = (w: string) => w.replace(/\\(.)/g, "$1");

export const FILE_COMMANDS = ["pwd", "cd", "ls", "cat", "edit", "echo", "touch", "mkdir", "rm", "rmdir", "mv", "cp", "whoami", "hostname", "uname", "date"];
