import { BellRing, ChartColumn, FileText, House, Landmark, Layers, ListChecks, ListOrdered, NotebookPen, Percent, Receipt, Scale, ScrollText, Search, Sigma, TrendingUp, Users, Wallet, X, type LucideIcon } from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";
import { dateOf } from "../../../../../sim/00-core/time";
import { isUnpaid } from "../../../../../sim/45-billing/billing";
import { lateInBooks } from "../../../../../sim/46-finance/payables";
import { sells, type Feature } from "../../../../../sim/10-catalog/bookkeeping";
import { hasModule, MODULES } from "../../../../../sim/10-catalog/modules";
import { booksUrl, currentEdition, currentVendor, hasFeature, versionYear } from "../../../../../sim/80-business/bookkeeping";
import { licenceMail } from "../../../../../sim/80-business/licences";
import { unsynced } from "../../../../../sim/80-business/shoplink";
import { backupBooks } from "../../../../../sim/90-actions/bookkeeping";
import { importFromShop } from "../../../../../sim/90-actions/shoplink";
import { t } from "../../../../../i18n/en";
import { LOCALE } from "../../../../../i18n/lang";
import { useSessionState } from "../../../../session";
import { useFocus, useStore } from "../../../../store";
import { BankTab } from "../../BankTab";
import { drafts as draftInvoices, late, unmatched } from "../../BooksApp";
import { CustomersTab } from "../../CustomersTab";
import { InvoicesTab } from "../../InvoicesTab";
import { NEW } from "../../NewCustomer";
import { PayablesTab } from "../../PayablesTab";
import { QuotesTab } from "../../QuotesTab";
import { Register } from "../../Register";
import { RemindersTab } from "../../RemindersTab";
import { InstallGuide } from "../../guide/InstallGuide";
import { chartOf, yearOfHour } from "../../data";
import { useBooks } from "../../view";
import { Bilanz, Bwa, Guv, Susa } from "../double-entry/Auswertungen";
import { Buchungsmaske, Stapel, type Draft } from "../double-entry/Buchungsmaske";
import { Journal, Kontenplan, OffenePosten } from "../double-entry/Konten";
import { UstVa } from "../double-entry/UstVa";
import { Pic } from "./icons";
import { MenuBar, type Item, type Menu } from "./MenuBar";
import { Arbeitsablauf, Firmenauswahl, Kacheln, type Nav } from "./Start";
import "./taxware.css";

// The program's look follows its version year: classic MDI until 2008, the workflow redesign of the 2009 version, flat from 2015.
export type Gen = "classic" | "workflow" | "flat";
export const genOf = (year: number): Gen => (year < 2009 ? "classic" : year < 2015 ? "workflow" : "flat");

type Body = ComponentType<{ focus: string | null; go: (id: string) => void; drafts: Draft[]; setDrafts: (d: Draft[]) => void }>;
const MaskWin: Body = ({ drafts, setDrafts }) => <><Buchungsmaske drafts={drafts} add={(d) => setDrafts([...drafts, d])} /><Stapel drafts={drafts} setDrafts={setDrafts} /></>;
const StapelWin: Body = ({ drafts, setDrafts }) => <Stapel drafts={drafts} setDrafts={setDrafts} />;
const StartWin: Body = () => null;

