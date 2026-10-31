import type { Dict } from "../lang";

export default {
  "error.jobLimit": () => "Un cluster peut avoir au plus 4 tâches de sauvegarde.",
  "error.unknownJob": () => "Cette tâche de sauvegarde n'existe pas.",
} satisfies Dict;
