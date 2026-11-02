# Bank and tax

A level-1 company borrows at about 10% interest and a level-6 company at about 4.5%. Profit is taxed at 30% once the yearly return is filed, and a company that stays out of cash for 30 days goes bankrupt.

**Loan interest** is the year's base rate plus a risk premium for the company level. Base rates follow these keyframes, with straight lines between them:

| Year | | 2009 | 2015 | 2021 | 2023 | 2026 |
| --- | --- | --- | --- | --- | --- | --- |
| Base rate | 4.0% | 2.5% | 1.0% | 1.0% | 4.5% | 4.0% |

| Level | Risk premium | Minimum loan limit |
| --- | --- | --- |
| 1 | 6.0% | €10,000 |
| 2 | 4.0% | €25,000 |
| 3 | 3.0% | €100,000 |
| 4 | 2.0% | €500,000 |
| 5 | 1.0% | €3,000,000 |
| 6 | 0.5% | €20,000,000 |

The loan limit is the higher of the level's minimum and 12× the average monthly gross profit of the last 6 months. Loans run 1 to 10 years and are repaid in equal monthly instalments.

**Missed repayments.** Each one adds 2 points to the loan's rate, costs a €100 fee and blocks new loans for 12 months. After three in a row the bank calls in the whole loan.

**Bankruptcy.** When cash stays below zero for 30 days and no loan is available that covers the deficit, the company is insolvent and the game ends.

**Account plans.** Each bank sells account plans, and the account fee a month is the plan's (docs/design/plans/bank-plans.md). A dearer plan makes each booking cheaper, and the top plans include the credit card. A booking is any ledger line of the month except the bank's own fees. Each month start books last month's bookings above the plan's free ones, then the plan's fee for the new month. A plan change takes effect at that month start. A limited company pays the plan's fee times the bank's limited factor, which is the ratio of its old limited fee to its old partnership fee. A legal form needs a plan that serves it, so the player moves up a plan before the paperwork, and a limited company application also needs the share capital of €25,000 in the account, without the overdraft.

| Plan | Serves | Fee a month | Free bookings | Per booking | Card |
| --- | --- | --- | --- | --- | --- |
| Giro | sole trader | the old sole fee | all | none | yearly fee |
| Business | all forms | the old partnership fee | 20 | the old booking fee | yearly fee |
| Business Plus | all forms | 2× Business | 100 | 1/3 of Business | included |
| Premium | partnership, limited | 4× Business | all | none | included, double limit |

| Bank | Plans | Giro | Business | Per booking | Limited factor | Loan margin | Smallest loan |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Sparklasse | all four | €8 | €12 | €0.30 | 4/3 | +0.5 | €2,500 |
| Folksbank | all four | €6 | €9 | €0.25 | 4/3 | +0.5 | €2,500 |
| Deutsche Bunk | no Giro | | €18 | €0.15 | 4/3 | 0 | €50,000 |
| Postbanq | all four | €4 | €6 | €0.40 | 4/3 | +1.5 | €2,500 |
| Ding-DiBa | Giro, Business for sole traders and partnerships | €0 | €5 | none | | +1.0 | no loans |
| Fidorr | Fidorr Start (Business), Fidorr Pro (Business Plus) | | €6 | none | 2 | +2.0 | €2,500 |
| Quonto | Quonto Essential (Business), Quonto Smart (Business Plus) | | €15 | none | 5/3 | +1.5 | no loans |

The loan margin in points is added to the base rate and the risk premium, and the rate is fixed when the loan is signed.

**Switching banks.** Opening an account at another bank moves the whole balance. The old account pays its last fee at the next month start and closes. Switching is refused while a loan is open or the account is overdrawn. Standing orders, mandates and the card stay behind, and the card's open spending is billed at once. Customers who pay an invoice issued before the switch still reach the company for three months; after that the transfer bounces and the invoice stays unpaid.

**VAT.** Prices are gross, as for private customers: a sale of a holds a × r / (1 + r) of VAT. The rate r is 16% to 2006, 19% from 1 January 2007, and 16% from 1 July to 31 December 2020. Output VAT comes from customer payments, setup fees and sales; input VAT comes back on hardware, rent, power, transit, licenses, subscriptions, marketing, maintenance, domains, leasing, moving and AI. Salaries, loans, capital, fees and taxes carry none. VAT payments book in the category `vat`, which counts against profit, so a small business that charges no VAT keeps more of the same price.

| Item | Rule |
|---|---|
| Small business limit (prior year's revenue) | €17,500 to 2019, €22,000 from 2020 to 2024, €25,000 from 2025 |
| Advance return period | Monthly in the registration year and the next; after that monthly above €6,136 of last year's VAT (€7,500 from 2009, €9,000 from 2025), quarterly above €512 (€1,000 from 2009, €2,000 from 2025), else only the yearly return |
| Due | The 10th of the month after the period |
| Late filing surcharge | 5% of the period's payable, at least €25, billed by letter the next working day after the due date |
| Estimate | One month after the due date, 1.5 × the real payable, at least €100, billed by letter; a later filing withdraws its open bill and books the payable less what was already paid |

A small business files no advance returns, charges no VAT and reclaims none. On 1 January a small business whose revenue last year was above the year's limit loses the rule by letter.

**Tax.** Income tax (corporate tax for a limited company) takes 30% of each year's profit once the yearly return is filed, and losses carry forward to later years. Taxable profit is the year's ledger without loan principal and taxes; instalments count only their interest, VAT payments count as a cost, and hardware is a cost in the year it is bought.

| Item | Rule |
|---|---|
| Yearly return due | 31 May of the next year, 31 July for the years from 2018; the tax office reminds in March |
| Assessment | 10 working days after filing, by letter with a bill due in 30 days; a refund books at once |
| Late fee | 0.25% of the assessed tax for each month started after the due date, at least €25 a month, billed with the assessment |
| Estimate | Two months after the due date, 1.3 × the real tax, at least €100; filing before the end of the following year replaces it and settles the difference |
