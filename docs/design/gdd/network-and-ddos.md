# Network and DDoS

Each location connects to the internet through what its city offers: transit carriers, internet exchanges and, later, private peering. Bandwidth costs money, and your customers' traffic has to fit through your links.

**The map.** The Network app opens on Western Europe's big cities, such as Frankfurt, Amsterdam, London, Paris, Berlin, Vienna, Zurich and Milan. The rest of the world stays zoomed out and only matters as distant transit destinations. The map itself covers the whole world, with coastlines, cities and the submarine cables from Series of Tubes (MIT). Datacenters stand in Europe (the big cities plus Düsseldorf, Munich, the budget hoster parks in Nuremberg and Falkenstein, and SkyBlink in Kerkrade on the Dutch-German border) and in North America (Ashburn, New York, Chicago, Dallas and Los Angeles). The cables are drawn without gameplay. The Add location dialog switches between Europe and North America; a wave or a rack move across the Atlantic costs much more than one within a continent. The Locations overview and the Add location dialog use the same map. Each city has its own carriers and prices, internet exchanges, datacenter operators, power price and demand.

**Ways to connect**

| Option | How it works | Cost | When |
| --- | --- | --- | --- |
| Home line | A consumer line in the basement, from DSL in 2005 to fiber later; upload stays slow until business fiber | A flat monthly fee per line; business lines with static addresses cost more | Start |
| Datacenter bandwidth | The datacenter's own transit, through its handoff | Per TB or per Mbps | Early |
| IP transit | A port with a carrier present in the city | Billed at the 95th percentile, with a minimum commit | Mid game |
| Exchange peering | A port at an internet exchange, then sessions with other networks | Port fee; the traffic itself is free | Mid game; needs your own network number (ASN) |
| Private peering | A direct cable to one big network | Cross-connect fee; weeks of lead time | Late game |
| Links between locations | Leased wavelengths or dark fiber | Monthly fee | Several locations |

**The basement's line.** The basement sends all its traffic through the home line's upload. Once a second server's customers push the evening peak past it, the basement's sites get slow: customers lose a little happiness each hour and some write in, as on an overloaded server. Locations and Network show the line's peak upload over the last week, and the first time a line runs full a notification says so. A faster line in Locations is the fix, alongside the move to a datacenter. Lines get faster over the years: DSL 16000 in 2005, VDSL 50 from 2007, VDSL 100 from 2014, each also as a business line with static addresses. 

**The move to a datacenter.** Once the basement's four servers are full, growth needs datacenter space. The cheapest start is a rack share in the home city, such as a quarter rack at Hetzler Park in Frankfurt for €63 a month, billed monthly with power and bandwidth. RAM is what runs out first, so the memory-optimized 2U (32 GB for €4,500 in 2005) is the server to buy there, and a lessor carries it when the bank's limit is used up: a 36-month lease of about €135 a month is paid for by the server's first 10 GB of customers. A new location needs its own cluster, because a cluster stays within one zone. A cluster that sells in a datacenter is created in Locations, with a hypervisor installed in Products.

**Uplinks.** A location can have as many uplinks as its routers have ports. Each uplink is a contract with one carrier or exchange and has one or more links. Every link uses one router port, and its speed is limited by that port and by what the provider sells that year; [Connectivity](connectivity.md) has the speeds by year, the provider panel where each line lands, and the modules above 10 Gbit/s. A small router has a few 1G ports, and bigger ones have 10G, 100G and 400G ports, so faster or more links mean a better router. Two links on two routers keep the uplink up when one router fails, and a second carrier keeps you online when the first has an outage.

**Joining an exchange.** You apply for membership at the exchange, which needs your own network number (ASN) and costs a setup fee plus a yearly fee. Then you order ports: one, two or more, each at a speed your routers support. The exchange delivers each port as a cross-connect to your patch panel after a lead time. Connecting to the exchange's route servers gives you sessions with every network that peers openly, and other networks need their own session. Exchanges such as DE-KICKS also offer ports in other cities, so one membership can cover several locations.

**Peering requests.** Once you are a member of an exchange, other members ask to peer with you, and each request arrives in your inbox. It shows the network's name, its PeeringDB-style facts (how many routes and prefixes it announces, its traffic level, its peering policy and which exchanges it is on) and what it expects in return. Small networks with a handful of routes save you little transit but cost a session to maintain; large ones move real traffic off your paid transit. You accept or reject each request. Big eyeball networks rarely ask and are hard to win over; small hosters and hobby networks ask often. As you grow, more and bigger networks ask, and your own requests to them are accepted more often.

**Topology view.** A second view of the same data draws the network as a tree from left to right: carriers and exchanges, uplinks, routers, switches and the servers on each switch. Every line shows its speed and is coloured by load with the same thresholds as the request bars. Clicking anything opens it in the inspector, and switches with many servers collapse into a count until you expand them.

**Uplinks in the Network app.** A location's page lists its uplinks as cards, one per carrier or exchange, with the type, every link with its speed and router port, the 95th percentile against the commit, and the monthly cost.

