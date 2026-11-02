import type { Dict } from "../lang";

export default {
  "error.restarting": () => "Este servicio se está reiniciando.",
  "error.componentUnavailable": () => "Este panel no ofrece este componente.",
  "error.componentInstalled": () => "Este componente ya está instalado.",
  "ledger.panelModule": (p) => `${p.module} en ${p.host}`,
} satisfies Dict;
