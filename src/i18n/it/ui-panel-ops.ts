import type { Dict } from "../lang";

export default {
  "error.restarting": () => "Questo servizio si sta riavviando.",
  "error.componentUnavailable": () => "Questo pannello non offre questo componente.",
  "error.componentInstalled": () => "Questo componente è già installato.",
  "ledger.panelModule": (p) => `${p.module} su ${p.host}`,
} satisfies Dict;
