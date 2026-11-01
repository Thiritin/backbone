import type { Dict } from "../lang";

export default {
  "dataFlow.uninstall": () => "Désinstaller",
  "dataFlow.needsProgram": () => "Installe un logiciel de comptabilité pour créer des clients et des factures.",
  "dataFlow.import": () => "Importer",
  "dataFlow.file": () => "Fichier",
  "dataFlow.created": () => "Créé",
  "dataFlow.imported": () => "Importé",
  "dataFlow.noFiles": () => "Aucun fichier à importer.",
  "dataFlow.exportShop": () => "Exporter clients et factures",
  "dataFlow.downloadStatement": () => "Télécharger le relevé",
  "dataFlow.saved": (p) => `Enregistré sous ${p.name}`,
  "dataFlow.csv.head": () => "type;numéro;nom;date;montant",
  "dataFlow.csv.customer": () => "client",
  "dataFlow.csv.invoice": () => "facture",
  "error.noShop": () => "Aucun système de boutique n'est configuré.",
  "error.noBankAccount": () => "L'entreprise n'a pas de compte bancaire.",
  "error.nothingToExport": () => "Rien de nouveau depuis le dernier fichier.",
  "error.fileImported": () => "Ce fichier est déjà importé.",
} satisfies Dict;
