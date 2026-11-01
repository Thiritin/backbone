# Software and OS version history

Real-world history 2005 to 2026 for every product in the game catalog, for news announcements, support dates and licensing eras. Values that could not be verified are marked "(unverified)". Mailpig is assumed to be Mailcow, FreePanel is assumed to be Webmin and Virtualmin.

# Product history research, batch A (2005 to 2026)

Sources: vendor docs where reachable (docs.cpanel.net, plesk.com, directadmin.com, releases.openstack.org), endoflife.date data (Plesk, VMware ESXi), Broadcom KB, trade press. Values from memory or weak sources are marked (unverified).

## cPanic
Real product: cPanel & WHM

### Versions
| Version | Released | Updates until | Security until | Headline features |
|---|---|---|---|---|
| 10.x (x theme, later x3) | 2005 (unverified) | (unverified) | (unverified) | Branded as cPanel/WHM 10; x3 theme replaced x; Fantastico one-click installer popular |
| 11.0 | 2006 (unverified) | (unverified) | (unverified) | New 11 architecture, stronger WHM reseller tools |
| 11.30 | 2011-07 (derived from 18-month lifetime, unverified) | 2013-01 | 2013-01 | Last release 11.30.8.0; EOL announced 2013-01-14 |
| 11.32 | 2011-12 (unverified) | 2013 (unverified) | 2013 (unverified) | EOL notice 2013-03-20 |
| 11.34 | 2012-10 (derived, unverified) | 2013-10-15 | 2013-10-15 | 12-month lifetime; last release 11.34.2.8 |
| 11.36 | 2013 (unverified) | 2014 (unverified) | 2014 (unverified) | Last release 11.36.2.13 |
| 11.38 | 2013 (unverified) | 2014 (unverified) | 2014 (unverified) | Paper Lantern theme introduced (unverified); last release 11.38.2.23 |
| 11.40 | 2014 (unverified) | 2014-11 (approx) | 2014-11 | Last release 11.40.1.22 |
| 11.42 | 2014 (unverified) | 2015-01 (end of month) | 2015-01 | Paper Lantern default |
| 11.44 to 11.54 | 2014-2015 (unverified) | rolling (unverified) | rolling | Even numbers are production, odd are development builds |
| 11.56 to 11.94 | 2015-2020 (unverified) | rolling, about 12 to 18 months each (unverified) | same | Let's Encrypt style AutoSSL (11.56, unverified), EasyApache 4 (2015-2016, unverified), WHM Docker/Python/Ruby apps |
| 98 | 2021 (unverified) | (unverified) | (unverified) | Jupiter theme introduced (cPanel confirms version 98); "11." prefix dropped around here (unverified) |
| 100 | 2022 (unverified) | (unverified) | (unverified) | Paper Lantern deprecated (cPanel confirms) |
| 102 | 2022 (unverified) | (unverified) | (unverified) | Paper Lantern development ends (cPanel confirms) |
| 108 | 2023 (unverified) | (unverified) | (unverified) | Paper Lantern removed (cPanel states 108; one blog says 106) |
| 110 (LTS) | 2023-03 (approx) | 2026-12 (approx) | 2028-01-01 for CentOS 7 / CloudLinux 7 with Extended Lifecycle Support | First LTS; supported until six months after next LTS reaches RELEASE |
| 118 (LTS) | 2024 (unverified) | (unverified) | (unverified) | Second LTS (unverified) |
| 126 (LTS) | 2025 (unverified) | (unverified) | (unverified) | Third LTS (unverified) |
| 134 (LTS) | 2026-01 (approx) | 2027-06 (approx) | 2027-06 | Current LTS |
| 136 | 2026-04 (approx) | 2026-08 (approx) | 2026-08 | Regular production release |
| 138 | 2026-07 (approx) | 2026-11 (approx) | 2026-11 | Regular production release |

Release tiers (official): LTS (one per year), STABLE, RELEASE (default for new installs), CURRENT, EDGE (several builds per week). Even majors are production; odd majors are development releases on EDGE only. Change logs exist for 110, 118, 120 to 138 even numbers.

### Licensing eras
| Period | Model | Price | Upgrade discount |
|---|---|---|---|
| 2005 to 2019-06 | Monthly lease per server, unlimited accounts (also one-time purchase for some years, unverified) | Dedicated server about $25 to $40/month, VPS about $15 (unverified) | None; lease includes all updates |
| 2019-06 (some sources say 2019-09-01) | Account-based monthly tiers: Solo (1), Admin (5), Pro (30), Premier (100 plus per extra account) | 06.2019: Solo $15, Admin $20, Pro $30, Premier $45 | None |
| 2021-01 | Same tiers, first rise | Admin $22, Pro $32.25, Premier $48.50 | None |
| 2021-12 | Same | Solo $15.99, Admin $24.99, Pro $35.99, Premier $53.99 | None |
| 2022-12 | Same | Admin $27.99, Pro $39.99, Premier $59.99 | None |
| 2023-12 | Same | Solo $17.49, Admin $29.99, Pro $42.99, Premier $60.99, extra accounts $0.40 | None |
| 2025 | Tiers renamed cloud-branded; Premier $65.99 (unverified) | Solo $26.99, Admin $32.99 per one forum post (unverified) | None |
| 2026 | Same | Premier $69.99, Admin $35.99 (HostingSeekers, unverified) | None |
| 2027 | Another rise announced 2026-10 (press, unverified) | (unverified) | None |

Ownership: cPanel acquired by Oakley Capital in 2018 (unverified), merged with Plesk into WebPros in 2021 (unverified).

### Trial
Yes. Official docs: a new installation is eligible for a free 15-day trial license, no credit card needed; after expiry WHM and cPanel interfaces lock while sites and mail keep running.

### UI generations
| Years | UI name | Introduced with |
|---|---|---|
| 2005 to about 2006 | x (classic) | 10.x (unverified) |
| about 2006 to 2014 | x3 | 10.8/11 era (unverified) |
| 2013/2014 to 2023 | Paper Lantern | 11.38 (unverified) |
| 2021 to present | Jupiter | 98 (cPanel confirms) |

## Pleskit
Real product: Plesk

### Versions
| Version | Released | Updates until | Security until | Headline features |
|---|---|---|---|---|
| Plesk 7.5 Reload | 2004 (unverified) | (unverified) | (unverified) | Linux and Windows panel; Plesk 7 released 2004-02 |
| Plesk 8.0 | 2006-09 | (unverified) | (unverified) | Wider mail, DNS and Windows support |
| Plesk 8.6 | 2008 (unverified) | (unverified) | (unverified) | Last of the 8 line |
| Parallels Plesk Panel 9 | 2009 (unverified) | (unverified) | (unverified) | Parallels branding |
| Parallels Plesk Panel 10 | 2010 (unverified) | (unverified) | (unverified) | New UI, Plesk Premium Antivirus options |
| Parallels Plesk Panel 11 | 2012 (unverified) | (unverified) | (unverified) | Updated UI, Plesk Sitebuilder successor, 11.5 added in 2013 (unverified) |
| Parallels Plesk Panel 12 | 2014-06-16 | 2018-06 extended support end (mirror of Wikipedia) | 2018-06 | Plesk 12.5 added Docker and Node.js style features (unverified) |
| Plesk Onyx 17.0 | 2016-10-11 | 2020-10-11 | 2021-04-20 | New UI, Let's Encrypt, 17.8 final line |
| Plesk Obsidian 18.0 | 2019-06 (Wikipedia) or 2019-09-25 (Plesk blog) | rolling | each 18.0.x supported about 3 months (e.g. 18.0.81 released 2026-09-15, EOL 2026-12-08) | Monthly incremental updates instead of 12 to 18 month majors; WordPress Toolkit; Docker; Git |

Company: SWsoft acquired Plesk in 2003, renamed Parallels in 2007; Odin was the service-provider business renamed in 2015; Plesk became independent, then WebPros group with cPanel in 2021 (unverified).

### Licensing eras
| Period | Model | Price | Upgrade discount |
|---|---|---|---|
| 2005 to about 2015 | Perpetual or monthly lease per server, tiers by domain count (10/30/100/300/unlimited) plus Power Pack (unverified) | Unlimited domains about $30 to $50/month leased (unverified) | Upgrade assurance bundle (unverified) |
| about 2016 to present | Subscription, per server (editions) | Web Admin about $13.50 to $18/month, Web Pro about $30/month, Web Host about $63/month (aggregator data, unverified) | Not applicable |
| 2018 onward | Oakley Capital ownership with annual price rises (unverified) | Rises in 2024 reported by press | None |

Editions Web Admin (10 domains), Web Pro (30 domains), Web Host (unlimited) are the current structure. Date of introduction unverified (about Onyx era).

### Trial
Yes. Official: free 14-day fully functional trial, no credit card, new customers only.

