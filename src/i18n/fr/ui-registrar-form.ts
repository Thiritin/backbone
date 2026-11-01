import type { Dict } from "../lang";

export default {
  "registrarForm.ns": (p) => `Serveur de noms ${p.n}`,
  "registrarForm.authCode": () => "Code d'autorisation",
  "registrarForm.customer": () => "Fiche client",
  "registrarForm.submitted": () => "Envoyé",
  "error.ownerMismatch": () => "Le titulaire ne correspond pas à la fiche client.",
  "error.authCode": () => "Le code d'autorisation est faux.",
} satisfies Dict;
