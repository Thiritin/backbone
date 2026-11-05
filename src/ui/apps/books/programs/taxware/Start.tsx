import { ArrowRight, BellRing, ChartColumn, Landmark, ListChecks, NotebookPen, Percent, type LucideIcon } from "lucide-react";
import { euroCents } from "../../../../../sim/00-core/money";
import { setupOf } from "../../../../../sim/80-business/books-guide";
import { t } from "../../../../../i18n/en";
import { LOCALE } from "../../../../../i18n/lang";
import { chartOf, useOpenItems, useReports, yearOfHour } from "../../data";
import { useBooks } from "../../view";

// What the start screens need from the program: whether a screen exists, is locked, its open count, and opening it.
export interface Nav { shown: (id: string) => boolean; locked: (id: string) => boolean; count: (id: string) => number; open: (id: string) => void; guide: () => void; web: () => void }

const month = (key: string) => new Date(`${key}-01T00:00:00Z`).toLocaleDateString(LOCALE, { month: "long", year: "numeric", timeZone: "UTC" });

// The classic start: the company list to open, or a new company from the assistant.
export function Firmenauswahl({ open, guide }: { open: () => void; guide: () => void }) {
  const game = useBooks(), u = setupOf(game);
  return (
    <div className="txo-dialog" role="dialog" aria-label={t("books-tw.firmen.title")}>
      <div className="txo-caption"><span>{t("books-tw.firmen.title")}</span></div>
      <div className="txo-dialog-body">
        <table className="table txo-list">
          <thead><tr><th>{t("books-tw.firmen.firma")}</th><th>{t("books-de.year")}</th><th>{t("books-de.chart.frame")}</th></tr></thead>
          <tbody>
            {u.company ? <tr className="sel" tabIndex={0} onDoubleClick={open}><td>{game.company.name}</td><td className="num">{yearOfHour(game.hour)}</td><td>{t(`books-de.chart.${chartOf(game).id}`)}</td></tr>
              : <tr><td colSpan={3} className="de-none">{t("books-tw.firmen.none")}</td></tr>}
          </tbody>
        </table>
        <div className="txo-buttons">
          <button className="btn" onClick={guide}>{t("books-tw.firmen.new")}</button>
          <button className="btn" disabled={!u.company} onClick={open}>{t("books-tw.firmen.open")}</button>
        </div>
      </div>
    </div>
  );
}

function InfoCenter() {
  const { cash, prevMonth, lastMonth } = useReports().overview(), { receivable, payable } = useOpenItems();
  const rows: [string, number][] = [[t("books-tw.info.cash"), cash], [t("books-tw.info.profit", { month: month(prevMonth) }), lastMonth], [t("books-tw.info.receivable"), receivable], [t("books-tw.info.payable"), payable]];
  return (
    <section className="txo-panel txo-info">
      <h3>{t("books-tw.info.title")}</h3>
      <dl>{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className={`num${v < 0 ? " de-neg" : ""}`}>{euroCents(v)}</dd></div>)}</dl>
    </section>
  );
}

// Today's work: each open count with the screen that clears it.
const TODO: [string, string][] = [["bank", "unmatched"], ["reminders", "late"], ["invoices", "drafts"], ["payables", "payables"], ["tax", "tax"], ["stapel", "stapel"]];
function Today({ nav }: { nav: Nav }) {
  const due = TODO.filter(([id]) => nav.shown(id) && !nav.locked(id) && nav.count(id) > 0);
  return (
    <section className="txo-panel txo-today">
      <h3>{t("books-tw.todo.title")}</h3>
      {due.length ? <ul>{due.map(([id, k]) => <li key={id}><button className="txo-link" onClick={() => nav.open(id)}>{t(`books-tw.todo.${k}`)}</button><span className="num">{nav.count(id)}</span></li>)}</ul>
        : <p className="de-none">{t("books-tw.todo.none")}</p>}
    </section>
  );
}

// The workflow start page: the four phases of the books as one row of steps.
const FLOW: [string, string][] = [["stammdaten", "chart"], ["belege", "payables"], ["buchen", "mask"], ["auswertung", "susa"]];
export function Arbeitsablauf({ nav }: { nav: Nav }) {
  return (
    <div className="txo-start txo-start-w">
      <section className="txo-flow">
        <h3>{t("books-tw.flow.title")}</h3>
        <ol>
          {FLOW.map(([k, id], i) => (
            <li key={k}>
              {i > 0 && <ArrowRight className="txo-arrow" aria-hidden="true" />}
              <button className="txo-step" aria-disabled={nav.locked(id) || undefined} onClick={() => nav.open(id)}><span className="num">{i + 1}</span>{t(`books-tw.flow.${k}`)}</button>
            </li>
          ))}
        </ol>
      </section>
      <div className="txo-cols"><Today nav={nav} /><InfoCenter /></div>
    </div>
  );
}

// The flat start page: tiles by process area, today's work and the info centre beside them, the service centre below.
const TILES: [string, LucideIcon][] = [["mask", NotebookPen], ["op", ListChecks], ["bank", Landmark], ["reminders", BellRing], ["susa", ChartColumn], ["tax", Percent]];
export function Kacheln({ nav }: { nav: Nav }) {
  return (
    <div className="txo-start txo-start-f">
      <div className="txo-tiles">
        {TILES.filter(([id]) => nav.shown(id)).map(([id, Icon]) => (
          <button key={id} className="txo-tile" aria-disabled={nav.locked(id) || undefined} onClick={() => nav.open(id)}>
            <Icon aria-hidden="true" /><span>{t(`books-tw.tile.${id}`)}</span>{nav.count(id) > 0 && !nav.locked(id) && <span className="txo-badge num">{nav.count(id)}</span>}
          </button>
        ))}
      </div>
      <div className="txo-side"><Today nav={nav} /><InfoCenter /></div>
      <footer className="txo-service">
        <b>{t("books-tw.service.title")}</b>
        <button className="txo-link" onClick={nav.guide}>{t("books-tw.item.guide")}</button>
        <button className="txo-link" onClick={nav.web}>{t("books-tw.item.web")}</button>
      </footer>
    </div>
  );
}
