// GDD, Racks, hardware and cabling (Switched PDUs). A rack with a switched PDU lets the player cut or cycle the power of every device in it.
import { modelById } from "../10-catalog/hardware";
import type { Device, GameState } from "../50-state";
import { working } from "./status";

export const hasPdu = (s: GameState, rackId: string): boolean => s.devices.some((d) => d.rackId === rackId && modelById(d.model).kind === "pdu");

// The PDU that powers this device: one in its rack that is up, never the device itself.
export const pduOf = (s: GameState, d: Device): Device | undefined =>
  d.rackId ? s.devices.find((x) => x.id !== d.id && x.rackId === d.rackId && modelById(x.model).kind === "pdu" && working(s, x.id)) : undefined;