### UI generations
| Years | UI name | Introduced with |
|---|---|---|
| 2005 to 2009 | Classic Plesk (Flash/frames era) | 7.5/8 (unverified) |
| 2010 to 2015 | Parallels Plesk Panel UI | 10 and 11 (unverified) |
| 2014 to 2016 | Plesk 12 refreshed UI | 12 (unverified) |
| 2016 to 2019 | Onyx UI | 17.0 |
| 2019 to present | Obsidian UI | 18.0 |

## DirectAdmen
Real product: DirectAdmin

### Versions
DirectAdmin has no named editions. Builds are numbered 1.x: 1.60 around 2019, 1.64x around 2022, 1.660 around 2024 (dates unverified). Support is rolling, only the latest is supported (unverified).

| Version | Released | Updates until | Security until | Headline features |
|---|---|---|---|---|
| 1.2x to 1.3x | 2005 to 2008 (unverified) | rolling | rolling | Lightweight panel with Enhanced skin |
| 1.5x | 2015 to 2018 (unverified) | rolling | rolling | CustomBuild 2, Let's Encrypt integration (unverified) |
| 1.60 | 2019 (unverified) | rolling | rolling | Evolution skin default for new installs |
| 1.64x | 2022 (unverified) | rolling | rolling | Refreshed Evolution |
| 1.660 | 2024 (unverified) | rolling | rolling | Refreshed Evolution layout |

### Licensing eras
| Period | Model | Price | Upgrade discount |
|---|---|---|---|
| to 2019-09 | Lifetime licence or monthly (unverified) | Lifetime about $299 (reported); monthly $29 Standard | Updates included in lifetime |
| 2019-07 to 2019-09 | Pricing change; lifetime stopped being sold, existing lifetime keys stay valid (blog, unverified) | Updates/support $99/year for legacy lifetime (reported, unverified) | Legacy holders can convert at 50% of monthly price (forum, unverified) |
| 2019 to present | Monthly subscription per server | Personal PLUS $5 (2 accounts, 20 domains), Lite $15 (10 accounts, 50 domains), Standard $29 (unlimited), official page | Bulk discount 15 to 40% from four Standard licences with prepaid balance |

### Trial
No. The official pricing page lists no trial for the panel (trials only for JetBackup 10 days, Acronis 30 days, Imunify360 14 days). A DirectAdmin staff forum reply says trial keys are no longer offered but a 30-day money-back guarantee exists (reported via search summary, unverified wording). An older TechRadar article claimed a 60-day trial, likely outdated.

### UI generations
| Years | UI name | Introduced with |
|---|---|---|
| 2003 to 2012 | Default skin | 1.x (unverified) |
| about 2008 to 2019 | Enhanced skin | (unverified) |
| (unverified) | Power User skin | (unverified; not found in docs) |
| 2019 to present | Evolution | 1.60 era (unverified) |

## FreePanel
Real product: Webmin and Virtualmin

### Versions
| Version | Released | Updates until | Security until | Headline features |
|---|---|---|---|---|
| Webmin 1.0 | 1999 (unverified) | rolling | rolling | Web-based Unix admin by Jamie Cameron (project started 1997, unverified) |
| Webmin 1.2xx to 1.5xx | 2005 to 2010 (unverified) | rolling | rolling | Virtualmin GPL grows into hosting panel |
| Webmin 1.7xx to 1.9xx | 2014 to 2022 (unverified) | rolling | rolling | Authentic theme by Ilia Rostovtsev (responsive) |
| Webmin 2.0 | 2022 (unverified) | rolling | rolling | Authentic theme becomes the default |
| Virtualmin 7 | 2022 (unverified) | rolling | rolling | Pro/GPL tiers, install script |

### Licensing eras
| Period | Model | Price | Upgrade discount |
|---|---|---|---|
| all years | Webmin free open source (BSD-style licence, not GPL); Virtualmin GPL free (GPL) | $0 | Not applicable |
| 2005 to 2015 | Virtualmin Pro annual, tiered by domains; renewals about half of purchase (2005 forum) | About $41/month leased in 2009 (forum) | Renewal about 50% |
| 2015 | Virtualmin 10 and Cloudmin 10 starting price | $99 ($40 to $50 lower than prior) | (unverified) |
| later (undated) | Subscription | $6/month or $60/year for 10 domains (forum, undated, unverified) | (unverified) |

### Trial
Not needed for GPL. For Pro, a trial or evaluation is (unverified).

### UI generations
| Years | UI name | Introduced with |
|---|---|---|
| 1999 to about 2014 | Classic Webmin theme / Gray Theme | 1.x |
| about 2014 to present | Authentic theme | 1.7xx/1.8xx (unverified) |

## OpenVeeZee
Real product: OpenVZ

### Versions
| Version | Released | Updates until | Security until | Headline features |
|---|---|---|---|---|
| Virtuozzo (Linux) | 2000/2001, first Linux OS containers (Wikipedia says 2000 for container tech) | commercial | commercial | SWsoft product, base of HSP Complete |
| OpenVZ | 2005 | (unverified) | (unverified) | SWsoft open sourced the Virtuozzo core under GPL |
| Parallels Virtuozzo Containers 4.0 / 4.6 / 4.7 | 2008 / 2010 / 2011 (unverified) | (unverified) | (unverified) | Commercial per-node licence; Windows version too |
| OpenVZ legacy (RHEL6 2.6.32 kernel) | 2011 stable (unverified) | up to about 2020-11, RHEL6 end (unverified; one host blog says end of 2018) | same | Vanilla Linux containers, VZ templates |
| Virtuozzo 7 / OpenVZ 7 | Tech preview 2015, Virtuozzo spun off Parallels 2015-12, GA 2016 (unverified month) | (unverified) | (unverified) | OpenVZ 7 added VMs (KVM) with containers on a RHEL7/3.10 kernel |
| Virtuozzo Hybrid Server / Infrastructure | 2019 onward (unverified) | (unverified) | (unverified) | Commercial combined containers, VMs, storage |

### Licensing eras
| Period | Model | Price | Upgrade discount |
|---|---|---|---|
| 2005 onward | OpenVZ free (GPL) | $0 | Not applicable |
| 2005 to 2015 | Parallels Virtuozzo Containers per physical server licence plus annual support (unverified) | (unverified) | (unverified) |
| 2016 onward | Virtuozzo commercial, per node subscription (unverified) | (unverified) | (unverified) |

### Trial
Virtuozzo offers evaluation licences on request (unverified).

### UI generations
| Years | UI name | Introduced with |
|---|---|---|
| 2005 to 2015 | Command line plus third-party panels (HyperVM, SolusVM, Virtuozzo Power Panels) | (unverified) |
| 2016 to present | Virtuozzo Automator / VZ7 web panel | 7 (unverified) |

## OpenStash
Real product: OpenStack

### Versions (official release dates from releases.openstack.org)
| Release | Released | Updates until | Security until | Headline features |
|---|---|---|---|---|
| Austin | 2010-10-21 | EOL | EOL | Nova and Swift only |
| Bexar | 2011-02-03 | EOL | EOL | Glance image service |
| Cactus | 2011-04-15 | EOL | EOL | Bug fixes |
| Diablo | 2011-09-22 | EOL | EOL | Dashboard and Keystone start |
| Essex | 2012-04-05 | EOL | EOL | Horizon and Keystone core |
| Folsom | 2012-09-27 | EOL | EOL | Quantum networking and Cinder |
| Grizzly | 2013-04-04 | EOL | EOL | Cells, Nova improvements |
| Havana | 2013-10-17 | EOL | EOL | Ceilometer, Heat |
| Icehouse | 2014-04-17 | EOL | EOL | Rolling upgrades |
| Juno | 2014-10-16 | EOL | EOL | Sahara, Neutron IPv6 |
| Kilo | 2015-04-30 | EOL | EOL | Ironic |
| Liberty | 2015-10-15 | EOL | EOL | Big Tent governance |
| Mitaka | 2016-04-07 | EOL | EOL | Easier configuration |
| Newton | 2016-10-06 | EOL | EOL | Containers integration |
| Ocata | 2017-02-22 | EOL | EOL | Shorter cycle |
| Pike | 2017-08-30 | EOL | EOL | Cells v2 |
| Queens | 2018-02-28 | EOL | EOL | GPU/vGPU |
| Rocky | 2018-08-30 | EOL | EOL | Ironic and Nova gains |
| Stein | 2019-04-10 | EOL | EOL | Nova placement |
| Train | 2019-10-16 | EOL | EOL | Placement and Ironic gains |
| Ussuri | 2020-05-13 | EOL | EOL | Python 3 only |
| Victoria | 2020-10-14 | EOL | EOL | Stable, Neutron OVN |
| Wallaby | 2021-04-14 | EOL | EOL | Nova refinements |
| Xena | 2021-10-06 | EOL (last to go to Extended Maintenance) | EOL | Yearly security focus |
| Yoga | 2022-03-30 | Unmaintained | Unmaintained | |
| Zed | 2022-10-05 | Unmaintained | Unmaintained | Last single-letter name |
| 2023.1 Antelope | 2023-03-22 | Unmaintained | Unmaintained | Year.cycle naming, SLURP skip-level upgrade |
| 2023.2 Bobcat | 2023-10-04 | EOL | EOL | |
| 2024.1 Caracal | 2024-04-03 | Unmaintained | Unmaintained | SLURP |
| 2024.2 Dalmatian | 2024-10-02 | EOL | EOL | |
| 2025.1 Epoxy | 2025-04-02 | Maintained | Maintained | SLURP |
| 2025.2 Flamingo | 2025-10-01 | Maintained | Maintained | |
| 2026.1 Gazpacho | 2026-04-01 | Maintained | Maintained | SLURP |
| 2026.2 Hibiscus | 2026-09-30 | Maintained | Maintained | |
| 2027.1 Indri | 2027-03-24 (estimated) | Development | | |

