// docs/design/plans/billing-by-hand.md, 9e: without Shop link or HBCI the data travels as files on the desktop. The shop
// exports its customers and invoices, the bank its statement, and the bookkeeping program imports each file once.
import { t } from "../../i18n/en";
import { dateOf } from "../00-core/time";
import { bankById } from "../10-catalog/banks";
import { invoiceTotal, inBooks, type Transfer } from "../45-billing/billing";
import { hbci } from "../46-finance/bank";
import type { DataFile, Doc, GameState } from "../50-state";
import { importShop, resolvePayouts } from "./shoplink";

const pad = (n: number) => String(n).padStart(2, "0");
const day = (hour: number) => dateOf(hour).toISOString().slice(0, 10);
const money = (v: number) => v.toFixed(2).replace(".", ",");

export const filesOf = (s: GameState, kind: DataFile["kind"]): Doc[] => s.docs.filter((d) => d.file?.kind === kind);
const carried = (s: GameState, kind: DataFile["kind"]) => new Set(filesOf(s, kind).flatMap((d) => d.file!.ids));

// shop-export-2005-10.csv, with -2 and on for a second file of the month.
export function fileName(s: GameState, base: string, ext: string): string {
  const d = dateOf(s.hour), stem = `${base}-${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
  for (let n = 1; ; n++) {
    const name = `${stem}${n > 1 ? `-${n}` : ""}.${ext}`;
    if (!s.docs.some((x) => x.title === name)) return name;
  }
}

// The shop's records Books does not hold yet and no file on the desktop carries.
export function shopExportIds(s: GameState): string[] {
  const done = carried(s, "shop");
  return [...s.customers, ...s.invoices].filter((x) => x.synced === false && !done.has(x.id)).map((x) => x.id);
}

export function shopCsv(s: GameState, ids: string[]): string {
  const want = new Set(ids), name = (id: string) => s.customers.find((c) => c.id === id)?.name ?? "";
  const rows = [
    ...s.customers.filter((c) => want.has(c.id)).map((c) => [t("dataFlow.csv.customer"), c.id, c.name, "", ""]),
    ...s.invoices.filter((i) => want.has(i.id)).map((i) => [t("dataFlow.csv.invoice"), i.number, name(i.customerId), day(i.issuedAt), money(invoiceTotal(i))]),
  ];
  return [t("dataFlow.csv.head"), ...rows.map((r) => r.join(";"))].join("\n");
}

// Transfers only the bank has and no statement file on the desktop carries.
export function statementIds(s: GameState): string[] {
  const done = carried(s, "statement");
  return s.transfers.filter((x) => !inBooks(x) && !done.has(x.id)).map((x) => x.id);
}

// The statement as MT940: account, then a :61: booking line and a :86: purpose line per transfer.
export function statementMt940(s: GameState, ids: string[]): string {
  const want = new Set(ids), b = s.bank!, line = (tr: Transfer) => {
    const d = dateOf(tr.hour), date = `${String(d.getUTCFullYear()).slice(2)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
    return [`:61:${date}${tr.amount < 0 ? "D" : "C"}${money(Math.abs(tr.amount))}NTRFNONREF`, `:86:${tr.from} ${t(tr.reference, tr.params)}`];
  };
  return [":20:STARTUMS", `:25:${bankById(b.id)!.code}/${b.number}`, ":28C:00001", ...s.transfers.filter((x) => want.has(x.id)).flatMap(line), "-"].join("\n");
}

// Takes the file's records into Books; the caller marks the file imported.
export function importData(s: GameState, f: DataFile): void {
  const ids = new Set(f.ids);
  if (f.kind === "shop") return importShop(s, ids);
  s.transfers = s.transfers.map((x) => (ids.has(x.id) && x.atBank ? { ...x, atBank: undefined } : x));
  resolvePayouts(s);
}

// Hourly: with HBCI the bookkeeping program pulls every new transfer from the bank itself. Before the company has a bank
// account there is no statement to download, and transfers go straight in.
export function pullStatement(s: GameState): void {
  if (!s.books.vendor || !s.transfers.some((x) => x.atBank) || (s.bank && !hbci(s))) return;
  s.transfers = s.transfers.map((x) => (x.atBank ? { ...x, atBank: undefined } : x));
  resolvePayouts(s);
}
