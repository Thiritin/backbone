import { euroCents } from "../../../../../../sim/00-core/money";
import { yearOf } from "../../../../../../sim/00-core/time";
import { isUnpaid, owed } from "../../../../../../sim/45-billing/billing";
import { guideOf, guideTicked } from "../../../../../../sim/80-business/books-guide";
import { hasFeature } from "../../../../../../sim/80-business/bookkeeping";
import { vatBetween } from "../../../../../../sim/80-business/tax";
import { lateInBooks, unbooked } from "../../../../../../sim/46-finance/payables";
import { taxFor } from "../../../../../../sim/46-finance/finance";
import type { GameState } from "../../../../../../sim/50-state";
import { t } from "../../../../../../i18n/en";
import { InstallGuide } from "../../../guide/InstallGuide";
import { unmatched, late } from "../../../BooksApp";
import { useOpenItems, useReports } from "../../../data";
import { useBooks } from "../../../view";
import { Card, Stat } from "../ui";

export const guideFinished = (g: GameState) => !!g.books.setupDone && guideOf(g).every((x) => x.optional || guideTicked(g, x));
export const openCount = (g: GameState) => ({ late: late(g), unmatched: unmatched(g), payables: g.payables.filter((p) => lateInBooks(g, p) && unbooked(p)).length });

// Übersicht: the figures of the year, what is open, the tax estimate and the onboarding checklist until it is done.
export function Dashboard({ go }: { go: (section: string) => void }) {
  const game = useBooks(), items = useOpenItems(), reports = useReports();
  const year = yearOf(game.hour), pl = reports.profitLoss(year);
  const revenue = pl.total(pl.revenue).reduce((a, b) => a + b, 0);
  const overdue = items.receivables.filter((i) => i.status === "overdue");
  const estimate = hasFeature(game, "tax")
    ? game.tax.returns.filter((r) => r.filedAt === null).reduce((n, r) => n + (r.kind === "vat" ? vatBetween(game, r.from, r.to).payable : taxFor(game, r.year).tax), 0) : 0;
  return (
    <>
      <h1>{t("rx.nav.dashboard")}</h1>
      <div className="sx-cards">
        <Stat title={t("rx.revenue")} value={euroCents(revenue)} note={String(year)} />
        <Stat title={t("rx.openInvoices")} value={euroCents(items.receivable)} note={t("rx.count", { count: items.receivables.length })} />
        <Stat title={t("rx.overdue")} value={euroCents(overdue.reduce((n, i) => n + owed(i), 0))} note={t("rx.count", { count: overdue.length })} warn={overdue.length > 0} />
        <Stat title={t("rx.taxEstimate")} value={euroCents(estimate)} />
        <Stat title={t("rx.bank")} value={euroCents(game.cash)} />
      </div>
      {!guideFinished(game) && <Card className="rx-checklist"><InstallGuide go={() => go("steuern")} canGo={() => hasFeature(game, "tax")} /></Card>}
      <Card title={t("rx.nav.rechnungen")}>
        <table className="sx-table">
          <tbody>
            {items.receivables.filter(isUnpaid).slice(0, 5).map((i) => (
              <tr key={i.id} tabIndex={0} onClick={() => go("rechnungen")}>
                <td className="num">{i.number}</td><td>{game.customers.find((c) => c.id === i.customerId)?.name}</td><td className="r num">{euroCents(owed(i))}</td>
              </tr>
            ))}
            {!items.receivables.length && <tr><td>{t("books.noInvoices")}</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}
