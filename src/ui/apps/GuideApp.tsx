import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { euro } from "../../sim/00-core/money";
import { yearOf } from "../../sim/00-core/time";
import { REGISTRARS } from "../../sim/10-catalog/registrars";
import { derivedDomain } from "../../sim/30-customers/domains";
import type { GameState } from "../../sim/50-state";
import { MAIL_PROVIDERS } from "../../sim/80-business/mail";
import { OWNED, owns } from "../../sim/80-business/marketing";
import { toggleCheck } from "../../sim/90-actions/checklist";
import { setCompany } from "../../sim/90-actions/company";
import { bookMail } from "../../sim/90-actions/mail";
import { setUpChannel } from "../../sim/90-actions/marketing";
import { orderCompanyDomain } from "../../sim/90-actions/registrar";
import { checkDone, TUTORIAL } from "../../sim/checklist";
import { CompanyFields } from "./company";
import { stepOf, type StepId } from "./guide";
import { useStore } from "../store";
import "./customers/customers.css";
import "./checklist/checklist.css";

function CompanyStep({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const [draft, setDraft] = useState(game.company);
  const save = () => { if (act(setCompany, { name: draft.name, logo: draft.logo, color: draft.color }).ok) act(toggleCheck, "company"); };
  return (
    <div className="guide-form">
      <CompanyFields company={draft} onChange={(p) => setDraft({ ...draft, ...p })} />
      <button className="btn primary" disabled={!draft.name.trim()} onClick={save}>Save</button>
    </div>
  );
}

function DomainStep({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const year = yearOf(game.hour), open = REGISTRARS.filter((r) => year >= r.from);
  const [registrar, setRegistrar] = useState<string>(open[0]?.id ?? "");
  const [name, setName] = useState("");
  const suggestion = derivedDomain(game);
  return (
    <div className="guide-form guide-line">
      {!game.registrar && (
        <select className="field" aria-label="Registrar" value={registrar} onChange={(e) => setRegistrar(e.target.value)}>
          {open.map((r) => <option key={r.id} value={r.id}>{r.name}{r.signup ? `, ${euro(r.signup)} signup` : ""}</option>)}
        </select>
      )}
      <input className="field grow" aria-label="Domain name" placeholder={suggestion} spellCheck={false} value={name} onChange={(e) => setName(e.target.value)} />
      <button className="btn primary" onClick={() => act(orderCompanyDomain, registrar, name || suggestion)}>Order</button>
    </div>
  );
}

function EmailStep({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const year = yearOf(game.hour);
  return (
    <div className="guide-form">
      {MAIL_PROVIDERS.filter((p) => year >= p.from).map((p) => (
        <div key={p.id} className="guide-line">
          <span className="grow">{p.name}</span>
          <span className="num cus-dim">{euro(p.price(year))} per seat</span>
          <button className="btn primary" disabled={!game.company.domain} onClick={() => act(bookMail, p.id)}>Book</button>
        </div>
      ))}
    </div>
  );
}

function WebsiteStep({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  if (owns(game, "website")) return null;
  const { setup } = OWNED.website;
  return (
    <div className="guide-form guide-line">
      <span className="grow">Web design</span>
      <span className="num cus-dim">{euro(setup)}</span>
      <button className="btn primary" disabled={!game.company.domain || game.cash < setup} onClick={() => act(setUpChannel, "website")}>Build</button>
    </div>
  );
}

const FORMS: Partial<Record<StepId, (p: { game: GameState }) => ReactNode>> = { company: CompanyStep, domain: DomainStep, email: EmailStep, website: WebsiteStep };

export function GuideApp() {
  const game = useStore((s) => s.game);
  const openApp = useStore((s) => s.openApp);
  return (
    <article className="guide">
      <h2>Getting started</h2>
      <p>It is January 2005. You run a small hosting company from a basement with an empty rack and 3,500 € of savings. Your goal is to grow it into your own datacenter by automating your own jobs.</p>
      <h3>Your first server</h3>
      <p>Your friends Jonas, Mira and Tobi are waiting for web hosting. Each step is checked off once it is done.</p>
      <ol className="guide-steps">
        {TUTORIAL.map((id) => {
          const done = checkDone(game, id);
          const step = stepOf(game, id);
          const Form = FORMS[id];
          return (
            <li key={id} className={`chk-row${done ? " done" : ""}`}>
              <span className={`chk-box${done ? " done" : ""}`}>{done && <Check />}</span>
              <div className="grow">
                <span className="cus-strong">{step.title}</span>
                <span className="cus-dim">{step.text}</span>
                {!done && Form && <Form game={game} />}
              </div>
              {!done && <button className="btn" onClick={() => openApp(step.app, step.focus)}>Open</button>}
            </li>
          );
        })}
      </ol>
      <p>When the server fills up, the Bank app lends you the money for the next one.</p>
      <h3>Time</h3>
      <p>The clock starts paused. Press <kbd>Space</kbd> to start or pause it, and <kbd>1</kbd> to <kbd>5</kbd> to switch between 1×, 2×, 4×, 8× and 16× speed. The buttons in the menu bar do the same.</p>
      <h3>Apps and windows</h3>
      <p>Open apps from the dock at the bottom. Drag a window by its title bar and resize it from any edge. The three buttons on the left of a window close, minimize and zoom it.</p>
      <h3>Notifications</h3>
      <p>Banners appear at the top right, and clicking one opens its app. The bell in the menu bar opens the history. Settings controls which apps may notify you.</p>
      <h3>Saving</h3>
      <p>The game saves itself in this browser. The logo menu at the far left of the menu bar exports your save to a file, imports a save, and deletes your progress.</p>
    </article>
  );
}
