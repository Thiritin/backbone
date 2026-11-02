# Hardware, power and failures

A G1 server costs about €26 a month in power in 2005; a G7 costs €89 in 2026 but carries 128 times the RAM. Old hardware also fails more often, so replacing it saves on power, space and outages at once.

**Power cost** per location per month, with W the draw of each device and PUE the overhead for cooling:

```math
\text{power cost} = \sum \frac{W}{1000} \cdot 730 \cdot \text{PUE} \cdot \text{price per kWh}
```

| Location | PUE | Billing |
| --- | --- | --- |
| Basement | 1.0 | Household price |
| Cage or suite | The datacenter's power factor | City business price × power factor; a rack above its position's kW limit trips |
| Own room | 1.6 | City business price |
| Own datacenter | 1.4, or 1.2 with liquid cooling | City business price, or a custom contract: 3 years fixed at 10% below the current price |

Only devices that are switched on and have a plugged-in, working power supply count as W. Plugging and unplugging a supply is free; a device that gets power from its first supply boots for 1 hour.

**Buying and selling.** Hardware arrives 72 hours after ordering in 2005, falling in a straight line to 24 hours in 2015 and staying there (`deliveryHours`). Supply shocks stretch that wait for the kinds and parts they hit (`SUPPLY_SHOCKS`, `leadFactor`): the factor rises along an S-curve from the start date to its peak, holds, and eases back to 1 by the end date. A server or chassis counts as every part it is built from, so a server with HDDs waits for the flood and every server waits for the memory crunch. A cart ships as one delivery after its slowest line, and the Cart shows that wait; leasing waits the same. Used listings ship from their sellers and keep their own shipping time.

| Shock | Hits | Rises from | Peak from | Peak until | Normal by | Peak factor | Peak wait |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Thailand flood | HDDs, servers with HDDs | Oct 2011 | Nov 2011 | Feb 2012 | Jul 2012 | 4 | about 7 days |
| Chip shortage | Servers, chassis, switches, firewalls, routers, NICs | Mar 2021 | Sep 2021 | Jul 2022 | Jan 2023 | 6 | 6 days |
| AI memory crunch | RAM, SSDs, NVMe drives, every server | Jan 2025 | Oct 2025 | Oct 2026 | Jan 2027 | 5 | 5 days |

Anchors: the flood took out about a quarter of world HDD output and drive lead times stretched from days to weeks into early 2012; in the chip shortage, server and switch lead times went from 4 to 8 weeks to 6 to 12 months; in the 2025 to 2026 AI crunch, DRAM and enterprise SSD makers put buyers on allocation with lead times of months. Real waits of months would stop a game month (12 real hours at 1x) dead, so the peaks are 4 to 6 times the normal wait, which turns a one-day delivery into most of a game week. Until it arrives a unit is in transit and cannot be mounted, sold or shipped; the Cart shows the wait as "Arrives in 3 days". A company that owns no server yet gets its orders at once, so the first server is in the stockroom the moment it is bought (the starter rule). Spares taken out of a device go to storage at once. Bought hardware goes to storage. Mounting it into a rack, and taking it out again, is hand work of 30 minutes for a 1U device and 15 minutes more for each further unit (`mountHours`); a stack is one job for the sum. In the basement the founder does it at once and for free. At a datacenter it gets done like a repair: by remote hands after their response time at their hourly rate for at least one hour, by the player on site, by a friend after the drive, or by a technician at that location from the queue at no fee. A device that is being mounted cannot be switched on and does not work until the work is done; a device that is being taken out waits in storage until then and cannot be mounted or shipped. Resale value falls in a straight line from 100% to 80% of the price over the first month, then in a straight line to 20% over the next 24 months, and stays at 20%. Racks sell the same way; spare parts sell at the current part price. A spare-parts kit costs 5% of the device's price and turns a repair into a 2-hour task.

**Failures.** Each device has a base annual failure rate (AFR), raised in its first 3 months and again after 3 years of age:

