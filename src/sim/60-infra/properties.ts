import { dateOf } from "../00-core/time";
import { DESKS_PER_SECTION, holdsDesks, nocSeats } from "../20-world/properties";
import { onShift, type Employee } from "../47-staff/staff";
import { BASEMENT_ADDRESS, type GameState, type PostalAddress, type Property, type Section } from "../50-state";

export type Desk = NonNullable<Employee["desk"]>;

const ready = (s: GameState, x: Section) => x.refitUntil <= s.hour;
const deskSections = (s: GameState, p: Property) => p.sections.filter((x) => holdsDesks(x.fit) && ready(s, x));

// The office: the latest rented or bought property with a desk section, else the basement.
export const officeOf = (s: GameState): Property | undefined =>
  [...s.properties].reverse().find((p) => p.kind !== "basement" && p.sections.some((x) => holdsDesks(x.fit))) ?? s.properties.find((p) => p.kind === "basement");

export const officeAddress = (s: GameState): PostalAddress => {
  const { street, zip, city } = officeOf(s)?.building ?? BASEMENT_ADDRESS;
  return { street, zip, city };
};

export const addressLine = (a: PostalAddress): string => `${a.street}, ${a.zip} ${a.city}`;

export const desks = (s: GameState): number => s.properties.reduce((n, p) => n + deskSections(s, p).length * DESKS_PER_SECTION + nocSeats(p).length, 0);

// The first unused desk: office desks first, then NOC seats; with a property, only that property's NOC seats.
export function freeDesk(s: GameState, hallOf?: string): Desk | null {
  const used = new Set(s.staff.flatMap((e) => (e.desk ? [`${e.desk.propertyId}/${e.desk.sectionId}/${e.desk.index}`] : [])));
  if (!hallOf)
    for (const p of s.properties)
      for (const x of deskSections(s, p))
        for (let index = 0; index < DESKS_PER_SECTION; index++) if (!used.has(`${p.id}/${x.id}/${index}`)) return { propertyId: p.id, sectionId: x.id, index };
  for (const p of s.properties) if (!hallOf || p.id === hallOf) { const d = nocSeats(p).find((q) => !used.has(`${q.propertyId}/${q.sectionId}/${q.index}`)); if (d) return d; }
  return null;
}

// Staff at their desks: weekdays 9 to 18, technicians away while a job keeps them at another location.
export const officeOpen = (hour: number): boolean => {
  const d = dateOf(hour), day = d.getUTCDay(), h = d.getUTCHours();
  return day > 0 && day < 6 && h >= 9 && h < 18;
};

export function whoIsIn(s: GameState, propertyId: string, hour: number): Employee[] {
  if (!officeOpen(hour)) return [];
  const home = s.properties.find((p) => p.id === propertyId)?.locationId ?? null;
  return s.staff.filter((e) => e.desk?.propertyId === propertyId && onShift(s, e, hour) && !(e.role === "technician" && e.busyUntil > hour && e.location !== home));
}

// Technicians of a location who are on shift now.
export const shiftTechs = (s: GameState, locationId: string): Employee[] => s.staff.filter((e) => e.role === "technician" && e.location === locationId && onShift(s, e, s.hour));
