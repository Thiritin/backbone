import type { Dict } from "../lang";

export default {
  "error.unknownOs": () => "No existe ese sistema operativo.",
  "error.otherMedia": () => "El medio de instalación contiene otro sistema operativo.",
  "error.badHostname": () => "Un nombre de host usa minúsculas, dígitos y guiones, hasta 63 caracteres.",
  "error.hostnameTaken": () => "Otra máquina ya tiene este nombre de host.",
  "error.noImage": () => "Descarga primero la ISO de este sistema operativo desde su sitio web.",
  "error.stickIn": () => "La memoria USB ya está conectada a este servidor.",
  "error.stickAway": () => "Desconecta primero la memoria USB del servidor.",
  "error.stickOut": () => "La memoria USB no está conectada.",
  "error.stickInstalling": () => "El servidor se está instalando desde la memoria USB.",
  "ipmi.log.stickIn": () => "Memoria USB conectada",
  "error.noOs": () => "Instala primero un sistema operativo en esta máquina.",
  "error.osNotUp": () => "El sistema operativo de la máquina no se está ejecutando.",
  "error.noUpgrade": () => "Aún no ha salido una versión más reciente de este sistema operativo.",
  "error.notVmwhere": () => "La App Suite se vende para clústeres VMwhere.",
  "error.noAppSuite": () => "Este clúster no tiene App Suite.",
  "error.hasAppSuite": () => "Este clúster ya tiene la App Suite.",
  "error.noDownload": () => "El instalador no pudo descargar el paquete.",
  "error.noMirror": () => "No se puede acceder a la réplica del archivo de Debiant indicada.",
} satisfies Dict;
