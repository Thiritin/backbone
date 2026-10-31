import type { Dict } from "../lang";

export default {
  "error.jobLimit": () => "Um cluster pode ter no máximo 4 tarefas de backup.",
  "error.unknownJob": () => "Esta tarefa de backup não existe.",
} satisfies Dict;
