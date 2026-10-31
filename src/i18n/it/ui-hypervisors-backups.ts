import type { Dict } from "../lang";

export default {
  "error.jobLimit": () => "Un cluster può avere al massimo 4 job di backup.",
  "error.unknownJob": () => "Questo job di backup non esiste.",
} satisfies Dict;
