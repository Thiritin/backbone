import type { Dict } from "../lang";

export default {
  "error.unknownOs": () => "Esse sistema operacional não existe.",
  "error.otherMedia": () => "O suporte de instalação contém outro sistema operacional.",
  "error.noImage": () => "Descarrega primeiro a ISO deste sistema operacional a partir do respetivo site.",
  "error.stickIn": () => "A pen USB já está ligada a este servidor.",
  "error.stickAway": () => "Desliga primeiro a pen USB do servidor.",
  "error.stickOut": () => "A pen USB não está ligada.",
  "error.stickInstalling": () => "O servidor está a instalar a partir da pen USB.",
  "ipmi.log.stickIn": () => "Pen USB ligada",
  "error.noOs": () => "Instala primeiro um sistema operacional nesta máquina.",
  "error.osNotUp": () => "O sistema operacional da máquina não está a correr.",
  "error.noUpgrade": () => "Ainda não saiu uma versão mais recente deste sistema operacional.",
  "error.notVmwhere": () => "A App Suite é vendida para clusters VMwhere.",
  "error.noAppSuite": () => "Este cluster não tem App Suite.",
  "error.hasAppSuite": () => "Este cluster já tem a App Suite.",
  "error.noDownload": () => "O instalador não conseguiu descarregar o pacote.",
} satisfies Dict;
