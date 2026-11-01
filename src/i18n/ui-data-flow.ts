import type { Dict } from "./lang";

// Programs without a bookkeeping program, exports and imports as files, the yearly tax return (billing-by-hand 9e).
export default {
  "dataFlow.uninstall": () => "Uninstall",
  "dataFlow.needsProgram": () => "Install a bookkeeping program to create customers and invoices.",
  "dataFlow.import": () => "Import",
  "dataFlow.file": () => "File",
  "dataFlow.created": () => "Created",
  "dataFlow.imported": () => "Imported",
  "dataFlow.noFiles": () => "No files to import.",
  "dataFlow.exportShop": () => "Export customers and invoices",
  "dataFlow.downloadStatement": () => "Download statement",
  "dataFlow.saved": (p) => `Saved as ${p.name}`,
  "dataFlow.csv.head": () => "type;number;name;date;amount",
  "dataFlow.csv.customer": () => "customer",
  "dataFlow.csv.invoice": () => "invoice",
  "error.noShop": () => "No shop system is set up.",
  "error.noBankAccount": () => "The company has no bank account.",
  "error.nothingToExport": () => "Nothing new since the last file.",
  "error.fileImported": () => "This file is already imported.",
} satisfies Dict;
