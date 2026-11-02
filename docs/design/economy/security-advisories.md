# Security advisories

Four scripted PHP vulnerabilities, modelled on real ones. Each fires on its date for a player with web sites on a cluster node running an affected version; a player without one never sees it.

| Date | Vulnerability | Affected versions |
| --- | --- | --- |
| 12 Mar 2007 | Zend engine memory corruption (Month of PHP Bugs) | 4.4, 5.1, 5.2 |
| 3 May 2012 | PHP-CGI query string options (CVE-2012-1823) | 5.1, 5.2, 5.3 |
| 22 Oct 2019 | PHP-FPM buffer underflow (CVE-2019-11043) | 7.1, 7.2, 7.3 |
| 7 Jun 2024 | PHP-CGI argument injection (CVE-2024-4577) | 8.1, 8.2, 8.3 |

| Stage | Hours after the announcement | Hourly chance an exposed node is compromised |
| --- | --- | --- |
| PHP announces it, patch date stated | 0 | 0 |
| Proof of concept on Twister | 24 | 1% |
| Agency warning (mass scanning) | 48 | 4% |
| Patch released | 60 | 4% for nodes still unpatched |

An exposed node runs an affected version without the patch, hosts web sites and has them online. A compromise:

| Effect | Value |
| --- | --- |
| Happiness of each customer with a site on the node (data leak) | −30 |
| Abuse report per such customer | 1 (spam) |
| Review | 1 star, written by 10% (20% below happiness 40) |
| Sites on the node | Down until cleaned up |
| Spam sent from the host's mail address | 12,000 a day through `addSpam`, as for any sender (Reputation) |
| Performance of the host's sites while compromised | 70% (the PHP upgrade slowdown) |
| Clean-up with a backup | 4 hours |
| Clean-up without a backup (rebuild) | 12 hours and −15 happiness |

Offline sites count as outages at the profile's hourly outage penalty (1 to 4). Taking a node offline at the warning and patching on release costs about 12 hours of outage, 12 to 48 happiness. Leaving it online from the proof of concept to the patch risks a compromise with 1 − 0.99²⁴ · 0.96¹² ≈ 52%, worth about −38 happiness with a backup and −69 without for a customer at penalty 2, plus reviews and support work. Going offline at the proof of concept costs 36 outage hours and rarely pays. Patching is the PHP upgrade: it installs the current version with the fix and slows the node's sites for an hour.

### Generated vulnerabilities

Every installed software has a `version`, the year of the release it runs, and `updatedAt`, the hour it was installed or last updated. A new install, and an update, set the version to the current year. A save from before versions gets the year its install finished when it is still installing and otherwise the save's year minus 2, updated at the save's hour.

Each software family releases one version a year. The vulnerabilities of a family's release in a year are drawn from the game's seed, the family and the year, so they are the same whenever they are looked up (Poisson count, mean by kind):

| Software | Vulnerabilities per year |
| --- | --- |
| Hosting panels | 2 |
| Hypervisors | 1 |
| Mail servers | 1 |
| Game panels | 1.5 |
| Customer CMS | 3 |

Game panels and customer CMS take effect with their own lanes.

| Severity | Share | Patch comes out | Daily chance of a compromise |
| --- | --- | --- | --- |
| Low | 50% | 0 to 14 days after disclosure | 0.05% |
| High | 35% | 0 to 14 days after disclosure | 0.25% |
| Critical | 15% | 0 to 3 days after disclosure | 1% |

With these chances a panel host that is never updated is first compromised after about a year and a half (median); the plan's first numbers were twice as high and hit within the first year.

Disclosure is a random day of the release's year. A vulnerability is open on an instance from its patch until the instance is updated, when the instance runs an older release than the vulnerability's year or the same release from before the patch. Exposure is counted in whole days from the patch, or from the last update when that is later, because before the patch nobody can update. The daily chance is multiplied by 2 from 30 days exposed and by 4 from 90 days exposed, and an instance rolls once a day with the highest chance among its open vulnerabilities.

| Rule | Value |
| --- | --- |
| Reached | A panel host with a web space online, a hypervisor with a customer virtual machine, the company's mail host; its control plane must be running |
| Compromise of a panel host | As in the table above: happiness, abuse reports, reviews, sites down, spam, clean-up |
| Compromise of a hypervisor | The same effects on its customers' virtual machines, which are down until clean-up |
| Compromise of a mail host | Spam from its address until clean-up |
| Banner at the patch (low and high) | Once per instance, only with Nagiosaurus installed |
| Alert at the patch (critical) | Once per instance |

An unattended panel host installed at the start of the game is compromised for the first time after a median of 0.8 years.

