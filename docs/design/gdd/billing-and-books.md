# Billing and books

Every contract is invoiced monthly for the hours it ran, domains and certificates yearly, and some customers don't pay. Chasing them is a manual job until bookkeepers and accountants take it over.

**Starting money.** A new game starts with no cash and €3,500 of savings, which arrive as the first booking when the player opens the bank account, enough for the first server and a little more, so the first loan from the bank pays for the second server. A level-1 company can borrow up to €10,000 from day one.

**Invoices and dunning.** Invoices go out automatically on the first of each month. Some customers pay late and a few never pay. When a dunning step is due, a button appears in the Billing app, and clicking it sends the notice (starting values, to tune):

1. **Payment reminder**, 7 days after the due date. Friendly, no fee.
2. **First dunning notice (Mahnung)**, after 14 days, with a fee.
3. **Final notice**, after 28 days. The customer's service is suspended, which creates tickets.
4. **Collections**, after 42 days. The debt goes to a collection agency for a fraction of its value, and the customer is gone.

Payment habits differ by segment. Private individuals forget most often, and enterprises pay slowly but always pay.

**Bookkeepers and accountants.** Bookkeepers record payments and send reminders. Accountants handle the later dunning steps, collections and month-end reports. Each works at their own rate, so a growing customer base needs a growing team.

**Books reports.** The bookkeeping program holds the account statement and, depending on its edition, an Overview with cash, monthly recurring revenue, last month's profit and runway, Statistics with profit and loss, cash flow and customers per month, and Tax. An entry the edition lacks stays disabled and opens the vendor's upgrade page.

**Bookkeeping programs.** Each program has its own strengths and gaps (`docs/design/plans/books-vendors.md`, Programs). Expenses always land in the books by themselves, and every program writes and sends invoices; without the monthly run each draft is sent by hand, and without matching by reference each payment is matched by hand. HBCI unlocks Pay all. GnuCache is free with reports and quotes, Kontomix includes HBCI in every edition, and Taxware sells HBCI as an add-on in its shop for any edition, kept until the company changes program.

**Account statement.** Books lists every booking on the company account: date, counterparty, description, category and amount, with the running balance. Filters narrow it by category (customer payments, hardware, rent, power, transit, salaries, loans, tax) and by month.

**Loans.** The Loans page on the bank's website holds the loans. Your running loans appear in a table with the remaining balance, monthly instalment, instalments left and a Repay button. Below it, offers appear: you pick a term (1, 2, 3, 5 or 10 years), and each card shows a preset amount up to your limit, plus one for the whole remaining limit, with its interest rate, monthly instalment, total interest and a Take loan button. The rate and the limit depend on your company level and repayment history, and missed repayments add penalties.

**Tax.** Corporate tax takes 30% of the previous calendar year's profit on 1 April, and a loss carries forward against later profits. Profit is read from the ledger: loan principal is left out, interest and missed-payment fees count as costs, and hardware counts as a cost in the year it is bought.

**Bankruptcy.** When cash stays below zero for 30 days and the bank lends nothing that would bring it back to zero (loans are blocked, or the remaining loan limit is below the deficit), the company is insolvent and the game ends. A sheet offers a new game or loading an export. A notification warns when cash first drops below zero.

**Suspension.** You can suspend a customer's services over an unpaid invoice. A suspended customer usually pays within days, because their site or server is down, but they open a ticket and lose happiness, and some leave instead. Nobody chases an invoice unless you or a rule do it, so a customer who stops paying keeps using the service for free until someone notices. The Billing app shows how much is owed by customers who are still being served.

**Suspension by customer.** Suspension hits customers differently. Low- and medium-budget customers grumble and pay, or leave per their payment habit. High-budget customers (offices, online shops and enterprises) run their business on the services, so going offline costs them twice the happiness and they pay much faster. Often they first write a suspension appeal: they forgot to pay, the manager who signs invoices is on vacation, nobody has access to the payment details, or the money is already on its way. The appeal ticket offers two actions. Unsuspend brings the services back online at once with a 7-day payment extension; most pay within it, and if the extension runs out unpaid, the suspend rule takes the services offline again, this time without a second appeal. Keep suspended leaves them offline and costs more happiness. A reply that says the services return once the payment arrives settles the appeals of customers who are paying anyway.

**Fraud and chargebacks.** Some orders are paid with stolen cards or accounts, most often for VPS and dedicated servers, which fraudsters use for spam, scanning and later crypto mining. The fraudster pays on time and draws abuse reports and notices like a shady customer, until the card holder disputes the payments a month or two later: the payment provider PayPail takes the money back with a fee and the customer is gone. Too many chargebacks bring a warning from PayPail and then higher fees. The setting Review server orders by hand catches most fraud on server orders, at the cost of staff time, slower setups even with order automation, and a few honest customers turned away. From 2008 the skill Fraud screening adds the setting Screen orders with MaxMined: a scoring service checks every standard order as it arrives for a small fee per check, declines most fraud and very few honest orders, and needs no staff time; manual review then only sees the orders it let through (economy/fraud-and-chargebacks.md, Fraud and chargebacks).

**Rules and automation.** The Billing sidebar has a Rules entry that holds the billing rules, each set with a switch or a segmented control. Rules say what should happen; bookkeepers and accountants trained on the task carry them out in their work hours, and every action takes time from their day ([Time per action](../economy/billing-and-payment-habits.md)). Bookkeepers send reminders, accountants send dunning and final notices, hand debts to collections and suspend services. With nobody on billing, the rules wait and you act by hand. The Rules page names who carries them out. After the Automation research the entry is called Automation and the rules run by themselves, day and night, without staff time. Renaming the entry was chosen over a switch on the Rules page, since nobody would turn automation back off.

- **Send reminders**: the reminder, dunning and final notices go out on schedule.
- **Suspend services after**: Off, 7, 14 or 30 days overdue. Services come back as soon as the invoice is paid.
- **Send to collections after**: Off, 42, 60 or 90 days overdue, once the final notice has gone out. Off by default, so collections stays a manual step until you turn it on.

**Customers as a CRM.** The Customers app is the hub for everything about a customer: a searchable, filterable list, and for each customer a full-page dashboard in the spirit of a hosting control panel's client summary. The list gives way to the dashboard, and a back control returns to it. The header carries the name, status, monthly value, open balance, customer since and happiness; tabs below it hold the Summary (contact, figures, services at a glance, recent invoices and tickets), Services (one card per service with its resources, price, billing, SLA, term and location, and the price change), Invoices, Tickets and Activity. The contact email is drawn on the customer's own domain when one of their services is a domain, otherwise on one named after them. Every item links to the app that handles it (Billing, Support, the virtual machine manager).
