import type { ComponentType, CSSProperties } from "react";
import { isUnpaid } from "../../../sim/45-billing/billing";
import { overdue } from "../../../sim/46-finance/payables";
import { booksHost, currentVendor } from "../../../sim/80-business/bookkeeping";
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
import { RemindersTab } from "./RemindersTab";
import { Register } from "./Register";
import "../billing/billing.css";
import "./books.css";

export const drafts = (s: GameState) => s.invoices.filter((i) => i.status === "draft").length;
export const unmatched = (s: GameState) => s.transfers.filter((x) => x.invoiceId === null).length;
export const late = (s: GameState) => s.invoices.filter((i) => i.status === "overdue").length;

// Each tab: id, label key, dock count and body. The selection a tab opens on comes from the focus id.
const TABS: { id: string; count: (s: GameState) => number; body: ComponentType<{ focus: string | null }> }[] = [
  { id: "customers", count: (s) => s.customers.filter((c) => c.churnedAt === null && !c.sponsor).length, body: CustomersTab },
  { id: "quotes", count: (s) => s.quotes.filter((q) => q.status === "accepted" && !s.sales.requests.some((r) => r.ticketId === q.ticketId && r.invoiceId)).length, body: QuotesTab },
  { id: "invoices", count: drafts, body: InvoicesTab },
  { id: "bank", count: unmatched, body: BankTab },
  { id: "reminders", count: late, body: RemindersTab },
  { id: "payables", count: (s) => s.payables.filter((p) => overdue(s, p)).length, body: PayablesTab },
];

export function BooksApp() {
  const game = useStore((s) => s.game);
  const [tab, setTab] = useSessionState("books.tab", "invoices");
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
  const current = TABS.find((x) => x.id === tab) ?? TABS[2];
  const Body = current.body;
  const v = currentVendor(game), skin = v?.skin;
  return (
    <div className="books" style={skin && { "--accent": skin.accent, "--bk-bar": skin.bar, "--bk-ink": skin.ink } as CSSProperties}>
      {v && skin?.web && <div className="books-web num">{`https://www.${booksHost(v)}/app`}</div>}
      <div className="books-top">
      <div className="books-bar tabs" role="tablist" aria-label={t("books.title")}>
        {TABS.map((x) => {
          const n = x.count(game);
          return (
            <button key={x.id} role="tab" aria-selected={x.id === current.id} onClick={() => { setTab(x.id); setFocus(null); }}>
              {t(`books.tab.${x.id}`)}{n ? <span className="tab-count num">{n}</span> : null}
            </button>
          );
        })}
      </div>
      {v?.keys !== false && <button className="btn books-register-open" aria-expanded={register} onClick={() => setRegister(!register)}>{t("vendor-sites.register")}</button>}
      </div>
      {register && v?.keys !== false && <Register onClose={() => setRegister(false)} />}
      <div className="books-body" role="tabpanel">
        <Body key={`${current.id}:${focus}`} focus={focus} />
      </div>
    </div>
  );
}
