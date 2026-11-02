import type { Dict } from "../lang";

export default {
  "error.restarting": () => "Ce service redémarre.",
  "error.componentUnavailable": () => "Ce panneau ne propose pas ce composant.",
  "error.componentInstalled": () => "Ce composant est déjà installé.",
  "ledger.panelModule": (p) => `${p.module} sur ${p.host}`,
} satisfies Dict;
