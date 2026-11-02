import { useState, type ReactNode } from "react";
import { t } from "../../../i18n/en";
import { yearOf } from "../../../sim/00-core/time";
import { mailServersOf } from "../../../sim/10-catalog/mail-providers";
import { mailBuild, mailHas } from "../../../sim/10-catalog/pear-mail";
import { companyDomain } from "../../../sim/30-customers/domains";
import { MAIL_LOGIN } from "../../../sim/42-mail/accounts";
import { accountByAddress } from "../../../sim/42-mail/address";
import { clientError, hostOwner } from "../../../sim/43-pear-mail/check";
import { autoServers, draftClient, type AccountInput } from "../../../sim/43-pear-mail/setup";
import type { ClientAccount } from "../../../sim/43-pear-mail/state";
import type { GameState } from "../../../sim/50-state";
import { getMail, setClientPassword, setupClientAccount } from "../../../sim/90-actions/pear-mail";
import { PearMailMark } from "../../art/mailmarks";
import { useStore } from "../../store";
import { offerLogin, savedLogin } from "../../vault";

// The password KeePassive holds for the address, the same entry the webmail sign-in uses; empty until it names a mailbox.
export const savedPassword = (game: GameState, address: string): string =>
  accountByAddress(game, address) ? savedLogin(game, MAIL_LOGIN(address), 2)[1] : "";

type Page = "welcome" | "incoming" | "outgoing" | "summary";
type Form = Required<Omit<AccountInput, "protocol">> & { protocol: "imap" | "pop" };
const EMPTY: Form = { fullName: "", address: "", password: "", protocol: "pop", description: "", host: "", smtp: "" };

const Field = ({ label, children }: { label: string; children: ReactNode }) => <label className="pm-row"><span>{label}</span>{children}</label>;

