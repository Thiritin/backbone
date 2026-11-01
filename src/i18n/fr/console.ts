import type { Dict } from "../lang";

export default {
  "error.unknownOs": () => "Ce système d'exploitation n'existe pas.",
  "error.otherMedia": () => "Le support d'installation contient un autre système d'exploitation.",
  "error.badHostname": () => "Un nom d'hôte se compose de minuscules, de chiffres et de tirets, 63 caractères au plus.",
  "error.hostnameTaken": () => "Une autre machine porte déjà ce nom d'hôte.",
  "error.noImage": () => "Télécharge d'abord l'ISO de ce système d'exploitation depuis son site web.",
  "error.stickIn": () => "La clé USB est déjà branchée sur ce serveur.",
  "error.stickAway": () => "Débranche d'abord la clé USB du serveur.",
  "error.stickOut": () => "La clé USB n'est pas branchée.",
  "error.stickInstalling": () => "Le serveur s'installe depuis la clé USB.",
  "ipmi.log.stickIn": () => "Clé USB branchée",
  "error.noOs": () => "Installe d'abord un système d'exploitation sur cette machine.",
  "error.osNotUp": () => "Le système d'exploitation de la machine ne tourne pas.",
  "error.noUpgrade": () => "Aucune version plus récente de ce système d'exploitation n'est encore sortie.",
  "error.notVmwhere": () => "L'App Suite est vendue pour les clusters VMwhere.",
  "error.noAppSuite": () => "Ce cluster n'a pas d'App Suite.",
  "error.hasAppSuite": () => "Ce cluster a déjà l'App Suite.",
  "error.noDownload": () => "L'installateur n'a pas pu télécharger le paquet.",
  "error.noMirror": () => "Le miroir de l'archive Debiant indiqué est injoignable.",
} satisfies Dict;
