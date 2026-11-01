# Bank plans

Each bank sells account plans. A dearer plan costs more a month and makes each booking cheaper, and the top plans include the card. Banks also lend at different rates. A legal form needs an account plan made for it, so moving up to a partnership or a limited company is a decision the player makes at the bank before the paperwork, and the bank never upgrades the account on its own.

## Today

- Seven banks in `src/sim/10-catalog/banks.ts`. Each has one fee a month per legal form (`monthly`), a booking fee for partnerships and limited companies, a yearly card fee, an overdraft rate and a loan limit factor.
- The company opens one account (`openBankAccount`) and can never switch. Ding-DiBa opens no account for a limited company, so a company that banks there can never become one.
- When the legal form changes, the account fee follows the new form without the player doing anything.
- `loanRate` is the base rate plus the level's risk premium. It is the same at every bank.
- The notary turns the limited company application down by mail when the cash is below the share capital of 25,000 euros.

## Plans

A bank row gets `plans` in place of `monthly` and `booking`. A plan has an id, a name, the legal forms it serves, a fee a month, free bookings a month, a fee per booking above them, and whether it includes the card.

| Plan | Serves | Fee a month | Free bookings | Per booking | Card |
|---|---|---|---|---|---|
| Giro | sole trader | the bank's sole fee today | all | 0 | yearly fee |
| Business | all forms | the bank's partnership fee today | 20 | the bank's booking fee today | yearly fee |
| Business Plus | all forms | 2x Business | 100 | 1/3 of Business | included |
| Premium | partnership, limited | 4x Business | all | 0 | included, 2x limit |

- The traditional banks (Sparklasse, Folksbank, Deutsche Bunk, Postbanq) sell all four plans. Deutsche Bunk sells no Giro plan.
- Ding-DiBa sells Giro and Business. Fidorr and Quonto sell Business and Business Plus with their own names.
- A booking is any transfer in or out of the account. A business with many small customers feels the booking fee, which is the reason to move up a plan.
- A limited company pays more on the same plan. Its fee a month is the Business fee times the ratio of the bank's limited fee to its partnership fee today.

## Choosing and changing

- The bank's site shows the plans on its account page and on the opening form. The player picks one when opening the account.
- The player can change the plan on the bank's site at any time. The new fee and booking rules start on the first of the next month, and the account page shows the pending change.
- A plan that does not serve the company's current form cannot be picked.

## Legal form needs the plan

- `applyError` returns `error.bankPlan` when the account's plan does not serve the form applied for. The office site and the notary form show it before the player signs anything.
- A limited company application also needs the share capital in the account. `applyError` returns `error.shareCapital` while the cash is below 25,000 euros, and the overdraft does not count. The notary's rejection mail stays for the case where the cash drops after the application was sent.
- Nothing changes the plan when the form changes, because the form can only change after the right plan is already in place.

## Switching banks

- The player can open an account at another bank on its site. Opening it moves the whole balance, closes the old account at the end of the month and pays its last fee.
- Switching is refused while a loan or overdraft at the old bank is open. The player pays them off first.
- Standing orders and mandates do not move. The new account page lists the ones the old account had, and the player sets them up again.
- Customers who pay to the old account number still arrive for three months. After that the transfer bounces and the invoice stays unpaid.

## Loan rates by bank

`loanRate` adds the bank's margin to the base rate and the level's risk premium. The rate is fixed when the loan is signed, as today.

| Bank | Margin | Smallest loan |
|---|---|---|
| Deutsche Bunk | 0 | 50,000 |
| Sparklasse | +0.5 | 2,500 |
| Folksbank | +0.5 | 2,500 |
| Postbanq | +1.5 | 2,500 |
| Ding-DiBa | +1.0 | 2,500 |
| Fidorr | +2.0 | 2,500 |
| Quonto | +1.5 | 2,500 |

The Bank app's loan form shows the rate of the company's own bank.

## Saves

- `newGame` opens no account, as today. Every account gets a `plan` field.
- `deserialize` gives an old account the cheapest plan of its bank that serves the company's current form. A Ding-DiBa account of a limited company in an old save keeps working on Business, since the save must load.

## Code

- `src/sim/10-catalog/banks.ts`: `plans` per bank, `margin`, helpers `planById`, `plansFor(bank, form)`. `monthlyFee` and `bookingFee` read the plan.
- `src/sim/46-finance/bank.ts`: `plan` and `planNext` on the account, free bookings counted per month, the card fee skipped on plans that include it.
- `src/sim/90-actions/bank.ts`: `setPlan`, `switchBank`. `openBankAccount` takes the plan.
- `src/sim/80-business/paperwork.ts`: `error.bankPlan` and `error.shareCapital` in `applyError`.
- `src/sim/45-billing/billing.ts`: the bank margin in `loanRate`.
- UI: the plan table on every bank site's opening form and account page, the switch on the opening form when an account exists, the rate on the loan form.
- `docs/design/economy.md`: the plan table and the margins.
- Tests: plan fees and free bookings over a month, the plan change on the first, `applyError` for plan and capital, switching with and without a loan, a payment to the old account in month two and month four, the margin in `loanRate`, an old save without `plan`.

## Open

- The plan numbers above are a first guess for `npm run balance` to check.
