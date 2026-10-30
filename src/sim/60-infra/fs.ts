// docs/design/terminal-shell.md, The filesystem: every machine has a base tree computed from the game state, and the paths
// the player changed on top of it.
import { t } from "../../i18n/en";
import { dateOf, yearOf } from "../00-core/time";
import type { Doc, GameState } from "../50-state";
import { checkDone, TUTORIAL } from "../checklist";

export const DESK = "desk";
export const DESKTOP = "/home/you/Desktop";
export const MAX_PATHS = 200;
export const MAX_FILE = 4096;

// A path maps to a file's text, or true for a directory.
export type Tree = Record<string, string | true>;

export interface Release { version: string; codename: string; kernel: string; year: number }
const RELEASES: Release[] = [
  { year: 2005, version: "3.1", codename: "sarge", kernel: "2.6.8" },
  { year: 2007, version: "4.0", codename: "etch", kernel: "2.6.18" },
  { year: 2009, version: "5.0", codename: "lenny", kernel: "2.6.26" },
  { year: 2011, version: "6.0", codename: "squeeze", kernel: "2.6.32" },
  { year: 2013, version: "7", codename: "wheezy", kernel: "3.2.0" },
  { year: 2015, version: "8", codename: "jessie", kernel: "3.16.0" },
  { year: 2017, version: "9", codename: "stretch", kernel: "4.9.0" },
  { year: 2019, version: "10", codename: "buster", kernel: "4.19.0" },
  { year: 2021, version: "11", codename: "bullseye", kernel: "5.10.0" },
  { year: 2023, version: "12", codename: "bookworm", kernel: "6.1.0" },
  { year: 2025, version: "13", codename: "trixie", kernel: "6.12.0" },
];
const releaseIn = (year: number): Release => [...RELEASES].reverse().find((r) => r.year <= year) ?? RELEASES[0];

// A server runs the Lunix version it installed, or without one the release of the year it was bought; the desk the one
// from the start of the game.
export function releaseOf(s: GameState, host: string): Release {
  const d = s.devices.find((x) => x.id === host), m = d ?? s.workloads.find((w) => w.id === host), v = m?.os?.id === "lunix" ? Number(m.os.version) : NaN;
  return RELEASES.find((r) => Number(r.version) === v) ?? releaseIn(yearOf(d?.boughtAt ?? 0));
}

export const userOf = (host: string) => (host === DESK ? "you" : "root");
export const homeOf = (host: string) => (host === DESK ? "/home/you" : "/root");
export const hostnameOf = (s: GameState, host: string) => s.devices.find((d) => d.id === host)?.hostname ?? DESK;

// An absolute path from what the player typed: ~ is the home, . and .. are walked, repeated slashes collapse.
export function resolve(cwd: string, arg: string, home: string): string {
  const raw = arg === "~" || arg.startsWith("~/") ? home + arg.slice(1) : arg.startsWith("/") ? arg : `${cwd}/${arg}`;
  const parts: string[] = [];
  for (const p of raw.split("/")) {
    if (!p || p === ".") continue;
    if (p === "..") parts.pop();
    else parts.push(p);
  }
  return `/${parts.join("/")}`;
}

export const parentOf = (path: string) => path.slice(0, path.lastIndexOf("/")) || "/";
export const nameOf = (path: string) => path.slice(path.lastIndexOf("/") + 1);

// The path as a prompt shows it: the home and what is under it start with ~.
export const shortPath = (path: string, home: string) => (path === home ? "~" : path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path);

