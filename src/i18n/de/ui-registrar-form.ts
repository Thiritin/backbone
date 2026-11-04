import type { Dict } from "../lang";

export default {
  "registrarForm.ns": (p) => `Nameserver ${p.n}`,
  "registrarForm.authCode": () => "Auth-Code",
  "registrarForm.customer": () => "Kundendaten",
  "registrarForm.submitted": () => "Abgeschickt",
  "error.ownerMismatch": () => "Der Inhaber stimmt nicht mit den Kundendaten überein.",
  "error.ownerField": (p) => `${p.field} weicht ab: Konto "${p.account}", Registrar "${p.registrar}".`,
  "error.authCode": () => "Der Auth-Code ist falsch.",
} satisfies Dict;