// Every window: its body, its icon, the features that open it (missing where never sold, locked where the edition lacks them),
// and faktura for the invoicing module's own area.
const SCREENS: Record<string, { body: Body; icon: LucideIcon; features?: Feature[]; faktura?: boolean }> = {
  start: { body: StartWin, icon: House },
  chart: { body: Kontenplan, icon: ListOrdered },
  customers: { body: CustomersTab, icon: Users },
  mask: { body: MaskWin, icon: NotebookPen },
  stapel: { body: StapelWin, icon: Layers },
  journal: { body: Journal, icon: ScrollText },
  op: { body: OffenePosten, icon: ListChecks },
  payables: { body: PayablesTab, icon: Wallet },
  reminders: { body: RemindersTab, icon: BellRing, features: ["dunning"] },
  bank: { body: BankTab, icon: Landmark },
  susa: { body: Susa, icon: Sigma, features: ["reports", "statistics"] },
  bwa: { body: Bwa, icon: ChartColumn, features: ["statistics"] },
  guv: { body: Guv, icon: TrendingUp, features: ["reports", "statistics"] },
  bilanz: { body: Bilanz, icon: Scale, features: ["reports", "statistics"] },
  tax: { body: UstVa, icon: Percent, features: ["tax"] },
  quotes: { body: QuotesTab, icon: FileText, features: ["quotes"], faktura: true },
  invoices: { body: InvoicesTab, icon: Receipt, faktura: true },
};
const SECTIONS: [string, string[], LucideIcon][] = [
  ["stammdaten", ["chart", "customers"], ListOrdered],
  ["buchen", ["mask", "stapel", "journal"], NotebookPen],
  ["op", ["op", "payables", "reminders"], ListChecks],
  ["zv", ["bank"], Landmark],
  ["auswertungen", ["susa", "bwa", "guv", "bilanz", "tax"], ChartColumn],
  ["faktura", ["quotes", "invoices"], Receipt],
];
const sectionOf = (id: string) => SECTIONS.find(([, ids]) => ids.includes(id));
// The classic toolbar's pictures (null a separator) and the workflow band's groups.
const TOOLS: (string | null)[] = ["open", "save", null, "mask", "stapel", "op", "bank", null, "susa", "tax", null, "help"];
const BAND: [string, string[]][] = [["buchen", ["mask", "stapel", "journal"]], ["op", ["op", "reminders", "payables"]], ["zv", ["bank"]], ["auswertungen", ["susa", "bwa", "guv", "tax"]]];
const STEP = 22;

