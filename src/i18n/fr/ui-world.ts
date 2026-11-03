import type { Dict } from "../lang";

export default {
  "world.standUp": () => "Se lever",
  "world.room": () => "Pièce",
  "world.obj.pc": () => "Ordinateur",
  "world.obj.desk": () => "Bureau",
  "world.obj.scanner": () => "Scanner",
  "world.obj.door": () => "Porte",
  "world.obj.letterbox": () => "Boîte aux lettres",
  "world.obj.shelf": () => "Étagère de stockage",
  "world.obj.fusebox": () => "Boîte à fusibles",
  "world.obj.fan": () => "Ventilateur de fenêtre",
  "world.obj.xconnect": () => "Panneau de cross-connect",
  "world.obj.cooling": () => "Unité de climatisation",
  "world.obj.pdu": () => "PDU",
  "world.obj.extinguisher": () => "Extincteur",
  "world.obj.noc": () => "Poste NOC",
  "world.obj.dock": () => "Quai de chargement",
  "world.inHands": () => "Dans tes mains",
  "world.pickUp": () => "Prendre",
  "world.obj.parcels": (p) => `${p.n} colis`,
} satisfies Dict;
