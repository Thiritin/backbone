import { useState } from "react";
import { t } from "../../../../../i18n/en";
import { LOCALE } from "../../../../../i18n/lang";
import { capsOf } from "../../../../../sim/42-mail/caps";
import { boxOf } from "../../../../../sim/42-mail/model";
import type { MailAccount, MailRole } from "../../../../../sim/42-mail/types";
import type { GameState } from "../../../../../sim/50-state";
import { assignMailRoles, createAdminMailbox } from "../../../../../sim/90-actions/mail-server";
import { mailboxLoss } from "../../../../../sim/80-business/mail-software";
import { addAlias, deleteMailAccount, removeAlias, setAccountPassword, setAccountQuota, setAccountTitle, setCatchAll, setForward } from "../../../../../sim/90-actions/mailbox";
import { noAutofill } from "../../../../no-autofill";
import { useFieldAct, usePageAct } from "../../pageAct";
import { dateOf, yearOf } from "../../../../../sim/00-core/time";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { familyOf } from "../../../../../sim/60-infra/vulns";
import type { SelfMailSoftware } from "../../../../../sim/80-business/mail";
import { dovecoatAt, MAIL_SOFTWARE, mailBackupAt, spamOn } from "../../../../../sim/80-business/mail-software";
import { setMailSoftwareOption } from "../../../../../sim/90-actions/mail-server";

// docs/design/plans/webmail-server.md, 5.2 and 5.3: the mailbox and alias forms Postfixit Admin and Mailpig share.
export const ROLES: MailRole[] = ["owner", "sales", "support", "abuse"];

export interface OwnServer { tenant: string; domain: string; boxes: MailAccount[]; catchAll: MailAccount | undefined }
// The own-server tenant of a mail server, with its open mailboxes.
export function ownServer(game: GameState, mailCluster: string | null): OwnServer | null {
  const tn = game.mail.tenants.find((x) => x.host === "self" && x.clusterId === mailCluster && (x.endsAt === null || x.endsAt > game.hour));
  if (!tn) return null;
  const boxes = game.mail.accounts.filter((a) => a.tenant === tn.id && a.closedAt === null);
  return { tenant: tn.id, domain: tn.domain, boxes, catchAll: boxes.find((a) => a.id === game.mail.catchAll) };
}

// What uninstalling the mail server takes with it.
export const lossLine = (x: { mailboxes: number; messages: number }) => t("mailserver.removeLoss", { mailboxes: x.mailboxes.toLocaleString(LOCALE), messages: x.messages.toLocaleString(LOCALE), n: x.mailboxes });
export const address = (a: MailAccount) => `${a.local}@${a.domain}`;
export const usedMb = (a: MailAccount) => (a.usedKb / 1024).toLocaleString(LOCALE, { maximumFractionDigits: 1 });
export const quotaOf = (game: GameState, a: MailAccount) => capsOf(game, a).quotaMb.toLocaleString(LOCALE);
export const messagesOf = (game: GameState, a: MailAccount) => (boxOf(game, a.id).length + a.older.n).toLocaleString(LOCALE);
export const rolesOf = (game: GameState, a: MailAccount) => [...(a.id === game.mail.primary ? ["owner"] : []), ...a.roles.filter((r) => r !== "owner")].map((r) => t(`mailserver.role.${r}`)).join(", ");

const Err = ({ error }: { error: string | null }) => (error ? <p className="adm-error" role="alert">{t(error)}</p> : null);

function Roles({ value, set }: { value: MailRole[]; set: (r: MailRole[]) => void }) {
  return (
    <span className="adm-roles">
      {ROLES.map((r) => <label key={r}><input type="checkbox" checked={value.includes(r)} onChange={(e) => set(e.target.checked ? [...value, r] : value.filter((x) => x !== r))} />{t(`mailserver.role.${r}`)}</label>)}
    </span>
  );
}