**Private networks.** Customers with several workloads, such as agencies, shops and enterprises, ask for a private network between them. A private network is a VLAN on your switches: workloads in it reach each other only if every node they run on has a switch port that carries the VLAN. A port to a node can carry all customer networks with one toggle, which is the easy setting. Enterprise customers require a private network, and other customers buy one as an add-on. One switch domain holds up to 4,094 VLANs; overlay networks (an unlock) lift that limit and stretch a private network across racks and locations.

**Every zone has its own network.** Carriers, transit, exchange ports, private peering and the gateway belong to one availability zone, just like racks and storage. A new zone starts with only what its datacenter offers. The one thing that ties zones together is a link you book between them, leased capacity or dark fiber. Over that link a zone can send traffic out through another zone's better transit and peering, so one well-connected site can carry a weaker one, at the cost of the link and the latency. The same link carries migrations between zones, and how long they take depends on the bandwidth left over. Without a link, zones share nothing.

**Path and latency.** `pathTo` lists the hops between two devices over the cables, with patch panels skipped: gateways, firewalls and switches, the home line as a hop named after its carrier, the datacenter's handoff as an uplink hop named after the datacenter, and a core hop for the distance between two cities. Ping and traceroute from the desk start at the basement home router. A stopped switch, firewall or gateway, or a basement without a line, ends the route: traceroute prints the hops that answer and `* * *` for the rest, ping reports 100% packet loss, and `ssh` times out. Each hop adds its latency (economy/traffic-and-bandwidth.md, Traffic and bandwidth) and every printed time varies by 10%. A line or uplink above 80% of its exit capacity adds delay and loses packets.

**Routing,** simplified from Series of Tubes ([repo](https://github.com/fjaeckel/seriesoftubes), MIT license). Traffic leaves through the cheapest exit available: private peering first, then exchange peering, then transit. Equal exits share the load, and anything over a link's capacity spills to the next option. Transit is billed on the 95th percentile of the last 30 days, never less than 20% of the port. Networks peer openly, only above a traffic threshold, only for a fee, or (the big carriers) not with small players at all.

**Parody names.** Series of Tubes has ~200 network names and is MIT-licensed, so we can reuse them with credit. We add our own for hosting brands, such as the OVH stand-in.

| Real company | Parody | Role |
| --- | --- | --- |
| Cogent | Cogentle | Cheapest transit; some customers demand "no Cogentle" |
| Lumen | Level Tree | Premium transit |
| Arelion (Telia) | Tell-Ya Carrier | Transit |
| Hurricane Electric | Drizzle Electric | Cheap transit, peers with everyone |
| Deutsche Telekom | Doitsche Telekomm | Big eyeball network, hard to peer with |
| Vodafone | Voda-Phony | Eyeball network |
| DE-CIX | DE-KICKS | Frankfurt exchange, raises prices yearly |
| AMS-IX | HAMS-IX | Amsterdam exchange |
| LINX | LYNX | London exchange |
| Equinix | Equinox | Datacenter operator |
| Interxion | Interaction | Datacenter operator |
| Cloudflare | Crowdflare | CDN, peers openly |
| Deutsche Bank | Deutsche Bankrupt | Bank with a website, loans and overdraft |

**DDoS attacks.** Attacks target one customer, and gamers attract the most. The flood saturates your links, so everyone sharing them suffers. Your options:

- **On-demand protection:** pay per incident. It kicks in after a detection delay, so there are minutes of downtime first.
- **Always-on protection:** a monthly fee. It filters everything all the time and adds a little latency. Game servers need it.
- **Blackholing:** an emergency button that drops all traffic to the attacked address. The target goes offline, but everyone else is saved.

Customers can also buy DDoS protection from you as an add-on.

**Gear firmware and the console.** Switches, routers, KVMs, console servers and OOB switches run firmware from the year they were bought. Update firmware, in the inspector or the Security app, installs the current year's version and reboots the device for 10 minutes. A switch or router hangs on 10% of updates, and a port group change locks you out of it 2% of the time; either way it stops forwarding. Recover over console fixes it in 5 minutes through a console server on its console port, and a lockout also clears through its management port on an OOB switch. Without either, the same fix is a hand task on site. A management device open to the internet (a KVM on a switch whose way out has no firewall, or a console server or OOB switch with its own line) is an exposed instance: the Security app lists it with its firmware's open vulnerabilities, one a year. An intruder on one cuts power to the servers behind it and locks out the gear behind it until it is recovered.

**How the Network app works.** The sidebar lists every zone, then Peering and DDoS. A zone page shows its traffic over the last week against what got through, and switches between Uplinks, Topology and Map. Uplinks lists the zone's uplinks as cards, then the carriers on site and the exchange as order cards, then links to other zones. Peering holds your AS number, your exchange memberships, the request inbox and the networks you can ask. DDoS holds the protection contracts and every running attack with its blackhole switch. The basement only has its home line, and every other zone starts with its datacenter's bandwidth. Private peering, remote exchange ports, carrier outages and DDoS protection sold to customers are not built yet.
