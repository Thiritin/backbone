import type { Dict } from "./lang";

export default {
  "registrarForm.ns": (p) => `Nameserver ${p.n}`,
  "registrarForm.authCode": () => "Auth code",
  "registrarForm.customer": () => "Customer record",
  "registrarForm.submitted": () => "Submitted",
  "error.ownerMismatch": () => "The owner does not match the customer record.",
  "error.authCode": () => "The auth code is wrong.",
} satisfies Dict;
