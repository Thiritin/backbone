// docs/design/plans/webmail-server.md, 3.5: SquirrelMeal's conf.pl, the numbered menu squirrelmeal-configure runs over ssh.
// Each line the player types moves it on; the screens redraw as the real one clears the terminal.
import { en, t } from "../../i18n/en";
import type { GameState } from "../50-state";
import { CONF_ITEMS, CONFIG_PHP, configPhp, confValue, selfHostCaps, setConfValue, webmailOf, WEBMAIL_PLUGINS, type WebmailInstall } from "../80-business/webmail";
import type { ActionResult } from "../90-actions/hardware";
import type { Call } from "../90-actions/index";
import { editFiles } from "../90-actions/files";
import { configureWebmail } from "../90-actions/mail-server";
import { softwareOn } from "../90-actions/software";
import { panelMachine } from "./licence";
import type { CommandResult } from "./terminal";

export const CONF_PL = "/usr/share/squirrelmeal/config/conf.pl";

type Screen = "main" | "org" | "server" | "imap" | "smtp" | "folders" | "general" | "themes" | "abook" | "motd" | "plugins" | "db" | "lang" | "presets";
// ask is the config.php variable whose value the next line sets, "quit" the save question on leaving, "enter" a pause.
export interface ConfMenu { clusterId: string; read: string; draft: WebmailInstall; screen: Screen; ask: string | null; dirty: boolean }
export interface ConfResult { output: string[]; clear: boolean; menu: ConfMenu | null }

const MAIN: Screen[] = ["org", "server", "folders", "general", "themes", "abook", "motd", "plugins", "db", "lang"];
// What the D menu sets for each IMAP server, after imap_server_type.
const PRESETS: Record<string, Record<string, string>> = {
  courier: { default_folder_prefix: "INBOX.", trash_folder: "Trash", sent_folder: "Sent", draft_folder: "Drafts", show_prefix_option: "false", optional_delimiter: "." },
  cyrus: { default_folder_prefix: "", trash_folder: "INBOX.Trash", sent_folder: "INBOX.Sent", draft_folder: "INBOX.Drafts", show_prefix_option: "false", optional_delimiter: "." },
  dovecoat: { default_folder_prefix: "", trash_folder: "Trash", sent_folder: "Sent", draft_folder: "Drafts", show_prefix_option: "false", optional_delimiter: "detect" },
  exchange: { default_folder_prefix: "", trash_folder: "Deleted Items", sent_folder: "Sent Items", draft_folder: "Drafts", show_prefix_option: "false", optional_delimiter: "detect" },
  uw: { default_folder_prefix: "mail/", trash_folder: "Trash", sent_folder: "Sent", draft_folder: "Drafts", show_prefix_option: "true", optional_delimiter: "/" },
};
// What an empty value reads as in the menu.
const EMPTY: Record<string, string> = { default_folder_prefix: "none", addrbook_dsn: "Disabled", prefs_dsn: "Disabled" };

const lines = (key: string, p: Record<string, string | number> = {}) => t(key, p).split("\n");
const label = (key: string) => t(`mailserver.conf.item.${key}`);
const isBool = (m: ConfMenu, key: string) => /^(true|false)$/.test(confValue(m.draft, key));
const row = (n: number | string, text: string, value?: string) => `${`${n}.`.padEnd(4)}${value === undefined ? text : `${text.padEnd(23)}: ${value}`}`;
const shown = (m: ConfMenu, key: string) => confValue(m.draft, key) || EMPTY[key] || "";
const itemRows = (m: ConfMenu, items: [string, string][], from = 1) => items.map(([k], i) => row(i + from, label(k), shown(m, k)));
const pluginsOf = (s: GameState) => WEBMAIL_PLUGINS.filter((x) => x !== "havelsieve" || selfHostCaps(s).sieve);

// The items a number picks on the screen, in order.
function itemsOn(m: ConfMenu): [string, string][] {
  if (m.screen === "imap" || m.screen === "smtp") return [...CONF_ITEMS.server, ...CONF_ITEMS[m.screen]];
  return CONF_ITEMS[m.screen] ?? [];
}

