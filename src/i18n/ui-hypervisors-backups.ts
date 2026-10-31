import type { Dict } from "./lang";

export default {
  "error.jobLimit": () => "A cluster can have at most 4 backup jobs.",
  "error.unknownJob": () => "This backup job does not exist.",
} satisfies Dict;