// Create mailbox; welcome is Postfixit Admin's "Send Welcome mail" box, absent in Mailpig.
export function CreateMailbox({ game, server, title, button, welcome, done }: { game: GameState; server: OwnServer; title: string; button: string; welcome?: boolean; done: (msg: string) => void }) {
  const [act, error] = useFieldAct(), [local, setLocal] = useState(""), [pass, setPass] = useState(""), [again, setAgain] = useState(""), [name, setName] = useState("");
  const [quota, setQuota] = useState(String(server.boxes[0] ? capsOf(game, server.boxes[0]).quotaMb : 1024)), [roles, setRoles] = useState<MailRole[]>([]), [send, setSend] = useState(true);
  const [mismatch, setMismatch] = useState(false);
  const submit = () => {
    setMismatch(pass !== again);
    if (pass !== again) return;
    const r = act(createAdminMailbox, { tenant: server.tenant, local, title: name, password: pass, quotaMb: Number(quota), roles, welcome: welcome ? send : true });
    if (r.ok) done(t("mailserver.adm.mailboxAdded", { address: `${local.trim().toLowerCase()}@${server.domain}` }));
  };
  return (
    <form className="adm-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <table>
        <thead><tr><th colSpan={2}>{title}</th></tr></thead>
        <tbody>
          <tr><td>{t("mailserver.adm.username")}</td><td><input value={local} onChange={(e) => setLocal(e.target.value)} {...noAutofill} />{`@${server.domain}`}</td></tr>
          <tr><td>{t("mailserver.adm.password")}</td><td><input type="password" value={pass} onChange={(e) => setPass(e.target.value)} {...noAutofill} /></td></tr>
          <tr><td>{t("mailserver.adm.again")}</td><td><input type="password" value={again} onChange={(e) => setAgain(e.target.value)} {...noAutofill} /></td></tr>
          <tr><td>{t("mailserver.adm.name")}</td><td><input value={name} onChange={(e) => setName(e.target.value)} {...noAutofill} /></td></tr>
          <tr><td>{t("mailserver.adm.quota")}</td><td><input type="number" min={1} value={quota} onChange={(e) => setQuota(e.target.value)} /></td></tr>
          <tr><td>{t("mailserver.adm.receives")}</td><td><Roles value={roles} set={setRoles} /></td></tr>
          {welcome && <tr><td>{t("mailserver.pfa.welcomeMail")}</td><td><input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} /></td></tr>}
          <tr><td /><td><button type="submit">{button}</button></td></tr>
        </tbody>
      </table>
      <Err error={mismatch ? "error.mailPasswordMatch" : error} />
    </form>
  );
}

// Edit: name, quota, roles, the forwarder and a password reset; a hire's mailbox shows the password it was given.
export function EditMailbox({ game, box, title, done }: { game: GameState; box: MailAccount; title: string; done: (msg: string) => void }) {
  const [act, error] = useFieldAct(), [name, setName] = useState(box.title), [quota, setQuota] = useState(String(capsOf(game, box).quotaMb));
  const [roles, setRoles] = useState<MailRole[]>([...(box.id === game.mail.primary ? ["owner" as const] : []), ...box.roles.filter((r) => r !== "owner")]);
  const [fwd, setFwd] = useState(box.forward?.to ?? ""), [keep, setKeep] = useState(box.forward?.keep ?? true), [pass, setPass] = useState(""), [again, setAgain] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const submit = () => {
    setMismatch(pass !== again);
    if (pass !== again) return;
    const steps: (() => { ok: boolean })[] = [
      () => act(setAccountTitle, box.id, name),
      () => act(setAccountQuota, box.id, Number(quota)),
      () => act(assignMailRoles, box.id, roles.includes("owner") || box.id !== game.mail.primary ? roles : [...roles, "owner"]),
      () => act(setForward, box.id, fwd.trim() || null, keep),
      ...(pass ? [() => act(setAccountPassword, null, box.id, pass)] : []),
    ];
    if (steps.every((s) => s().ok)) done(t("mailserver.adm.saved"));
  };
  return (
    <form className="adm-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <table>
        <thead><tr><th colSpan={2}>{title}</th></tr></thead>
        <tbody>
          <tr><td>{t("mailserver.adm.username")}</td><td><b>{address(box)}</b></td></tr>
          {box.employee && <tr><td>{t("mailserver.adm.initial")}</td><td><code>{box.password}</code></td></tr>}
          <tr><td>{t("mailserver.adm.name")}</td><td><input value={name} onChange={(e) => setName(e.target.value)} {...noAutofill} /></td></tr>
          <tr><td>{t("mailserver.adm.quota")}</td><td><input type="number" min={1} value={quota} onChange={(e) => setQuota(e.target.value)} /></td></tr>
          <tr><td>{t("mailserver.adm.receives")}</td><td><Roles value={roles} set={setRoles} /></td></tr>
          <tr><td>{t("mailserver.adm.forward")}</td><td><input value={fwd} onChange={(e) => setFwd(e.target.value)} {...noAutofill} /> <label><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />{t("mailserver.adm.keep")}</label></td></tr>
          <tr><td>{t("mailserver.adm.reset")}</td><td><input type="password" value={pass} onChange={(e) => setPass(e.target.value)} {...noAutofill} /></td></tr>
          <tr><td>{t("mailserver.adm.again")}</td><td><input type="password" value={again} onChange={(e) => setAgain(e.target.value)} {...noAutofill} /></td></tr>
          <tr><td /><td><button type="submit">{t("mailserver.adm.save")}</button></td></tr>
        </tbody>
      </table>
      <Err error={mismatch ? "error.mailPasswordMatch" : error} />
    </form>
  );
}

