import { FileText, FilePlus, FileSpreadsheet, Landmark, LayoutDashboard, LineChart, Receipt, Settings, Users } from "lucide-react";
import { useState } from "react";
import { yearOf } from "../../../../../../sim/00-core/time";
import { sells } from "../../../../../../sim/10-catalog/bookkeeping";
import { hasModule } from "../../../../../../sim/10-catalog/modules";
import { booksOffline, currentVendor, hasFeature } from "../../../../../../sim/80-business/bookkeeping";
import { setupOf } from "../../../../../../sim/80-business/books-guide";
import { unsynced } from "../../../../../../sim/80-business/shoplink";
import { importFromShop } from "../../../../../../sim/90-actions/shoplink";
import { t } from "../../../../../../i18n/en";
import { useSessionState } from "../../../../../session";
import { useFocus, useStore } from "../../../../../store";
import { CustomersTab } from "../../../CustomersTab";
import { OverviewTab, StatementTab, StatisticsTab } from "../../../Reports";
import { InstallGuide } from "../../../guide/InstallGuide";
import { Installer } from "../../../guide/Installer";
import { Offline } from "../../../BooksApp";
import { useBooks } from "../../../view";
import { SaasShell, type NavItem } from "../Shell";
import { Bank } from "./Bank";
import { editionsUrl } from "./Gated";
import { Belege } from "./Belege";
import { Dashboard, openCount } from "./Dashboard";
import { Documents } from "./Documents";
import { eraOf } from "./era";
import { Steuern } from "./Steuern";
import "./rexoffice.css";

type Section = "dashboard" | "rechnungen" | "angebote" | "kontakte" | "belege" | "bank" | "auswertungen" | "steuern" | "einstellungen";
const FEATURES: Partial<Record<Section, Parameters<typeof sells>[1][]>> = { angebote: ["quotes"], auswertungen: ["reports", "statistics"], steuern: ["tax"] };
const ICON: Record<Section, NavItem["icon"]> = {
  dashboard: <LayoutDashboard />, rechnungen: <Receipt />, angebote: <FilePlus />, kontakte: <Users />, belege: <FileText />,
  bank: <Landmark />, auswertungen: <LineChart />, steuern: <FileSpreadsheet />, einstellungen: <Settings />,
};

