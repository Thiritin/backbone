import { Check } from "lucide-react";
import { useState, type ReactNode } from "react";
import { yearOf } from "../../../../sim/00-core/time";
import { booksVendor } from "../../../../sim/10-catalog/bookkeeping";
import { guideOf, guideTicked, setupOf } from "../../../../sim/80-business/books-guide";
import { acceptBooksLicence, activateBooks, backupBooks, createBooksCompany, enterBooksKey, enterOpening, linkBooksBank, setBooksTemplate } from "../../../../sim/90-actions/bookkeeping";
import { t } from "../../../../i18n/en";
import { useStore } from "../../../store";
import { CompanyForm } from "./CompanyForm";
import { guideLook } from "./looks";
import "./guide.css";

// Steps whose action is a tab of the program rather than a call of the sim.
const TABS: Record<string, string> = { tax: "tax", cert: "tax", vat: "tax" };
type Result = { ok: boolean; error?: string; params?: Record<string, string | number> };

// The first-steps guide of the installed bookkeeping program: the sim's step table with live ticks, one action per step.
// A finished setup shows the guide collapsed to its heading.
export function InstallGuide({ go }: { go?: (tab: string) => void }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const v = booksVendor(game.books.vendor);
  const steps = guideOf(game);
  const [err, setErr] = useState<{ id: string; text: string } | null>(null);
  const [key, setKey] = useState("");
  const finished = !!game.books.setupDone && steps.every((x) => x.optional || guideTicked(game, x));
  const [open, setOpen] = useState(!finished);
  if (!v || !steps.length) return null;
  const look = guideLook(v, yearOf(game.hour)), u = setupOf(game);
  const done = steps.filter((x) => guideTicked(game, x)).length;
  const current = steps.find((x) => !guideTicked(game, x) && !x.optional) ?? steps.find((x) => !guideTicked(game, x));
  const run = (id: string, r: Result) => setErr(r.ok ? null : { id, text: t(r.error ?? "error.booksSetupOrder", r.params) });
  const hasChart = steps.some((x) => x.id === "chart");

  const action = (id: string): ReactNode => {
    const btn = (label: string, fn: () => void, enabled = true) => <button type="button" className="btn primary bg-do" disabled={!enabled} onClick={fn}>{label}</button>;
    switch (id) {
      case "licence": return btn(t("bkguide.do.licence"), () => run(id, act(acceptBooksLicence)));
      case "key": return (
        <span className="bg-field">
          <label>{t("bkguide.field.key")}<input className="num" value={key} onChange={(e) => setKey(e.target.value)} /></label>
          {btn(t("bkguide.do.key"), () => run(id, act(enterBooksKey, key)), key.trim() !== "")}
        </span>
      );
      case "activate": return btn(t(v.deployment === "browser" ? "bkguide.do.confirm" : "bkguide.do.activate"), () => run(id, act(activateBooks)));
      case "company": return <CompanyForm chart={hasChart} onCreate={(c) => run(id, act(createBooksCompany, c))} />;
      case "opening": return btn(t("bkguide.do.opening"), () => run(id, act(enterOpening)));
      case "bank": return btn(t("bkguide.do.bank"), () => run(id, act(linkBooksBank)));
      case "template": return btn(t("bkguide.do.template"), () => run(id, act(setBooksTemplate)));
      case "backup": return btn(t("bkguide.do.backup"), () => run(id, act(backupBooks)));
      default: return TABS[id] && go ? btn(t(`bkguide.do.${id}`), () => go(TABS[id])) : null;
    }
  };
  // Chart and method are set by the company assistant; once set the step shows the chosen value.
  const value = (id: string): string | null => id === "chart" && u.chart ? t(`bkguide.chart.${u.chart}`) : id === "method" && u.method ? t(`bkguide.method.${u.method}`) : null;

  return (
    <section className={`bg bg-${look}${finished ? " bg-finished" : ""}`} aria-label={t(`bkguide.title.${look}`)} data-look={look}>
      <header className="bg-head">
        <h2>{t(`bkguide.title.${look}`)}</h2>
        <span className="bg-count num">{t("bkguide.progress", { done, total: steps.length })}</span>
        {finished && <button type="button" className="btn bg-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? t("bkguide.hide") : t("bkguide.show")}</button>}
      </header>
      <div className="bg-bar" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done}><i style={{ width: `${(done / steps.length) * 100}%` }} /></div>
      {finished && <p className="bg-allDone">{t("bkguide.allDone")}</p>}
      {open && (
        <ol className="bg-steps">
          {steps.map((x, i) => {
            const ticked = guideTicked(game, x), now = current?.id === x.id;
            const todo = v.deployment === "browser" ? ({ activate: "confirm", buy: "signup" } as Record<string, string>)[x.id] ?? x.id : x.id;
            return (
              <li key={x.id} className={`bg-step${ticked ? " ticked" : ""}${now ? " current" : ""}`} aria-current={now ? "step" : undefined} data-step={x.id} ref={now ? (el) => el?.scrollIntoView?.({ block: "nearest" }) : undefined}>
                <span className="bg-mark" role="img" aria-label={t(ticked ? "bkguide.done" : "bkguide.open")}>{ticked ? <Check aria-hidden /> : <span className="num">{i + 1}</span>}</span>
                <div className="bg-text">
                  <strong>{t(x.labelKey)}{x.optional && <em className="bg-opt">{t("bkguide.optional")}</em>}</strong>
                  <span>{t(`bkguide.todo.${todo}`)}</span>
                  {value(x.id) && <span className="bg-value">{value(x.id)}</span>}
                  {!ticked && <div className="bg-act">{action(x.id)}</div>}
                  {err?.id === x.id && <p className="bg-err" role="alert">{err.text}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