function body(s: GameState, m: ConfMenu): string[] {
  const d = m.draft, title = t(`mailserver.conf.${m.screen === "imap" || m.screen === "smtp" ? "server" : m.screen}`);
  if (m.screen === "main") return [t("mailserver.conf.mainMenu"), ...MAIN.map((x, i) => row(i + 1, t(`mailserver.conf.${x}`))), "", row("D", t("mailserver.conf.presetsKey"))];
  if (m.screen === "presets") return [...lines("mailserver.conf.presetsIntro"), ...Object.keys(PRESETS).map((x) => `    ${x.padEnd(11)} = ${t(`mailserver.conf.preset.${x}`)}`), "", `    ${"quit".padEnd(11)} = ${t("mailserver.conf.presetQuit")}`];
  if (m.screen === "plugins") {
    const all = pluginsOf(s), pick = (on: boolean) => all.flatMap((x, i) => (d.plugins.includes(x) === on ? [`    ${i + 1}. ${t(`mailserver.plugin.${x}`)}`] : []));
    return [title, `  ${t("mailserver.conf.installed")}`, ...pick(true), `  ${t("mailserver.conf.available")}`, ...pick(false)];
  }
  if (m.screen === "server" || m.screen === "imap" || m.screen === "smtp") {
    const imap = `${d.imapHost}:${d.imapPort} (${confValue(d, "imap_server_type")})`, smtp = `${d.smtpHost}:${d.smtpPort}`;
    const block = (x: "imap" | "smtp") => [t(`mailserver.conf.${x}Settings`), "-".repeat(14), ...itemRows(m, CONF_ITEMS[x], CONF_ITEMS.server.length + 1)];
    return [
      title, "", t("mailserver.conf.generalHead"), "-------", ...itemRows(m, CONF_ITEMS.server), "",
      ...(m.screen === "imap" ? [...block("imap"), ""] : [row("A", t("mailserver.conf.updateImap"), imap)]),
      ...(m.screen === "smtp" ? [...block("smtp"), ""] : [row("B", t("mailserver.conf.updateSmtp"), smtp)]),
      ...(m.screen === "server" ? [] : [row("H", t(`mailserver.conf.hide.${m.screen}`))]),
    ];
  }
  return [title, ...itemRows(m, itemsOn(m))];
}

// The whole screen, as conf.pl redraws it.
function draw(s: GameState, m: ConfMenu): ConfResult {
  const keys = m.screen === "presets" ? [] : ["", ...(m.screen === "main" ? [] : [`R   ${t("mailserver.conf.return")}`]), `S   ${t("mailserver.conf.save")}`, `Q   ${t("mailserver.conf.quit")}`];
  return { output: [t("mailserver.conf.title", { file: m.read }), "-".repeat(57), ...body(s, m), ...keys, ""], clear: true, menu: { ...m, ask: null } };
}

export function confPrompt(m: ConfMenu): string {
  if (m.ask === "enter") return t("mailserver.conf.enter");
  if (m.ask === "quit") return t("mailserver.conf.saveAsk");
  if (m.ask) return isBool(m, m.ask) ? `(y/n) [${confValue(m.draft, m.ask) === "true" ? "y" : "n"}]:` : `[${confValue(m.draft, m.ask)}]:`;
  return t("mailserver.conf.command");
}

// Opens conf.pl when the line names it and the machine runs SquirrelMeal; undefined otherwise.
export function confCommand(s: GameState, machineId: string, cmd: string, args: string[]): CommandResult | undefined {
  if (!((cmd === "squirrelmeal-configure" && !args.length) || cmd === CONF_PL || (cmd === "perl" && args[0] === CONF_PL))) return undefined;
  const x = softwareOn(s, machineId).find((i) => i.id === "squirrelmeal");
  if (!x) return undefined;
  if (x.doneAt !== null || !x.cluster) return { output: lines("term.vendor.installing", { name: "SquirrelMeal" }), failed: true };
  const m: ConfMenu = { clusterId: x.cluster.id, read: x.cluster.setupPending ? "config_default.php" : "config.php", draft: webmailOf(s, x.cluster), screen: "main", ask: null, dirty: false };
  const r = draw(s, m);
  return { output: r.output, clear: true, menu: r.menu! };
}

