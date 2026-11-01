# Tutorial

A new game starts with nothing but a browser and no money in the business. The player first opens a bank account, which brings in the savings, then registers the company at the trade office. The company does not exist until then, so Pear One holds back its business apps. These two steps teach the things every later step needs: the Browser, the bank site with its TANs, the Getting started guide and the time controls. After it, the dock fills with the starter apps and the guide carries on with the steps it already has.

## The empty desktop

The game opens paused on Saturday 1 January 2005 at 00:00. The dock holds only the Browser and the cash reads €0. The desktop shows the Getting started guide, and its first step reads "Open a business account on a bank's website in the Browser." Its Open button opens the Yahoy! directory, which lists the banks. The second step is the registration, and its Open button opens the Browser on the trade office page. The Browser also bookmarks that page until the company is registered.

## The bank account

Each bank's site shows its conditions under the login box with an Open account button while the company has no account. Opening one logs the player in and shows the account number and PIN once; the welcome email repeats them and the TAN list lands on the desktop. The account's first booking is a €3,500 transfer from the player's personal account with the reference "Savings", which the bank statement and Books both show. Books lists it with the incoming transfers, and it needs no invoice. A weekly challenge with less starting cash brings in smaller savings.

## The trade office

The page lives at `www.trade-office.gov/eservice/` and looks like a government site from 2005 that was last updated in 2003: a table layout at 760 pixels wide, Verdana at 11 pixels, a crest in a blue header, a grey left menu where most links lead to "under construction", a visitor counter, a "Best viewed with Internet Exploder 6 at 1024x768" footer and bevelled grey buttons. The form is a fieldset with red asterisks on the required fields.

The online service only answers during office hours, Monday to Friday from 08:00 to 16:00. Outside them the page shows the hours and nothing else. Since the game starts on a Saturday night, the first thing the player learns is to press play or fast-forward. At 08:00 on Monday the game posts a Browser notification that the trade office is open, which also stops "Skip to next event" there, so one click on Skip gets the player to the opening.

The form asks for the company name, the owner, the legal form (sole trader, partnership or limited company) and a declaration checkbox. The form also shows the €40 registration fee. Submitting it fills in the fee transfer to the trade office on the bank's site, and the player confirms it with a TAN. The confirmed transfer registers the company under that name at once, installs the starter apps in the dock and ticks the guide step. From then on the page shows the registration extract: the name, the legal form, a register number and the date.

A submit outside office hours fails with "The online service is closed." An empty owner or a bad company name fails with the same errors the Settings company fields use, and a company without a bank account cannot apply.

## Apps that arrive later

The registration installs Applications, Locations, Shop, Browser, Terminal, Support, Billing and Settings. Every other app arrives when its problem does, checked each morning at 09:00, with one email from Pear in Support and one News line:

| App | Arrives when |
| --- | --- |
| Finance | The first month ends, or cash falls below two months of running costs |
| Customers | The company has five customers |
| Marketing | The first server gets a hosting panel or a hypervisor |
| Security | The first abuse report or vulnerability arrives |
| Staff | More than ten customer tickets are open |
| Market | The first sale is lost |
| Research | The player opens the Pear Store in the Shop, seven days have passed, or Staff or Market was offered |

Staff and Market are paid Pear Store apps, so their email offers them and the player buys them in the Shop once Research has trained their skill. The others go straight into the dock. Each app arrives once. Getting started shows the steps of an app, such as Build your website for Marketing or Take a loan for Finance, only once that app is installed.

## Old saves

Saves from before the tutorial count as registered on the first hour, so they keep their dock and never see the trade office as a step. Apps a save already has count as arrived and send no email. A registered save keeps its bank account and cash as they are. A save that was started but not registered keeps its €3,500 back until the player opens an account, where it arrives as the Savings transfer.

## Next chapters

These are planned and not built. Each one gates a little more of the game behind a believable piece of paperwork, the same way registration gates the dock.

1. **Bank account.** Finance opens a business account with the register extract; until then, customers cannot pay invoices.
2. **Tax number.** The tax office sends a questionnaire by post a week after registration, and the first invoice needs the number it returns.
3. **Pear One activation.** The Pear Store asks for the register number before it sells the first feature expansion.
