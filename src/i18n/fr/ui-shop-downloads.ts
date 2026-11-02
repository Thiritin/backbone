import type { Dict } from "../lang";

export default {
  "shop-downloads.download": () => "Télécharger",
  "shop-downloads.file": () => "Fichier",
  "shop-downloads.size": () => "Taille",
  "shop-downloads.mb": (p) => `${p.mb} Mo`,
  "shop-downloads.licenceNeeded": () => "Une licence valide est requise pour le téléchargement.",
  "shop-downloads.upload": () => "Envoyez l'archive sur votre espace web et extrayez-la dans le Gestionnaire de fichiers, dans le dossier du sous-domaine du portail.",
  "shop-downloads.database": () => "Créez une base de données MySQL avec un utilisateur.",
  "shop-downloads.installer": (p) => `Ouvrez ${p.url} et suivez l'installateur.`,
  "shop-downloads.activate": (p) => `Activer ${p.name}`,
} satisfies Dict;
