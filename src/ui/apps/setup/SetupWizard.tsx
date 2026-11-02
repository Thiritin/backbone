import type { ReactNode } from "react";
import { BANKS } from "../../../sim/10-catalog/banks";
import { invoiceNumber, NUMBERINGS } from "../../../sim/45-billing/billing";
import { yearOf } from "../../../sim/00-core/time";
import { vatPeriod } from "../../../sim/80-business/tax";
import { setBillingRules } from "../../../sim/90-actions/billing";
import type { GameState } from "../../../sim/50-state";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import "./setup.css";

export interface SetupStep { id: string; label: string; body: ReactNode }

// The first-run wizard every Books program and shop system shows; the host app gives it its look.
export function SetupWizard({ program, steps, step, onStep, onClose }: { program: string; steps: SetupStep[]; step: string | undefined; onStep: (id: string) => void; onClose: () => void }) {
  const i = Math.max(0, steps.findIndex((x) => x.id === step)), last = i === steps.length - 1;
  return (
    <div className="setup" role="dialog" aria-label={`${program} ${t("setup.title")}`}>
      <header className="setup-head"><h2>{program} {t("setup.title")}</h2></header>
      <div className="setup-main">
        <ol className="setup-steps">
          {steps.map((x, n) => <li key={x.id} aria-current={n === i ? "step" : undefined} className={n < i ? "done" : undefined}>{x.label}</li>)}
        </ol>
        <section className="setup-body">
          <h3>{steps[i].label}</h3>
          {steps[i].body}
        </section>
      </div>
      <footer className="setup-foot">
        <button className="btn" onClick={onClose}>{t("setup.close")}</button>
        <span />
        <button className="btn" disabled={i === 0} onClick={() => onStep(steps[i - 1].id)}>{t("setup.back")}</button>
        <button className="btn primary" onClick={() => (last ? onClose() : onStep(steps[i + 1].id))}>{t(last ? "setup.finish" : "setup.next")}</button>
      </footer>
    </div>
  );
}

const Fields = ({ rows }: { rows: [string, ReactNode][] }) => (
  <dl className="setup-fields">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
);

export function CompanyStep({ game, currency }: { game: GameState; currency?: boolean }) {
  const a = game.company.address;
  return <Fields rows={[
    [t("setup.company.name"), game.company.name],
    [t("setup.company.address"), a ? `${a.street}, ${a.zip} ${a.city}` : t("setup.none")],
    ...(currency ? [[t("setup.currency"), "EUR"] as [string, ReactNode]] : []),
  ]} />;
}

export function TaxStep({ game }: { game: GameState }) {
  return <Fields rows={[
    [t("setup.tax.number"), game.tax.number || t("setup.none")],
    [t("setup.tax.small"), t(game.tax.small ? "setup.yes" : "setup.no")],
    [t("setup.tax.period"), t(`setup.period.${vatPeriod(game, yearOf(game.hour))}`)],
  ]} />;
}

export function BankStep({ game }: { game: GameState }) {
  const b = game.bank;
  return <Fields rows={b ? [[t("setup.bank.bank"), BANKS.find((x) => x.id === b.id)?.name ?? b.id], [t("setup.bank.account"), <span className="num">{b.number}</span>]] : [[t("setup.bank.bank"), t("setup.none")]]} />;
}

// One numbering for Books and the shop, so both count the same invoices.
export function NumberingStep({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  return (
    <fieldset className="setup-choice">
      <legend>{t("setup.numbering")}</legend>
      {NUMBERINGS.map((n) => (
        <label key={n}>
          <input type="radio" name="setup-numbering" checked={game.billingRules.numbering === n} onChange={() => act(setBillingRules, { numbering: n })} />
          <span className="num">{invoiceNumber({ hour: game.hour, billingRules: { ...game.billingRules, numbering: n } }, game.invoices.length + 1)}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function DoneStep({ links }: { links: [string, () => void][] }) {
  return (
    <>
      <p>{t("setup.done")}</p>
      <ul className="setup-links">{links.map(([label, go]) => <li key={label}><a href="#" onClick={(e) => { e.preventDefault(); go(); }}>{label}</a></li>)}</ul>
    </>
  );
}
