import type { Dict } from "../lang";

export default {
  "registrarForm.ns": (p) => `Nameserver ${p.n}`,
  "registrarForm.authCode": () => "Codice di autorizzazione",
  "registrarForm.customer": () => "Scheda cliente",
  "registrarForm.submitted": () => "Inviato",
  "error.ownerMismatch": () => "Il titolare non corrisponde alla scheda cliente.",
  "error.ownerField": (p) => `${p.field} non coincide: account "${p.account}", registrar "${p.registrar}".`,
  "error.authCode": () => "Il codice di autorizzazione è errato.",
} satisfies Dict;
