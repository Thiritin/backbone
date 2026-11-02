# PHP versions

Each version becomes available on 1 January after its release, rounded so the start of the game has 4.4:

| Version | From | Version | From | Version | From |
| --- | --- | --- | --- | --- | --- |
| 4.4 | 2005 | 5.6 | 2015 | 7.4 | 2020 |
| 5.1 | 2006 | 7.0 | 2016 | 8.0 | 2021 |
| 5.2 | 2007 | 7.1 | 2017 | 8.1 | 2022 |
| 5.3 | 2010 | 7.2 | 2018 | 8.2 | 2023 |
| 5.4 | 2013 | 7.3 | 2019 | 8.3 | 2024 |
| 5.5 | 2014 | | | 8.4 | 2025 |
| | | | | 8.5 | 2026 |

A cluster runs its oldest node's version. With b the number of newer versions out:

| Effect | Value |
| --- | --- |
| How-to ticket rate of web spaces on the cluster | × (1 + 0.05 · min(b, 6)), at most +30% |
| Unsupported | b ≥ 3 |
| Abuse report rate of a customer with a web space on an unsupported cluster | × 1.5 |
| Web hosting requests in Sales that need a supported version | min(1, 0.25 · (b − 2)): 25% at 3 behind, all at 6 |
| Performance of a node's sites in the hour after its upgrade | 70% |

A request that needs a supported version asks for the oldest one still supported and is lost when it would land on the old cluster. Through 2005 to 2009 the catalogue moves slowly, so a cluster set up in 2005 is unsupported from 2010; from 2015 a new version comes every year, and a cluster left alone for three years starts losing sales.

### Legacy versions on a panel host

A panel host keeps up to two older versions besides its newest, and each account runs one of them (the newest unless the player moves it). The ticket and abuse rows above use the oldest version an account on the host still runs, b counted from that version. The sales row keeps using the newest version.

| Effect | Value |
| --- | --- |
| Versions kept besides the newest | At most 2 |
| Installing or removing a version | A rebuild: the host's sites run at 70% for an hour |
| A CMS release runs on | PHP up to the version of the release year + 2; static sites run on any |
| A site on a newer version than its release runs on | Slowed every day, and 35% write in once per version (drawn per site) |
| Upgrading with Keep | The old version stays installed and takes the accounts that would break |
| An advisory | Applies to a host when any installed version is affected |

The rows for tickets, abuse and advisories are the price of keeping a legacy version; the rebuild and the lost sites are the price of not keeping one.
