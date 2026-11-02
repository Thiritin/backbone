import { useState } from "react";
import { t } from "../../../../../i18n/en";
import { dateOf } from "../../../../../sim/00-core/time";
import type { GameState } from "../../../../../sim/50-state";
import { LEGAL_FORMS, OFFICE_HOST, OFFICE_URL, officeOpen } from "../../../../../sim/80-business/office";
import { registerCompany } from "../../../../../sim/90-actions/company";
import { euroCents } from "../../../../../sim/00-core/money";
import { euro } from "../../../../../sim/00-core/money";
import { applyError, FEES, FILED_WITH, FORM_RANK, SHARE_CAPITAL } from "../../../../../sim/80-business/paperwork";
import { downloadForm } from "../../../../../sim/90-actions/docs";
import "./office.css";
import { useFieldAct, usePageAct } from "../../pageAct";
import { AddressFields, type AddressValue } from "../shared/Checkout";

const DAYS = [t("browser-sites-1.of.day0"), t("browser-sites-1.of.day1"), t("browser-sites-1.of.day2"), t("browser-sites-1.of.day3"), t("browser-sites-1.of.day4"), t("browser-sites-1.of.day5"), t("browser-sites-1.of.day6")];
const pad = (n: number) => String(n).padStart(2, "0");
const stamp = (hour: number) => {
  const d = dateOf(hour);
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
};
const clock = (hour: number, minute: number) => `${DAYS[dateOf(hour).getUTCDay()]}, ${stamp(hour)}, ${pad(dateOf(hour).getUTCHours())}:${pad(minute)}`;

const MENU = [
  [t("browser-sites-1.of.menuHome"), "/"],
  [t("browser-sites-1.of.eservice"), "/eservice/"],
  [t("browser-sites-1.of.menuForms"), "/forms/"],
  [t("browser-sites-1.of.menuFees"), "/fees/"],
  [t("browser-sites-1.of.menuDirections"), "/directions/"],
  [t("browser-sites-1.of.menuContact"), "/contact/"],
];

function Hours() {
  return (
    <table className="to-hours">
      <tbody>
        <tr><td>{t("browser-sites-1.of.weekdays")}</td><td>{t("browser-sites-1.of.weekdayHours")}</td></tr>
        <tr><td>{t("browser-sites-1.of.weekend")}</td><td>{t("browser-sites-1.of.closed")}</td></tr>
      </tbody>
    </table>
  );
}

// Shown next to the field the office turned down, or under the form.
const FIELD: Record<string, string> = { "error.companyName": "name", "error.ownerName": "owner", "error.companyAddress": "address" };

function Register({ game }: { game: GameState }) {
  const [act, error] = useFieldAct();
  const at = error ? FIELD[error] ?? "form" : null, note = (field: string) => at === field && <span className="to-error" role="alert">{t(error!)}</span>;
  const [name, setName] = useState(game.company.name);
  const [owner, setOwner] = useState("");
  const blank = { street: "", zip: "", city: game.locations[0]?.city ?? "" };
  const [address, setAddress] = useState<AddressValue>(blank);
  return (
    <form className="to-form" onSubmit={(e) => { e.preventDefault(); act(registerCompany, name, owner, "sole", address); }}>
      <fieldset>
        <legend>{t("browser-sites-1.of.application")}</legend>
        <table>
          <tbody>
            <tr>
              <td><label htmlFor="to-name">{t("browser-sites-1.of.businessName")} <b>*</b></label></td>
              <td><input id="to-name" value={name} maxLength={32} required onChange={(e) => setName(e.target.value)} />{note("name")}</td>
            </tr>
            <tr>
              <td><label htmlFor="to-owner">{t("browser-sites-1.of.ownerField")} <b>*</b></label></td>
              <td><input id="to-owner" value={owner} required onChange={(e) => setOwner(e.target.value)} />{note("owner")}</td>
            </tr>
            <AddressFields id="to" value={address} set={setAddress} error={note("address")} />
            <tr>
              <td>{t("browser-sites-1.of.legalForm")}</td>
              <td>{LEGAL_FORMS.sole}</td>
            </tr>
            <tr>
              <td>{t("bank.office.fee")}</td>
              <td>{euroCents(FEES.registration)}</td>
            </tr>
            <tr>
              <td><label htmlFor="to-activity">{t("browser-sites-1.of.activity")} <b>*</b></label></td>
              <td>
                <select id="to-activity" defaultValue="hosting">
                  <option value="hosting">{t("browser-sites-1.of.hosting")}</option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
        <label className="to-check"><input type="checkbox" required /> {t("browser-sites-1.of.declare")} <b>*</b></label>
        <p className="to-req"><b>*</b> {t("browser-sites-1.of.required")}</p>
        {note("form")}
        <div className="to-buttons">
          <button type="submit">{t("browser-sites-1.of.submit")}</button>
          <button type="reset" onClick={() => { setName(""); setOwner(""); setAddress(blank); }}>{t("browser-sites-1.of.reset")}</button>
        </div>
      </fieldset>
    </form>
  );
}