Support phases: Maintained (about 18 months for non-SLURP, ~2 years for SLURP, unverified), then Unmaintained; the Extended Maintenance phase was replaced by Unmaintained and Xena was the last series moved into Extended Maintenance. Exact per-release end dates unverified. Headline features column is from memory (unverified).

### Licensing eras
| Period | Model | Price | Upgrade discount |
|---|---|---|---|
| 2010 to present | Apache 2.0 free software, governed by OpenStack Foundation (2012) then Open Infrastructure Foundation (2020) (unverified) | $0 | Not applicable |
| 2012 to present | Vendor distros sold as subscriptions: Red Hat OpenStack Platform, Canonical Charmed OpenStack, SUSE, Mirantis, HPE Helion (unverified) | Per node or per core subscription (unverified) | Upgrade included with subscription (unverified) |

### Trial
No licence needed. Vendor distros offer evaluations (unverified).

### UI generations
| Years | UI name | Introduced with |
|---|---|---|
| 2011 | Dashboard (Django) | Diablo (unverified) |
| 2012 to present | Horizon | Essex |
| 2013 to present | Horizon with Heat and Neutron panels | Havana (unverified) |

## VMwhere
Real product: VMware ESX, ESXi, vSphere, vCenter

### Versions
Dates 5.0 onward from endoflife.date (Broadcom data); earlier from memory.

| Version | Released | Updates until (general support) | Security until (technical guidance) | Headline features |
|---|---|---|---|---|
| ESX 3.0 / VI3 | 2006-06 (unverified month) | (unverified) | (unverified) | VMware Infrastructure 3, HA and DRS |
| ESX 3.5 | 2007-12 (unverified) | (unverified) | (unverified) | ESXi 3.5 free edition 2008 (unverified) |
| vSphere 4.0 | 2009-05 (unverified) | 2014-05 (unverified) | 2016-05 (unverified) | First vSphere branding, vCenter |
| vSphere 4.1 | 2010-07 (unverified) | 2014-05 (unverified) | (unverified) | Last ESX with service console |
| vSphere 5.0 | 2011-07-12 | 2016-08-24 | 2018-08-24 | ESXi only, vRAM licensing |
| vSphere 5.1 | 2012-08-27 | 2016-08-24 | 2018-08-24 | vRAM tax removed (unverified) |
| vSphere 5.5 | 2013-09-19 | 2018-09-19 | 2020-09-19 | Web Client, larger VMs |
| vSphere 6.0 | 2015-03-12 | 2020-03-12 | 2022-03-12 | Platform Services Controller, vVols |
| vSphere 6.5 | 2016-11-15 | 2022-10-15 | 2023-11-15 | HTML5 client, vCenter appliance |
| vSphere 6.7 | 2018-04-17 | 2022-10-15 | 2023-11-15 | Full HTML5 client |
| vSphere 7.0 | 2020-04-02 | 2025-10-02 (extended from 2025-04-02) | 2027-04-02 | Kubernetes (Tanzu), Lifecycle Manager |
| vSphere 8.0 | 2022-10-11 | 2027-10-11 | 2029-10-11 | DPU support, Distributed Services Engine |
| vSphere/ESX 9.0 | 2025-06-17 | 2027-09-17 | 2028-09-17 | Part of VMware Cloud Foundation 9, product renamed ESX |
| ESX 9.1 | 2026-05-12 | 2028-08-12 | 2029-08-12 | Latest |

### Licensing eras
| Period | Model | Price | Upgrade discount |
|---|---|---|---|
| 2006 to 2011 | Perpetual per CPU socket (caps on cores per CPU in vSphere 4: 6 or 12 cores), editions Standard, Enterprise, Enterprise Plus | Standard about $795/CPU (unverified), Enterprise Plus about $3,495 (unverified) | Support and Subscription (SnS) renewal, upgrade price (unverified) |
| 2008-07 to 2024-02 | Free ESXi hypervisor, limited (no vCenter) | $0 | Not applicable |
| 2011-07 to 2012-08 | vSphere 5.0 vRAM entitlement per CPU licence (unpopular), removed in 5.1 | (unverified) | |
| 2012 to 2023 | Perpetual per CPU socket, 32 core cap per licence from 2020-04 (unverified), SnS yearly | (unverified) | SnS renewals |
| 2023-11 | Broadcom acquisition closes (unverified day) | | |
| 2023-12 | Perpetual sales ended, subscription only (unverified exact day) | | Existing perpetual keys stay valid but no support |
| 2024-02 | Per-core subscription, 16-core minimum per CPU (reported); free ESXi ended | (unverified) | |
| 2025-04 | Minimum of 72 cores per order reported, reversed within about a week (reported) | | |
| 2025-04 | Free ESXi returns with ESXi 8.0 Update 3e (Heise, Register) | $0 | |

### Trial
Historic 60-day evaluation mode on every ESXi install without a licence key (unverified). Current Broadcom evaluation terms unverified.

