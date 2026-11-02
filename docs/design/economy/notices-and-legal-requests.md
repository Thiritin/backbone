# Notices and legal requests

Rates per active customer per month (decisions):

| Event | Normal customer | Shady customer |
| --- | --- | --- |
| Real copyright or abuse notice | 0.01 | 0.3 |
| Fake notice about their domain | 0.01 | 0.01 |
| Legal request | 0.002 | 0.06 |
| Abuse report (existing ticket) | Profile rate | 10 × the profile rate |

Notices about domains nobody hosts arrive 0.2 times a month for the company. A notice waits 7 days before it counts as ignored, and an ignored real notice brings the next step after 3 to 7 days.

| Action | Happiness | Result |
| --- | --- | --- |
| Forward a real notice | 0 | Settled; a shady customer ignores it and the next step follows |
| Forward a fake notice | −2 | Settled |
| Take down on a real notice | −5 | Service offline for 48 hours |
| Take down on a fake notice | −25 | Service offline for 48 hours |
| Comply with a legal request | −15 | Closed |
| Object to a legal request | 0 | Closed; 25% (shady 50%) return as a court order with a 3-day deadline |
| Miss a legal deadline | −60 without a backup, −15 with one | The server is seized for 3 to 24 months |