function Extract({ game }: { game: GameState }) {
  const r = game.registration!;
  return (
    <fieldset className="to-form">
      <legend>{t("browser-sites-1.of.extract")}</legend>
      <table>
        <tbody>
          <tr><td>{t("browser-sites-1.of.regNumber")}</td><td>GA {r.number}</td></tr>
          <tr><td>{t("browser-sites-1.of.businessName")}</td><td>{game.company.name}</td></tr>
          {r.owner && <tr><td>{t("browser-sites-1.of.owner")}</td><td>{r.owner}</td></tr>}
          {game.company.address && <tr><td>{t("checkout.address")}</td><td>{game.company.address.street}, {game.company.address.zip} {game.company.address.city}</td></tr>}
          <tr><td>{t("browser-sites-1.of.legalForm")}</td><td>{LEGAL_FORMS[r.form]}</td></tr>
          <tr><td>{t("browser-sites-1.of.registeredOn")}</td><td>{stamp(r.hour)}</td></tr>
        </tbody>
      </table>
    </fieldset>
  );
}

// The application forms for a higher legal form; the form downloads to the desktop.
function Forms({ game }: { game: GameState }) {
  const act = usePageAct();
  const r = game.registration;
  if (!r) return <p>{t("paperwork.of.registerFirst")}</p>;
  if (r.form === "limited") return <p>{t("paperwork.of.top")}</p>;
  const next = Object.keys(FORM_RANK).filter((f) => FORM_RANK[f] > FORM_RANK[r.form] && applyError(game, f) !== "error.companyLaw");
  if (!next.length) return <p>{t("paperwork.of.none")}</p>;
  const fee = (f: string) => f === "limited" ? t("paperwork.of.feeLimited", { notary: euro(FEES.notary), register: euro(FEES.register), capital: euro(SHARE_CAPITAL) }) : euro(FEES.change);
  return (
    <>
      <p className="to-closed">{t("paperwork.of.final")}</p>
      {next.map((f) => {
        const err = applyError(game, f), have = game.docs.some((d) => d.form?.form === f);
        return (
          <fieldset key={f} className="to-form">
            <legend>{t(`doc.form.${f}`)}</legend>
            <table>
              <tbody>
                <tr><td>{t("paperwork.of.sendTo")}</td><td>{FILED_WITH[f]}</td></tr>
                <tr><td>{t("paperwork.of.fee")}</td><td>{fee(f)}</td></tr>
                <tr><td /><td>{err === "error.changePending" ? t("paperwork.of.pending") : err ? t(err) : have ? t("paperwork.of.downloaded")
                  : <a href="#download" onClick={(e) => { e.preventDefault(); act(downloadForm, f); }}>{t("paperwork.of.download")}</a>}</td></tr>
              </tbody>
            </table>
          </fieldset>
        );
      })}
    </>
  );
}

