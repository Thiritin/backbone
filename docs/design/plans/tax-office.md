# Plan: tax office, VAT and DOHLE

The company pays VAT and income tax by filing returns itself. Today `46-finance/finance.ts` books a flat tax every April on its own and VAT does not exist. After this plan the tax office (Finanzamt) assigns a tax number by letter, the player files advance VAT returns and a yearly return through DOHLE (pun on ELSTER, the jackdaw being the magpie's cousin), and a missed deadline costs a surcharge and then an estimate that is always too high. Letters use the Post app and its bills (`docs/design/plans/company-paperwork.md`). The bookkeeping programs from `docs/design/plans/billing-by-hand.md` file for the player once they are connected to the DOHLE account; the tax advisor lane (9f there) stays a later step.

## 1. Decisions

- Prices are gross, as they are for private customers in Germany. A sale of €6 holds €6 × r / (1 + r) of VAT. The company keeps the rest. VAT payments book in the ledger category `vat`, which counts against profit, so a small business that charges no VAT keeps more of the same price.
- Input VAT is reclaimed on purchases in the categories hardware, rent, power, transit, licenses, subscriptions, marketing, maintenance, domains, leasing, moving and ai. Salaries, insurance, loans, capital, credit, payments, fees, tax and vat carry none.
- The tax office writes only by letter. DOHLE answers by email and letter like a real portal.
- Filing books the payment at once (a refund when input VAT is larger). A tax assessment arrives as a letter with a bill, which lands in the payables like any paper bill.
- The flat April booking goes. Income tax is owed only once the yearly return is filed or the office estimates it.
- The tax rate stays `TAX_RATE` for every legal form.

## 2. Tax number

1. Two working days after the trade office confirms the registration, the tax office sends the questionnaire for tax registration (Fragebogen zur steuerlichen Erfassung) by letter.
2. The letter's link opens `www.dohle.de/erfassung/`. The page asks for the expected revenue of the first year and whether the company uses the small business rule (Kleinunternehmerregelung, §19 UStG). The page shows the revenue limit of the year.
3. Five working days after sending, the tax office sends the tax number (Steuernummer, shown as `045 812 34567`, built from the seed) by letter, with the VAT period for the year.
4. Without a tax number nothing can be filed, and every return is late from its due date as usual.
5. Old saves that registered before this plan get a tax number on load, with the standard rule and the monthly period.
6. The page refuses the small business rule when the expected revenue is above the year's limit. The letter's link is an Open button in the Post app.

## 3. VAT

| Item | Rule |
|---|---|
| Rate | 16% to 2006, 19% from 1 January 2007, 16% from 1 July to 31 December 2020 |
| Small business limit | Prior year's revenue at most €17,500 (to 2019), €22,000 (2020 to 2024), €25,000 (from 2025) |
| Period in the registration year and the next calendar year | Monthly |
| Period after that, from the prior year's VAT | Monthly above €6,136 (€7,500 from 2009, €9,000 from 2025), quarterly above €512 (€1,000 from 2009, €2,000 from 2025), else only the yearly return |
| Due | The 10th of the month after the period |
| Late filing surcharge (Verspätungszuschlag) | 5% of the period's payable, at least €25, by letter with a bill, the day after the due date |
| Estimate (Schätzung) | One month after the due date, 1.5 times the real payable, at least €100, booked as a bill. A later filing replaces it and books the difference |

- On 1 January the office checks the small business rule: a company whose prior year revenue was above the limit loses it and gets a letter. Leaving the rule early is a choice on DOHLE that binds for five years, as it does in reality.
- A small business files no advance returns, charges no VAT and reclaims none.
- The advance return shows output VAT, input VAT and the payable for the period, taken from the ledger.
- Customer income in the ledger is the categories payments (customer payments and transfers, net of refunds and chargebacks), setup (setup fees) and sales (used hardware and app updates). All three carry output VAT and make up the revenue the small business limit reads.
- The surcharge is non-deductible and books in the category `tax`, which profit ignores; an estimate books in `vat`. An open estimate bill is withdrawn when the return is filed, and a paid part counts toward the return.
- A period letter goes out on 1 January when the year's period differs from last year's. Leaving the small business rule has no way back in the game, which covers the five years.

## 4. Yearly return

- Due 31 May of the next year, 31 July for the years 2018 on. It covers the income tax (or corporate tax for a limited company) and, for a company that charges VAT, the yearly VAT return, which matches the advances.
- In March the tax office sends a reminder letter.
- Filing sends the profit from `taxFor`. Ten working days later the assessment (Steuerbescheid) arrives with a bill due in 30 days. A loss carries forward as today.
- Late filing costs 0.25% of the assessed tax for each month started, at least €25 a month, billed with the assessment.
- Two months after the due date the office estimates 1.3 times the real tax and bills it. Filing before the year ends replaces the estimate with the real assessment and books the difference.
- The estimate is at least €100, like the VAT estimate, so a loss year is estimated too. "Before the year ends" is read as the end of the calendar year after the tax year; after that the estimate stands and filing is refused with `error.taxYearClosed`.
- A yearly return opens on 1 January for every year the company was registered in. Filing it files the year's open advance returns and books the rest of the year's VAT, so the yearly VAT return always matches. The assessment lists the tax, the late fee and the credit for a paid estimate; when the credit is larger, the refund books at once.
- The Books Tax tab (editions with the tax view) shows the open returns in place of the April tax card. The Finance app moved into Books before this phase landed.

## 5. Filing routes

| Route | Years | What it needs |
|---|---|---|
| DohleFormular | 2005 to 2012 | Downloaded from `www.dohle.de/download/` and installed as an app on the dock. It sends with the certificate file. |
| Mein DOHLE | from 2013 | The same forms on `www.dohle.de`, logged in with the certificate file. DohleFormular refuses to start from 2013 and points to the portal. |
| Bookkeeping program | when its edition has the tax view | Connect DOHLE once in Books by picking the certificate file. From then on Books files the advance return in its monthly run and offers Submit tax return, which needs every invoice of the year present and a matched statement (billing-by-hand 9e). |

- The Tax tab and Connect DOHLE come with the editions that have the tax view (billing-by-hand 9d).
- On the first of the month at nine, when the monthly run sends the drafts, Books files every advance return whose period has ended.
- Submit tax return sits on the yearly return's row in the Books Tax tab. "Every invoice of the year present" means no invoice issued in the year is still waiting for an import from the shop, and "a matched statement" means no transfer of the year is unmatched. Submitting then files like DohleFormular, with the same tax number, certificate and closing checks.

- From 1 January 2013 the site's Downloads tab becomes Mein DOHLE at `www.dohle.de/mein/`, and the download page is gone. Logging in picks the certificate file from the desktop and lasts while the page stays open. An installed DohleFormular stays on the dock and opens to a notice with a button to the portal.

## 6. Certificate

1. Registering on `www.dohle.de/registrieren/` needs the tax number and the company's email address.
2. The activation ID comes by email at once. The activation code comes by letter after two working days, with a random third day on one in three registrations.
3. Entering both on the site puts `dohle-zertifikat.pfx` on the desktop as a document.
4. Every filing route reads that file from the desktop. A route that finds no file refuses with `error.dohleCert`.
5. A deleted certificate cannot be recovered. The site's Lost certificate link starts a new registration, which revokes the old one, breaks the Books connection and sends a new code by letter.
6. The company's email address is the address customers write to (the free mailbox, or sales@ on the own domain). Every registration revokes the certificate before it, so the Lost certificate link opens the same form.

## 7. Phases

Each phase is one pull request with a seeded test, i18n keys in every language and a CHANGELOG bullet.

1. `tax-number`: the tax office as an institution, the questionnaire letter and page, the small business choice, the tax number letter, `s.tax` with its default in `newGame` and the fill in `deserialize`. `tests/tax-number.test.ts`.
2. `vat`: rates, periods, due dates, the return records in `s.tax`, the January check, the surcharge and estimate letters. `tests/vat.test.ts`.
3. `dohle`: the dohle.de site, registration, the activation letter, the certificate document and its loss, DohleFormular as an app that files the advance VAT return. `tests/dohle.test.ts`.
4. `income-tax`: the yearly return in DohleFormular, the assessment letter, the late fee and the estimate. The April booking goes, and the Finance and Books views show the open returns. `tests/income-tax.test.ts`.
5. `books-dohle`: Connect DOHLE in Books, filing from the monthly run and Submit tax return. `tests/books-dohle.test.ts`.
6. `mein-dohle`: the portal from 2013 and DohleFormular's retirement.

The numbers above go into `docs/design/economy.md` (Bank, insurance and tax) in phase 2.
