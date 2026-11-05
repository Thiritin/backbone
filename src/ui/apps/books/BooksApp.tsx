import { useState, type ComponentType, type CSSProperties } from "react";
import { isUnpaid, synced } from "../../../sim/45-billing/billing";
import { hasModule, MODULES } from "../../../sim/10-catalog/modules";
import { licenceMail } from "../../../sim/80-business/licences";
import { unsynced } from "../../../sim/80-business/shoplink";
import { importFromShop } from "../../../sim/90-actions/shoplink";
import { lateInBooks } from "../../../sim/46-finance/payables";
import { sells, type BooksVendor, type BooksVendorId, type Feature } from "../../../sim/10-catalog/bookkeeping";
import { booksAppUrl, booksOffline, booksUrl, currentVendor, hasFeature } from "../../../sim/80-business/bookkeeping";
import type { GameState } from "../../../sim/50-state";
import { t } from "../../../i18n/en";
import { useSessionState } from "../../session";
import { useFocus, useStore } from "../../store";
import { AccountTree } from "./AccountTree";
import { BankTab } from "./BankTab";
import { BookingTab } from "./BookingTab";
import { ChartTab } from "./ChartTab";
import { CustomersTab } from "./CustomersTab";
import { InvoicesTab } from "./InvoicesTab";
import { QuotesTab } from "./QuotesTab";
import { NEW } from "./NewCustomer";
import { PayablesTab } from "./PayablesTab";
import { RemindersTab } from "./RemindersTab";
import { OverviewTab, StatementTab, StatisticsTab } from "./Reports";
import { TaxTab } from "./TaxTab";
import { Register } from "./Register";
import { BooksSetup } from "./BooksSetup";
import { InstallGuide } from "./guide/InstallGuide";
import { Installer } from "./guide/Installer";
import { setupOf } from "../../../sim/80-business/books-guide";
import type { AppMenu } from "../../desktop/menu";
import { useBooks } from "./view";
import { LAYOUTS } from "./layouts";
import type { Entry, Group } from "./layouts/types";
import "../billing/billing.css";
import "./books.css";
import "./screens.css";

export const drafts = (s: GameState) => s.invoices.filter((i) => i.status === "draft" && synced(i)).length;
export const unmatched = (s: GameState) =>
  s.transfers.filter((x) => x.matchedAt === null).length + (s.bank?.outgoing ?? []).filter((o) => o.matched === null && !o.returned).length;
export const late = (s: GameState) => s.invoices.filter((i) => i.status === "overdue" && synced(i)).length;

// Each tab: id, label key, dock count and body. The selection a tab opens on comes from the focus id; go switches tab.
// only: the one program that has the tab.
const TABS: { id: string; group: Group; count: (s: GameState) => number; body: ComponentType<{ focus: string | null; go: (tab: string) => void }>; features?: Feature[]; only?: BooksVendorId }[] = [
  { id: "accounts", group: "reports", count: () => 0, body: AccountTree, only: "gnucache" },
  { id: "overview", group: "reports", count: () => 0, body: OverviewTab },
  { id: "customers", group: "sales", count: (s) => s.customers.filter((c) => c.churnedAt === null && !c.sponsor).length, body: CustomersTab },
  { id: "quotes", group: "sales", count: (s) => s.quotes.filter((q) => q.status === "accepted").length, body: QuotesTab, features: ["quotes"] },
  { id: "invoices", group: "sales", count: drafts, body: InvoicesTab },
  { id: "bank", group: "payments", count: unmatched, body: BankTab },
  { id: "booking", group: "payments", count: () => 0, body: BookingTab, only: "collmix" },
  { id: "reminders", group: "payments", count: late, body: RemindersTab, features: ["dunning"] },
  { id: "payables", group: "payments", count: (s) => s.payables.filter((p) => lateInBooks(s, p)).length, body: PayablesTab },
  { id: "statistics", group: "reports", count: () => 0, body: StatisticsTab, features: ["reports", "statistics"] },
  { id: "tax", group: "reports", count: (s) => s.tax.returns.filter((r) => r.filedAt === null && s.hour >= r.dueAt).length, body: TaxTab, features: ["tax"] },
  { id: "chart", group: "reports", count: () => 0, body: ChartTab, only: "saga" },
  { id: "statement", group: "reports", count: () => 0, body: StatementTab },
];

// A browser program runs in the Browser at the vendor's site; Books only links there.
export function BooksApp() {
  const game = useBooks(), openApp = useStore((s) => s.openApp), v = currentVendor(game);
  if (v?.deployment !== "browser") return <BooksProgram />;
  return (
    <div className="books books-link">
      <button className="btn primary" onClick={() => openApp("Browser", { kind: "url", id: booksAppUrl(v) })}>{t("books.openWeb", { program: v.program })}</button>
      <InstallGuide />
    </div>
  );
}