### UI generations
| Years | UI name | Introduced with |
|---|---|---|
| 2006 to 2016 | vSphere Client (C#, Windows only) | VI3 and 4/5/6.0; not shipped with 6.5 (Broadcom KB 2147929) |
| 2009 to 2018 | vSphere Web Client (Flash/Flex) | 5.0 (unverified); positioned as main client in 6.5 |
| 2016 to present | vSphere Client (HTML5) | 6.5 subset, full feature parity around 6.7 U1 (community) |
| 2008 to present | Host UI (ESXi Embedded Host Client, HTML5) | 6.0/6.5 (unverified) |
# Hosting stack real-world history (batch b)

Research date 2026-11-01. Sources: endoflife.date, vendor pages (proxmox.com, tcadmin.com/pricing, multicraft.org pricing, ISC KB/blog, PowerDNS EOL doc), Wikipedia. Anything marked (unverified) comes from memory or a single weak source.

## Proxmocks
Real product: Proxmox VE

### Versions
Proxmox publishes no separate "updates until" date. Only the newest minor of the newest major gets regular updates, so that column reads "latest minor only". Security until is the endoflife.date value.

| Version | Released | Updates until | Security until | Headline features |
|---|---|---|---|---|
| 0.9 (first public) | 2008-04 | n/a | n/a | Web interface for OpenVZ and KVM on Debian |
| 1.0 | 2008-10 (endoflife.date: 2008-10-29) | latest minor only | 2013-01 | Debian 5 Lenny base, KVM and OpenVZ, web management |
| 1.9 | 2011-09 | latest minor only | 2013-01 | Last 1.x release |
| 2.0 | 2012-03 (2012-03-30) | latest minor only | 2014-05 | New ExtJS 4 web interface, HA cluster, REST API (unverified) |
| 3.0 | 2013-05 (2013-05-24) | latest minor only | 2017-02 | Debian 7 base, 3.4 added ZFS (unverified) |
| 4.0 | 2015-10 (2015-10-06) | latest minor only | 2018-06 | Debian 8, LXC replaces OpenVZ, new HA stack |
| 5.0 | 2017-07 (2017-07-04) | latest minor only | 2020-07 | Debian 9, Ceph Luminous, live storage migration (unverified) |
| 6.0 | 2019-07 (2019-07-16) | latest minor only | 2022-09 | Debian 10, Corosync 3, Ceph Nautilus in GUI (unverified) |
| 7.0 | 2021-07 (2021-07-06) | latest minor only | 2024-07 | Debian 11, Ceph Pacific, Proxmox Backup Server integration (unverified) |
| 8.0 | 2023-06 (2023-06-22) | latest minor only | 2026-08 (endoflife.date shows 2026-08-31) | Debian 12, Ceph Quincy, resource mapping (unverified) |
| 8.4 | 2025-04 (2025-04-09) | latest minor only | 2026-08 | Last 8.x |
| 9.0 | 2025-08 (2025-08-05) | latest minor only | no end date yet | Debian 13 Trixie base |
| 9.1 | 2025-11 (2025-11-19) | latest minor only | no end date yet | Minor release on Trixie |
| 9.2 | 2026-05 (2026-05-21) | current | no end date yet | Minor release on Trixie |

Notes: Proxmox Backup Server 1.0 shipped 2020-11 (unverified). Proxmox Mail Gateway traces back to 2005 (unverified). Support lifecycle follows the Debian base release.

### Licensing eras
| Period | Model | Price | Upgrade discount |
|---|---|---|---|
| 2008 onward | Free AGPL software, no licence fee | 0 | n/a |
| Early 2010s (unverified) | Optional paid subscription with enterprise repository, per CPU socket per year, tiers Community, Basic, Standard, Premium | Early prices (unverified) | Same subscription covers all updates |
| 2026 (vendor page) | Subscription per CPU socket per year, net of VAT | Community 120 EUR, Basic 370 EUR, Standard 550 EUR, Premium 1100 EUR | Every major upgrade is free |

Basic adds 3 tickets a year with one business day response, Standard 10 tickets with 4 hours for critical requests, Premium unlimited tickets with 2 hours (reseller source wz-it.com). The enterprise repository is the stable, tested package feed; the no-subscription repository gets updates earlier and a "No valid subscription" login notice appears.

### Trial
No time-limited trial. The full product is free to use without a subscription (unverified against a vendor trial statement).

### UI generations
| Years | UI name | Introduced with |
|---|---|---|
| 2008 to 2012 | First web interface (Perl based, unverified) | 0.9 / 1.0 |
| 2012 to 2016 | New management interface on ExtJS 4 | 2.0 |
| 2016 onward | Flat design on ExtJS 6 | 4.2 (2016) |

## HyperVee
Real product: Microsoft Hyper-V

### Versions
Dates for lifecycle are Microsoft's published fixed lifecycle values from memory; endoflife.date confirms 2022, 2025, 2019, 2012 ESU and 2008 end dates. The 2016 row on endoflife.date was garbled, so the 2016 end dates are (unverified).

| Version | Released | Updates until (mainstream) | Security until | Headline features |
|---|---|---|---|---|
| Hyper-V in Windows Server 2008 | 2008-06 (RTM update; server 2008-02) | 2015-01 (unverified) | 2020-01, ESU to 2023-01 | First Microsoft hypervisor, role in Server 2008, replaces Virtual Server |
| Hyper-V Server 2008 (free) | 2008-10 (unverified) | 2015-01 (unverified) | 2020-01 (unverified) | Free standalone host, command line only |
| 2008 R2 | 2009-10 (unverified) | 2015-01 (unverified) | 2020-01, ESU to 2023-01 | Live Migration, Cluster Shared Volumes |
| 2012 | 2012-09 (unverified) | 2018-10 (unverified) | 2023-10, ESU to 2026-10 | Hyper-V Replica, VHDX, extensible switch |
| 2012 R2 | 2013-10 (unverified) | 2018-10 (unverified) | 2023-10, ESU to 2026-10 | Generation 2 VMs, enhanced session mode |
| 2016 | 2016-10 (endoflife.date: 2016-10-15) | 2022-01 (unverified) | 2027-01 (unverified) | Nested virtualization, discrete device assignment, containers |
| 2019 (and free Hyper-V Server 2019) | 2018-11 (2018-11-13) | 2024-01 (2024-01-09) | 2029-01 (2029-01-09) | Shielded VM improvements, persistent memory; last free Hyper-V Server |
| 2022 | 2021-08 (2021-08-18) | 2026-10 (2026-10-13) | 2031-10 (2031-10-14) | Nested virtualization on AMD |
| 2025 | 2024-11 (2024-11-01) | 2029-11 (2029-11-13) | 2034-11 (2034-11-14) | GPU partitioning, workgroup clusters, generation 2 default |

The free Hyper-V Server line ended with 2019 (Microsoft Tech Community statement, found via search).

### Licensing eras
| Period | Model | Price | Upgrade discount |
|---|---|---|---|
| 2008 to 2011 | Hyper-V role bundled in Windows Server, per server or per processor plus CALs; Hyper-V Server 2008, 2008 R2 free | Standard 999 USD, Enterprise 3999 USD, Datacenter 2999 USD per processor (all unverified) | Software Assurance about 25 percent per year (unverified) |
| 2012 to 2015 | Per processor pair (2 sockets) | Standard 882 USD, Datacenter 4809 USD (unverified) | Software Assurance |
| 2016 onward | Per core, minimum 16 cores per server, sold in 16 core packs, plus CALs | 2022: Standard 1069 USD, Datacenter 6155 USD per 16 core pack (Microsoft page). 2025: Standard 1176 USD, Datacenter 6771 USD (secondary source) | Software Assurance |
| After 2019 | Free standalone SKU ended; Hyper-V only through Windows Server editions | n/a | n/a |

### Trial
Windows Server has a 180 day evaluation from Microsoft Evaluation Center (unverified this session). Hyper-V Server 2008 to 2019 were free without trial limits.

### UI generations
| Years | UI name | Introduced with |
|---|---|---|
| 2008 onward | Hyper-V Manager (MMC) | 2008 |
| 2008 to 2020s | System Center Virtual Machine Manager (VMM), fleet management | VMM 2008 (2008-10, unverified) |
| 2018 onward | Windows Admin Center (browser based, formerly Project Honolulu) | GA around 2018-04, works from 2012 R2 up (unverified) |

## TCAdmen
Real product: TCAdmin

### Versions
Release dates are mostly (unverified); the project forum lists dated builds.

| Version | Released | Updates until | Security until | Headline features |
|---|---|---|---|---|
| TCAdmin 1.x | mid 2000s (unverified) | ended; v1 licences stopped working on v2 after 2017-01-31 | ended | Original Windows game panel with automated game server setup |
| TCAdmin 2.0.x | around 2015 (unverified) | current builds to 2.0.191 (2024-02) | not stated | Windows and Linux hosts, billing integrations |
| TCAdmin 2020 | 2020 (unverified) | not stated | not stated | Rebranded v2 release |
| TCAdmin 3 | 2020s (unverified) | 3.2.34 released 2026-03-30 | not stated | Modern UI, v2 master licence can preview v3 on same server, AI assistant credits |

### Licensing eras
| Period | Model | Price | Upgrade discount |
|---|---|---|---|
| Older | Monthly lease per server, or purchase per server, or Enterprise | 15.95 USD per server (forum, possibly outdated); purchase prices (unverified) | v1 to v2 required new licence after 2017-01-31 |
| Now (vendor page) | Monthly per server | Community 7.95 USD per server per month, up to 4 game or voice services. Professional 15.95 USD per server per month, unlimited. Enterprise custom | v3 licences start at same 7.95 USD as v2 |
| Hosting offer | Hosted panel | from 7.95 USD per month | n/a |

### Trial
Yes. Vendor pricing page: 30 days free, then monthly per server. An older site text said 20 days. Use 30 days.

### UI generations
| Years | UI name | Introduced with |
|---|---|---|
| 2000s | v1 Windows web panel | 1.x (unverified) |
| 2010s | v2 panel with TCAdmin Admin and Client areas | 2.0 (unverified) |
| 2020s | v3 panel | 3.0 (unverified) |

## MultiKraft
Real product: Multicraft

### Versions
| Version | Released | Updates until | Security until | Headline features |
|---|---|---|---|---|
| 1.x | 2011 | not stated (unverified) | not stated | First Minecraft panel with web UI and daemon |
| 2.0 | 2013 (unverified) | not stated | not stated | Rewritten panel, multi server |
| 2.4.2 (Windows) / 2.5.0 (Linux, Windows) | 2.5.0 current on the download page, date not shown | current | not stated | Billing modules, Windows Advanced preview |

I found no changelog with dates; all version dates beyond 2011 are (unverified).

### Licensing eras
| Period | Model | Price | Upgrade discount |
|---|---|---|---|
| Earlier (third party wiki) | Volume priced monthly licence by server count, machines do not matter | (unverified) | n/a |
| Now (vendor page) | Free: personal use, 1 machine per panel. Dynamic: first 25 gameservers free then 1.49 EUR per gameserver per month. Enterprise: custom | Dynamic examples: 50 servers 74.50 EUR, 100 servers 149 EUR, 1000 servers 1490 EUR (billing period not stated) | n/a |

Billing modules: Blesta and WHMCS free, FOSSBilling beta.

### Trial
No free trial on the pricing page. The free personal tier serves as the entry.

### UI generations
| Years | UI name | Introduced with |
|---|---|---|
| 2011 onward | PHP web panel plus daemon, themeable | 1.x / 2.x (unverified) |

## Pterodaktyl
Real product: Pterodactyl Panel

### Versions
| Version | Released | Updates until | Security until | Headline features |
|---|---|---|---|---|
| 0.x | 2016 (unverified) | ended | ended | Docker based game panel, Node daemon |
| 1.0 and Wings (Go daemon) | 2021 (unverified) | latest 1.x | latest 1.x | Wings daemon in Go, stable API |
| 1.15.2 | 2026-10-21 (year inferred from release list) | current | current | Security fixes for file handling |
| 2.0.0 beta 1 and 2 | 2026-10-14 | beta | beta | Open beta, keep production on 1.x |

Pelican Panel is the successor fork by the same lead developer, a rewrite with Wings fork at 1.0.0-beta29; some sources call Pterodactyl maintenance only (secondary source). Fork date (unverified).

### Licensing eras
| Period | Model | Price | Upgrade discount |
|---|---|---|---|
| 2016 onward | Free open source (MIT, unverified) | 0 | n/a |

### Trial
Not applicable, it is free.

### UI generations
| Years | UI name | Introduced with |
|---|---|---|
| 2016 to 2018 | Early Laravel panel (unverified) | 0.x |
| 2018 onward | React based client area (unverified) | 0.7 / 1.0 |
| 2026 | 2.0 redesign | 2.0 beta |

## Bound
Real product: BIND (ISC BIND 9)

### Versions
Dates from ISC and endoflife.date are marked; older ones are (unverified). ISC support lasts about four years for ESV, lifecycle per ISC policy.

| Version | Released | Updates until | Security until | Headline features |
|---|---|---|---|---|
| 9.3 | 2004-09 (unverified) | ended | ended | Incumbent in 2005 |
| 9.4 | 2007 (unverified) | ended | ended | IPv6 and DNSSEC refinements |
| 9.6 ESV | 2009 (unverified) | ended | ended | First ESV, DNSSEC NSEC3 |
| 9.8 to 9.11 | 2011 to 2016 (unverified) | ended | ended | DNSSEC inline signing, response policy zones |
| 9.16 | 2020-02-12 | ended | 2024-03-31 | Stable and LTS branch |
| 9.18 ESV | 2022-01-24 | ended | 2026-06-30 (ISC blog: last release 9.18.50 in June 2026) | DoH and DoT, zone transfer over TLS (unverified) |
| 9.20 | 2024-07-08 | current | 2028-07-08 (endoflife.date) | Multithreading refactor; becomes ESV (repositories move July 2026) |
| 9.21 | 2024-08-13 | development | development | Development branch toward 9.22 |

### Licensing eras
| Period | Model | Price | Upgrade discount |
|---|---|---|---|
| 2005 onward | Free software (MPL 2.0 from 9.11, ISC license earlier) | 0 | n/a |
| Paid | ISC support subscriptions, private ESV package repository on Cloudsmith | (unverified) | n/a |

### Trial
Not applicable, it is free.

### UI generations
| Years | UI name | Introduced with |
|---|---|---|
| 2005 onward | Command line: named.conf, rndc | 9.x |
| 2010s onward | Statistics channel (HTTP) | 9.5 and later (unverified) |

## PowerDNZ
Real product: PowerDNS

### Versions
Authoritative Server dates are from the vendor EOL page; policy is critical-only updates then end of life.

| Version | Released | Updates until | Security until | Headline features |
|---|---|---|---|---|
| 2.9.x | 2002 onward (unverified) | declared end of life 2015-05-21 | 2015-05 | Database backends (SQL) |
| 3.x | 2011 (unverified) | ended | ended 2017-12-01 | DNSSEC, more backends |
| 4.0 and 4.1 | 2016 (unverified) | ended | ended | Hardened design, new API |
| 4.2 | 2019-08 | 2020-12 | 2021-07 | Maintenance |
| 4.3 | 2020-04 | 2021-04 | 2022-01 | Maintenance |
| 4.4 | 2020-12 | 2022-01 | 2022-10 | Maintenance |
| 4.5 | 2021-07 | 2022-01 | 2023-06 | Maintenance |
| 4.6 | 2022-01 | 2022-10 | 2024-03 | Maintenance |
| 4.7 | 2022-10-20 | 2023-06 | 2025-08 | Maintenance |
| 4.8 | 2023-06-01 | 2024-03 | 2026-06 | Maintenance |
| 4.9 | 2024-03-15 | 2025-08 | about 2026-09 | Maintenance |
| 5.0 | 2025-08-22 | 2026-06 | about 2027-03 | New major generation |
| 5.1 | 2026-06-03 | about 2027-01 | about 2028-01 | Current supported train |

Recursor and DNSdist are separate products; their versions are (unverified) here. Release cadence is about every six months.

### Licensing eras
| Period | Model | Price | Upgrade discount |
|---|---|---|---|
| 2002 onward | Free GPL software | 0 | n/a |
| 2005 onward | Commercial support from the company (cloudns source says services began 2005) | (unverified) | n/a |
| 2015-03 onward | Merged into Open-Xchange; support subscriptions via PowerDNS.com B.V. or Open-Xchange | (unverified) | End of life releases may still get support for commercial customers |

### Trial
Not applicable, it is free.

### UI generations
| Years | UI name | Introduced with |
|---|---|---|
| 2000s | No built-in UI; third party Poweradmin | n/a |
| 2010s onward | Built-in web server and REST API for PowerDNS-Admin type tools | 3.4 / 4.0 (unverified) |

## Knut DNS
Real product: Knot DNS

### Versions
First release 2011-11-03 by CZ.NIC (Wikipedia).

| Version | Released | Updates until | Security until | Headline features |
|---|---|---|---|---|
| 1.0 | 2011 (unverified) | ended | ended | Authoritative-only server |
| 2.0 | 2015 (unverified) | ended | ended | Rewrite with new config |
| 2.2 | 2016-04-26 | ended | ended | Maintenance |
| 2.9 | 2019-10-10 | ended | ended | Last 2.x |
| 3.0 | 2020-09-09 | ended | ended | New major line |
| 3.1 | 2021-08-02 | ended | ended | Maintenance |
| 3.2 | 2022-08-22 | ended | ended | Maintenance |
| 3.3 | 2023-08-28 | ended | ended | Maintenance |
| 3.4 | 2024-09-02 | ended | ended | Maintenance |
| 3.5 | 2025-09-18 | current | current | License GPL-2.0-or-later |
| 3.6 | 2026-09 (unverified; page ambiguous), 3.6.2 on 2026-10-21 | current | current | Latest line |

CZ.NIC support policy per version is (unverified).

### Licensing eras
| Period | Model | Price | Upgrade discount |
|---|---|---|---|
| 2011 onward | Free GPL software | 0 | n/a |

### Trial
Not applicable, it is free.

### UI generations
| Years | UI name | Introduced with |
|---|---|---|
| 2011 onward | Command line knotc and config file only | 1.0 |
# Real-world history 2005 to 2026 (batch C)

Verification note: web search verified the items marked "(verified)". Everything else comes from background knowledge and is marked "(unverified)" where I could not confirm it. Dates are YYYY-MM.

## OpenVeePeeN
Real product: OpenVPN

### Versions
| Version | Released | Updates until | Security until | Headline features |
|---|---|---|---|---|
| OpenVPN 2.0 | 2005-04 (unverified) | about 2009 (unverified) | about 2009 (unverified) | Server mode with many clients on one port, push options, per-client config |
| OpenVPN 2.1 | 2009-12 (unverified) | about 2011 (unverified) | about 2012 (unverified) | Dynamic IPv6 groundwork, management interface improvements, Windows Vista/7 fixes |
| OpenVPN 2.2 | 2011-04 (unverified) | about 2012 (unverified) | about 2013 (unverified) | Cleanup and stability release, Windows 7 support |
| OpenVPN 2.3 | 2012-05 (unverified) | about 2016 (unverified) | about 2017 (unverified) | Native IPv6 tunnels, PolarSSL option, Windows installer improvements |
| OpenVPN 2.4 | 2016-12 (unverified) | 2021 (unverified) | about 2022 (unverified) | AEAD ciphers (AES-GCM), ECDH, NCP cipher negotiation, compression disabled by default later |
| OpenVPN 2.5 | 2021-01 (unverified) | about 2022 (unverified) | about 2023 (unverified) | Data channel offload groundwork, tls-crypt-v2, ChaCha20-Poly1305 |
| OpenVPN 2.6 | 2022-11 (unverified) | still maintained (unverified) | still maintained (unverified) | Data Channel Offload on Linux (ovpn-dco), faster crypto, OpenSSL 3 support |
| OpenVPN 2.7 | 2026 (unverified, not confirmed released) | n/a | n/a | Kernel DCO as a standard feature (unverified) |
| OpenVPN 3 (client core) | about 2017 (unverified) | rolling | rolling | C++ client library for Connect apps, mobile first |

### Licensing eras
| Period | Model | Price | Upgrade discount |
|---|---|---|---|
| 2002 to now | Community edition, GPLv2, free | free | not applicable |
| about 2009 to now | OpenVPN Access Server (commercial, from OpenVPN Technologies / OpenVPN Inc.), per concurrent connected device | Free tier of 2 simultaneous connections with no time limit (verified). Paid subscription per connection, billed monthly or yearly, from about 11 USD per connection per month per a third party listing (unverified, conflicting sources) | Subscription, no upgrade fee |
| about 2019 to now | Access Server subscription licence, renewal yearly | see above | volume tiers (unverified) |

### Trial
Access Server has no time-limited trial; the free tier of two concurrent connections never expires (verified from the vendor docs). A third party listing mentions a 14-day trial (unverified).

### UI generations
| Years | UI name | Introduced with |
|---|---|---|
| 2005 to now | Command line and config files | 2.0 |
| 2005 to 2018 | OpenVPN GUI (Windows tray app) | 2.0 era (unverified) |
| about 2009 to now | Access Server Admin UI and Client UI (web) | Access Server 1.x (unverified) |
| about 2013 to now | OpenVPN Connect apps | Connect 1.x / 3.x (unverified) |

## Sysko AnyConnekt
Real product: Cisco AnyConnect Secure Mobility Client, renamed Cisco Secure Client

### Versions
| Version | Released | Updates until | Security until | Headline features |
|---|---|---|---|---|
| AnyConnect 2.0 | about 2007 (unverified) | about 2012 (unverified) | about 2012 (unverified) | Replaces the Cisco SSL VPN Client, DTLS-based tunnel |
| AnyConnect 2.5 | 2010 (unverified) | about 2013 (unverified) | about 2013 (unverified) | Mobile platforms, posture hooks |
| AnyConnect 3.0 / 3.1 | 2012 / 2013 (unverified) | about 2016 (unverified) | about 2016 (unverified) | Secure Mobility with web security, Windows 8 |
| AnyConnect 4.0 to 4.10 | 2015 to 2022 (unverified) | 2024-03-31 end of software maintenance for all 4.x (verified) | 2024-03-31 (verified); application support to 2027-03-31 per third party only (unverified) | Next Generation Encryption, Network Visibility Module, ISE posture, Umbrella roaming module |
| Cisco Secure Client 5.0 | about 2023 (unverified) | follows 5.x policy, dates not found (unverified) | not found (unverified) | Rebrand, unified agent for VPN, Umbrella, Secure Endpoint |
| Cisco Secure Client 5.1 | about 2024 (unverified) | not found (unverified) | not found (unverified) | Newer OS support, Secure Firewall posture |

### Licensing eras
| Period | Model | Price | Upgrade discount |
|---|---|---|---|
| 2005 to about 2009 | Cisco SSL VPN Client bundled free with ASA / VPN 3000; clientless and client both included (unverified) | free | not applicable |
| about 2009 to 2014 | AnyConnect Essentials (per ASA, flat) and AnyConnect Premium (per simultaneous session) | not found (unverified) | upgrade path Essentials to Premium (unverified) |
| about 2014 to 2023 | AnyConnect Plus and Apex, per user, term 1/3/5 years, plus perpetual Plus (unverified dates) | not found (unverified) | eligible customers with valid term or supported perpetual licences get the 5.x upgrade at no charge (verified) |
| 2023 to now | Cisco Secure Client Advantage (was Plus), Premier (was Apex), Premier Cloud-managed, per user; Smart Licensing (verified for the Plus to Advantage and Apex to Premier mapping) | not found (unverified) | no charge migration (verified) |

### Trial
A 90-day evaluation licence is commonly offered through Cisco sales or the licence portal (unverified, vendor page not read).

### UI generations
| Years | UI name | Introduced with |
|---|---|---|
| 2007 to 2013 | AnyConnect tray client with simple connect window | 2.0 (unverified) |
| 2013 to 2023 | AnyConnect with modular tiles (VPN, Web Security, Network Visibility) | 3.1 / 4.0 (unverified) |
| 2023 to now | Cisco Secure Client | 5.0 (unverified) |

## WireGuarded
Real product: WireGuard

### Versions
| Version | Released | Updates until | Security until | Headline features |
|---|---|---|---|---|
| First public snapshots | 2016 (unverified) | rolling | rolling | Out of tree Linux module, tiny code base |
| NDSS paper, snapshots 0.0.x | 2017 (unverified) | rolling | rolling | Noise protocol, cryptokey routing |
| iOS and macOS apps | 2018 to 2019 (unverified) | rolling | rolling | First mobile clients |
| Android app | 2018 (unverified) | rolling | rolling | In kernel on rooted, else wireguard-go |
| 1.0.0 (tools and module) | 2020-03 (unverified) | rolling | rolling | Declared stable on release in Linux 5.6 |
| Linux 5.6 merge | 2020-03 (kernel release date, unverified) | kernel lifecycle | kernel lifecycle | In kernel, backports for older LTS |
| WireGuard for Windows 0.x | 2019 to 2021 (unverified) | rolling | rolling | Wintun driver, then Windows kernel driver in 2021 (unverified) |

### Licensing eras
| Period | Model | Price | Upgrade discount |
|---|---|---|---|
| 2016 to now | Free software, GPLv2 for the kernel module, MIT for many tools (unverified details) | free | not applicable |

### Trial
Not applicable, it is free software.

### UI generations
| Years | UI name | Introduced with |
|---|---|---|
| 2016 to now | wg and wg-quick command line | first snapshots |
| 2018 to now | Official apps with tunnel list | iOS / macOS / Android apps (unverified) |

## vsFTPeed
Real product: vsftpd (Very Secure FTP Daemon, by Chris Evans)

### Versions
| Version | Released | Updates until | Security until | Headline features |
|---|---|---|---|---|
| 2.0.x | 2004 onward (unverified) | none formal | none formal | Hardened by design, privilege separation, chroot jails |
| 2.3.4 | 2011-07 (unverified) | none | none | Backdoored source tarball briefly on the download site (unverified) |
| 3.0.0 to 3.0.2 | 2012 (unverified) | none | none | IPv6 and SSL cleanups |
| 3.0.3 | 2015 (unverified) | none | none | Maintenance and bug fixes |
| 3.0.5 | 2021-10 (unverified) | none formal | distribution patches | Latest long-stable release |

Maintainership moved to Red Hat and other distributions over time (unverified). There is no formal support policy; each distribution patches its own package.

### Licensing eras
| Period | Model | Price | Upgrade discount |
|---|---|---|---|
| 2001 to now | GPLv2 free | free | not applicable |

### Trial
Not applicable.

### UI generations
| Years | UI name | Introduced with |
|---|---|---|
| 2001 to now | none (CLI and vsftpd.conf only) | none |

## OwnClod
Real product: ownCloud

### Versions
| Version | Released | Updates until | Security until | Headline features |
|---|---|---|---|---|
| ownCloud 1.0 | 2010 (unverified) | none formal | none formal | PHP file sync and share, started by Frank Karlitschek |
| 2.0 to 4.0 | 2011 to 2012 (unverified) | short | short | Sync clients for desktop, apps, versioning |
| 5.0 / 6.0 | 2013 (unverified) | short | short | Encryption, Enterprise edition launched |
| 7.0 / 8.x | 2014 to 2015 (unverified) | short | short | Federated sharing, activity, file drop |
| 9.0 | 2016-03 (unverified) | about 2017 (unverified) | about 2018 (unverified) | Federation improvements, Nextcloud fork announced 2016 |
| 10.0 | about 2017 (unverified) | follows 10.x | follows 10.x | Major refresh, still PHP based |
| 10.x to 10.15 | 2017 to 2024 (unverified) | not confirmed | not confirmed | Ongoing PHP line next to Infinite Scale |
| Infinite Scale 1.0 | about 2021 (unverified) | rolling | rolling | Rewritten in Go, microservices, storage drivers |
| Infinite Scale 6.0 | 2024-06 (via tracker, unverified) | latest only | latest only | continued feature releases |
| Infinite Scale 7.0 | 2024-12 (via tracker, unverified) | latest only | latest only | continued feature releases |
| Infinite Scale 8.0 | 2026-02 (via tracker, unverified) | latest only | latest only | no fixed end of life dates, latest version model (tracker) |

Note: Nextcloud was forked in 2016 by Karlitschek and core developers (unverified). Kiteworks acquired ownCloud around 2023 to 2024 (unverified).

### Licensing eras
| Period | Model | Price | Upgrade discount |
|---|---|---|---|
| 2010 to now | Community: AGPL, free | free | not applicable |
| 2013 to now | Enterprise: subscription per user per year, minimum user count | not found (unverified) | continuous subscription |

### Trial
A 30 day enterprise trial is typical (unverified).

### UI generations
| Years | UI name | Introduced with |
|---|---|---|
| 2010 to 2016 | Original web UI (jQuery) | 1.0 |
| 2017 to 2020 | ownCloud 10 refreshed web UI | 10.0 (unverified) |
| 2021 to now | New Vue-based web (Infinite Scale web) | Infinite Scale 1.0 (unverified) |

## MinnIO
Real product: MinIO

### Versions
Versions are dated tags in the form RELEASE.YYYY-MM-DDThh-mm-ssZ.
| Version | Released | Updates until | Security until | Headline features |
|---|---|---|---|---|
| First releases | 2015 (unverified) | rolling | rolling | S3 compatible object store in Go |
| Erasure coding / Bitrot | 2016 to 2017 (unverified) | rolling | rolling | Erasure coding, bitrot protection |
| License change to AGPLv3 | 2021-05 (unverified) | rolling | rolling | Switched from Apache 2.0 to AGPLv3 |
| RELEASE.2025-05 line | 2025-05 (verified: GUI features removed from community console) | rolling | rolling | Community console reduced to object browser (verified) |
| Maintenance mode | 2025-12-03 (verified) | none (verified: no new features) | case by case (verified) | Steering to commercial AIStor |
| Archived repository | 2026-02 (single source, unverified) | none | none | no longer maintained (unverified) |

### Licensing eras
| Period | Model | Price | Upgrade discount |
|---|---|---|---|
| 2015 to 2021-05 | Apache 2.0 free | free | not applicable |
| 2021-05 to now | AGPLv3 community | free | not applicable |
| about 2019 to now | SUBNET commercial subscription, per capacity | not found; one forum post cites 96,000 USD per year starting price for AIStor (unverified) | not found |
| 2025 to now | AIStor commercial product | see above | not found |

### Trial
A free AIStor tier or trial exists (unverified).

### UI generations
| Years | UI name | Introduced with |
|---|---|---|
| 2015 to 2019 | Browser UI | early releases (unverified) |
| 2019 to 2025 | MinIO Console (full admin) | 2020 (unverified) |
| 2025-05 to now | Object browser only in community, full console in AIStor | RELEASE.2025-05 (verified) |

## Postfixit
Real product: Postfix (Wietse Venema)

### Versions
| Version | Released | Updates until | Security until | Headline features |
|---|---|---|---|---|
| 2.2 | 2005-03 (unverified) | about 2008 (unverified) | about 2008 (unverified) | TLS and SASL improvements |
| 2.3 | 2006 (unverified) | about 2009 (unverified) | about 2009 (unverified) | Milter support |
| 2.4 to 2.11 | 2007 to 2013 (unverified) | each about 3 to 4 years (unverified) | same (unverified) | Postscreen, DNSBL, SMTPUTF8 groundwork |
| 3.0 | 2015-01 (given by requester) | about 2019 (unverified) | about 2019 (unverified) | New numbering, SMTPUTF8 |
| 3.1 to 3.7 | 2016 to 2022 (unverified) | last four stable releases supported (verified rule) | same | Dual licence (IPL / EPL), TLS 1.3, DANE |
| 3.8 | 2023-04-17 (verified) | still supported per one source (unverified) | same | Maintenance |
| 3.9 | 2024-03-06 (verified) | 2026-10-06 per Versio (unverified) | same | Maintenance |
| 3.10 | 2025-02-16 (verified) | 2026-10-06 per Versio (unverified) | same | Maintenance |
| 3.11 | 2026-03-06 (per Versio, unverified) | 2026-10-06 per Versio (unverified) | same | Latest |

Policy: the last four stable releases are supported, no long-term branches (verified via endoflife.date).

### Licensing eras
| Period | Model | Price | Upgrade discount |
|---|---|---|---|
| 2005 to now | Free: IBM Public License, later dual with Eclipse Public License 2.0 | free | not applicable |

### Trial
Not applicable.

### UI generations
| Years | UI name | Introduced with |
|---|---|---|
| 2005 to now | none (CLI and main.cf) | none |

## Mailpig
Real product: Mailcow (mailcow-dockerized). Mapping judged plausible (cow and pig pun). Zimbra is the alternative reading.

### Versions
Version scheme is date-based (YYYY-MM) with occasional patch letters (unverified).
| Version | Released | Updates until | Security until | Headline features |
|---|---|---|---|---|
| First mailcow-dockerized | about 2016 (unverified) | latest only | latest only | Docker Compose mail stack with Postfix, Dovecot, SOGo, Rspamd |
| 2018 to 2022 releases | monthly (unverified) | latest only | latest only | ClamAV, TLSA, 2FA, ActiveSync |
| 2024 to 2026 releases | monthly (unverified) | latest only | latest only | Ongoing updates |

No end of life policy, only the latest release is supported (unverified).

### Licensing eras
| Period | Model | Price | Upgrade discount |
|---|---|---|---|
| 2016 to now | GPLv3 free | free | not applicable |
| about 2018 to now | Commercial support through Servercow | not found (unverified) | not applicable |

### Trial
Not applicable (free software); support offered separately.

### UI generations
| Years | UI name | Introduced with |
|---|---|---|
| 2016 to now | mailcow web UI (Bootstrap) plus SOGo webmail | first release (unverified) |

### Zimbra note
Zimbra Collaboration Suite started 2005. Owners: Yahoo 2007, VMware 2010, Telligent 2013, Synacor 2015, Zimbra 2022 (unverified). Versions 8.0 (2012), 8.8 (2016), 9.0 (2020), 10.0 (2022 to 2023), 10.1 (2024) (all unverified). Open Source Edition free; Network Edition per mailbox subscription (unverified). Trial likely 60 days (unverified).

## Backula
Real product: Bacula

### Versions
| Version | Released | Updates until | Security until | Headline features |
|---|---|---|---|---|
| 1.38 | 2005 (unverified) | none | none | Pre-2.0 stable line |
| 2.0 | 2006 to 2007 (unverified) | about 2008 (unverified) | about 2008 (unverified) | Major 2.x line begins |
| 3.0 | 2009 (unverified) | about 2010 (unverified) | about 2010 (unverified) | Maintenance |
| 5.0 / 5.2 | 2010 / 2011 (unverified) | about 2013 (unverified) | about 2013 (unverified) | Plugins, bat console |
| 7.0 to 7.4 | 2014 to 2016 (unverified) | follows | follows | Ongoing |
| 9.0 to 9.6 | 2017 to 2020 (unverified) | follows | follows | Ongoing |
| 11.0 / 13.0 / 15.0 | 2021 to 2024 (unverified) | latest only (unverified) | latest only | Ongoing |

Note: Bareos fork announced 2010, first release 2013 (unverified).

### Licensing eras
| Period | Model | Price | Upgrade discount |
|---|---|---|---|
| 2000 to now | Bacula Community, AGPLv3 (earlier GPLv2), free | free | not applicable |
| 2008 to now | Bacula Enterprise by Bacula Systems, subscription per agent or volume | not found (unverified) | continuous subscription |

### Trial
A 30 day trial is offered (unverified).

### UI generations
| Years | UI name | Introduced with |
|---|---|---|
| 2000 to now | bconsole CLI | 1.x |
| 2007 to 2020 | Bacula Administration Tool (BAT, Qt) | 2.x (unverified) |
| 2010 to now | Baculum and Bacula Web (web) | 5.x (unverified) |

## Veeham Backup
Real product: Veeam Backup & Replication

### Versions
| Version | Released | Updates until | Security until | Headline features |
|---|---|---|---|---|
| v1 | 2008 (unverified) | about 2010 (unverified) | about 2010 (unverified) | VM-level backup for VMware |
| v3 / v4 / v5 / v6 | 2008 to 2011 (unverified) | follows | follows | Replication, SureBackup, Instant VM Recovery |
| v6.5 / v7 / v8 | 2012 to 2014 (unverified) | follows | follows | Hyper-V, Veeam Availability Suite |
| v9 | 2016-01 (unverified) | about 2018 (unverified) | about 2019 (unverified) | Cloud Connect |
| v10 | 2020-02 (unverified) | about 2022 (unverified) | about 2023 (unverified) | NAS backup |
| v11 | 2021-02 (unverified) | about 2024 (unverified) | about 2024 (unverified) | Linux proxy, CDP |
| v12 | 2023-02 (verified) | end of fix 2025-09 (verified) | end of support 2027-02 (verified) | Direct to object, Kasten integration |
| v12.1 to v12.3 | 2023 to 2025 (unverified) | follows v12 | follows v12 | Updates |
| v13 | 2025-11 (per lifecycle table; may be earlier, unverified) | 2028-11 (verified) | 2028-11 (verified) | Software Appliance on Linux, web UI (unverified) |
| v13.1 | 2026 (unverified) | follows v13 | follows v13 | vSphere 9.1 support (verified) |

### Licensing eras
| Period | Model | Price | Upgrade discount |
|---|---|---|---|
| 2008 to about 2018 | Per socket, editions Standard / Enterprise / Enterprise Plus | not found (unverified) | Maintenance subscription (unverified) |
| 2018 to now | Veeam Universal Licence (VUL), per workload | not found (unverified) | Subscription renewal |
| about 2019 to now | Community Edition, free for limited instances (10 instances, unverified) | free | not applicable |
| 2023 to now | Veeam Data Platform Foundation / Advanced / Premium | not found (unverified) | not found |

### Trial
Veeam offers a 30 day free trial (stated in the task, vendor page not read, unverified).

### UI generations
| Years | UI name | Introduced with |
|---|---|---|
| 2008 to 2020 | Windows console with ribbon | v1 / v9 (unverified) |
| 2020 to 2024 | Refreshed console | v10 / v11 (unverified) |
| 2025 to now | Web UI plus console | v13 (unverified) |
## Debiant GNU/Lunix

Real product: Debian GNU/Linux

Source for dates: debian.org/releases (fetched 2026-11) and Wikipedia Debian version history. Dates are YYYY-MM.

### Versions

| Version | Released | Updates until (regular security support) | Security until (LTS / ELTS) | Headline features |
|---|---|---|---|---|
| 3.1 Sarge | 2005-06 | 2008-03 | none (unverified) | New debian-installer, OpenOffice.org, GNOME 2.8, about 15,400 packages |
| 4.0 Etch | 2007-04 | 2010-02 | none (unverified) | amd64 port, UTF-8 and udev by default, graphical installer option (unverified) |
| 5.0 Lenny | 2009-02 | 2012-02 | none (unverified) | ARM EABI (armel) port, more than 23,000 packages |
| 6.0 Squeeze | 2011-02 | 2014-05 | LTS 2016-02 | Free kernel without blobs, Chromium added, first LTS release |
| 7 Wheezy | 2013-05 | 2016-04 | LTS 2018-05, ELTS 2020-06 | UEFI support, armhf and s390x ports, more than 36,000 packages |
| 8 Jessie | 2015-04 | 2018-06 | LTS 2020-06, ELTS 2025-06 | systemd is the default init, ARM64 and ppc64el ports |
| 9 Stretch | 2017-06 | 2020-07 | LTS 2022-07, ELTS 2027-06 | Linux 4.9, GNOME 3.22, KDE Plasma 5 |
| 10 Buster | 2019-07 | 2022-09 | LTS 2024-06, ELTS 2029-06 | Linux 4.19, AppArmor on by default, Secure Boot support |
| 11 Bullseye | 2021-08 | 2024-08 | LTS 2026-08, ELTS 2031-06 | Linux 5.10, Python 2 removed from the default set, exFAT kernel support (unverified) |
| 12 Bookworm | 2023-06 | 2026-07 (security team handed over to LTS) | LTS 2028-06, ELTS 2033-06 | Linux 6.1, non-free firmware offered in the installer, PipeWire default audio (unverified) |
| 13 Trixie | 2025-08 | 2028-08 | LTS 2030-06, ELTS 2035-06 | Linux 6.12, 64-bit RISC-V port, KDE Plasma 6; i386 installer images dropped |

ELTS is the paid Freexian Extended LTS. Regular security end dates for Wikipedia differ by a few days from debian.org (Bookworm 2026-06 vs 2026-07-11); debian.org is used above.

### Licensing eras

| Period | Model | Price | Upgrade discount |
|---|---|---|---|
| 2005 to now | Free software (DFSG, GPL and others) | 0 | Not applicable; upgrade by apt dist-upgrade |
| 2014 to now | Paid ELTS after LTS ends (Freexian) | Per-contract quote (unverified) | Not applicable |

### Trial

Not applicable. The distribution is free, ISO images are available at no cost.

### UI generations

| Years | UI / installer / management | Introduced with |
|---|---|---|
| 2005 to now | Text-mode debian-installer (ncurses) | 3.1 Sarge |
| 2007 to now | Graphical (GTK) debian-installer as an option | 4.0 Etch (unverified) |
| 2007 to now | Expert and rescue modes, preseed automation | Etch era (unverified) |
| 2019 to now | Calamares on live images only; not the default installer | 10 Buster (unverified) |
| 2023 to now | Installer can load non-free firmware | 12 Bookworm |
| Server admin | Shell, apt, later systemd units; no vendor GUI console | 8 Jessie for systemd |

---

## Windoors Server

Real product: Microsoft Windows Server

Lifecycle dates for 2022 and 2025 were verified on learn.microsoft.com. Other lifecycle dates are from general knowledge of the Microsoft lifecycle pages and marked "(unverified)" for this session. Release dates for 2003 to 2025 come from Wikipedia (the user brief says 2003 R2 2005-12; Wikipedia lists general availability 2006-03, RTM 2005-12).

### Versions

| Version | Released | Updates until (mainstream) | Security until (extended / ESU) | Headline features |
|---|---|---|---|---|
| Windows Server 2003 | 2003-04 | 2010-07 (unverified) | 2015-07 (unverified) | Active Directory improvements, IIS 6, Volume Shadow Copy |
| Windows Server 2003 R2 | 2005-12 RTM, GA 2006-03 | 2010-07 (unverified) | 2015-07 (unverified) | Branch office tools, DFS replication, Unix interop (unverified) |
| Windows Server 2008 | 2008-02 | 2015-01 (unverified) | 2020-01, ESU 2023-01 (unverified) | Server Manager, Server Core, Hyper-V, IIS 7 |
| Windows Server 2008 R2 | 2009-10 | 2015-01 (unverified) | 2020-01, ESU 2023-01 (Azure ESU 2024-01) (unverified) | Hyper-V live migration, 64-bit only, PowerShell 2 |
| Windows Server 2012 | 2012-09 | 2018-10 (unverified) | 2023-10, ESU 2026-10 (unverified) | Start screen UI, Storage Spaces, Hyper-V Replica, SMB 3 |
| Windows Server 2012 R2 | 2013-10 | 2018-10 (unverified) | 2023-10, ESU 2026-10 (unverified) | Start button returns, Storage tiering, Work Folders |
| Windows Server 2016 | 2016-10 | 2022-01 (unverified) | 2027-01 (unverified) | Nano Server, containers, Storage Spaces Direct, per-core licensing |
| Windows Server 2019 | 2018-10 | 2024-01 (unverified) | 2029-01 (unverified) | Windows Admin Center, Kubernetes support, Storage Migration Service |
| Windows Server 2022 | 2021-08 | 2026-10-14 | 2031-10-15 | Secured-core server, SMB over QUIC, Azure Edition hotpatch |
| Windows Server 2025 | 2024-11 | 2029-11-14 | 2034-11-15 | Hotpatching via Azure Arc, NVMe performance gains, Active Directory scale improvements (unverified), pay-as-you-go licensing |

### Licensing eras

| Period | Model | Price (list) | Upgrade / SA equivalent |
|---|---|---|---|
| 2003 to 2008 | Server licence per server plus per-seat or per-device CALs; Standard, Enterprise, Datacenter | Standard about 999 USD, Enterprise about 3,999 USD (unverified) | Software Assurance on Volume Licensing (unverified) |
| 2008 to 2012 | Same; Datacenter licensed per processor | 2008 R2 Datacenter about 2,999 USD per processor (unverified) | Software Assurance, Datacenter SA includes unlimited VMs |
| 2012 (2012-09) | Per processor pair; Standard and Datacenter both full features, differing by VM rights (2 vs unlimited); Essentials for 25 users | 2012 Standard 882 USD, Datacenter 4,809 USD (Datacenter later 6,155 USD in Open NL for 2012 R2); Essentials about 425 USD (unverified) | Software Assurance; HPE channel guide lists 2012 R2 Standard 722 USD and Datacenter 4,829 USD |
| 2016 (2016-10) | Per core, minimum 8 per processor and 16 per server, sold in 2-core and 16-core packs; Standard 2 VMs, Datacenter unlimited | 2016 Standard 16 cores 809 USD, Datacenter 16 cores 4,809 USD (HPE guide) | Software Assurance; Azure Hybrid Benefit from about 2017 to run licensed Windows Server on Azure (unverified) |
| 2019 to 2022 | Same per-core model | 2019 Standard 972 USD, Datacenter 6,155 USD; 2022 Standard 1,069 USD, Datacenter 6,155 USD (unverified) | Software Assurance, Azure Hybrid Benefit |
| 2024-11 (2025) | Same per-core perpetual, plus subscription via Azure Arc pay-as-you-go | Standard 1,176 USD, Datacenter 6,771 USD per 16 cores; User CAL 50 USD, Device CAL 39 USD; PAYG about 33.58 USD per core per month (secondary source, unverified) | Software Assurance; Azure Hybrid Benefit; Arc enables hotpatch subscription |

Note: Windows Server Essentials is a 1-CPU, 25-user edition with no CALs; whether it is sold new for 2025 is (unverified).

### Trial

Yes. Microsoft Evaluation Center offers a 180-day evaluation of Windows Server 2025 (verified: ISO with Standard and Datacenter, VHD, or Azure image; must activate online within 10 days). 180 days for other versions is (unverified); older versions such as 2003 had shorter trials or none (unverified).

### UI generations

| Years | UI generation | Introduced with |
|---|---|---|
| 2003 to 2007 | Classic Windows desktop with Manage Your Server wizard | Windows Server 2003 |
| 2008 to 2011 | Server Manager and roles and features; Aero-style desktop | Windows Server 2008 |
| 2012 to 2015 | Start screen (Metro) and refreshed Server Manager | Windows Server 2012 |
| 2013 to 2016 | Start button restored | Windows Server 2012 R2 |
| 2016 to 2018 | Windows 10 style desktop experience; Nano Server headless option | Windows Server 2016 |
| 2018 to now | Windows Admin Center browser console | Windows Server 2019 era |
| 2021 to now | Windows 10 21H2-style shell, Azure Edition hotpatch | Windows Server 2022 |
| 2024 to now | Windows 11 style shell, Hotpatch via Azure Arc | Windows Server 2025 |

---

Sources fetched: debian.org/releases, Wikipedia Debian version history, learn.microsoft.com lifecycle pages for 2022 and 2025, microsoft.com evalcenter 2025, search results for prices (HPE Q1 2017 guide, TechTarget, microsoft.com pricing).
