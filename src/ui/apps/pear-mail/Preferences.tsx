// The Preferences sheet: an icon tab strip over one pane (docs/design/plans/mail-client.md, Preferences and the account lifecycle).
import type { ReactNode } from "react";
import { ListChecks, MailX, type LucideIcon } from "lucide-react";
import { t } from "../../../i18n/en";
import type { ClientRule } from "../../../sim/43-pear-mail/state";
import { resetPearJunk, setPearJunk } from "../../../sim/90-actions/pear-junk";
import { ask } from "../../desktop/Confirm";
import { useStore } from "../../store";
import { RulesPane } from "./Rules";

export type PrefTab = "junk" | "rules";
const TABS: [PrefTab, LucideIcon][] = [["junk", MailX], ["rules", ListChecks]];

function JunkPane() {
  const j = useStore((s) => s.game.pearMail.junk), act = useStore((s) => s.act);
  return (
    <div className="pm-pref-form">
      <label className="pm-check"><input type="checkbox" checked={j.on} onChange={(e) => act(setPearJunk, { on: e.target.checked })} />{t("pearMail.junkPref.on")}</label>
      <fieldset disabled={!j.on}>
        <legend>{t("pearMail.junkPref.arrives")}</legend>
        {(["training", "automatic"] as const).map((m) => (
          <label key={m} className="pm-check"><input type="radio" name="pm-junk-mode" checked={j.mode === m} onChange={() => act(setPearJunk, { mode: m })} />{t(`pearMail.junkPref.${m}`, { box: t("mail.folder.junk") })}</label>
        ))}
      </fieldset>
      <p><button className="btn" onClick={() => ask({ title: t("pearMail.junkPref.resetTitle"), text: t("pearMail.junkPref.resetText"), action: t("pearMail.junkPref.reset"), run: () => act(resetPearJunk) })}>{t("pearMail.junkPref.resetDots")}</button></p>
    </div>
  );
}

export function Preferences({ tab, onTab, onEditRule, onClose }: { tab: PrefTab; onTab: (t: PrefTab) => void; onEditRule: (r?: ClientRule) => void; onClose: () => void }) {
  const panes: Record<PrefTab, ReactNode> = { junk: <JunkPane />, rules: <RulesPane onEdit={onEditRule} /> };
  return (
    <div className="pm-sheet pm-prefs" role="dialog" aria-labelledby="pm-prefs-title">
      <div className="pm-pref-tabs" role="tablist">
        {TABS.map(([k, Icon]) => (
          <button key={k} role="tab" aria-selected={k === tab} className={k === tab ? "on" : ""} onClick={() => onTab(k)}><Icon /><span>{t(`pearMail.pref.${k}`)}</span></button>
        ))}
      </div>
      <h2 id="pm-prefs-title">{t(`pearMail.pref.${tab}`)}</h2>
      {panes[tab]}
      <div className="pm-sheet-buttons"><span className="pm-grow" /><button className="btn primary" onClick={onClose}>{t("pearMail.ok")}</button></div>
    </div>
  );
}