export function BooksProgram() {
  const game = useBooks(), act = useStore((s) => s.act), openApp = useStore((s) => s.openApp);
  const waiting = useStore((s) => unsynced(s.game));
  // Before Shop link, a shop system hands its records over only on import.
  const importing = !!game.shop.variant && !hasModule(game, "shop-link");
  const [tab, setTab] = useSessionState("books.tab", "overview");
  const [focus, setFocus] = useSessionState<string | null>("books.focus", null);
  const [register, setRegister] = useSessionState("books.register", false);
  const [setup, setSetup] = useSessionState("books.setup", false);
  const [guide, setGuide] = useSessionState("books.guide", false);
  // The sign-up of a web program runs until its plan page is closed; a program with its company already made skips it.
  const [signedUp, setSignedUp] = useState(setupOf(game).company);
  useFocus("Books", (got) => {
    const f = got.kind === "url" ? got.inner : got;
    if (!f) return;
    if (f.kind === "register") return setRegister(true);
    if (f.kind === "setup") return setSetup(true);
    if (f.kind === "guide") return setGuide(true);
    const to = f.kind === "invoice" ? (hasFeature(game, "dunning") && game.invoices.find((i) => i.id === f.id && isUnpaid(i) && i.status === "overdue") ? "reminders" : "invoices")
      : f.kind === "customer" || f.kind === "newCustomer" ? "customers" : f.kind === "quote" ? "quotes" : f.kind === "payable" ? "payables" : null;
    if (!to) return;
    setTab(to);
    setFocus(f.kind === "newCustomer" ? `${NEW}${f.id}` : f.id);
  });
  const v = currentVendor(game), skin = v?.skin;
  // An entry the edition lacks opens the vendor's editions page; one the vendor never sells is missing.
  const shown = TABS.filter((x) => (!x.only || x.only === v?.id) && (!x.features || x.features.some((f) => v && sells(v, f))));
  const locked = (x: (typeof TABS)[number]) => !!x.features && !x.features.some((f) => hasFeature(game, f));
  const current = shown.find((x) => x.id === tab && !locked(x)) ?? shown[0];
  const Body = current.body;
  const pick = (id: string) => {
    const x = shown.find((y) => y.id === id)!;
    if (locked(x) && v) return openApp("Browser", { kind: "url", id: booksUrl(v) });
    setTab(x.id); setFocus(null);
  };
  const entries: Entry[] = shown.map((x) => ({ id: x.id, group: x.group, count: x.count(game), locked: locked(x) }));
  const Layout = LAYOUTS[v?.layout ?? "tabs"];
  // Shop modules arrive with a licence key to register here.
  const keys = MODULES.some((m) => licenceMail(game, m.id) && !hasModule(game, m.id));
  return (
    <div className="books" style={skin && { "--accent": skin.accent, "--bk-bar": skin.bar, "--bk-ink": skin.ink } as CSSProperties}>
      <Layout v={v!} entries={entries} active={current.id} pick={pick}>
        <div className="books-top">
            {v && game.books.setupDone === false && <button className="btn books-guide-open" aria-expanded={guide} onClick={() => setGuide(!guide)}>{t("bkguide.menu")}</button>}
            {v?.deployment === "browser" && current.id === "overview" && <button className="btn" onClick={() => setSetup(true)}>{t("setup.title")}</button>}
            {importing && <button className="btn books-import" onClick={() => act(importFromShop)}>{t("shop-link.import")}{waiting ? <span className="tab-count num">{waiting}</span> : null}</button>}
            {keys && <button className="btn books-register-open" aria-expanded={register} onClick={() => setRegister(!register)}>{t("vendor-sites.register")}</button>}
        </div>
        {register && keys && <Register onClose={() => setRegister(false)} />}
        <div className="books-body">
          {v && booksOffline(game) ? <Offline v={v} />
            : guide ? <div className="books-guide"><InstallGuide go={(tab) => { setGuide(false); pick(tab); }} /></div>
            : v?.deployment === "browser" && game.books.setupDone === false && !signedUp ? <Installer id={v.id} inline onClose={() => setSignedUp(true)} />
            : v && (setup || game.books.setupDone === false) ? <BooksSetup v={v} game={game} close={(to) => { setSetup(false); if (shown.some((x) => x.id === to)) pick(to!); }} />
            : <Body key={`${current.id}:${focus}`} focus={focus} go={pick} />}
        </div>
      </Layout>
    </div>
  );
}

// A browser program without its line: the browser's error page for the vendor's address.
function Offline({ v }: { v: BooksVendor }) {
  return (
    <div className="books-offline">
      <h2>{t("books-editions.offlineTitle")}</h2>
      <p className="num">{`https://${booksAppUrl(v)}`}</p>
    </div>
  );
}

// The installed program offers the setup wizard in its app menu; the web version on its overview.
export const booksMenus = (): AppMenu[] => [{ id: "app", title: "", items: [
  { label: t("bkguide.menu"), run: () => useStore.getState().openApp("Books", { kind: "guide", id: "" }) },
  { label: t("setup.title"), run: () => useStore.getState().openApp("Books", { kind: "setup", id: "" }) },
] }];
