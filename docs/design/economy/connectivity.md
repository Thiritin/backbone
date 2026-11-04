# Connectivity

The numbers behind [the connectivity design](../gdd/connectivity.md): uplink speeds by year, the monthly price of a line, the modules above 10 Gbit/s, and the provider cable. The code holds them in `src/sim/10-catalog/uplinks.ts`.

## Uplink lines by year

A band holds from its year until the next band starts. The floor is the slowest line a provider still sells, the standard is what most racks book, and the ceiling is the fastest on offer. Prices are euros per line per month, on top of the carrier's transit or the exchange's port. A second line costs the same as the first. A speed a band no longer sells keeps the price of the band that last sold it.

| Band | Floor | Standard | Ceiling | Line prices |
|---|---|---|---|---|
| 2005 | 10 Mbit/s | 100 Mbit/s | 1 Gbit/s | 10M 60, 100M 150, 1G 400 |
| 2010 | 100 Mbit/s | 1 Gbit/s | 10 Gbit/s | 100M 100, 1G 250, 10G 900 |
| 2015 | 100 Mbit/s | 1 Gbit/s | 40 Gbit/s | 100M 80, 1G 200, 10G 650, 40G 1,500 |
| 2020 | 1 Gbit/s | 10 Gbit/s | 100 Gbit/s | 1G 150, 10G 450, 25G 800, 40G 1,100, 100G 2,200 |
| 2025 | 1 Gbit/s | 10 Gbit/s | 400 Gbit/s | 1G 120, 10G 350, 25G 600, 100G 1,600, 400G 5,000 |
| 2030 | 10 Gbit/s | 100 Gbit/s | 1.6 Tbit/s | 10G 300, 25G 500, 100G 1,200, 400G 3,500, 800G 6,000, 1.6T 10,000 |

Each speed gets cheaper from band to band while the ceiling rises, so a rack's standard line costs about the same across the years: 150 in 2005, 250 in 2010, 450 in 2020 and 1,200 in 2030.

## Modules above 10 Gbit/s

A line above 10 Gbit/s needs a router or switch port of the matching kind and one module per line, bought as a part in the Shop.

| Port kind | Fastest speed | Sold from | Module price |
|---|---|---|---|
| SFP+ | 10 Gbit/s | 2005 | 120 |
| QSFP28 | 100 Gbit/s | 2015 | 400 |
| QSFP-DD | 400 Gbit/s | 2020 | 900 |
| OSFP | 800 Gbit/s | 2025 | 1,500 |
| InfiniBand | 1.6 Tbit/s | 2030 | 2,500 |

## Provider cable

A cable between two rented racks in the same datacenter costs 150 once, billed when the provider has laid it, and takes two days. A cancelled order costs nothing.
