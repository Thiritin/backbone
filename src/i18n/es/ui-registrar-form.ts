import type { Dict } from "../lang";

export default {
  "registrarForm.ns": (p) => `Servidor de nombres ${p.n}`,
  "registrarForm.authCode": () => "Código de autorización",
  "registrarForm.customer": () => "Ficha del cliente",
  "registrarForm.submitted": () => "Enviado",
  "error.ownerMismatch": () => "El titular no coincide con la ficha del cliente.",
  "error.authCode": () => "El código de autorización es incorrecto.",
} satisfies Dict;