function Body({ game, path, go }: { game: GameState; path: string; go: (url: string) => void }) {
  if (path === "/" || path === "") {
    return (
      <>
        <h1>{t("browser-sites-1.of.welcome")}</h1>
        <p>{t("browser-sites-1.of.welcomeText")}</p>
        <p className="to-new"><span>{t("browser-sites-1.of.new")}</span> <a href={`#${OFFICE_URL}`} onClick={(e) => { e.preventDefault(); go(OFFICE_URL); }}>{t("browser-sites-1.of.newText")}</a> (14.03.2003)</p>
        <h2>{t("browser-sites-1.of.hours")}</h2>
        <Hours />
      </>
    );
  }
  if (path.replace(/\/$/, "") === "/forms") return <><h1>{t("browser-sites-1.of.menuForms")}</h1><Forms game={game} /></>;
  if (path.replace(/\/$/, "") !== "/eservice") {
    return (
      <>
        <h1>{t("browser-sites-1.of.construction")}</h1>
        <p className="to-construction">{t("browser-sites-1.of.constructionText")}</p>
      </>
    );
  }
  if (game.registration) return <><h1>{t("browser-sites-1.of.eservice")}</h1><Extract game={game} /></>;
  if (!officeOpen(game.hour)) {
    return (
      <>
        <h1>{t("browser-sites-1.of.eservice")}</h1>
        <p className="to-closed">{t("browser-sites-1.of.serviceClosed")}</p>
        <p>{t("browser-sites-1.of.serverTime", { time: clock(game.hour, game.minute) })}</p>
        <h2>{t("browser-sites-1.of.hours")}</h2>
        <Hours />
      </>
    );
  }
  return <><h1>{t("browser-sites-1.of.eservice")}</h1><Register game={game} /></>;
}

// docs/design/tutorial.md: a 2005 government page that registers the company during office hours.
export function OfficeSite({ game, path, go }: { game: GameState; path: string; go: (url: string) => void }) {
  return (
    <div className="to">
      <div className="to-page">
        <div className="to-head">
          <svg width="44" height="48" viewBox="0 0 44 48" aria-hidden="true">
            <path d="M4 4h36v18c0 12-8 19-18 23C12 41 4 34 4 22z" fill="#f2c200" stroke="#111" strokeWidth="2" />
            <path d="M22 12l-8 6h16zM15 19h3v10h-3zM20.5 19h3v10h-3zM26 19h3v10h-3zM13 30h18v3H13z" fill="#111" />
          </svg>
          <div>
            <div className="to-title">{t("browser-sites-1.of.title")}</div>
            <div className="to-sub">{t("browser-sites-1.of.subtitle")}</div>
          </div>
        </div>
        <div className="to-crumbs">{t("browser-sites-1.of.here")} <a href={`#www.${OFFICE_HOST}/`} onClick={(e) => { e.preventDefault(); go(`www.${OFFICE_HOST}/`); }}>{t("browser-sites-1.of.menuHome")}</a>{path !== "/" && <> &gt; {MENU.find(([, p]) => p === path)?.[0] ?? t("browser-sites-1.of.page")}</>}</div>
        <div className="to-cols">
          <ul className="to-menu">
            {MENU.map(([label, p]) => (
              <li key={p}><a href={`#www.${OFFICE_HOST}${p}`} aria-current={p === path || undefined} onClick={(e) => { e.preventDefault(); go(`www.${OFFICE_HOST}${p}`); }}>{label}</a></li>
            ))}
          </ul>
          <div className="to-main"><Body game={game} path={path} go={go} /></div>
        </div>
        <div className="to-foot">
          <span className="to-counter">{t("browser-sites-1.of.visitors")}</span>
          <span>{t("browser-sites-1.of.updated")}</span>
          <span>{t("browser-sites-1.of.bestViewed")}</span>
        </div>
      </div>
    </div>
  );
}
