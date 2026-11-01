// docs/design/plans/billing-by-hand.md, 9e: exports land as files on the desktop, the bookkeeping program imports them.
import type { DataFile, GameState } from "../50-state";
import { fileName, importData, shopCsv, shopExportIds, statementIds, statementMt940 } from "../80-business/dataflow";
import { freeSpot } from "./docs";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

function write(s: GameState, kind: DataFile["kind"], title: string, body: string, ids: string[]): ActionResult {
  const id = `file${s.nextId++}`;
  s.docs = [...s.docs, { id, kind: "file", title, body, ...freeSpot(s), file: { kind, at: s.hour, ids, imported: [] } }];
  return { ok: true, id };
}

// The shop admin's Export customers and invoices: everything since the last export.
export function exportShop(s: GameState): ActionResult {
  if (!s.shop.variant) return fail("error.noShop");
  const ids = shopExportIds(s);
  if (!ids.length) return fail("error.nothingToExport");
  return write(s, "shop", fileName(s, "shop-export", "csv"), shopCsv(s, ids), ids);
}

// The bank site's Download statement: the transfers since the last download.
export function downloadStatement(s: GameState): ActionResult {
  if (!s.bank) return fail("error.noBankAccount");
  const ids = statementIds(s);
  if (!ids.length) return fail("error.nothingToExport");
  return write(s, "statement", fileName(s, "statement", "sta"), statementMt940(s, ids), ids);
}

// Books' Import: a file goes into each bookkeeping program once.
export function importFile(s: GameState, docId: string): ActionResult {
  const doc = s.docs.find((d) => d.id === docId), f = doc?.file, program = s.books.vendor;
  if (!program) return fail("error.notInstalled");
  if (!doc || !f) return fail("error.unknownDoc");
  if (f.imported.includes(program)) return fail("error.fileImported");
  importData(s, f);
  doc.file = { ...f, imported: [...f.imported, program] };
  return { ok: true };
}
