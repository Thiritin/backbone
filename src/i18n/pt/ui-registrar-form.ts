import type { Dict } from "../lang";

export default {
  "registrarForm.ns": (p) => `Servidor de nomes ${p.n}`,
  "registrarForm.authCode": () => "Código de autorização",
  "registrarForm.customer": () => "Ficha do cliente",
  "registrarForm.submitted": () => "Enviado",
  "error.ownerMismatch": () => "O titular não corresponde à ficha do cliente.",
  "error.ownerField": (p) => `${p.field} difere: conta "${p.account}", registrador "${p.registrar}".`,
  "error.authCode": () => "O código de autorização está errado.",
} satisfies Dict;
