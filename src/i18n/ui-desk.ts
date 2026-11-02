import type { Dict } from "./lang";

// The desk's domain records page: the records to add at the registrar, their state and Verify.
export default {
  "desk.records.title": () => "Domain records",
  "desk.records.type": () => "Type",
  "desk.records.name": () => "Name",
  "desk.records.value": () => "Value",
  "desk.records.status": () => "Status",
  "desk.records.ok": () => "Active",
  "desk.records.missing": () => "Not found",
  "desk.records.noAddress": () => "No public address",
  "desk.records.copy": () => "Copy",
  "desk.records.copied": () => "Copied",
  "desk.records.verify": () => "Verify",
  "desk.records.verified": () => "Verified",
  "desk.records.dns": () => "Open DNS settings",
  "error.deskRecords": () => "Some records were not found.",
} satisfies Dict;
