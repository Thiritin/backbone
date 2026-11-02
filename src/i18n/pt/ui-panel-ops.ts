import type { Dict } from "../lang";

export default {
  "error.restarting": () => "Este serviço está a reiniciar.",
  "error.componentUnavailable": () => "Este painel não oferece este componente.",
  "error.componentInstalled": () => "Este componente já está instalado.",
  "ledger.panelModule": (p) => `${p.module} em ${p.host}`,
} satisfies Dict;
