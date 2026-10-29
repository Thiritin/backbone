type Params = Record<string, string | number>;

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const clock = (h: unknown) => `${String(h).padStart(2, "0")}:00`;
const when = (p: Params) => `${DAYS[Number(p.weekday)]} ${p.date} ${MONTHS[Number(p.month)]} from ${clock(p.from)} to ${clock(p.to)}`;
const name = (p: Params) => p.hostname || p.service;

// Planned maintenance: the notice emails, the customers' answers, the events and the errors (gdd.md, Support).
export const MAINTENANCE_EN: Record<string, (p: Params) => string> = {
  "ticket.maintenance.notice.subject": (p) => `Planned maintenance on ${name(p)}`,
  "ticket.maintenance.notice.text": (p) => `We will carry out maintenance on ${DAYS[Number(p.weekday)]} ${p.date} ${MONTHS[Number(p.month)]}. ${name(p)} will be unavailable from ${clock(p.from)} to ${clock(p.to)} (${p.hours} hours).`,
  "ticket.maintenance.moved.subject": (p) => `Maintenance on ${name(p)} rescheduled`,
  "ticket.maintenance.moved.text": (p) => `The planned maintenance moved. ${name(p)} will now be unavailable ${when(p)} (${p.hours} hours).`,
  "ticket.maintenance.move.subject": (p) => `Maintenance window for ${name(p)}`,
  "ticket.maintenance.move.text": () => "That is a busy time for us. Could you do the maintenance at night instead?",
  "ticket.maintenance.declined.subject": (p) => `Maintenance window for ${name(p)}`,
  "ticket.maintenance.declined.text": () => "That is a bad night for us. We do not agree to this window.",
  "event.maintenanceStart.title": () => "Maintenance started",
  "event.maintenanceStart.text": (p) => `The ${p.hours} hour maintenance window on ${p.where} has begun.`,
  "event.maintenanceEnd.title": () => "Maintenance window ended",
  "event.maintenanceEnd.text": (p) => `The maintenance window on ${p.where} is over.`,
  "error.maintenanceTarget": () => "This cannot be planned for maintenance.",
  "error.maintenanceStart": () => "The window must start in the future.",
  "error.maintenanceHours": () => "The window needs a length.",
  "error.unknownMaintenance": () => "This maintenance window is not planned.",
};