const exit = (): ConfResult => ({ output: lines("mailserver.conf.exit"), clear: false, menu: null });

// One line typed into the open menu; act runs the save, which sets the install and writes config.php.
export function confLine(get: () => GameState, act: (a: Call) => ActionResult, m: ConfMenu, line: string): ConfResult {
  const s = get(), v = line.trim(), k = v.toUpperCase();
  const save = (): string | null => {
    let r = act([configureWebmail, m.clusterId, m.draft]);
    const c = get().clusters.find((x) => x.id === m.clusterId), machine = c && panelMachine(c);
    if (r.ok && machine) r = act([editFiles, machine, [["mkdir", "/etc/squirrelmeal"], ["write", CONFIG_PHP, configPhp(webmailOf(get(), c!))]]]);
    return r.ok ? null : t(r.error);
  };
  if (m.ask === "enter") return draw(s, m);
  if (m.ask === "quit") {
    if (!/^(y|yes)?$/i.test(v)) return exit();
    const error = save();
    return error ? { output: [error], clear: false, menu: { ...m, ask: "enter" } } : { ...exit(), output: [...lines("mailserver.conf.saved"), ...exit().output] };
  }
  if (m.ask) {
    const value = !v ? null : isBool(m, m.ask) ? (/^y/i.test(v) ? "true" : "false") : v;
    return draw(s, value === null ? m : { ...m, draft: setConfValue(m.draft, m.ask, value), dirty: true });
  }
  if (m.screen === "presets") {
    const p = PRESETS[v.toLowerCase()];
    if (!p) return draw(s, { ...m, screen: v.toLowerCase() === "quit" ? "main" : "presets" });
    const set = { imap_server_type: v.toLowerCase(), ...p };
    const draft = Object.entries(set).reduce((d, [key, value]) => setConfValue(d, key, value), m.draft);
    const out = Object.entries(set).map(([key, value]) => `${key.padStart(30)} = ${value || "<none>"}`);
    return { output: ["", ...out, ""], clear: false, menu: { ...m, draft, dirty: true, screen: "main", ask: "enter" } };
  }
  if (k === "S") {
    const error = save();
    return { output: error ? [error] : lines("mailserver.conf.saved"), clear: false, menu: { ...m, dirty: !!error, read: error ? m.read : "config.php", ask: "enter" } };
  }
  if (k === "Q") return m.dirty ? { output: lines("mailserver.conf.unsaved"), clear: false, menu: { ...m, ask: "quit" } } : exit();
  if (k === "R") return draw(s, { ...m, screen: "main" });
  if (m.screen === "main") {
    const to = k === "D" ? "presets" : MAIN[Number(k) - 1];
    return draw(s, to ? { ...m, screen: to } : m);
  }
  if (m.screen === "server" || m.screen === "imap" || m.screen === "smtp") {
    const to = ({ A: "imap", B: "smtp", H: "server" } as Record<string, Screen>)[k];
    if (to) return draw(s, { ...m, screen: to });
  }
  const n = Number(k) - 1;
  if (m.screen === "plugins") {
    const id = pluginsOf(s)[n], d = m.draft;
    if (!id) return draw(s, m);
    return draw(s, { ...m, dirty: true, draft: { ...d, plugins: d.plugins.includes(id) ? d.plugins.filter((x) => x !== id) : [...d.plugins, id] } });
  }
  const item = Number.isInteger(n) ? itemsOn(m)[n] : undefined;
  if (!item) return draw(s, m);
  const help = `mailserver.conf.help.${item[0]}`;
  return { output: ["", ...(en[help] ? lines(help) : []), ""], clear: false, menu: { ...m, ask: item[0] } };
}