export function TaxwareProgram() {
  const game = useBooks(), act = useStore((s) => s.act), openApp = useStore((s) => s.openApp);
  const v = currentVendor(game)!, year = versionYear(game, v), gen = genOf(year);
  const [wins, setWins] = useSessionState<string[]>("taxware.wins", gen === "classic" ? [] : ["start"]);
  const [active, setActive] = useSessionState("taxware.active", gen === "classic" ? "" : "start");
  const [arrange, setArrange] = useSessionState<"cascade" | "tile" | "max">("taxware.arrange", "cascade");
  const [focus, setFocus] = useSessionState<{ win: string; id: string } | null>("taxware.focus", null);
  const [opened, setOpened] = useSessionState("taxware.opened", false);
  const [drafts, setDrafts] = useSessionState<Draft[]>("taxware.stapel", []);
  const [register, setRegister] = useSessionState("books.register", false);
  const [query, setQuery] = useState("");
  const [note, setNote] = useState<string | null>(null);
  // The assistant opens first while the setup is unfinished, and again when the program is reinstalled.
  const [guide, setGuide] = useState(game.books.setupDone !== true);
  useEffect(() => { if (game.books.setupDone !== true) setGuide(true); }, [game.books.vendor, game.books.installedAt]);

  const shown = (id: string) => !!SCREENS[id] && (!SCREENS[id].features || SCREENS[id].features!.some((f) => sells(v, f)));
  const locked = (id: string) => !!SCREENS[id]?.features && !SCREENS[id].features!.some((f) => hasFeature(game, f));
  const label = (id: string) => t(`books-tw.win.${id}`);
  const counts: Record<string, number> = {
    bank: unmatched(game), reminders: late(game), invoices: draftInvoices(game), stapel: drafts.length,
    payables: game.payables.filter((p) => lateInBooks(game, p)).length,
    tax: game.tax.returns.filter((r) => r.filedAt === null && game.hour >= r.dueAt).length,
  };
  const web = () => openApp("Browser", { kind: "url", id: booksUrl(v) });
  const open = (id: string) => {
    if (!shown(id)) return;
    if (locked(id)) return web();
    setGuide(false); setOpened(true);
    setWins((w) => (gen === "flat" ? [id] : w.includes(id) ? w : [...w, id]));
    setActive(id);
    setFocus((f) => (f?.win === id ? null : f));
  };
  const close = (id: string) => setWins((w) => w.filter((x) => x !== id));
  const top = wins.includes(active) ? active : wins[wins.length - 1];
  useFocus("Books", (got) => {
    const f = got.kind === "url" ? got.inner : got;
    if (!f) return;
    if (f.kind === "register") return setRegister(true);
    if (f.kind === "setup" || f.kind === "guide") return setGuide(true);
    const to = f.kind === "invoice" ? (hasFeature(game, "dunning") && game.invoices.find((i) => i.id === f.id && isUnpaid(i) && i.status === "overdue") ? "reminders" : "invoices")
      : f.kind === "customer" || f.kind === "newCustomer" ? "customers" : f.kind === "quote" ? "quotes" : f.kind === "payable" ? "payables" : null;
    if (!to) return;
    open(to);
    setFocus({ win: to, id: f.kind === "newCustomer" ? `${NEW}${f.id}` : f.id });
  });
  // Shop records come over by import until Shop link; shop modules arrive with a licence key to register here.
  const importing = !!game.shop.variant && !hasModule(game, "shop-link");
  const waiting = useStore((s) => unsynced(s.game));
  const keys = MODULES.some((m) => licenceMail(game, m.id) && !hasModule(game, m.id));
  const backup = () => { if (act(backupBooks).ok) setNote(t("books-tw.backedUp")); };
  const nav: Nav = { shown, locked, count: (id) => counts[id] ?? 0, open, guide: () => setGuide(true), web };

  const win = (id: string, key = `books-tw.win.${id}`): Item | null => (shown(id) ? { id, label: t(key), run: () => open(id), locked: locked(id) } : null);
  const cmd = (id: string, run: () => void, text = t(`books-tw.item.${id}`)): Item => ({ id, label: text, run });
  const list = (...xs: (Item | null | false)[]) => xs.filter((x): x is Item => !!x);
  const windows = wins.map((id, i): Item => ({ id: `win-${id}`, label: `${i + 1} ${label(id)}`, run: () => setActive(id), checked: id === top, sep: i === 0 }));
  const arranged = (id: "cascade" | "tile"): Item => ({ ...cmd(id, () => setArrange(id)), checked: arrange === id });
  const m = {
    datei: list(gen === "classic" && cmd("open", () => setOpened(false)), cmd("backup", backup),
      importing && cmd("import", () => act(importFromShop), waiting ? `${t("shop-link.import")} (${waiting})` : t("shop-link.import"))),
    bearbeiten: list(cmd("firma", () => setGuide(true))),
    stammdaten: list(win("chart"), win("customers", "books-tw.win.debitoren")),
    buchen: list(win("mask"), win("stapel"), win("op"), win("bank"), win("reminders"), win("payables")),
    auswertungen: list(win("journal"), win("susa"), win("bwa"), win("guv"), win("bilanz"), win("tax"), win("op", "books-tw.win.opList")),
    faktura: list(win("customers"), win("quotes"), win("invoices")),
    extras: list(shown("tax") && { ...cmd("dohle", () => open("tax")), locked: locked("tax") }, keys && cmd("register", () => setRegister(true), t("vendor-sites.register"))),
    fenster: list(gen === "classic" && arranged("cascade"), gen === "classic" && arranged("tile"), cmd("closeAll", () => setWins([])), ...windows),
    hilfe: list(cmd("guide", () => setGuide(true)), cmd("web", web)),
  };
  const menu = (id: keyof typeof m | string, items: Item[], key = `books-tw.menu.${id}`): Menu => ({ id, label: t(key), items });
  const here = top ? sectionOf(top) : undefined;
  const menus: Menu[] = gen === "classic"
    ? (["datei", "bearbeiten", "stammdaten", "buchen", "auswertungen", "faktura", "extras", "fenster", "hilfe"] as const).map((k) => menu(k, m[k]))
    : gen === "workflow"
      ? [...(["datei", "bearbeiten", "stammdaten", "buchen", "auswertungen", "faktura"] as const).map((k) => menu(k, m[k])), menu("weitere", [...m.extras, ...m.fenster]), menu("hilfe", m.hilfe)]
      : [menu("datei", m.datei), menu("bearbeiten", m.bearbeiten), ...(here ? [menu(here[0], list(...here[1].map((id) => win(id))), `books-tw.sec.${here[0]}`)] : []), menu("extras", m.extras), menu("hilfe", m.hilfe)];

  const body = (id: string) => {
    if (id === "start") return gen === "flat" ? <Kacheln nav={nav} /> : <Arbeitsablauf nav={nav} />;
    const B = SCREENS[id].body, f = focus?.win === id ? focus.id : null;
    return <B key={`${id}:${f}`} focus={f} go={open} drafts={drafts} setDrafts={setDrafts} />;
  };
  const leaf = (id: string, icons: boolean) => {
    const Icon = SCREENS[id].icon, n = counts[id];
    return (
      <li key={id}><button className="txo-leaf" aria-current={id === top ? "page" : undefined} aria-disabled={locked(id) || undefined} onClick={() => open(id)}>
        {icons && <Icon aria-hidden="true" />}<span>{label(id)}</span>{n && !locked(id) ? <span className="txo-count num">{n}</span> : null}
      </button></li>
    );
  };
  const edition = currentEdition(game), product = edition?.id === "buchhalter" && year >= 2017 ? "buchhaltung" : edition?.name ?? "";
  const title = `${v.name} ${product} ${year}`;
  const caption = `${title} - ${game.company.name}${top && gen === "classic" ? ` - [${label(top)}]` : ""}`;
  const today = dateOf(game.hour).toLocaleDateString(LOCALE, { timeZone: "UTC" });
  const status = (
    <footer className="txo-status">
      <span>{note ?? t("books-tw.status.ready")}</span>
      <span>{t("books-tw.status.firma", { name: game.company.name })}</span>
      <span>{t("books-tw.status.year", { year: yearOfHour(game.hour) })}</span>
      <span>{t(`books-de.chart.${chartOf(game).id}`)}</span>
      <span className="num">{today}</span>
    </footer>
  );
  const firmen = gen === "classic" && !opened && !guide && <Firmenauswahl open={() => setOpened(true)} guide={() => setGuide(true)} />;
  const modal = guide && (
    <div className="txo-modal">
      <div className="txo-dialog txo-guide" role="dialog" aria-label={t("books-tw.item.guide")}>
        <div className="txo-caption"><span>{t("books-tw.item.guide")}</span><button className="txo-cap-btn" aria-label={t("books-tw.close")} onClick={() => setGuide(false)}><X /></button></div>
        <div className="txo-dialog-body"><InstallGuide go={open} canGo={(id) => shown(id) && !locked(id)} /></div>
      </div>
    </div>
  );
  const faktura = (id: string) => (SCREENS[id]?.faktura ? " txo-faktura" : "");

  return (
    <div className={`books txo txo-${gen}`} data-gen={gen}>
      {gen !== "flat" && <div className="txo-title"><span className="txo-logo" aria-hidden="true" />{caption}</div>}
      {gen === "flat" && <header className="txo-brand"><span className="txo-logo" aria-hidden="true" /><b>{v.name}</b> {product} {year}<span className="txo-firma">{game.company.name}</span></header>}
      <MenuBar menus={menus} />
      {gen === "classic" && (
        <div className="txo-tools" role="toolbar">
          {TOOLS.map((id, i) => {
            if (!id) return <span key={i} className="txo-tool-sep" />;
            const screen = !!SCREENS[id];
            if (screen && !shown(id)) return null;
            const text = screen ? label(id) : t(`books-tw.tool.${id}`);
            const run = id === "open" ? () => setOpened(false) : id === "save" ? backup : id === "help" ? () => setGuide(true) : () => open(id);
            return <button key={id} title={text} aria-label={text} aria-disabled={(screen && locked(id)) || undefined} onClick={run}><Pic id={id} /></button>;
          })}
        </div>
      )}
      {gen === "workflow" && (
        <div className="txo-band" role="toolbar">
          {BAND.map(([sec, ids]) => (
            <div key={sec} className="txo-group" role="group" aria-label={t(`books-tw.sec.${sec}`)}>
              <div className="txo-group-items">
                {ids.filter(shown).map((id) => { const Icon = SCREENS[id].icon; return <button key={id} aria-disabled={locked(id) || undefined} onClick={() => open(id)}><Icon aria-hidden="true" /><span>{label(id)}</span></button>; })}
              </div>
              <div className="txo-group-name">{t(`books-tw.sec.${sec}`)}</div>
            </div>
          ))}
          <form className="txo-search" role="search" onSubmit={(e) => {
            e.preventDefault();
            const q = query.trim().toLowerCase(), hit = Object.keys(SCREENS).find((id) => shown(id) && label(id).toLowerCase().includes(q));
            if (q && hit) { open(hit); setQuery(""); }
          }}>
            <Search aria-hidden="true" />
            <input type="search" list="txo-search-list" aria-label={t("books-tw.search")} placeholder={t("books-tw.search")} value={query} onChange={(e) => setQuery(e.target.value)} />
            <datalist id="txo-search-list">{Object.keys(SCREENS).filter(shown).map((id) => <option key={id} value={label(id)} />)}</datalist>
          </form>
        </div>
      )}
      {register && keys && <Register onClose={() => setRegister(false)} />}
      <div className="txo-split">
        {gen !== "flat" ? (
          <nav className="txo-nav" aria-label={t("books-tw.navigator")}>
            <div className="txo-nav-head">{t(gen === "classic" ? "books-tw.navigator" : "books-tw.navigation")}</div>
            <ul role="tree">
              {gen === "workflow" && leaf("start", true)}
              {SECTIONS.map(([sec, ids]) => (
                <li key={sec} className={sec === "faktura" ? "txo-faktura" : undefined}>
                  <span className="txo-folder">{t(`books-tw.sec.${sec}`)}</span>
                  <ul role="group">{ids.filter(shown).map((id) => leaf(id, gen === "workflow"))}</ul>
                </li>
              ))}
            </ul>
          </nav>
        ) : (
          <nav className="txo-main" aria-label={t("books-tw.navigation")}>
            {[["start", ["start"], House] as const, ...SECTIONS].map(([sec, ids, Icon]) => {
              const first = ids.find((id) => shown(id));
              if (!first) return null;
              return <button key={sec} aria-current={(sec === "start" ? top === "start" : here?.[0] === sec) ? "page" : undefined} onClick={() => open(first)}><Icon aria-hidden="true" /><span>{t(`books-tw.sec.${sec}`)}</span></button>;
            })}
          </nav>
        )}
        {gen === "classic" && (
          <div className={`txo-mdi txo-arr-${arrange}`}>
            {wins.map((id, i) => {
              const n = wins.length - 1;
              const at = arrange === "cascade" ? { top: i * STEP, left: i * STEP, width: `calc(100% - ${n * STEP}px)`, height: `calc(100% - ${n * STEP}px)` } : undefined;
              return (
                <section key={id} className={`txo-child${id === top ? " active" : ""}${faktura(id)}`} style={at} aria-label={label(id)} onMouseDown={() => id !== top && setActive(id)}>
                  <div className="txo-caption">
                    <span>{SCREENS[id].faktura ? `${t("books-tw.sec.faktura")} - ` : ""}{label(id)}</span>
                    <button className="txo-cap-btn" aria-label={t("books-tw.maximize")} onClick={() => setArrange(arrange === "max" ? "cascade" : "max")}>□</button>
                    <button className="txo-cap-btn" aria-label={t("books-tw.close")} onClick={() => close(id)}><X /></button>
                  </div>
                  <div className="txo-child-body">{body(id)}</div>
                </section>
              );
            })}
            {firmen}
          </div>
        )}
        {gen === "workflow" && (
          <div className="txo-docs">
            <div className="txo-tabs" role="tablist">
              {wins.map((id) => (
                <div key={id} className={`txo-tab${faktura(id)}`} role="tab" aria-selected={id === top}>
                  <button onClick={() => setActive(id)}>{label(id)}</button>
                  <button className="txo-cap-btn" aria-label={t("books-tw.close")} onClick={() => close(id)}><X /></button>
                </div>
              ))}
            </div>
            {wins.map((id) => <div key={id} className={`txo-doc${faktura(id)}`} role="tabpanel" hidden={id !== top}>{body(id)}</div>)}
          </div>
        )}
        {gen === "flat" && (
          <main className={`txo-page${top ? faktura(top) : ""}`}>
            {top && top !== "start" && (
              <div className="txo-context">
                <h2>{here && here[0] === "faktura" ? `${t("books-tw.sec.faktura")} - ` : ""}{label(top)}</h2>
                {here && <div className="txo-subtabs" role="tablist">{here[1].filter(shown).map((id) => <button key={id} role="tab" aria-selected={id === top} aria-disabled={locked(id) || undefined} onClick={() => open(id)}>{label(id)}</button>)}</div>}
              </div>
            )}
            {top && <div className="txo-doc">{body(top)}</div>}
          </main>
        )}
      </div>
      {status}
      {modal}
    </div>
  );
}
