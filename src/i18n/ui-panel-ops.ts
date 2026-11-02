import type { Dict } from "./lang";

// Web panel services and components: action errors and the ledger line of a module fee.
export default {
  "error.restarting": () => "This service is restarting.",
  "error.componentUnavailable": () => "This panel does not offer this component.",
  "error.componentInstalled": () => "This component is already installed.",
  "ledger.panelModule": (p) => `${p.module} on ${p.host}`,
} satisfies Dict;