An operating system or software on a machine that runs past its vendor's end of security updates collects vulnerabilities of its own: each year past the end adds 0.5 to a multiplier on the daily compromise chance of the instances on that machine, counted up to 4 years per install (an install 4 years past the end triples the chance). The newest release of a product never counts as ended while it is the newest. The vendor emails 90 days before the end of security updates of every version the company runs.

### Breaches and ransom

A critical vulnerability that has been open on an instance for more than 30 days can turn the daily exploitation roll into a breach. When the roll hits an instance (the table above) and the instance has such a vulnerability open, 25% of the hits are breaches: the attackers steal the customer data on the host and the host is not compromised in the usual way (no clean-up, no spam). A host with a ransom still undecided cannot be breached again. The customers on a host are those with a workload on it; a mail host holds every customer's mailbox. The tick draws from the seed, the host and the day (the exploitation roll uses tag 91, the breach roll tag 92).

The breach opens an extortion ticket from the Lockbitt Crew. It is an alert, so the game pauses and the sheet opens the ticket in Support. The ticket says the data is offered for sale online and names the sum. The player pays or refuses within 72 hours; no decision by then counts as a refusal, and so does Ignore.

| Rule | Value |
| --- | --- |
| Demand | 2 months of the monthly revenue of the customers on the host, at least €500 and at most €50,000, then × 3 from 2013 and × 5 from 2020 |
| Paying | The demand is booked as `ledger.ransom` (category fees); in 10% of the draws the data is sold anyway, otherwise nothing further happens |
| Refusing | The data is sold |
| Customers on a sold host | −40 happiness, 30% cancel at once, 20% write a 1-star review (reason data loss) |
| Awareness | Falls by 20% in every customer profile (a multiplier of 0.8, so a low awareness cannot go below zero) |
| Press | A banner reports the breach |
| Fine | 30 days after a sale, drawn once (table below), booked as `ledger.fine` (category fees) |

| Sale date | Chance of a fine | Fine |
| --- | --- | --- |
| Before 25 May 2018 | 20% | €2,000 to €25,000, log-uniform |
| From 25 May 2018 | 50% | 2% of the last twelve months of customer payments and setup fees, at least €2,000 and at most €200,000 |

The Security app lists every breach in a Breaches card: date, host, ransom, decision and outcome (open, data kept, or sold with the fine pending, none or its sum).

Anchors. Symantec's 2016 Internet Security Threat Report puts the average ransom at USD 679 (up from USD 294 in 2015). Small-business ransoms ran from USD 500 to USD 50,000 in 2016, which gives the bounds before the multipliers. NetDiligence's SME claims data has a median demand near USD 12,000 in 2017 to 2020, and Coalition reports an average demand of about USD 1.2 million for its insured firms in 2021, so the 2020 multiplier of 5 on a demand capped at €50,000 reaches €250,000 for a large host and stays well below that average. A paid ransom is no guarantee, which is why 10% of the payments still end in a sale. Fines: the old German Federal Data Protection Act (BDSG) allowed up to €300,000 and authorities used it rarely, hence 20% and a range far below the cap. The GDPR applies from 25 May 2018 with up to 2% or 4% of annual turnover; the first large fine was €9.55 million against 1&1 Telecom in 2019, so a small company pays the 2% of its own turnover with a floor and a ceiling. The 25% breach share, the 10% and the 30-day exposure are game choices: a patch that is a month old is long enough for the player to have reacted. Ledger category fees is new and holds both the ransom and the fine; no existing expense category fits them.

The balance bot never calls the tick, so its medians do not change; the exposure for a breach stays at 30 days.

### Updating software

An update installs this year's release at once and sets `updatedAt` to now. The customers on the software are down while it runs:

| Software | Downtime |
| --- | --- |
| Hosting panel | 30 minutes, for its web spaces |
| Game panel | 15 minutes, for its servers |
| Mail server | 15 minutes, no customers are affected |
| Hypervisor | 2 hours per node, for the virtual machines on it, none when the hypervisor moves virtual machines live and the cluster has a second node |

A technician at the server does the update in its office hour: panel and mail updates need panel training, hypervisor updates need server training.

Some software can update itself from a year on: cPanic from 2008, HyperVee from 2012 (cluster-aware updating), Pleskit from 2014, DirectAdmen from 2019 and VMwhere from 2020 (lifecycle manager). The player turns automatic updates on per cluster in its console or the Software menu; it is off by default. At 3:00 game time each night such a cluster runs any due update with the same downtime, and the News app announces the year each software gets it.

Nagiosaurus costs €15 a month in 2005 and rises 8% a year like the other Pear Store apps.

### Customer applications

