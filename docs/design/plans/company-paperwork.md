# Company paperwork and the post

The company's legal form only moves up: sole trader, then partnership, then limited company. Each step is paperwork on the desktop, and the answers come back as letters in the Post app. Paper bills land in the payables next to the emailed supplier invoices.

## Letters

- A letter has a sender, a subject and body by text key, the hour it lands, a read flag, and optionally a bill and a legal form.
- Letters land with the morning post at 10:00 on the working day a given number of working days after they were sent. Weekends do not count.
- A letter with a bill files it as a payable when it lands. The bill goes by paper only, so no invoice email is sent; a supplier with a direct debit mandate still debits it.
- A letter with a legal form changes the company's form when it lands.
- The Post app joins the dock with the first letter. Its dock tile counts unread letters. A bill letter carries a Pay button that opens the bank's transfer form.

## Institutions

| Role | Name in the game | Contact |
|---|---|---|
| Trade office | Gewerbeamt | eservice@trade-office.gov |
| Notary | Dr. Ilse Stempel | kanzlei@stempel-notary.de |
| Commercial register (Handelsregister) | Handelsregistrar | by letter only |
| Chamber of commerce (IHK) | IHQ | by letter only |

The Yahoy! Directory lists the trade office under Government.

## Flow

1. The player registers the business in the trade office eService (GA-1, the Gewerbeanmeldung). Registration is always as a sole trader, so the eService shows the legal form as fixed and `registerCompany` refuses any other form with `error.registerSole`. Saves that registered as a partnership or limited company before this rule keep their form. Two working days later the trade office confirms by letter with its fee.
2. The trade office site's Forms page lists the application for each higher legal form that is open to the company, whom to send it to and what it costs, and states that a change of legal form is final.
3. Download puts the form on the desktop as a PDF document. Opening it shows the filled form with a signature line; one click signs it with the owner's name.
4. The player writes a new email in the Email app, addressed to the trade office (partnership) or the notary (limited company), with the signed form attached.
5. The recipient answers at once by email. A missing attachment, an unsigned form, the wrong office or missing share capital each get their own answer and nothing is filed. Any other address bounces.
6. A partnership: the trade office confirms by letter three working days later, with its fee. The form changes when that letter lands.
7. A limited company: the notary confirms it files within three working days and bills its fee by letter two working days later. The register's entry letter lands thirteen working days after sending, and the form changes then. The register's invoice follows three working days later.
8. No downgrade exists. Every path that would lower the form, including a stale form on the desktop, is refused with `error.legalFormDown`. While a change waits for its letter, no second application is taken (`error.changePending`).
9. A bank that opens no account for the target form refuses the change (`error.bankForm`); netbunk has no limited company account.
10. A limited company needs the Company law training in Research (company track, tier 1, 100 know-how, 10 days, no prerequisites). Until it is learned, the Forms page does not list the limited company and every path to it is refused with `error.companyLaw`. A partnership needs no training.

## Numbers

Real-world anchors (Germany) and the game values:

| Item | Real world | Game |
|---|---|---|
| Gewerbeanmeldung (GewA1) | 20 to 60 EUR | 26 EUR |
| Gewerbeummeldung (GewA2) | 20 to 40 EUR | 30 EUR |
| Notary, GmbH articles and filing | 300 to 800 EUR | 650 EUR |
| Commercial register entry, invoiced by the local court after entry | about 150 EUR | 150 EUR |
| GmbH share capital | 25,000 EUR | 25,000 EUR in the company account |
| Register entry time | 1 to 3 weeks | 13 working days after sending |

The share capital is checked, never charged: the notary files only while the company account holds at least 25,000 EUR. The money stays the company's.

## Chamber of commerce

Membership is mandatory for every registered business. The chamber bills its basic fee once per calendar year by letter, ten working days after the first check of the year, starting in the year of registration. The tier uses the employee count when the bill is written; a company in the commercial register pays the higher row.

| Employees | Trader (sole, partnership) | Register-entered (limited) |
|---|---|---|
| 0 to 2 | 40 EUR | 150 EUR |
| 3 to 9 | 90 EUR | 300 EUR |
| 10 to 49 | 250 EUR | 700 EUR |
| 50 or more | 600 EUR | 1,600 EUR |

## Code

- `src/sim/40-support/letters.ts`: letters, the morning post and arrival.
- `src/sim/80-business/paperwork.ts`: institutions, fees, tiers, `applyError`, the filing and the yearly chamber bill.
- `src/sim/90-actions/docs.ts`: `downloadForm`, `signForm`. `src/sim/90-actions/paperwork.ts`: `sendMail`, `readLetter`.
- UI: the office site's Forms page, `FormDoc` in the Notes window, `Compose` in the Email app, the Post app.
