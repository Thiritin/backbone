# Documents and inbox

Plan note, not built yet.

## Idea

Running a business leaves paper behind: the trade registration, the bank loan contract, hardware invoices, colocation contracts, tax letters. Today those events happen in the sim and vanish. The game should hand them to the player as documents.

## Inbox

Every document lands in the existing inbox, in one line with the mail that is already there. The inbox stays a flat timeline: newest on top, no folders, no search. That is the free baseline.

## Document management

**Documents** is a Pear Store app. Once installed it collects every document the inbox received into its own window and adds:

- Search across title, sender and type.
- Types the player assigns to each document (contract, invoice, letter, registration), with a filter per type.
- A list per type, so a bank contract or a datacenter lease can be found again months later.

The app costs money, like the other Pear Store apps, and search is the reason to buy it: without it the player scrolls the inbox.

## Open

- Which sim events produce a document first. Start with the trade registration, the bank loan and hardware orders, since they already exist.
- Whether old documents are generated for existing saves or only new events produce them.