// The desktop's documents as files in ~/Desktop, named by title; a repeated title gets a number.
export function desktopFiles(s: GameState): { path: string; doc: Doc }[] {
  const seen = new Map<string, number>();
  return s.docs.filter((doc) => doc.kind !== "app").map((doc) => {
    const name = doc.title.replace(/\//g, "-"), n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    return { path: `${DESKTOP}/${n > 1 ? `${name} (${n})` : name}`, doc };
  });
}

// Getting started as text: its steps, the done ones ticked.
export const guideText = (s: GameState) =>
  `${t("doc.guide")}\n\n${TUTORIAL.map((id) => `[${checkDone(s, id) ? "x" : " "}] ${t(`guide.step.${id}`)}`).join("\n")}\n`;

// Getting started follows the game, so the terminal only reads it.
export const readOnly = (s: GameState, host: string, path: string) =>
  host === DESK && desktopFiles(s).some((f) => f.doc.kind === "guide" && f.path === path);

const stamp = (hour: number) => dateOf(hour).toISOString().slice(0, 16).replace("T", " ");

function baseTree(s: GameState, host: string): Tree {
  const r = releaseOf(s, host), d = s.devices.find((x) => x.id === host);
  const tree: Tree = { "/": true, "/etc": true, "/etc/apt": true, "/etc/apt/sources.list.d": true, "/var": true, "/var/log": true, "/tmp": true, "/home": true, [homeOf(host)]: true };
  tree["/etc/hostname"] = `${hostnameOf(s, host)}\n`;
  tree["/etc/os-release"] = [
    `PRETTY_NAME="Debian GNU/Linux ${r.version} (${r.codename})"`, `NAME="Debian GNU/Linux"`, `VERSION_ID="${r.version}"`,
    `VERSION="${r.version} (${r.codename})"`, "ID=debian", "",
  ].join("\n");
  tree["/etc/apt/sources.list"] = `deb http://ftp.debian.org/debian ${r.codename} main\n`;
  tree["/var/log/syslog"] = (d?.log ?? []).map((e) => `${stamp(e.hour)} ${hostnameOf(s, host)} ${t(e.key)}\n`).join("");
  if (host === DESK) {
    tree[DESKTOP] = true;
    for (const f of desktopFiles(s)) tree[f.path] = f.doc.kind === "guide" ? guideText(s) : f.doc.body;
  }
  return tree;
}

// Whether the stored changes are still on the machine: a data loss since the first change wiped them.
export function kept(s: GameState, host: string): boolean {
  const f = s.files[host], lost = s.devices.find((x) => x.id === host)?.dataLost;
  return !!f && !(lost != null && lost >= f.since);
}
const changesOf = (s: GameState, host: string) => (kept(s, host) ? s.files[host].paths : {});

export function treeOf(s: GameState, host: string): Tree {
  const tree = baseTree(s, host);
  for (const [path, v] of Object.entries(changesOf(s, host))) {
    if (v === false) delete tree[path];
    else tree[path] = v;
  }
  return tree;
}

// What differs from the base tree, to be stored. The desktop's files live in its documents, so they are never stored.
export function changesFrom(s: GameState, host: string, tree: Tree): Record<string, string | boolean> {
  const base = baseTree(s, host), out: Record<string, string | boolean> = {};
  for (const [path, v] of Object.entries(tree)) if (base[path] !== v) out[path] = v;
  for (const path of Object.keys(base)) if (!(path in tree)) out[path] = false;
  if (host === DESK) for (const path of Object.keys(out)) if (path === DESKTOP || path.startsWith(`${DESKTOP}/`)) delete out[path];
  return out;
}

// A change to a machine's files, kept as plain data so the action log can replay it.
export type FileOp = ["write" | "append", string, string] | ["mkdir" | "rm", string] | ["copy" | "move", string, string];

// The path and everything under it.
export const under = (tree: Tree, p: string) => Object.keys(tree).filter((k) => k === p || k.startsWith(p === "/" ? "/" : `${p}/`));

export function applyOps(tree: Tree, ops: FileOp[]): void {
  for (const [op, p, arg] of ops) {
    if (op === "write") tree[p] = arg!;
    else if (op === "append") tree[p] = (typeof tree[p] === "string" ? tree[p] : "") + arg!;
    else if (op === "mkdir") tree[p] = true;
    else if (op === "rm") for (const k of under(tree, p)) delete tree[k];
    else {
      const copied = under(tree, p).map((k) => [arg + k.slice(p.length), tree[k]] as const);
      if (op === "move") for (const k of under(tree, p)) delete tree[k];
      for (const k of under(tree, arg!)) delete tree[k];
      for (const [k, v] of copied) tree[k] = v;
    }
  }
}

export const childrenOf = (tree: Tree, dir: string): string[] =>
  Object.keys(tree).filter((p) => p !== "/" && parentOf(p) === dir).map(nameOf).sort();
