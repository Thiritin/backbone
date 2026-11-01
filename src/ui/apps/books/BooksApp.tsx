import type { ComponentType, CSSProperties } from "react";
import { isUnpaid, synced } from "../../../sim/45-billing/billing";
import { hasModule, MODULES } from "../../../sim/10-catalog/modules";
import { licenceMail } from "../../../sim/80-business/licences";
import { unsynced } from "../../../sim/80-business/shoplink";
import { importFromShop } from "../../../sim/90-actions/shoplink";
import { overdue } from "../../../sim/46-finance/payables";
import { sells, type BooksVendor, type Feature } from "../../../sim/10-catalog/bookkeeping";
import { booksHost, booksOffline, booksUrl, currentVendor, hasFeature } from "../../../sim/80-business/bookkeeping";
import type { GameState } from "../../../sim/50-state";
import { t } from "../../../i18n/en";
import { useSessionState } from "../../session";
import { useFocus, useStore } from "../../store";
import { BankTab } from "./BankTab";
import { CustomersTab } from "./CustomersTab";
import { InvoicesTab } from "./InvoicesTab";
import { QuotesTab } from "./QuotesTab";
import { NEW } from "./NewCustomer";
import { PayablesTab } from "./PayablesTab";
import { ProductsTab } from "./ProductsTab";
import { RemindersTab } from "./RemindersTab";
import { OverviewTab, StatementTab, StatisticsTab } from "./Reports";
import { TaxTab } from "./TaxTab";
import { Register } from "./Register";
import { useBooks } from "./view";
import { LAYOUTS } from "./layouts";
import type { Entry, Group } from "./layouts/types";
import { unpublished } from "../../../sim/80-business/catalog";
import "../billing/billing.css";
import "./books.css";

export const drafts = (s: GameState) => s.invoices.filter((i) => i.status === "draft" && synced(i)).length;
export const unmatched = (s: GameState) => s.transfers.filter((x) => x.matchedAt === null).length;
export const late = (s: GameState) => s.invoices.filter((i) => i.status === "overdue" && synced(i)).length;

// Each tab: id, label key, dock count and body. The selection a tab opens on comes from the focus id.
const TABS: { id: string; group: Group; count: (s: GameState) => number; body: ComponentType<{ focus: string | null }>; features?: Feature[] }[] = [
  { id: "overview", group: "reports", count: () => 0, body: OverviewTab },
  { id: "customers", group: "sales", count: (s) => s.customers.filter((c) => c.churnedAt === null && !c.sponsor).length, body: CustomersTab },
  { id: "quotes", group: "sales", count: (s) => s.quotes.filter((q) => q.status === "accepted").length, body: QuotesTab, features: ["quotes"] },
  { id: "invoices", group: "sales", count: drafts, body: InvoicesTab },
  { id: "bank", group: "payments", count: unmatched, body: BankTab },
  { id: "reminders", group: "payments", count: late, body: RemindersTab },
  { id: "products", group: "sales", count: unpublished, body: ProductsTab },
  { id: "payables", group: "payments", count: (s) => s.payables.filter((p) => overdue(s, p)).length, body: PayablesTab },
  { id: "statistics", group: "reports", count: () => 0, body: StatisticsTab, features: ["reports", "statistics"] },
  { id: "tax", group: "reports", count: (s) => s.tax.returns.filter((r) => r.filedAt === null && s.hour >= r.dueAt).length, body: TaxTab, features: ["tax"] },
  { id: "statement", group: "reports", count: () => 0, body: StatementTab },
];

export function BooksApp() {
  const game = useBooks(), act = useStore((s) => s.act), openApp = useStore((s) => s.openApp);
  const waiting = useStore((s) => unsynced(s.game));
  // Before Shop link, a shop system hands its records over only on import.
  const importing = !!game.shop.variant && !hasModule(game, "shop-link");
  const [tab, setTab] = useSessionState("books.tab", "overview");
  const [focus, setFocus] = useSessionState<string | null>("books.focus", null);
  const [register, setRegister] = useSessionState("books.register", false);
  useFocus("Books", (f) => {
    if (f.kind === "register") return setRegister(true);
    const to = f.kind === "invoice" ? (game.invoices.find((i) => i.id === f.id && isUnpaid(i) && i.status === "overdue") ? "reminders" : "invoices")
      : f.kind === "customer" || f.kind === "newCustomer" ? "customers" : f.kind === "quote" ? "quotes" : null;
    if (!to) return;
    setTab(to);
    setFocus(f.kind === "newCustomer" ? `${NEW}${f.id}` : f.id);
  });
  const v = currentVendor(game), skin = v?.skin;
  // An entry the edition lacks opens the vendor's editions page; one the vendor never sells is missing.
  const shown = TABS.filter((x) => !x.features || x.features.some((f) => v && sells(v, f)));
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
        {(importing || keys) && (
          <div className="books-top">
            {importing && <button className="btn books-import" onClick={() => act(importFromShop)}>{t("shop-link.import")}{waiting ? <span className="tab-count num">{waiting}</span> : null}</button>}
            {keys && <button className="btn books-register-open" aria-expanded={register} onClick={() => setRegister(!register)}>{t("vendor-sites.register")}</button>}
          </div>
        )}
        {register && keys && <Register onClose={() => setRegister(false)} />}
        <div className="books-body">
          {v && booksOffline(game) ? <Offline v={v} /> : <Body key={`${current.id}:${focus}`} focus={focus} />}
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
      <p className="num">{`https://www.${booksHost(v)}/app`}</p>
    </div>
  );
}