// The Rexoffice web app: left navigation, company bar and one page per area. The sign-up runs first; a company already made skips it.
export function Rexoffice() {
  const game = useBooks(), act = useStore((s) => s.act), openApp = useStore((s) => s.openApp), v = currentVendor(game)!;
  const era = eraOf(yearOf(game.hour));
  const [section, setSection] = useSessionState<Section>("rx.section", "dashboard");
  const [focus, setFocus] = useSessionState<string | null>("rx.focus", null);
  const [q, setQ] = useState("");
  const [signedUp, setSignedUp] = useState(game.books.setupDone === true || setupOf(game).company);
  const waiting = useStore((s) => unsynced(s.game));
  const importing = !!game.shop.variant && !hasModule(game, "shop-link");
  useFocus("Books", (got) => {
    const f = got.kind === "url" ? got.inner : got;
    if (!f) return;
    if (f.kind === "setup" || f.kind === "guide") return setSection("dashboard");
    const to = f.kind === "invoice" ? "rechnungen" : f.kind === "customer" || f.kind === "newCustomer" ? "kontakte" : f.kind === "quote" ? "angebote" : f.kind === "payable" ? "belege" : null;
    if (!to) return;
    setSection(to);
    setFocus(f.id);
  });
  const go = (id: string) => { setSection(id as Section); setFocus(null); setQ(""); };
  const sold = (id: Section) => !FEATURES[id] || FEATURES[id]!.some((f) => sells(v, f));
  const locked = (id: Section) => !!FEATURES[id] && !FEATURES[id]!.some((f) => hasFeature(game, f));
  const ids = (["dashboard", "rechnungen", "angebote", "kontakte", "belege", "bank", "auswertungen", "steuern", ...(era === "modern" ? [] : ["einstellungen"])] as Section[]).filter(sold);
  const counts = openCount(game);
  const nav: NavItem[] = ids.map((id) => ({ id, label: t(`rx.nav.${id}`), icon: ICON[id], locked: locked(id), badge: id === "rechnungen" ? counts.late : id === "bank" ? counts.unmatched : id === "belege" ? counts.payables : undefined }));
  const pick = (id: string) => (locked(id as Section) ? openApp("Browser", { kind: "url", id: editionsUrl(FEATURES[id as Section]!, game) }) : go(id));
  const page = locked(section) || !sold(section) ? "dashboard" : section;

  if (booksOffline(game)) return <div className="sx rx-signup"><Offline v={v} /></div>;
  if (!signedUp && game.books.setupDone !== true) return <div className="sx rx-signup"><Installer id={v.id} inline onClose={() => setSignedUp(true)} /></div>;
  return (
    <SaasShell cls={`rx rx-${era}`} brand={<span className="rx-logo">{v.program}</span>} nav={nav} active={page} onNav={pick}
      company={game.company.name} companyMenu={[{ id: "settings", label: t("rx.manageCompany"), run: () => go("einstellungen") }]}
      query={q} onQuery={(x) => { setQ(x); if (x && page !== "rechnungen" && page !== "belege" && page !== "bank") setSection("rechnungen"); }} searchLabel={t("rx.search")}
      newLabel={t("rx.new")} gear={era === "modern" ? { label: t("rx.nav.einstellungen"), run: () => go("einstellungen") } : undefined}
      newMenu={[
        { id: "invoice", label: t("rx.newInvoice"), run: () => go("rechnungen") },
        ...(sold("angebote") && !locked("angebote") ? [{ id: "quote", label: t("rx.newQuote"), run: () => go("angebote") }] : []),
        { id: "beleg", label: t("rx.uploadBeleg"), run: () => go("belege") },
      ]}>
      {page === "dashboard" && <Dashboard go={go} />}
      {page === "rechnungen" && <Documents kind="invoice" focus={focus} q={q} go={go} />}
      {page === "angebote" && <Documents kind="quote" focus={focus} q={q} go={go} />}
      {page === "kontakte" && <div className="sx-legacy books"><CustomersTab focus={focus} /></div>}
      {page === "belege" && <Belege q={q} focus={focus} />}
      {page === "bank" && <Bank q={q} />}
      {page === "auswertungen" && <Auswertungen />}
      {page === "steuern" && <Steuern />}
      {page === "einstellungen" && (
        <>
          <h1>{t("rx.nav.einstellungen")}</h1>
          {importing && <div><button type="button" className="sx-btn" onClick={() => act(importFromShop)}>{t("shop-link.import")}{waiting ? ` (${waiting})` : ""}</button></div>}
          <div className="sx-card books"><InstallGuide go={() => go("steuern")} canGo={() => sold("steuern") && !locked("steuern")} /></div>
        </>
      )}
    </SaasShell>
  );
}

// Overview, statistics and statement under one page with their own switch.
function Auswertungen() {
  const game = useBooks();
  const [tab, setTab] = useSessionState("rx.reports", "overview");
  const items = [{ id: "overview", label: t("books.tab.overview") }, ...(hasFeature(game, "statistics") || hasFeature(game, "reports") ? [{ id: "statistics", label: t("books.tab.statistics") }] : []), { id: "statement", label: t("books.tab.statement") }];
  return (
    <>
      <h1>{t("rx.nav.auswertungen")}</h1>
      <div className="sx-tabs" role="group">{items.map((i) => <button key={i.id} type="button" aria-pressed={i.id === tab} onClick={() => setTab(i.id)}>{i.label}</button>)}</div>
      <div className="sx-legacy books">{tab === "statistics" ? <StatisticsTab /> : tab === "statement" ? <StatementTab /> : <OverviewTab />}</div>
    </>
  );
}
