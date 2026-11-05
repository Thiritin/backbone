import type { Dict } from "../lang";

export default {
  "payG.methodNow": (p) => `Forma de pago cambiada a ${p.method}`,
} satisfies Dict;
