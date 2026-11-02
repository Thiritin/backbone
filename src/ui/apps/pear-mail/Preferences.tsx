// The Preferences sheet: an icon tab strip over one pane (docs/design/plans/mail-client.md, Preferences and the account lifecycle).
import { useState, type ReactNode } from "react";
import { AtSign, Glasses, ListChecks, MailX, Minus, PenLine, Plus, Settings, Signature as SignatureIcon, Type, type LucideIcon } from "lucide-react";
import { t } from "../../../i18n/en";
import { LOCALE } from "../../../i18n/lang";
import { mailBuild, MAIL_BUILDS } from "../../../sim/10-catalog/pear-mail";
import { autoServers, CHECK_EVERY } from "../../../sim/43-pear-mail/setup";
import { FONT_SIZES, type ClientAccount, type ClientRule, type PearMailPrefs, type PopRemove } from "../../../sim/43-pear-mail/state";
import { editClientAccount, removeClientAccount, setAccountEnabled } from "../../../sim/90-actions/pear-mail";
import { resetPearJunk, setPearJunk } from "../../../sim/90-actions/pear-junk";
import { removeSignature, saveSignature, seePearBuild, setPearPref } from "../../../sim/90-actions/pear-prefs";
import { ask } from "../../desktop/Confirm";
import { useStore } from "../../store";
import { RulesPane } from "./Rules";

export type PrefTab = "general" | "accounts" | "junk" | "fonts" | "viewing" | "composing" | "signatures" | "rules";
const TABS: [PrefTab, LucideIcon][] = [
  ["general", Settings], ["accounts", AtSign], ["junk", MailX], ["fonts", Type], ["viewing", Glasses], ["composing", PenLine], ["signatures", SignatureIcon], ["rules", ListChecks],
];
const POP_REMOVE: PopRemove[] = ["now", "day", "week", "month", "never"];

const Row = ({ label, children }: { label: string; children: ReactNode }) => <label className="pm-row"><span>{label}</span>{children}</label>;
function usePrefs() {
  const p = useStore((s) => s.game.pearMail.prefs), act = useStore((s) => s.act);
  const check = (k: keyof PearMailPrefs, label: string) => (
    <label className="pm-check"><input type="checkbox" checked={!!p[k]} onChange={(e) => act(setPearPref, { [k]: e.target.checked })} />{t(label)}</label>
  );
  return { p, act, check };
}

function GeneralPane() {
  const { act, check } = usePrefs(), accounts = useStore((s) => s.game.pearMail.accounts);
  const every = accounts[0]?.checkEvery ?? CHECK_EVERY[0];
  return (
    <div className="pm-pref-form">
      <Row label={t("pearMail.general.check")}>
        <select className="field" value={every} disabled={!accounts.length} onChange={(e) => { for (const c of accounts) act(editClientAccount, c.id, { checkEvery: +e.target.value }); }}>
          {[...CHECK_EVERY, 0].map((m) => <option key={m} value={m}>{m ? t("pearMail.general.every", { n: m.toLocaleString(LOCALE) }) : t("pearMail.general.manually")}</option>)}
        </select>
      </Row>
      {check("sound", "pearMail.general.sound")}
      {check("dockCount", "pearMail.general.dock")}
    </div>
  );
}

type AcctTab = "info" | "behaviors" | "advanced";
function AccountForm({ c }: { c: ClientAccount }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const auto = c.server ? null : autoServers(game, c.address);
  const start = { description: c.description, fullName: c.fullName, password: c.password, host: c.server?.host ?? auto?.host ?? "", smtp: c.smtp ?? auto?.smtp ?? "", storeSent: c.storeSent, popRemove: c.popRemove };
  const [f, setF] = useState(start);
  const [tab, setTab] = useState<AcctTab>("info");
  const [error, setError] = useState<string | null>(null);
  const changed = Object.fromEntries(Object.entries(f).filter(([k, v]) => v !== start[k as keyof typeof start]));
  const text = (k: "description" | "fullName" | "password" | "host" | "smtp", type = "text") => <input className="field" type={type} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />;
  const save = () => { const r = act(editClientAccount, c.id, changed); setError(r.ok ? null : r.error ?? null); };
  return (
    <div className="pm-acct-form">
      <div className="pm-subtabs" role="tablist">
        {(["info", "behaviors", "advanced"] as const).filter((k) => k !== "advanced" || c.protocol === "pop").map((k) => (
          <button key={k} role="tab" aria-selected={k === tab} className={k === tab ? "on" : ""} onClick={() => setTab(k)}>{t(`pearMail.acct.${k}`)}</button>
        ))}
      </div>
      {tab === "info" && <>
        <Row label={t("pearMail.add.type")}><span className="pm-value">{t(`pearMail.type.${c.protocol}`)}</span></Row>
        <Row label={t("pearMail.add.description")}>{text("description")}</Row>
        <Row label={t("pearMail.add.address")}><span className="pm-value">{c.address}</span></Row>
        <Row label={t("pearMail.add.fullName")}>{text("fullName")}</Row>
        <Row label={t("pearMail.add.password")}>{text("password", "password")}</Row>
        <Row label={t("pearMail.add.incoming")}>{text("host")}</Row>
        <Row label={t("pearMail.add.outgoing")}>{text("smtp")}</Row>
        <label className="pm-check"><input type="checkbox" checked={c.enabled} onChange={(e) => act(setAccountEnabled, c.id, e.target.checked)} />{t("pearMail.acct.enable")}</label>
      </>}
      {tab === "behaviors" && <label className="pm-check"><input type="checkbox" checked={f.storeSent} onChange={(e) => setF({ ...f, storeSent: e.target.checked })} />{t("pearMail.acct.storeSent")}</label>}
      {tab === "advanced" && (
        <Row label={t("pearMail.acct.popRemove")}>
          <select className="field" value={f.popRemove} onChange={(e) => setF({ ...f, popRemove: e.target.value as PopRemove })}>
            {POP_REMOVE.map((x) => <option key={x} value={x}>{t(`pearMail.acct.pop.${x}`)}</option>)}
          </select>
        </Row>
      )}
      {error && <p className="pm-error">{t(error)}</p>}
      <p><button className="btn" disabled={!Object.keys(changed).length} onClick={save}>{t("pearMail.acct.save")}</button></p>
    </div>
  );
}

