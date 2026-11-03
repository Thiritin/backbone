import type { Dict } from "./lang";

// The room the player walks around in.
export default {
  "world.standUp": () => "Stand up",
  "world.room": () => "Room",
  "world.you": () => "You",
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
  "world.inHands": () => "In your hands",
  "world.obj.parcels": (p) => `${p.n} parcels`,
} satisfies Dict;
