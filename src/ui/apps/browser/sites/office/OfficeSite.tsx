import { useState } from "react";
import { dateOf } from "../../../../../sim/00-core/time";
import type { GameState } from "../../../../../sim/50-state";
import { LEGAL_FORMS, OFFICE_HOST, OFFICE_URL, officeOpen } from "../../../../../sim/80-business/office";
import { registerCompany } from "../../../../../sim/90-actions/company";
import { useStore } from "../../../../store";
import "./office.css";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const pad = (n: number) => String(n).padStart(2, "0");
const stamp = (hour: number) => {
  const d = dateOf(hour);
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
};
const clock = (hour: number, minute: number) => `${DAYS[dateOf(hour).getUTCDay()]}, ${stamp(hour)}, ${pad(dateOf(hour).getUTCHours())}:${pad(minute)}`;

const MENU = [
  ["Home", "/"],
  ["eService: Trade registration", "/eservice/"],
  ["Forms (PDF)", "/forms/"],
  ["Fees", "/fees/"],
  ["Directions", "/directions/"],
  ["Contact", "/contact/"],
];

function Hours() {
  return (
    <table className="to-hours">
      <tbody>
        <tr><td>Monday to Friday</td><td>08:00 to 16:00</td></tr>
        <tr><td>Saturday, Sunday and public holidays</td><td>closed</td></tr>
      </tbody>
    </table>
  );
}

function Register({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const [name, setName] = useState(game.company.name);
  const [owner, setOwner] = useState("");
  const [form, setForm] = useState("sole");
  return (
    <form className="to-form" onSubmit={(e) => { e.preventDefault(); act(registerCompany, name, owner, form); }}>
      <fieldset>
        <legend>Application for trade registration (Form GA-1)</legend>
        <table>
          <tbody>
            <tr>
              <td><label htmlFor="to-name">Name of the business <b>*</b></label></td>
              <td><input id="to-name" value={name} maxLength={32} required onChange={(e) => setName(e.target.value)} /></td>
            </tr>
            <tr>
              <td><label htmlFor="to-owner">Owner (surname, first name) <b>*</b></label></td>
              <td><input id="to-owner" value={owner} required onChange={(e) => setOwner(e.target.value)} /></td>
            </tr>
            <tr>
              <td><label htmlFor="to-form">Legal form <b>*</b></label></td>
              <td>
                <select id="to-form" value={form} onChange={(e) => setForm(e.target.value)}>
                  {Object.entries(LEGAL_FORMS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </td>
            </tr>
            <tr>
              <td><label htmlFor="to-activity">Business activity <b>*</b></label></td>
              <td>
                <select id="to-activity" defaultValue="hosting">
                  <option value="hosting">Provision of internet services (hosting)</option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
        <label className="to-check"><input type="checkbox" required /> I declare that the above information is true and complete. <b>*</b></label>
        <p className="to-req"><b>*</b> Required field</p>
        <div className="to-buttons">
          <button type="submit">Submit application</button>
          <button type="reset" onClick={() => { setName(""); setOwner(""); setForm("sole"); }}>Reset</button>
        </div>
      </fieldset>
    </form>
  );
}

function Extract({ game }: { game: GameState }) {
  const r = game.registration!;
  return (
    <fieldset className="to-form">
      <legend>Extract from the trade register</legend>
      <table>
        <tbody>
          <tr><td>Register number</td><td>GA {r.number}</td></tr>
          <tr><td>Name of the business</td><td>{game.company.name}</td></tr>
          {r.owner && <tr><td>Owner</td><td>{r.owner}</td></tr>}
          <tr><td>Legal form</td><td>{LEGAL_FORMS[r.form]}</td></tr>
          <tr><td>Registered on</td><td>{stamp(r.hour)}</td></tr>
        </tbody>
      </table>
    </fieldset>
  );
}

function Body({ game, path, go }: { game: GameState; path: string; go: (url: string) => void }) {
  if (path === "/" || path === "") {
    return (
      <>
        <h1>Welcome to Trade Office Online</h1>
        <p>You can now register your business online with the trade office. Please use the eService during our office hours.</p>
        <p className="to-new"><span>NEW!</span> <a href={`#${OFFICE_URL}`} onClick={(e) => { e.preventDefault(); go(OFFICE_URL); }}>Trade registration is now available online</a> (14.03.2003)</p>
        <h2>Office hours</h2>
        <Hours />
      </>
    );
  }
  if (path.replace(/\/$/, "") !== "/eservice") {
    return (
      <>
        <h1>Under construction</h1>
        <p className="to-construction">This page is currently under construction. Please visit us again soon.</p>
      </>
    );
  }
  if (game.registration) return <><h1>eService: Trade registration</h1><Extract game={game} /></>;
  if (!officeOpen(game.hour)) {
    return (
      <>
        <h1>eService: Trade registration</h1>
        <p className="to-closed">The online service is closed.</p>
        <p>Server time: {clock(game.hour, game.minute)}</p>
        <h2>Office hours</h2>
        <Hours />
      </>
    );
  }
  return <><h1>eService: Trade registration</h1><Register game={game} /></>;
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
            <div className="to-title">Trade Office Online</div>
            <div className="to-sub">The official eGovernment portal of the trade office</div>
          </div>
        </div>
        <div className="to-crumbs">You are here: <a href={`#www.${OFFICE_HOST}/`} onClick={(e) => { e.preventDefault(); go(`www.${OFFICE_HOST}/`); }}>Home</a>{path !== "/" && <> &gt; {MENU.find(([, p]) => p === path)?.[0] ?? "Page"}</>}</div>
        <div className="to-cols">
          <ul className="to-menu">
            {MENU.map(([label, p]) => (
              <li key={p}><a href={`#www.${OFFICE_HOST}${p}`} aria-current={p === path || undefined} onClick={(e) => { e.preventDefault(); go(`www.${OFFICE_HOST}${p}`); }}>{label}</a></li>
            ))}
          </ul>
          <div className="to-main"><Body game={game} path={path} go={go} /></div>
        </div>
        <div className="to-foot">
          <span className="to-counter">Visitors: 004213</span>
          <span>Last updated: 14.03.2003</span>
          <span>Best viewed with Internet Exploder 6 at 1024x768</span>
        </div>
      </div>
    </div>
  );
}
