import type { Dict } from "../lang";

export default {
  "error.jobLimit": () => "Ein Cluster kann höchstens 4 Backup-Jobs haben.",
  "error.unknownJob": () => "Diesen Backup-Job gibt es nicht.",
} satisfies Dict;
