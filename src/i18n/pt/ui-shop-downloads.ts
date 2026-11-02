import type { Dict } from "../lang";

export default {
  "shop-downloads.download": () => "Transferir",
  "shop-downloads.file": () => "Ficheiro",
  "shop-downloads.size": () => "Tamanho",
  "shop-downloads.mb": (p) => `${p.mb} MB`,
  "shop-downloads.licenceNeeded": () => "É necessária uma licença válida para transferir.",
  "shop-downloads.upload": () => "Carregue o arquivo no seu espaço web e extraia-o no Gestor de ficheiros para a pasta do subdomínio do portal.",
  "shop-downloads.database": () => "Crie uma base de dados MySQL com um utilizador.",
  "shop-downloads.installer": (p) => `Abra ${p.url} e siga o instalador.`,
  "shop-downloads.activate": (p) => `Ativar ${p.name}`,
} satisfies Dict;