```math
\text{AFR}(a) = \text{base} \cdot e(a) \cdot \big(1 + 0.4 \cdot \max(0,\ a - 3)\big), \qquad e(a) = \begin{cases} 1.5 & a < 0.25 \\ 1 & \text{otherwise} \end{cases}
```

Here a is the age in years, and the chance of failing in any game hour is AFR ÷ 8,760. A 6-year-old server fails 17.6% of the time per year.

| Device | Base AFR | Effect of a failure |
| --- | --- | --- |
| Server | From its components (see Components) | Depends on the component; see Wear, failures and maintenance in the GDD |
| Access or core switch | 2% | Everything wired only to it goes offline |
| Edge router | 1.5% | Its uplinks go down; traffic spills to other exits if there are any |
| UPS | 3% | The next grid outage takes the room down |

Without a spare kit in stock, a repair waits for a delivery first.

**Components.** Each component's chance of failing in a year depends on whether it is past its life expectancy, and is multiplied by the manufacturer's failure factor and by 1 + the device's hot hours ÷ 100 (see Cooling and overheating). The chance per game hour is the yearly rate ÷ 8,760.

| Component | Life expectancy | Yearly failure rate before | After | Part price | Swap while running |
| --- | --- | --- | --- | --- | --- |
| HDD | 5 years | 1.5% | 8% | €120 | In RAID |
| SSD | 5 years | 0.8% | 4% | €150 | In RAID |
| NVMe | 5 years | 0.6% | 3% | €200 | In RAID |
| Power supply | 7 years | 1% | 6% | €150 | With two |
| Fan | 6 years | 1% | 7% | €25 | Yes |
| RAM stick | 12 years | 0.2% | 0.6% | €60 | No |
| Mainboard | 12 years | 0.3% | 1% | €600 | No |
| CPU | 7 years | 0.05% | 0.2% | €400 | No |
| Network card | 10 years | 0.3% | 1% | €80 | No |

A server has 4 fans; a switch or router 2 fans, 1 or 2 power supplies and a board that fails like a mainboard. The part price column is the reference price of an unsized spare; the shop sells parts at the prices of Part prices by year.

**Cooling and overheating.** Each location keeps a room temperature: 22 °C in a datacenter hall, and in the basement 22 + 5 · cos((month − 6.5) · π / 6), from 17 in January to 27 in July. A server's inlet adds up to 3 °C as its rack nears its power limit and 6 °C behind a failed fan. On top of that the room carries heat H, which the sim steps every game minute (60 steps when an hour is ticked at once):

```math
\frac{dH}{dt} = \frac{0.5}{m}\,\big(P - C - s \cdot H\big) \quad \text{°C per minute}, \qquad H \ge 0
```

P is the kW the location's racks draw and m the room's mass: its positions in a hall, 4 in the basement. A hall's cooling C is 1.2 × the kW limits of its racks, so it never falls short while it works, and it sheds s = 0.02 kW per position and degree through the building. The basement has no cooling unit: it sheds C = 3 kW at its normal temperature and s = 0.2 kW more per degree, so a basement drawing 4.5 kW on its extra circuit settles 7.5 °C warmer. A hall's cooling fails 0.3 times a year per location for a log-normal duration (median 40 minutes, σ 1, 5 minutes to 8 hours); C is then 0. A full 3.3 kW position climbs 1.6 °C a minute and reaches 45 °C after about 14 minutes, a 0.3 kW position 0.15 °C a minute.

**CPU temperature and fans.** A server's CPU runs at inlet + 20 °C × utilisation × (1 + 1 per failed fan); it equals the inlet when the server is off. Its fans spin at 30% of their 12,500 rpm maximum up to 50 °C CPU and rise in a straight line to full speed at 80 °C; a failed fan reads 0 rpm. The IPMI sensor page shows the CPU temperature (warning from 85 °C, critical from 95 °C), each fan's rpm (warning below 2,000) and the fan speed in percent. From 85 °C CPU the server throttles: its performance falls in a straight line to 50% at 95 °C and stays there, and its event log records a warning when it starts and a line when it stops. Every hour at 90 °C CPU or more counts as a hot hour. A server keeps the worse of its inlet throttle and its CPU throttle, never both. Healthy fans keep a server under 50 °C CPU at full load in any room under 30 °C, so only failed fans or a hot room bring it there: two failed fans at full load reach about 91 °C in a hall and 96 °C in a basement in July.

