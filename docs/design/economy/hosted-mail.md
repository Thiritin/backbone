# Hosted mail

Hosted Exchange by Ionose and Lookout 365 bill every open mailbox at the price of the plan, from the first month start after the order. Additional addresses are free. The rows are in `src/sim/10-catalog/mail-providers.ts`; the figures are game numbers, unverified against the real price lists.

### Ionose

The price per mailbox falls by 40 cents a year from 10 euro in 2005 and stops at 6 euro. Business costs a euro more and doubles the storage.

| Plan | Mailboxes | Price per mailbox | Storage from 2005 | 2009 | 2013 | 2016 |
| --- | --- | --- | --- | --- | --- | --- |
| Basic | 10 | max(6, 10 - 0.4 x (year - 2005)) | 500 MB | 2 GB | 10 GB | 50 GB |
| Business | 100 | Basic + 1 | 1 GB | 4 GB | 20 GB | 100 GB |

Each tenant has 10 additional addresses and a catch-all. Cancelled mailboxes close at the end of the month and are deleted with their mail 30 days later.
