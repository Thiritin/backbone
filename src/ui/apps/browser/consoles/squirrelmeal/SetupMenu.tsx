import { useState } from "react";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { selfHostCaps, webmailOf, WEBMAIL_PLUGINS, type WebmailInstall } from "../../../../../sim/80-business/webmail";
import { configureWebmail } from "../../../../../sim/90-actions/mail-server";
import { t } from "../../../../../i18n/en";
import { useFieldAct } from "../../pageAct";

type Menu = "main" | "org" | "server" | "plugins";
type Field = "productName" | "domain" | "imapHost" | "imapPort" | "smtpHost" | "smtpPort";
const FIELDS: Record<"org" | "server", Field[]> = { org: ["productName"], server: ["domain", "imapHost", "imapPort", "smtpHost", "smtpPort"] };
const MAIN: [string, Menu][] = [["1", "org"], ["2", "server"], ["3", "plugins"]];
const pad = (x: string, n: number) => x.padEnd(n);

// docs/design/plans/webmail-server.md, 3.5: the numbered text menu of the configuration tool, run on a fresh install.
export function SetupMenu({ game, c }: { game: GameState; c: Cluster }) {
  const [act, error] = useFieldAct();
  const [draft, setDraft] = useState<WebmailInstall>(() => webmailOf(game, c));
  const [menu, setMenu] = useState<Menu>("main"), [ask, setAsk] = useState<Field | null>(null);
  const [cmd, setCmd] = useState("");
  const plugins = WEBMAIL_PLUGINS.filter((x) => x !== "havelsieve" || selfHostCaps(game).sieve);

  const run = (raw: string) => {
    const v = raw.trim();
    setCmd("");
    if (ask) {
      if (v) setDraft({ ...draft, [ask]: ask.endsWith("Port") ? Number(v) : v });
      setAsk(null);
      return;
    }
    const k = v.toUpperCase();
    if (k === "S" || k === "Q") {
      act(configureWebmail, c.id, draft);
      return;
    }
    if (k === "R") return setMenu("main");
    if (menu === "main") { const to = MAIN.find(([n]) => n === k); if (to) setMenu(to[1]); return; }
    const n = Number(k) - 1;
    if (menu === "plugins") {
      const id = plugins[n];
      if (id) setDraft({ ...draft, plugins: draft.plugins.includes(id) ? draft.plugins.filter((x) => x !== id) : [...draft.plugins, id] });
      return;
    }
    const f = FIELDS[menu][n];
    if (f) setAsk(f);
  };

  const fieldLines = (m: "org" | "server") => FIELDS[m].map((f, i) => `${pad(`${i + 1}.`, 4)}${pad(t(`mailserver.setup.${f}`), 22)}: ${draft[f]}`);
  const body: string[] = menu === "main"
    ? [t("mailserver.setup.mainMenu"), ...MAIN.map(([n, m]) => `${pad(`${n}.`, 4)}${t(`mailserver.setup.${m}`)}`)]
    : menu === "plugins"
      ? [t("mailserver.setup.plugins"), "", t("mailserver.setup.installed"), ...plugins.flatMap((x, i) => (draft.plugins.includes(x) ? [`  ${pad(`${i + 1}.`, 4)}${t(`mailserver.plugin.${x}`)}`] : [])),
        "", t("mailserver.setup.available"), ...plugins.flatMap((x, i) => (draft.plugins.includes(x) ? [] : [`  ${pad(`${i + 1}.`, 4)}${t(`mailserver.plugin.${x}`)}`]))]
      : [t(`mailserver.setup.${menu}`), "", ...fieldLines(menu)];
  const keys = [...(menu === "main" ? [] : [`R   ${t("mailserver.setup.return")}`]), `S   ${t("mailserver.setup.save")}`, `Q   ${t("mailserver.setup.quit")}`];
  const prompt = ask ? `${t(`mailserver.setup.${ask}`)} [${draft[ask]}]: ` : `${t("mailserver.setup.command")} >> `;

  return (
    <div className="smc">
      <pre>{[t("mailserver.setup.title"), "---------------------------------------------------------", ...body, "", ...keys, "", ...(error ? [t(error), ""] : [])].join("\n")}</pre>
      <form onSubmit={(e) => { e.preventDefault(); run(cmd); }}>
        <label>{prompt}<input value={cmd} onChange={(e) => setCmd(e.target.value)} autoFocus spellCheck={false} autoComplete="off" /></label>
      </form>
    </div>
  );
}