| Inlet | Effect |
| --- | --- |
| 35 °C or more | The server throttles to 60% of its performance, or its CPU throttle if that is lower, which slows the customer apps on it (see Usage curves), and every hour counts as a hot hour |
| 45 °C or more | The server shuts itself off with the same corruption roll as a pulled plug |
| Below 30 °C after a shutdown | The server switches itself on and boots; the minutes it was off are recorded as an Overheating incident with the usual refund requests and reviews |

Each hot hour adds 1% of a component's rate for good: 100 hot hours double every component's failure rate in the device.

**Chassis slots.** Each server line has a fixed number of DIMM slots, drive bays, PCIe slots and power supply bays. Sockets are 2 (1 for ARM, backup and archive). The DIMM column interpolates between the generations given: G1 and G2 share the G1 value, G3 and G4 the G3 value, G5 and G6 the G5 value.

| Line | DIMM slots G1 / G3 / G5 / G7 | Bays | PCIe | PSU bays |
| --- | --- | --- | --- | --- |
| Balanced 1U, Compute-dense 1U, ARM 1U | 8 / 12 / 16 / 32 | 4 × 3.5" to G2, 8 × 2.5" at G3, 10 NVMe-capable from G4 | 2 | 2 |
| Memory-optimized 2U | 16 / 24 / 32 / 48 | 8 × 2.5" to G3, 8 NVMe-capable from G4 | 4 | 2 |
| Storage 2U | 8 / 12 / 16 / 24 | 12 × 3.5" to G5, 12 NVMe-capable from G6 | 4 | 2 |
| Backup storage 4U | 8 / 12 / 16 / 24 | 36 × 3.5" | 4 | 2 |
| Archive storage 4U | 8 / 8 / 16 / 16 | 60 × 3.5" | 2 | 2 |
| GPU 4U | 16 / 24 / 32 / 48 | 8 NVMe-capable | 8 (a GPU takes 2) | 2 |

Anchors: Dell PowerEdge 1950 (2006) has 8 DIMMs, 4 × 3.5" or 6 × 2.5" bays and 2 PCIe slots; the R630 (2014) has 24 DIMMs and 10 × 2.5" bays with 4 NVMe; the R660 (2023) has 32 DIMMs and 10 NVMe bays. A 2.5" bay takes SATA or SAS drives, an NVMe-capable bay also takes NVMe drives, and a 3.5" bay takes 3.5" drives only (a 3.5" SSD counts as a 3.5" drive). The storage line moves to NVMe-capable bays when its generation ships NVMe drives. The memory line outgrows the generation's standard stick, so its presets use sticks of twice the size until they fit the DIMM slots.

A part has a size: GB for RAM sticks and drives, cores for CPUs. The preset splits the model's RAM, drive capacity and cores evenly over its sticks, drives and sockets, so the capacity of a bought server is the number in its spec. Capacity comes from the working parts: a failed stick or CPU stops counting. All installed drives are array members, and the smallest sets the size each contributes, so RAID usable space is the level's formula over the drive count times the smallest drive. A failed drive stays in the array until replaced. A mirror pairs drives, so an odd drive count in RAID 1 or RAID 10 leaves one drive unused.

**Bare chassis, extras and parts.** A bare chassis costs the preset price (with the brand factor) minus the CPUs, RAM and drives of the preset at the year's part prices (Part prices by year), and never less than 25% of the preset price. Extras and parts cost the year's part price for their size each, and the brand factor does not apply to parts; where the 25% floor does not apply, a bare chassis plus the preset's parts costs the preset price. The Parts tab offers every size the presets in the shop are built from, which is the current generation and the one before it (a generation stays in the shop until the one two steps newer arrives), plus NVMe drives of 1, 2, 8 and 15 TB from G4, G5, G6 and G7 (Intel P3700 800 GB in 2014). Installing or removing a part that swaps while running is instant in the basement; any other part takes 30 minutes in the basement, and at a datacenter the work takes the remote hands' response time and is billed at their hourly rate for at least one hour, as a swap is.

