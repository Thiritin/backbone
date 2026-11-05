import type { Dict } from "../lang";

export default {
  "payG.methodNow": (p) => `Metodo di pagamento cambiato in ${p.method}`,
} satisfies Dict;
