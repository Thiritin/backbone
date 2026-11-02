import type { Dict } from "./lang";

export default {
  "apps.about.DocuWhere": () => "Files every letter from the post in an archive you can search and sort by document type.",
  "dms.archive": () => "Archive",
  "dms.all": () => "All documents",
  "dms.inbox": () => "Inbox",
  "dms.docType": () => "Document type",
  "dms.search": () => "Search",
  "dms.date": () => "Date",
  "dms.sender": () => "Sender",
  "dms.subject": () => "Subject",
  "dms.none": () => "No documents",
  "dms.type.contract": () => "Contract",
  "dms.type.invoice": () => "Invoice",
  "dms.type.official": () => "Official letter",
  "dms.type.registration": () => "Registration",
  "dms.type.other": () => "Other",
  "shop.inc.DocuWhere.0": () => "Archive of every letter",
  "shop.inc.DocuWhere.1": () => "Search in sender, subject and text",
  "shop.inc.DocuWhere.2": () => "Document types with counts",
  "error.unknownDocType": () => "This document type does not exist.",
} satisfies Dict;