**RAID.**

| Level | Drives | Usable | Survives |
| --- | --- | --- | --- |
| None | 1+ | All | Nothing; a failed drive loses its data |
| RAID 1 | 2+ | Half | 1 drive |
| RAID 5 | 3+ | All but one | 1 drive |
| RAID 6 | 4+ | All but two | 2 drives |
| RAID 10 | 4+, even | Half | 1 drive per mirror pair |

| Rebuild rate | Rebuild speed | Server performance while rebuilding |
| --- | --- | --- |
| Low | 50 MB/s | × 0.95 |
| Medium | 150 MB/s | × 0.8 |
| High | 400 MB/s | × 0.6 |

A rebuild takes the used data on the drive ÷ the rebuild speed, so a 4 TB HDD that is 70% full takes about 5 hours at medium. Until workloads fill drives, every drive counts as 70% full. A server with two or more drives starts in RAID 1, one with a single drive in none, and changing the level needs the server off and wipes its data.

**Maintenance.** A swap takes 15 minutes once someone is there. In the basement you are there at once. At a datacenter remote hands arrive after their response time and bill their hourly rate for at least one hour.

**Hand work yourself.** At a datacenter the same swap can be done by you or by a friend, after the drive from the home city (the basement's city). Same city: 1 hour and EUR 20 (anchor: a regional train ticket). Same country: 4 hours and EUR 90 (an ICE return). Another European country: 9 hours and EUR 250 (a short-haul flight). Overseas is not offered. A datacenter that is the highest position price of a city with a rival (`visitBooking`) adds 24 hours for the booked visit. Doing it yourself keeps `playerBusyUntil` set through the drive there, the work and the drive back, and waits behind replies already queued. A friend charges EUR 35 (pizza and beer), at most 3 times per calendar year (`friendFavours`), takes the same drive time and leaves the player free; the game's random sequence rolls a 10% chance per favour that the work takes twice as long. Neither option bills remote hands. A player already at the datacenter presses the front panel buttons and plugs the power cords at once, with no drive and no fee.

**Remote management, hangs and pulled plugs.** A baseboard management controller is part of the server board: it needs no extra part and costs nothing. Anchors for when it appears: Dell DRAC 5 on PowerEdge 9G in 2006 as an add-in card and iDRAC standard from 11G in 2009; HP iLO 2 on ProLiant G5 in 2006; Supermicro onboard IPMI on X8 boards in 2009; Lenovo IMM on System x from 2008. The game maps them to the generations: Dwell and Hewlett-Packet from generation 2 (2008), SuperMacro and Lenovoid from generation 3 (2011), the ARM line always, generation 1 (2005) never. The management address follows the private address rule: 192.168.3.x in the basement, 10.n.2.x in datacenter n, with the same host octet. Hang rates have no public source and are game choices.

| Event | Rate | Raised by |
| --- | --- | --- |
| Operating system hang | 1% a year | × 2 while a part has failed (degraded or hot) |
| Management controller hang | 1% a year | × 3 once the server is 6 years old |
| Corruption after a hard stop with running workloads | 15% | Pulled power, reset and power cycle; never after a graceful shutdown |
| Recovered workload comes back fine | 70% | The other 30% need a restore from backup |

Rates are rolled hourly (yearly rate ÷ 8,760) per server and do not draw from the game's random sequence. A reset or power cycle boots for 1 hour. A graceful shutdown completes within the hour and stops the workloads cleanly. A recovery takes 30 minutes per workload, with no remote hands fee because the work happens in the operating system. Resetting a hung controller takes 15 minutes on site, plus the remote hands' response time and a one-hour fee in a datacenter; a technician does it without a fee. When corruption hits a server whose array has all its drives and no rebuild running, the array resyncs for the rebuild time of a drive instead (server performance × 0.95, × 0.8 or × 0.6 by rebuild rate) and no workload is corrupted.

**Remote access.** KVMs, console servers and OOB switches are bought once and stay in the Shop to the end of the game. Anchors: a PiKVM v3 kit cost about USD 150 in 2021 and DIY builds about EUR 60; Avocent 8-port IP KVMs sold around USD 1,500 in the 2000s; Opengear 16-port console servers cost around USD 2,500; Raritan sold small OOB management switches.

| Item | From | Price | Draw | Notes |
| --- | --- | --- | --- | --- |
| PiKVN | 2019 | 60 € | 5 W | 0U on the rail, one server, power through its own ATX adapter |
| IP-KVN 8 | 2005 | 1,200 € | 25 W | 1U, 8 servers, console only |
| ATX adapter | 2005 | 25 € | | Fitted to a server, lets an IP-KVN switch its power |
| OpenGearbox 8, 16, 48 | 2005 | 1,500 €, 2,500 €, 6,000 € | 15, 18, 30 W | 1U, rollover cables to console ports |
| OOB switch 8 | 2005 | 150 € | 8 W | 1U, 8 management ports |
| Management DSL | 2005 | 20 € a month | | Own way in for a console server or OOB switch |
| Cellular modem | 2008 | 30 € a month | | Same, on the mobile network |

| Event | Rate or time |
| --- | --- |
| Stuck boot after a part swap or a hard power event | 5% per server |
| Continue boot | 2 minutes over a controller or a console |
| KVM, console server and OOB switch failure | 4% a year for KVMs, the default device rate for the others |
| Firmware update | 10 minutes of reboot |
| Switch or router hangs during a firmware update | 10% |
| Lockout on a port group change | 2% |
| Recover over console | 5 minutes |
| Management firmware vulnerabilities | 1 a year |

Stuck boots, hangs and lockouts are rolled per device and hour and do not draw from the game's random sequence. Without a console, Continue boot and Recover are hand tasks billed as one hour of remote hands in a datacenter. An exposed management device is checked once a day against the risk of its open vulnerabilities, the same risk as an exposed software instance.

**Hardware lifecycle.** Every model on sale has a last year on sale (end of sale) and a number of support years after it; the model is out of support once the year passes that sum. Devices keep working past both dates. The anchor is Cisco's policy of ending sale six months after the notice and keeping support and spares for five more years; Dell and HPE sell five to seven years of support for servers.

| Kind | Last year on sale | Support years after it |
| --- | --- | --- |
| Server | Launch year of the generation two later, minus one (the two newest generations have none yet) | 5 |
| Switch, firewall, router | Launch year + 6 (none for the newest model of a line) | 5 |
| UPS, PDU | Launch year + 8 (none for the newest model of a line) | 3 |
| Patch panel | Never | None |

- **Price erosion.** A non-server model's list price falls 5% a year from the second year of sale (launch year + n costs 0.95^n of the list price) until its last year on sale, as successors arrive. A server's price follows its parts (see Part prices by year) and is not eroded.
- **Out of support.** Hands-on work on the device (swapping, installing or removing a part) takes twice as long, a spare part for it costs 1.5 times its price (the extra half is booked as a grey market premium when the part goes in), and every component fails 1.2 times as often because the firmware no longer gets fixes. Work that takes no time on a running device stays instant.
- **News.** Each non-server model ends with a Heize online item on 1 January of the year after its last year on sale.

**Used hardware.** Listings come from the current preset price of the model (Part prices by year for servers, eroded list prices for the rest) with the seller's brand factor. A listing's brand has already released the model.

| Rule | Value |
| --- | --- |
| New listings per channel and month | 2 to 6, posted over the month at random hours, the first month with the new game; a model qualifies once its launch is at least 2 years back, and a model from 2005 counts as launched in 2002, so 2005 listings are 1 to 3 years old at the usual price bands |
| Age of a unit | 1 year up to the years since the model's launch |
| WebHostingTalc ask | 60% of the preset price at 1 year falling in a straight line to 45% at 6 years and older |
| Craigslost ask | 45% falling to 30% the same way; 15% of the deals are scams that take the money and ship nothing |
| eBuy | Starts at 25%; the rival's maximum is 35% to 70%; the higher maximum wins and pays the other's maximum |
| Visible defect | 30% of single units; PSU 2 missing ×0.85 (two-supply models), 1 drive reports errors ×0.8 (the drive arrives one year past its life), no rails ×0.95 (rack-mounted) |
| Hidden part age | Each part's age is the unit's age times 0.5 to 1.5 |
| Listing lifetime | eBuy 5 to 10 days, ending at 20:00; board 10 to 30 days after the day of early access; chat 4 to 10 days |
| Shipping | 3 to 5 days; 1 day from a board or chat seller in the destination's city (35% of sellers are in a city where the player has a location) |
| Selling on the board | Default ask 1.3 times the resale value (Buying and selling); a buyer pays the ask within 7 to 30 days when it is under 1.5 times the value, otherwise the listing expires after 30 days |
| Selling on eBuy | Starts at half the value and ends at 1 to 1.4 times the value within 7 to 30 days, minus an 8% fee |
| Board reputation | +1 per board purchase or board sale, never from scams; 5 shows board listings 24 hours early; 15 brings one VPS lead a month |
| Bust hoster's lot | Once a year: 20 servers of one model as one board listing at 35% of their preset price, from the player's first city, for 14 days |
| Clearance weekend | Once a year: 10 eBuy auctions ending on the second evening |

Used devices cannot be leased and resell from the price paid like any other device. Anchors: eBay server lots sold at 30% to 50% of list in the 2000s, and WebHostingTalk marketplace asks sit around half of the new price.

**Burn-in.** A racked server that is on, has power and sits in no cluster and runs no workload can be burned in. The server counts as busy for the whole test: it draws its full rated power at the location's rate, and in a datacenter the rack position and power limit are used as usual. The test ends early if the server loses power.

| Rule | Value |
| --- | --- |
| Quick | 6 hours; every hidden part at 80% of its life or more is marked worn, the others stay unknown; no failures |
| Full | 48 hours; every hidden part shows its real age; each working part past its life fails with 50% (seeded by game seed, hour and device) |
| Bonus | A full burn-in in which no part failed multiplies the server's failure chance by 0.9 for 365 days (it stacks with the other failure factors) |
| Used parts | Parts bought on the used market are hidden until a burn-in has looked at them; replaced parts are known |
| Buyer protection | The first failed part of a unit bought on the board or eBuy within 14 days of its arrival refunds half the unit price, once; Craigslost deals never refund |

**Power feeds.**

| Feed | Effect | Price |
| --- | --- | --- |
| Feed A | Included with every position, at the datacenter's kW per position | In the rent |
| Feed B | Second feed at the same limit as A; servers with two power supplies split their draw over both and survive a feed failure while A and B together fit one feed's limit | 40% of the position price per month |
| High-density feed | Doubles the position's kW limit | 60% of the position price per month |
| Basement circuit | One extra household circuit, +3 kW | €400 once |

**Breakers.** Every feed, the basement circuit included, carries 80% of its limit continuously, as the electrical code rates a breaker for loads that run three hours or more. A feed above its limit trips at once; a feed above 80% of it trips after three hours there. Servers that hang on the tripped feed alone switch off and stay off. Single-supply servers, network gear and customer equipment hang on feed A. A dual-fed server draws half its power from each feed, so when a feed fails or trips its whole draw moves to the other one; when that exceeds one feed's limit, the other feed trips as well and every server in the rack goes dark for the outage. Customer colocation is only placed in a rack while its whole draw stays under 80% of one feed.

**Monitoring.** Without monitoring, failures only show as lights on the device fronts. Monitoring is a tier 1 skill in Research.

| Product | Parody of | Price | Trade-off |
| --- | --- | --- | --- |
| "Nagiost" | Nagios | Free | Alerts only after 15 minutes; dashboard refreshes hourly |
| "Zabbicks" | Zabbix | Free | Alerts after 5 minutes; more admin work as it grows |
| "DataDawg" | Datadog | €15 per monitored device per month (2026, m = 3) | Alerts within a minute and the best dashboard |

**Data loss and backups.** A workload with a lost disk is down until it is restored or rebuilt empty. Restoring takes the volume's size ÷ the link speed from the backup server.

| Situation | Happiness | Ticket |
| --- | --- | --- |
| Restored from a backup | −15, and −1 more per hour of backup age, at most −40 | Outage ticket |
| No backup | −60 | Refund request; the customer churns if it is refused |
| Refund granted (one month's fees) | +20 | Closes the refund request |

Backup rules: hourly, daily or weekly, kept 7, 14 or 30 days. A full copy plus 5% of the volume per extra day kept fills the backup pool. Backup jobs follow the backup usage curve and use the zone's switch bandwidth.

**How the first build plays backups.** A cluster backs up to another cluster, in its own zone or another one, daily or weekly (Sundays), at 02:00, with one retention for all: the pool needs 1.3 × the used disk of every workload backed up to it. A job fails with a notification when the target's control plane is down or its nodes lack the free disk. A backup records the hour on each workload. When a server's array is lost, the game opens an incident report listing every workload on it with its customer, disk and last backup. Customers without a backup lose 60 happiness at once and ask for a refund. Restoring from a backup takes the used disk ÷ 450 GB per hour inside the zone or ÷ 45 GB per hour from another zone, rounded up to whole hours, and costs the happiness in the table, counted from the hour of the loss. Without a backup, a restore starts the workload on an empty disk. A refund pays back one month of the service's fees; declining one makes the customer leave. Restores from a backup, refunds and declines each give the customer the review chance from Marketing and reviews, with the 3-star rule after a refund.

**Power outages.** Grid outages are random events per location. They are far more frequent than in reality, so the player meets them in the first year. The basement's household line fails twice as often as a datacenter's utility feed (decision).

| Event | Rate | Duration | What survives it |
| --- | --- | --- | --- |
| Grid outage, basement | 3 a year | Median 20 minutes, 10% last over 2 hours, at most 12 hours | Rooms with a UPS, while its battery lasts |
| Grid outage, datacenter | 1.5 a year per location | As above | Datacenters with generators; a datacenter UPS alone bridges 15 minutes, plus any UPS of your own |
| Datacenter feed failure | 0.3 a year per feed | Median 30 minutes | Servers with a second PSU on the other feed |
| Generator fails to start | 2% of grid outages at a datacenter | Until the grid returns | Nothing on that feed |

A UPS runs for its battery capacity divided by the load:

```math
\text{runtime (min)} = \frac{\text{battery Wh}}{\text{load W}} \cdot 60
```

| Item | Price in 2005 | Notes |
| --- | --- | --- |
| Small UPS, 1,500 VA, 600 Wh | €180 | Carries a small basement rack (0.2 kW) for about 3 hours |
| Second feed (A+B) | Included where the datacenter has it | Only protects dual-PSU servers |
| Dual power supply | +10% of the server's price | PSU failures make up about a quarter of a server's AFR; with two PSUs they no longer take the server down, so its AFR drops from 8% to 6% |

Prices follow the same yearly multipliers as other hardware (see [Prices over time](prices-over-time.md)).

An outage reaches the servers for the minutes the UPS and the site can't bridge, rounded up to whole hours of downtime. Customers hit by an hour or more ask for a refund with a 10% chance at low budget, 15% at medium and 30% at high budget (decision).


### Erasure sets

The drives of a MinnIO cluster form sets of up to 16. Parity 2 or 4 is how many drives of a set can fail; the data shards leave `(n - parity) / n` of the disk, so EC:2 on 8 drives is 75% and EC:4 is 50%. One to parity failed drives mean a degraded set: the storage customers are marked slow, and after 72 hours without a replacement each loses 1 happiness a day. More failed drives than the parity take the set offline until a drive is back. A replaced drive heals at 40 GB per hour.
