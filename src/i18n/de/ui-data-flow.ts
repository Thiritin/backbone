import type { Dict } from "../lang";

export default {
  "dataFlow.uninstall": () => "Deinstallieren",
  "dataFlow.needsProgram": () => "Installiere ein Buchhaltungsprogramm, um Kunden und Rechnungen anzulegen.",
  "dataFlow.import": () => "Importieren",
  "dataFlow.file": () => "Datei",
  "dataFlow.created": () => "Erstellt",
  "dataFlow.imported": () => "Importiert",
  "dataFlow.noFiles": () => "Keine Dateien zum Importieren.",
  "dataFlow.exportShop": () => "Kunden und Rechnungen exportieren",
  "dataFlow.downloadStatement": () => "Kontoauszug herunterladen",
  "dataFlow.saved": (p) => `Gespeichert als ${p.name}`,
  "dataFlow.csv.head": () => "typ;nummer;name;datum;betrag",
  "dataFlow.csv.customer": () => "kunde",
  "dataFlow.csv.invoice": () => "rechnung",
  "error.noShop": () => "Es ist kein Shopsystem eingerichtet.",
  "error.noBankAccount": () => "Die Firma hat kein Bankkonto.",
  "error.nothingToExport": () => "Seit der letzten Datei gibt es nichts Neues.",
  "error.fileImported": () => "Diese Datei ist schon importiert.",
} satisfies Dict;