// Delete asks first and names what goes with the mailbox.
export function DeleteMailbox({ game, box, done }: { game: GameState; box: MailAccount; done: (msg: string | null) => void }) {
  const [act, error] = useFieldAct(), loss = mailboxLoss(game, box.id);
  return (
    <div className="adm-confirm" role="alertdialog">
      <p><b>{t("mailserver.adm.confirmDelete", { address: address(box) })}</b></p>
      <p>{t("mailserver.adm.lossMessages", { n: loss.messages.toLocaleString(LOCALE) })}</p>
      {loss.stale && <p>{t("mailserver.adm.lossStale")}</p>}
      <button className="danger" onClick={() => { if (act(deleteMailAccount, box.id).ok) done(t("mailserver.adm.deleted", { address: address(box) })); }}>{t("mailserver.adm.delete")}</button>
      <button onClick={() => done(null)}>{t("mailserver.adm.cancel")}</button>
      <Err error={error} />
    </div>
  );
}

// Create alias: "*" makes the target the catch-all.
export function CreateAlias({ server, title, hint, button, done }: { server: OwnServer; title: string; hint: string; button: string; done: (msg: string) => void }) {
  const [act, error] = useFieldAct(), [local, setLocal] = useState(""), [to, setTo] = useState(server.boxes[0]?.id ?? "");
  const submit = () => {
    const l = local.trim().toLowerCase(), r = l === "*" || l === "" || l.startsWith("@") ? act(setCatchAll, to) : act(addAlias, to, l);
    if (r.ok) done(t("mailserver.adm.aliasAdded", { address: `${l}@${server.domain}` }));
  };
  return (
    <form className="adm-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <table>
        <thead><tr><th colSpan={2}>{title}</th></tr></thead>
        <tbody>
          <tr><td>{t("mailserver.adm.alias")}</td><td><input value={local} onChange={(e) => setLocal(e.target.value)} {...noAutofill} />{`@${server.domain}`}<br /><small>{hint}</small></td></tr>
          <tr><td>{t("mailserver.adm.to")}</td><td><select value={to} onChange={(e) => setTo(e.target.value)}>{server.boxes.map((b) => <option key={b.id} value={b.id}>{address(b)}</option>)}</select></td></tr>
          <tr><td /><td><button type="submit">{button}</button></td></tr>
        </tbody>
      </table>
      <Err error={error} />
    </form>
  );
}

type Act = ReturnType<typeof useFieldAct>[0];
// The aliases, forwarders and catch-all of the domain as rows of from and to, with their remove action.
export function aliasRows(server: OwnServer): { from: string; to: string; key: string; remove: ((act: Act) => void) | null }[] {
  return [
    ...server.boxes.flatMap((b) => b.aliases.map((l) => ({ from: `${l}@${b.domain}`, to: address(b), key: `${b.id}:${l}`, remove: (act: Act) => { act(removeAlias, b.id, l); } }))),
    ...server.boxes.filter((b) => b.forward).map((b) => ({ from: address(b), to: [b.forward!.keep && address(b), b.forward!.to].filter(Boolean).join(", "), key: `${b.id}:fwd`, remove: null })),
    ...(server.catchAll ? [{ from: `*@${server.domain}`, to: address(server.catchAll), key: "catchall", remove: (act: Act) => { act(setCatchAll, null); } }] : []),
  ];
}

// The mail server's own lines: its spam filter with the switch where it has one, Dovecoat's release and the last backup.
export function ServerLines({ game, back, className }: { game: GameState; back: Cluster; className: string }) {
  const act = usePageAct(), sw = familyOf(back) as SelfMailSoftware, row = MAIL_SOFTWARE[sw], on = spamOn(game, back, sw), at = mailBackupAt(game, back);
  return (
    <table className={className}>
      <tbody>
        <tr><th>{row.spam.name}</th><td>{t(on ? "mailserver.adm.on" : "mailserver.adm.off")} {!row.spam.always && <button onClick={() => act(setMailSoftwareOption, back.id, "spam", !on)}>{t(on ? "mailserver.adm.switchOff" : "mailserver.adm.switchOn")}</button>}</td></tr>
        {sw === "postfixit" && <tr><th>{t("mailserver.adm.dovecoat")}</th><td>{dovecoatAt(yearOf(game.hour))}</td></tr>}
        <tr><th>{t("mailserver.adm.backup")}</th><td>{at === null ? t("mailserver.adm.none") : dateOf(at).toLocaleString(LOCALE, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })}</td></tr>
      </tbody>
    </table>
  );
}
