import { useState, type ComponentType } from "react";
import { X } from "lucide-react";
import { yearOf } from "../../../../../sim/00-core/time";
import { hasModule, MODULES } from "../../../../../sim/10-catalog/modules";
import { sells } from "../../../../../sim/10-catalog/bookkeeping";
import { setupOf } from "../../../../../sim/80-business/books-guide";
import { currentVendor } from "../../../../../sim/80-business/bookkeeping";
import { licenceMail } from "../../../../../sim/80-business/licences";
import { importFromShop } from "../../../../../sim/90-actions/shoplink";
import { backupBooks, createBooksCompany, enterOpening, linkBooksBank } from "../../../../../sim/90-actions/bookkeeping";
import { t } from "../../../../../i18n/en";
import { useSessionState } from "../../../../session";
import { useFocus, useStore } from "../../../../store";
import { BankTab } from "../../BankTab";
import { CustomersTab } from "../../CustomersTab";
import { InvoicesTab } from "../../InvoicesTab";
import { NEW } from "../../NewCustomer";
import { PayablesTab } from "../../PayablesTab";
import { QuotesTab } from "../../QuotesTab";
import { Register as KeyRegister } from "../../Register";
import { InstallGuide } from "../../guide/InstallGuide";
import type { Account } from "../../data";
import { useBooks } from "../../view";
import { GcIcon } from "./Icons";
import { Ledger } from "./Ledger";
import { MenuBar, type MenuDef } from "./MenuBar";
import { NewFile } from "./NewFile";
import { Report, REPORTS, type ReportKind } from "./Reports";
import { Tree } from "./Tree";
import { money, useChart } from "./shared";
import "./gnucache.css";

type Body = ComponentType<{ focus: string | null; go: (tab: string) => void }>;
// The business pages: the sim's customer, invoice, order, supplier and bank screens, opened from the Business menu.
const BIZ: Record<string, { label: string; body: Body }> = {
  customers: { label: "gc.i.customers", body: CustomersTab },
  invoices: { label: "gc.i.invoices", body: InvoicesTab },
  quotes: { label: "gc.i.quotes", body: QuotesTab },
  payables: { label: "gc.i.suppliers", body: PayablesTab },
  bank: { label: "gc.tool.reconcile", body: BankTab },
};
const REPORT_OF: Record<string, ReportKind> = { overview: "figures", statement: "transactions", statistics: "stats" };

// GnuCache's look follows the game year: GTK 1.2 up to 2005, GTK 2 to 2017, GTK 3 after.
export const lookOf = (year: number) => (year <= 2005 ? "g1" : year <= 2017 ? "g2" : "g3");

