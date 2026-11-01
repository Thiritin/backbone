import type { Dict } from "../lang";

export default {
  "dataFlow.uninstall": () => "Disinstalla",
  "dataFlow.needsProgram": () => "Installa un programma di contabilità per creare clienti e fatture.",
  "dataFlow.import": () => "Importa",
  "dataFlow.file": () => "File",
  "dataFlow.created": () => "Creato",
  "dataFlow.imported": () => "Importato",
  "dataFlow.noFiles": () => "Nessun file da importare.",
  "dataFlow.exportShop": () => "Esporta clienti e fatture",
  "dataFlow.downloadStatement": () => "Scarica estratto conto",
  "dataFlow.saved": (p) => `Salvato come ${p.name}`,
  "dataFlow.csv.head": () => "tipo;numero;nome;data;importo",
  "dataFlow.csv.customer": () => "cliente",
  "dataFlow.csv.invoice": () => "fattura",
  "error.noShop": () => "Nessun sistema di shop configurato.",
  "error.noBankAccount": () => "L'azienda non ha un conto bancario.",
  "error.nothingToExport": () => "Niente di nuovo dall'ultimo file.",
  "error.fileImported": () => "Questo file è già importato.",
} satisfies Dict;
