import type { Dict } from "../lang";

export default {
  "error.restarting": () => "Dieser Dienst wird neu gestartet.",
  "error.componentUnavailable": () => "Dieses Panel bietet diese Komponente nicht an.",
  "error.componentInstalled": () => "Diese Komponente ist bereits installiert.",
  "ledger.panelModule": (p) => `${p.module} auf ${p.host}`,
} satisfies Dict;