function AccountsPane({ onAdd }: { onAdd: () => void }) {
  const accounts = useStore((s) => s.game.pearMail.accounts), act = useStore((s) => s.act);
  const [sel, setSel] = useState<string | null>(accounts[0]?.id ?? null);
  const [removing, setRemoving] = useState<ClientAccount | null>(null);
  const [keep, setKeep] = useState(true);
  const c = accounts.find((x) => x.id === sel) ?? accounts[0];
  return (
    <div className="pm-pref-cols">
      <div className="pm-pref-list">
        <ul>
          {accounts.map((x) => (
            <li key={x.id} className={x.id === c?.id ? "sel" : ""} onClick={() => setSel(x.id)}>
              <input type="checkbox" aria-label={x.description} checked={x.enabled} onClick={(e) => e.stopPropagation()} onChange={(e) => act(setAccountEnabled, x.id, e.target.checked)} />
              <span>{x.description}</span>
            </li>
          ))}
        </ul>
        <div className="pm-pref-pm">
          <button aria-label={t("pearMail.acct.add")} title={t("pearMail.acct.add")} onClick={onAdd}><Plus /></button>
          <button aria-label={t("pearMail.acct.remove")} title={t("pearMail.acct.remove")} disabled={!c} onClick={() => { setKeep(true); setRemoving(c ?? null); }}><Minus /></button>
        </div>
      </div>
      {c && <AccountForm key={c.id} c={c} />}
      {removing && (
        <div className="pm-sheet" role="alertdialog" aria-labelledby="pm-remove">
          <h2 id="pm-remove">{t("pearMail.acct.removeTitle", { name: removing.description })}</h2>
          {removing.protocol === "pop" && <label className="pm-check"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />{t("pearMail.acct.keepCopy")}</label>}
          <div className="pm-sheet-buttons">
            <span className="pm-grow" />
            <button className="btn" onClick={() => setRemoving(null)}>{t("pearMail.cancel")}</button>
            <button className="btn primary" onClick={() => { act(removeClientAccount, removing.id, removing.protocol === "pop" && keep); setRemoving(null); setSel(null); }}>{t("pearMail.remove")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function FontsPane() {
  const { p, act, check } = usePrefs();
  const size = (k: "listSize" | "msgSize", label: string) => (
    <Row label={t(label)}>
      <select className="field" value={p[k]} onChange={(e) => act(setPearPref, { [k]: +e.target.value })}>
        {FONT_SIZES.map((n) => <option key={n} value={n}>{t("pearMail.font.size", { n: n.toLocaleString(LOCALE) })}</option>)}
      </select>
    </Row>
  );
  return <div className="pm-pref-form">{size("listSize", "pearMail.font.list")}{size("msgSize", "pearMail.font.msg")}{check("fixedWidth", "pearMail.font.fixed")}{check("quoteColor", "pearMail.font.quote")}</div>;
}

function ViewingPane() {
  const { check } = usePrefs();
  return <div className="pm-pref-form">{check("boldUnread", "pearMail.view.bold")}{check("related", "pearMail.view.related")}</div>;
}

function ComposingPane() {
  const { p, act, check } = usePrefs(), accounts = useStore((s) => s.game.pearMail.accounts);
  return (
    <div className="pm-pref-form">
      <Row label={t("pearMail.compose.self")}>
        <select className="field" value={p.ccSelf} onChange={(e) => act(setPearPref, { ccSelf: e.target.value as PearMailPrefs["ccSelf"] })}>
          {(["off", "cc", "bcc"] as const).map((x) => <option key={x} value={x}>{t(`pearMail.compose.self.${x}`)}</option>)}
        </select>
      </Row>
      <Row label={t("pearMail.compose.from")}>
        <select className="field" value={p.defaultFrom ?? ""} onChange={(e) => act(setPearPref, { defaultFrom: e.target.value || null })}>
          <option value="">{t("pearMail.compose.fromSelected")}</option>
          {accounts.map((c) => <option key={c.id} value={c.id}>{c.description}</option>)}
        </select>
      </Row>
      {check("quote", "pearMail.compose.quote")}
    </div>
  );
}

function SignaturesPane() {
  const pm = useStore((s) => s.game.pearMail), act = useStore((s) => s.act);
  const [who, setWho] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(pm.signatures[0]?.id ?? null);
  const sig = pm.signatures.find((x) => x.id === sel), c = pm.accounts.find((x) => x.id === who);
  const add = () => { const r = act(saveSignature, { name: t("pearMail.sig.name", { n: (pm.signatures.length + 1).toLocaleString(LOCALE) }), text: "" }); if (r.ok && r.id) setSel(r.id); };
  return (
    <div className="pm-pref-cols">
      <div className="pm-pref-list">
        <ul>
          {[null, ...pm.accounts.map((x) => x.id)].map((id) => (
            <li key={id ?? ""} className={id === who ? "sel" : ""} onClick={() => setWho(id)}>{id ? pm.accounts.find((x) => x.id === id)?.description : t("pearMail.sig.all")}</li>
          ))}
        </ul>
      </div>
      <div className="pm-pref-list">
        <ul>{pm.signatures.map((x) => <li key={x.id} className={x.id === sel ? "sel" : ""} onClick={() => setSel(x.id)}>{x.name}</li>)}</ul>
        <div className="pm-pref-pm">
          <button aria-label={t("pearMail.sig.add")} title={t("pearMail.sig.add")} onClick={add}><Plus /></button>
          <button aria-label={t("pearMail.sig.remove")} title={t("pearMail.sig.remove")} disabled={!sig} onClick={() => { if (sig) { act(removeSignature, sig.id); setSel(null); } }}><Minus /></button>
        </div>
      </div>
      <div className="pm-sig-edit">
        {sig && <>
          <input className="field" aria-label={t("pearMail.rule.name")} value={sig.name} onChange={(e) => act(saveSignature, { ...sig, name: e.target.value })} />
          <textarea className="field" aria-label={t("pearMail.sig.text")} value={sig.text} onChange={(e) => act(saveSignature, { ...sig, text: e.target.value })} />
        </>}
        {c && (
          <Row label={t("pearMail.sig.choose")}>
            <select className="field" value={c.signature ?? ""} onChange={(e) => act(editClientAccount, c.id, { signature: e.target.value || null })}>
              <option value="">{t("pearMail.sig.none")}</option>
              {pm.signatures.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </Row>
        )}
      </div>
    </div>
  );
}

// Shown once per build: the features of every build since the one last seen.
export function WhatsNew() {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const build = mailBuild(game.os, game.hour), seen = MAIL_BUILDS.findIndex((b) => b.version === game.pearMail.seenBuild);
  const adds = MAIL_BUILDS.slice(seen + 1, MAIL_BUILDS.indexOf(build) + 1).flatMap((b) => b.adds);
  if (!game.pearMail.welcomed || game.pearMail.seenBuild === build.version || !adds.length) return null;
  return (
    <div className="pm-sheet" role="dialog" aria-labelledby="pm-whatsnew">
      <h2 id="pm-whatsnew">{t("pearMail.whatsNew", { version: build.version })}</h2>
      <ul className="pm-whatsnew">{adds.map((f) => <li key={f}>{t(`pearMail.feature.${f}`)}</li>)}</ul>
      <button className="btn primary" onClick={() => act(seePearBuild)}>{t("pearMail.whatsNew.continue")}</button>
    </div>
  );
}

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

export function Preferences({ tab, onTab, onEditRule, onAdd, onClose }: { tab: PrefTab; onTab: (t: PrefTab) => void; onEditRule: (r?: ClientRule) => void; onAdd: () => void; onClose: () => void }) {
  const panes: Record<PrefTab, ReactNode> = {
    general: <GeneralPane />, accounts: <AccountsPane onAdd={onAdd} />, junk: <JunkPane />, fonts: <FontsPane />, viewing: <ViewingPane />,
    composing: <ComposingPane />, signatures: <SignaturesPane />, rules: <RulesPane onEdit={onEditRule} />,
  };
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