// The Add Account assistant: manual pages in Pear Mail 2, automatic setup first from Pear Mail 3.
export function Assistant({ onClose }: { onClose: () => void }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const canAuto = mailHas(mailBuild(game.os, game.hour), "autoSetup");
  const [page, setPage] = useState<Page>("welcome");
  const [f, setF] = useState<Form>(EMPTY);
  const [auto, setAuto] = useState(canAuto);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const found = canAuto && auto ? autoServers(game, f.address) : null;
  const inputOf = (x: Form): AccountInput => (found ? { ...x, protocol: found.protocol, host: "", smtp: "" } : x);
  const verify = (x: Form) => { setF(x); setError(clientError(game, draftClient(game, "", inputOf(x)))); setPage("summary"); };
  const text = (k: keyof Form, type = "text") => (
    <input className="field" type={type} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
  );
  // KeePassive fills the password once the address names a mailbox.
  const typeAddress = (address: string) => setF({ ...f, address, password: f.password || savedPassword(game, address) });
  // Switches to POP and, for a provider's IMAP host, to its POP host.
  const tryPop = () => {
    const owner = f.host && hostOwner(game, f.host, "imap");
    const host = owner ? mailServersOf(owner, companyDomain(game), yearOf(game.hour)).pop?.host ?? f.host : f.host;
    verify({ ...f, protocol: "pop", host });
  };
  const create = () => {
    const r = act(setupClientAccount, { ...inputOf(f), online });
    if (!r.ok) return setError(r.error);
    const g = useStore.getState().game, c = g.pearMail.accounts.find((x) => x.id === r.id);
    if (c && !clientError(g, c)) offerLogin(g, MAIL_LOGIN(c.address), c.server?.host ?? found?.host ?? c.address, [c.address, f.password]);
    onClose();
  };
  const ready = page === "welcome" ? f.fullName.trim() !== "" && f.address.includes("@") : page === "incoming" ? f.host.trim() !== "" : true;
  const next = () => (page === "welcome" ? (found ? verify(f) : setPage("incoming")) : page === "incoming" ? setPage("outgoing") : page === "outgoing" ? verify(f) : create());
  const back = () => setPage(page === "summary" ? (found ? "welcome" : "outgoing") : page === "outgoing" ? "incoming" : "welcome");
  const title = { welcome: "pearMail.add.title", incoming: "pearMail.add.incoming", outgoing: "pearMail.add.outgoing", summary: "pearMail.add.summary" }[page];

  return (
    <form className="pm-sheet pm-assistant" role="dialog" aria-labelledby="pm-add" onSubmit={(e) => { e.preventDefault(); if (ready) next(); }}>
      <PearMailMark className="pm-sheet-icon" />
      <h2 id="pm-add">{t(title)}</h2>
      <div className="pm-form">
        {page === "welcome" && <>
          <Field label={t("pearMail.add.fullName")}>{text("fullName")}</Field>
          <Field label={t("pearMail.add.address")}><input className="field" value={f.address} onChange={(e) => typeAddress(e.target.value)} autoComplete="off" /></Field>
          <Field label={t("pearMail.add.password")}>{text("password", "password")}</Field>
          {canAuto && <label className="pm-check"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />{t("pearMail.add.auto")}</label>}
        </>}
        {page === "incoming" && <>
          <Field label={t("pearMail.add.type")}>
            <select className="field" value={f.protocol} onChange={(e) => setF({ ...f, protocol: e.target.value as Form["protocol"] })}>
              {(["pop", "imap"] as const).map((p) => <option key={p} value={p}>{t(`pearMail.type.${p}`)}</option>)}
            </select>
          </Field>
          <Field label={t("pearMail.add.description")}>{text("description")}</Field>
          <Field label={t("pearMail.add.incoming")}>{text("host")}</Field>
        </>}
        {page === "outgoing" && <Field label={t("pearMail.add.outgoing")}>{text("smtp")}</Field>}
        {page === "summary" && <>
          <dl className="pm-summary">
            <dt>{t("pearMail.add.type")}</dt><dd>{t(`pearMail.type.${found?.protocol ?? f.protocol}`)}</dd>
            <dt>{t("pearMail.add.incoming")}</dt><dd>{found?.host ?? f.host}</dd>
            <dt>{t("pearMail.add.address")}</dt><dd>{f.address.trim().toLowerCase()}</dd>
            <dt>{t("pearMail.add.fullName")}</dt><dd>{f.fullName}</dd>
            <dt>{t("pearMail.add.outgoing")}</dt><dd>{found?.smtp ?? f.smtp}</dd>
          </dl>
          {error && <p className="pm-error" role="alert">{t(error)}</p>}
          <label className="pm-check"><input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} />{t("pearMail.add.online")}</label>
        </>}
      </div>
      <div className="pm-sheet-buttons">
        <button type="button" className="btn" onClick={onClose}>{t("pearMail.cancel")}</button>
        <span className="pm-grow" />
        {page === "summary" && error === "error.mailProtocol" && <button type="button" className="btn" onClick={tryPop}>{t("pearMail.add.tryPop")}</button>}
        {page !== "welcome" && <button type="button" className="btn" onClick={back}>{t("pearMail.add.back")}</button>}
        <button type="submit" className="btn primary" disabled={!ready}>{t(page === "summary" ? "pearMail.add.create" : "pearMail.add.continue")}</button>
      </div>
    </form>
  );
}

// The sheet behind an account's warning triangle; a refused password asks for the current one.
export function AccountAlert({ c, onClose }: { c: ClientAccount; onClose: () => void }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const error = clientError(game, c) ?? (c.authFailed ? "error.mailAuth" : null);
  const [password, setPassword] = useState(() => savedPassword(game, c.address));
  const [wrong, setWrong] = useState(false);
  const auth = error === "error.mailAuth";
  const submit = () => {
    if (!auth) { act(getMail, c.id); return onClose(); }
    const r = act(setClientPassword, c.id, password);
    if (!r.ok) return setWrong(true);
    offerLogin(useStore.getState().game, MAIL_LOGIN(c.address), c.server?.host ?? c.address, [c.address, password]);
    onClose();
  };
  return (
    <form className="pm-sheet" role="dialog" aria-labelledby="pm-alert" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <PearMailMark className="pm-sheet-icon" />
      <h2 id="pm-alert">{t(auth ? "pearMail.password.title" : "pearMail.alert.title", { account: c.description })}</h2>
      {error && <p className={wrong || !auth ? "pm-error" : ""} role={wrong ? "alert" : undefined}>{t(error)}</p>}
      {auth && <div className="pm-form"><Field label={t("pearMail.add.password")}><input className="field" type="password" value={password} onChange={(e) => { setPassword(e.target.value); setWrong(false); }} autoFocus /></Field></div>}
      <div className="pm-sheet-buttons">
        <span className="pm-grow" />
        <button type="button" className="btn" onClick={onClose}>{t("pearMail.cancel")}</button>
        <button type="submit" className="btn primary">{t(auth ? "pearMail.ok" : "pearMail.tryAgain")}</button>
      </div>
    </form>
  );
}
