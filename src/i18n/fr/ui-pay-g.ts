import type { Dict } from "../lang";

export default {
  "payG.methodNow": (p) => `Moyen de paiement changé : ${p.method}`,
} satisfies Dict;
