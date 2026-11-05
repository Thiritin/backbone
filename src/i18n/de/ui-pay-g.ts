import type { Dict } from "../lang";

export default {
  "payG.methodNow": (p) => `Zahlungsart geändert: ${p.method}`,
} satisfies Dict;
