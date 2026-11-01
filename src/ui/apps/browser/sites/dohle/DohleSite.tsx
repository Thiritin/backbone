import { useState } from "react";
import { t } from "../../../../../i18n/en";
import { LOCALE } from "../../../../../i18n/lang";
import { euro } from "../../../../../sim/00-core/money";
import { yearOf } from "../../../../../sim/00-core/time";
import type { GameState } from "../../../../../sim/50-state";
import { certOk, DOHLE_HOST, FORMULAR_APP, portalOpen, smallLimit, taxNumber } from "../../../../../sim/80-business/tax";
import { activateDohle, answerQuestionnaire, fileReturn, installDohleFormular, leaveSmallRule, loginMeinDohle, registerForDohle } from "../../../../../sim/90-actions/tax";
import { useStore } from "../../../../store";
import { paperDay } from "../../../FormDoc";
import { Jackdaw } from "../../../../art/letterheads";
import { ReturnForms } from "../../../dohle/DohleFormularApp";
import "./dohle.css";

type Go = (url: string) => void;

function Questionnaire({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const year = yearOf(game.hour), tax = game.tax;
  const [expected, setExpected] = useState("");
  const [small, setSmall] = useState(false);
  if (tax.answered !== null) {
    const number = taxNumber(game);
    return (
      <section className="dh-box">
        <header>{t("ui-tax.dohle.questionnaire")}</header>
        <table>
          <tbody>
            <tr><th>{t("ui-tax.dohle.company")}</th><td>{game.company.name}</td></tr>
            <tr><th>{t("ui-tax.dohle.sentOn")}</th><td>{paperDay(tax.answered)}</td></tr>
            <tr><th>{t("ui-tax.dohle.expected", { year: tax.since })}</th><td>{euro(tax.expected)}</td></tr>
            <tr><th>{t("ui-tax.dohle.rule")}</th><td>{t(tax.small ? "ui-tax.dohle.ruleSmall" : "ui-tax.dohle.ruleStandard")}</td></tr>
            <tr><th>{t("ui-tax.dohle.taxNumber")}</th><td>{number ?? t("ui-tax.dohle.pending")}</td></tr>
          </tbody>
        </table>
        {tax.small && <div className="dh-buttons"><button type="button" onClick={() => act(leaveSmallRule)}>{t("ui-tax.dohle.leaveSmall")}</button></div>}
      </section>
    );
  }
  return (
    <form className="dh-box" onSubmit={(e) => { e.preventDefault(); act(answerQuestionnaire, Number(expected), small); }}>
      <header>{t("ui-tax.dohle.questionnaire")}</header>
      <table>
        <tbody>
          <tr><th>{t("ui-tax.dohle.company")}</th><td>{game.company.name}</td></tr>
          <tr>
            <th><label htmlFor="dh-expected">{t("ui-tax.dohle.expected", { year })}</label></th>
            <td><input id="dh-expected" type="number" min={0} step={100} required value={expected} onChange={(e) => setExpected(e.target.value)} /> €</td>
          </tr>
          <tr><th>{t("ui-tax.dohle.limit", { year })}</th><td>{euro(smallLimit(year))}</td></tr>
          <tr>
            <th>{t("ui-tax.dohle.rule")}</th>
            <td>
              <label><input type="radio" name="dh-rule" checked={!small} onChange={() => setSmall(false)} /> {t("ui-tax.dohle.ruleStandard")}</label>
              <label><input type="radio" name="dh-rule" checked={small} onChange={() => setSmall(true)} /> {t("ui-tax.dohle.ruleSmall")}</label>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="dh-buttons"><button type="submit">{t("ui-tax.dohle.send")}</button></div>
    </form>
  );
}

function Field({ id, label, value, set, type }: { id: string; label: string; value: string; set: (v: string) => void; type?: string }) {
  return <tr><th><label htmlFor={id}>{label}</label></th><td><input id={id} type={type} required value={value} onChange={(e) => set(e.target.value)} /></td></tr>;
}

// Registration with tax number and email address, then activation with the ID from the email and the code from the letter.
function Register({ game, renew, go }: { game: GameState; renew: boolean; go: Go }) {
  const act = useStore((s) => s.act);
  const [taxNo, setTaxNo] = useState(""), [email, setEmail] = useState("");
  const [id, setId] = useState(""), [code, setCode] = useState("");
  const tax = game.tax;
  if (certOk(game) && !renew) {
    return (
      <section className="dh-box">
        <header>{t("ui-tax.dohle.account")}</header>
        <table>
          <tbody>
            <tr><th>{t("ui-tax.dohle.taxNumber")}</th><td>{tax.number}</td></tr>
            <tr><th>{t("ui-tax.dohle.certificate")}</th><td>{t("ui-tax.dohle.active")}</td></tr>
          </tbody>
        </table>
        <div className="dh-buttons"><a href={`#www.${DOHLE_HOST}/registrieren/?neu`} onClick={(e) => { e.preventDefault(); go(`www.${DOHLE_HOST}/registrieren/?neu`); }}>{t("ui-tax.dohle.lost")}</a></div>
      </section>
    );
  }
  return (
    <>
      <form className="dh-box" onSubmit={(e) => { e.preventDefault(); act(registerForDohle, taxNo, email); }}>
        <header>{t("ui-tax.dohle.register")}</header>
        <table>
          <tbody>
            <Field id="dh-taxno" label={t("ui-tax.dohle.taxNumber")} value={taxNo} set={setTaxNo} />
            <Field id="dh-mail" label={t("ui-tax.dohle.email")} value={email} set={setEmail} type="email" />
          </tbody>
        </table>
        <div className="dh-buttons"><button type="submit">{t("ui-tax.dohle.registerButton")}</button></div>
      </form>
      {tax.dohleCode && (
        <form className="dh-box" onSubmit={(e) => { e.preventDefault(); act(activateDohle, id, code); }}>
          <header>{t("ui-tax.dohle.activate")}</header>
          <table>
            <tbody>
              <Field id="dh-id" label={t("ui-tax.dohle.activationId")} value={id} set={setId} />
              <Field id="dh-code" label={t("ui-tax.dohle.activationCode")} value={code} set={setCode} />
            </tbody>
          </table>
          <div className="dh-buttons"><button type="submit">{t("ui-tax.dohle.activateButton")}</button></div>
        </form>
      )}
    </>
  );
}

function Download({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const have = game.installed.includes(FORMULAR_APP);
  return (
    <section className="dh-box">
      <header>{FORMULAR_APP}</header>
      <table>
        <tbody>
          <tr><th>{t("ui-tax.dohle.version")}</th><td>{yearOf(game.hour)}.1</td></tr>
          <tr><th>{t("ui-tax.dohle.size")}</th><td>{(14.2).toLocaleString(LOCALE)} MB</td></tr>
        </tbody>
      </table>
      <div className="dh-buttons">
        <button type="button" disabled={have} onClick={() => act(installDohleFormular)}>{t(have ? "ui-tax.dohle.installed" : "ui-tax.dohle.download")}</button>
      </div>
    </section>
  );
}

// The portal from 2013: logged in with the certificate file, it shows the same forms as DohleFormular.
function MeinDohle({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const certs = game.docs.filter((d) => d.kind === "cert");
  const [doc, setDoc] = useState(certs[0]?.id ?? ""), [inside, setInside] = useState(false);
  if (inside && certOk(game) && doc === game.tax.cert) {
    return (
      <section className="dh-box">
        <header>{t("ui-tax.mein.returns")}</header>
        <table><tbody><tr><th>{t("ui-tax.dohle.taxNumber")}</th><td>{taxNumber(game) ?? t("ui-tax.dohle.pending")}</td></tr></tbody></table>
        <ReturnForms game={game} send={(id) => act(fileReturn, id)} />
        <div className="dh-buttons"><button type="button" onClick={() => setInside(false)}>{t("ui-tax.mein.logout")}</button></div>
      </section>
    );
  }
  return (
    <form className="dh-box" onSubmit={(e) => { e.preventDefault(); if (act(loginMeinDohle, doc).ok) setInside(true); }}>
      <header>{t("ui-tax.mein.login")}</header>
      <table>
        <tbody>
          <tr>
            <th><label htmlFor="dh-cert">{t("ui-tax.dohle.certificate")}</label></th>
            <td><select id="dh-cert" required value={doc} onChange={(e) => setDoc(e.target.value)}>{certs.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</select></td>
          </tr>
        </tbody>
      </table>
      <div className="dh-buttons"><button type="submit">{t("ui-tax.mein.loginButton")}</button></div>
    </form>
  );
}

function Body({ game, path, go }: { game: GameState; path: string; go: Go }) {
  const [page, query] = path.split("?");
  const at = page.replace(/\/$/, "");
  if (at === "/erfassung") return <><h1>{t("ui-tax.dohle.questionnaire")}</h1><Questionnaire game={game} /></>;
  if (at === "/registrieren") return <><h1>{t("ui-tax.dohle.register")}</h1><Register game={game} renew={query === "neu"} go={go} /></>;
  const portal = portalOpen(game);
  if (at === "/download" && !portal) return <><h1>{t("ui-tax.dohle.downloads")}</h1><Download game={game} /></>;
  if (at === "/mein" && portal) return <><h1>{t("ui-tax.mein.title")}</h1><MeinDohle game={game} /></>;
  if (at === "/download" || at === "/mein") return <h1>{t("browser-sites-1.pg.notFound")}</h1>;
  return (
    <>
      <h1>{t("ui-tax.dohle.welcome")}</h1>
      <p>{t("ui-tax.dohle.welcomeText")}</p>
    </>
  );
}

// docs/design/plans/tax-office.md: DOHLE, the tax administration's filing site.
export function DohleSite({ game, path, go }: { game: GameState; path: string; go: Go }) {
  const tabs: [string, string][] = [[t("ui-tax.dohle.home"), "/"], [t("ui-tax.dohle.questionnaire"), "/erfassung/"], [t("ui-tax.dohle.register"), "/registrieren/"], portalOpen(game) ? [t("ui-tax.mein.title"), "/mein/"] : [t("ui-tax.dohle.downloads"), "/download/"]];
  return (
    <div className="dh">
      <div className="dh-page">
        <div className="dh-head">
          {Jackdaw}
          <div>
            <div className="dh-title">DOHLE</div>
            <div className="dh-sub">{t("ui-tax.dohle.subtitle")}</div>
          </div>
        </div>
        <nav className="dh-tabs">
          {tabs.map(([label, p]) => (
            <a key={p} href={`#www.${DOHLE_HOST}${p}`} aria-current={p === path || undefined} onClick={(e) => { e.preventDefault(); go(`www.${DOHLE_HOST}${p}`); }}>{label}</a>
          ))}
        </nav>
        <div className="dh-main"><Body game={game} path={path} go={go} /></div>
        <div className="dh-foot">
          <span>{t("ui-tax.dohle.foot")}</span>
        </div>
      </div>
    </div>
  );
}