Every web hosting service runs an app (`spec.app`): WordPass (WordPress), Joomlah (Joomla), Drupel (Drupal) or static HTML. It is drawn from the shares of the year the service starts, linear between the keyframes and flat from 2020; the share that is neither static nor WordPass splits Joomlah 3 : Drupel 1. Anchor: W3Techs measured WordPress on 13% of all websites in 2011 and 43% in 2022.

| Year | Static | WordPass | Joomlah | Drupel |
| --- | --- | --- | --- | --- |
| 2005 | 60% | 20% | 15% | 5% |
| 2010 | 35% | 40% | 18.75% | 6.25% |
| 2015 | 20% | 60% | 15% | 5% |
| 2020 and later | 15% | 70% | 11.25% | 3.75% |

Each service records `appVersion` (the release year it runs) and `appUpdatedAt` (the hour it was installed or last updated). The three apps have 3 vulnerabilities a year each, drawn like the company's software (`vulnsFor` with the app as the family, Generated vulnerabilities above), and a site is open to the patched ones the same way an instance is. A save from before customer apps draws the app from the service's start year and gets the release of two years before the save, or of its start year when that is later.

**Updating by themselves.** After a vulnerability for the app is patched, a customer updates by themselves with a chance by the skill of their profile, on a random day within 7 days of the patch. Updating installs this year's release, which closes every open vulnerability. Anchor: Sucuri found 61% of the hacked WordPress sites it cleaned in 2016 and 39% in 2017 outdated; WordPress 3.7 (2013) added automatic minor updates, so WordPass patches from 2013 use the second column.

| Skill | Before 2013 and other apps | WordPass from 2013 |
| --- | --- | --- |
| High | 80% | 95% |
| Medium | 40% | 70% |
| Low | 10% | 40% |

**Defacement.** A running site that is open rolls once a day with the daily chance of its worst open vulnerability (Generated vulnerabilities above, including the factors for 30 and 90 days exposed). A hit affects only that service:

| Effect | Value |
| --- | --- |
| Site | Shows as defaced; it stays online |
| Spam | 2,000 mails a day through `addSpam` on the host's address while defaced |
| Ticket | A how-to ticket from the customer, topic hacked |
| Clean-up by the player | `cleanSite`, 30 minutes of the player's time, from Monitoring or the ticket; resolves the ticket for +5 happiness |
| Clean-up by the customer | Medium and high skill: 50% clean it up themselves 1 to 3 days after the hit; low skill never |
| Third hack within 365 days | The customer cancels all services |

**Site clean-up.** Defaced sites are listed in the Security app under Advisories, and the notification opens it on the site. Each offers four actions; any clean-up ends an abuse hold on the site, so it comes back online and stops sending spam.

| Action | Effect |
| --- | --- |
| Restore backup | `cleanSite` above; needs a backup |
| Offer clean-up | The customer answers at once: accepts with 60% ÷ (player rate ÷ market rate), which books the price as a sales ledger line, takes the player that many hours and cleans the site; of those who decline, 25% × (player rate ÷ market rate) cancel all services. Offered once per hack |
| Remind | 3 minutes of the player's time. The customer cleans the site 1 to 3 days after the hit with 90%, 60% or 30% by high, medium or low skill, low skill included. Once per hack |
| Suspend for abuse | An abuse hold. The customer's ticket asks about the hack (how-to, topic abuseHold, the same actions as hacked) instead of an invoice |

The price is the web hosting `cleanHour` rate times the hours the site takes: 1, 2 or 4 by the customer's budget, like their order sizes. The market's hourly rate is €85 in 2026 with multiplier 0.6 (€51 in 2005), shown in Pricing beside the player's. Anchor: German web agencies bill €60 to €100 an hour for WordPress clean-up. The hacked and abuseHold tickets also offer paid clean-up as an action, decided the same way; a decline keeps the thread open.

**Notifying.** Notify customers, per app and vulnerability from Monitoring, writes to every site open to it that has not been written to yet: 30 minutes of the player's time per 10 customers. Of the customers who would not update by themselves, 50% answer with a how-to ticket, topic update. Each customer who asks has a fixed wish, drawn by their profile's budget:

| Budget | One-off update | Managed updates | Refuses |
| --- | --- | --- | --- |
| Low | 80% | 0% | 20% |
| Medium | 70% | 20% | 10% |
| High | 55% | 35% | 10% |

The ticket offers three actions, each 20 minutes of the player's time. The one-off offer succeeds with a customer who wants it, books the `updateOnce` price as a sales ledger line and updates the site. The managed offer succeeds with a customer who wants it, sets `spec.managedUpdates`, adds the `updates` price to the service's monthly price (the customer agreed to it, so it costs no happiness) and updates the site. An offer to a customer who wants something else is declined and the ticket stays open. Doing it free updates the site and gives +5 happiness. A support agent who works such a ticket updates the site for free. A site with managed updates is updated on the day of every patch.