export function GnuCache() {
  const game = useBooks(), accounts = useChart();
  const act = useStore((s) => s.act), waiting = !!game.shop.variant && !hasModule(game, "shop-link");
  const look = lookOf(yearOf(game.hour)), v = currentVendor(game);
  const [pages, setPages] = useSessionState<string[]>("books.gnuPages", game.books.setupDone === true ? ["accounts"] : ["accounts", "guide"]);
  const [active, setActive] = useSessionState("books.gnuActive", "accounts");
  const [focus, setFocus] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState(""), [notice, setNotice] = useState<string | null>(null);
  const company = setupOf(game).company;
  const [assistant, setAssistant] = useState(false), [welcome, setWelcome] = useState(!company), [keysOpen, setKeysOpen] = useState(false);
  const keys = MODULES.some((m) => licenceMail(game, m.id) && !hasModule(game, m.id));

  const open = (id: string) => { setPages(pages.includes(id) ? pages : [...pages, id]); setActive(id); setFocus(null); };
  const close = (id: string) => {
    const left = pages.filter((p) => p !== id);
    setPages(left.length ? left : ["accounts"]);
    if (active === id) setActive(left[left.length - 1] ?? "accounts");
  };
  const go = (tab: string) => open(REPORT_OF[tab] ? `rep:${REPORT_OF[tab]}` : BIZ[tab] ? `biz:${tab}` : "accounts");
  const openAccount = (a: Account) => (a.go ? go(a.go) : open(`reg:${a.id}`));
  const run = (r: { ok: boolean }, done: string) => { if (r.ok) { setStatus(t(done)); setNotice(t(done)); } };

  useFocus("Books", (got) => {
    const f = got.kind === "url" ? got.inner : got;
    if (!f) return;
    if (f.kind === "register") return setKeysOpen(true);
    if (f.kind === "setup" || f.kind === "guide") return open("guide");
    const to = f.kind === "invoice" ? "invoices" : f.kind === "customer" || f.kind === "newCustomer" ? "customers" : f.kind === "quote" ? "quotes" : f.kind === "payable" ? "payables" : null;
    if (!to) return;
    open(`biz:${to}`);
    setFocus(f.kind === "newCustomer" ? `${NEW}${f.id}` : f.id);
  });

  const title = (p: string) => p === "accounts" ? t("gc.page.accounts") : p === "guide" ? t("gc.i.contents")
    : p.startsWith("reg:") ? accounts.find((a) => a.id === p.slice(4))?.label ?? "" : p.startsWith("rep:") ? t(`gc.r.${p.slice(4)}`) : t(BIZ[p.slice(4)].label);
  const item = (id: string, label: string, fn: () => void, off = false) => ({ id, label, run: fn, off });
  const menus: MenuDef[] = [
    { id: "file", label: t("gc.m.file"), items: [
      item("new", t("gc.i.newFile"), () => setAssistant(true)),
      item("backup", t("gc.i.backup"), () => run(act(backupBooks), "gc.done.backup")),
      ...(waiting ? [item("import", t("gc.i.import"), () => run(act(importFromShop), "gc.status.saved"))] : []),
      ...(keys ? [item("keys", t("gc.i.keys"), () => setKeysOpen(true))] : []),
      item("close", t("gc.i.close"), () => close(active)),
    ] },
    { id: "edit", label: t("gc.m.edit"), items: [
      item("openAccount", t("gc.i.openAccount"), () => { const a = accounts.find((x) => x.id === selected); if (a) openAccount(a); }, !selected),
    ] },
    { id: "view", label: t("gc.m.view"), items: [item("tree", t("gc.i.accountsPage"), () => open("accounts"))] },
    { id: "actions", label: t("gc.m.actions"), items: [
      item("opening", t("gc.i.opening"), () => run(act(enterOpening), "gc.done.opening")),
      item("reconcile", t("gc.i.reconcile"), () => open("biz:bank")),
      item("post", t("gc.i.post"), () => { const a = accounts.find((x) => x.id === selected); open(a && !a.go ? `reg:${a.id}` : "reg:bank"); }),
    ] },
    { id: "business", label: t("gc.m.business"), items: ["customers", "invoices", "quotes", "payables"]
      .filter((b) => b !== "quotes" || (v && sells(v, "quotes"))).map((b) => item(b, t(BIZ[b].label), () => open(`biz:${b}`))) },
    { id: "reports", label: t("gc.m.reports"), items: REPORTS.map((r) => item(r, t(`gc.r.${r}`), () => open(`rep:${r}`))) },
    { id: "tools", label: t("gc.m.tools"), items: [item("bank", t("gc.i.bankSetup"), () => run(act(linkBooksBank), "gc.done.bank"))] },
    { id: "windows", label: t("gc.m.windows"), items: look === "g1" ? [] : pages.map((p) => item(p, title(p), () => setActive(p))) },
    { id: "help", label: t("gc.m.help"), items: [item("contents", t("gc.i.contents"), () => open("guide"))] },
  ];

  const bank = accounts.find((a) => a.id === "bank")!;
  const current = pages.includes(active) ? active : "accounts";
  const Biz = current.startsWith("biz:") ? BIZ[current.slice(4)].body : null;
  const reg = current.startsWith("reg:") ? accounts.find((a) => a.id === current.slice(4)) : undefined;
  const tool = (icon: Parameters<typeof GcIcon>[0]["id"], label: string, fn: () => void, off = false) =>
    <button key={icon} disabled={off} onClick={fn}><GcIcon id={icon} /><span>{label}</span></button>;
  return (
    <div className={`books gc gc-${look}`} aria-label={t("gc.titlebar", { file: company ? t("gc.file.name") : t("gc.file.untitled"), page: title(current) })}>
      <MenuBar menus={menus} />
      <div className="gc-toolbar" role="toolbar">
        {tool("save", t("gc.tool.save"), () => run(act(backupBooks), "gc.done.backup"))}
        {tool("new", t("gc.tool.new"), () => setAssistant(true))}
        {tool("open", t("gc.tool.open"), () => { const a = accounts.find((x) => x.id === selected); if (a) openAccount(a); }, !selected)}
        {tool("close", t("gc.tool.close"), () => close(current))}
        {tool("reconcile", t("gc.tool.reconcile"), () => open("biz:bank"))}
      </div>
      <div className="gc-tabs" role="tablist">
        {pages.map((p) => (
          <span key={p} role="tab" className="gc-tab" aria-selected={p === current}>
            <button className="gc-tab-name" onClick={() => setActive(p)}>{title(p)}</button>
            {look !== "g1" && p !== "accounts" && <button className="gc-tab-x" aria-label={t("gc.tool.close")} onClick={() => close(p)}><X /></button>}
          </span>
        ))}
      </div>
      <div className="gc-page" role="tabpanel">
        {current === "accounts" ? <Tree selected={selected} select={setSelected} open={openAccount} />
          : reg ? <Ledger key={reg.id} a={reg} say={setStatus} />
          : current.startsWith("rep:") ? <Report kind={current.slice(4) as ReportKind} />
          : current === "guide" ? <div className="gc-scroll gc-sheet"><InstallGuide go={go} canGo={(tab) => !!BIZ[tab] || !!REPORT_OF[tab]} /></div>
          : Biz ? <div className="gc-scroll gc-embed"><Biz key={`${current}:${focus}`} focus={focus} go={go} /></div> : null}
      </div>
      <div className="gc-status"><span>{status || t("gc.status.ready")}</span><span className="num">{t("gc.status.total", { amount: money(bank.kind, bank.balance) })}</span></div>
      {welcome && !assistant && (
        <div className="gc-modal">
          <div className="gc-dialog" role="dialog" aria-label={t("gc.welcome.title")}>
            <div className="gc-dtitle">{t("gc.welcome.title")}</div>
            <div className="gc-choices">
              <button onClick={() => { setWelcome(false); setAssistant(true); }}>{t("gc.welcome.new")}</button>
              <button onClick={() => { setWelcome(false); open("guide"); }}>{t("gc.welcome.tutorial")}</button>
            </div>
          </div>
        </div>
      )}
      {assistant && <NewFile onCancel={() => setAssistant(false)} onApply={(c) => { const r = act(createBooksCompany, c); if (r.ok) { setAssistant(false); setWelcome(false); open("accounts"); run(r, "gc.done.company"); } }} />}
      {notice && (
        <div className="gc-modal">
          <div className="gc-dialog" role="alertdialog" aria-label={notice}>
            <div className="gc-dtitle">GnuCache</div>
            <p className="gc-note">{notice}</p>
            <div className="gc-buttons"><button className="gc-default" autoFocus onClick={() => setNotice(null)}>{t("gc.btn.ok")}</button></div>
          </div>
        </div>
      )}
      {keysOpen && keys && <div className="gc-modal"><div className="gc-dialog"><KeyRegister onClose={() => setKeysOpen(false)} /></div></div>}
    </div>
  );
}
