import type { Dict } from "./lang";

// The room the player looks at and acts on.
export default {
  "world.standUp": () => "Stand up",
  "world.room": () => "Room",
  "world.obj.pc": () => "Computer",
  "world.obj.desk": () => "Desk",
  "world.obj.scanner": () => "Scanner",
  "world.obj.door": () => "Door",
  "world.obj.letterbox": () => "Letterbox",
  "world.obj.shelf": () => "Storage shelf",
  "world.obj.fusebox": () => "Fuse box",
  "world.obj.fan": () => "Window fan",
  "world.obj.xconnect": () => "Cross-connect panel",
  "world.obj.cooling": () => "Cooling unit",
  "world.obj.pdu": () => "PDU",
  "world.obj.extinguisher": () => "Fire extinguisher",
  "world.obj.noc": () => "NOC desk",
  "world.obj.dock": () => "Loading dock",
  "world.obj.stairs": () => "Stairwell",
  "world.inHands": () => "In your hands",
  "world.pickUp": () => "Pick up",
  "world.obj.parcels": (p) => `${p.n} parcels`,
  "world.cableInHand": () => "Cable in hand",
  "world.toRack": () => "To another rack",
  "world.dropCable": () => "Drop cable",
} satisfies Dict;
