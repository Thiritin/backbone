# Research explainers

The sheet the game shows when a training completes, and again from the skill's panel in Research under "How it works". Each `##` section is a skill, named exactly as in the research tree, and each `###` inside it is one page of the sheet. Pages use the same markup as intro.md: **bold** and plain paragraphs, plus `- ` lines, which show as a checklist.

## Monitoring

### Now available

- **Failure notifications** tell you the moment a part breaks or a server hangs.
- **Nagiosaurus** is in the Pear Store and lists your installed software with known vulnerabilities.

### Your team can see now

Until today, a broken disk announced itself through an angry customer. Your company now knows how to watch its own hardware, so every failed part sends you a notification the moment it breaks.

The lights on the device fronts still tell the same story. The difference is that you no longer have to be looking at them.

## Employee management

### Now available

- **Staff** is in the Pear Store, where you hire people and give each one a task.

### You are allowed to hire

Your company now knows how to hire people, pay them and give them something to do. Doing all of it alone was heroic, and it was also the reason the tickets piled up while you slept.

### The Staff app

**Staff** is now in the Pear Store. It shows the job market, lets you hire at a salary you agree on and assigns each person a task, such as answering tickets.

Salaries are paid every month whether the person is busy or not. A good hire pays for themselves in saved hours, and a bad one is still cheaper than burning out.

## Company law

### Now available

- **Limited company** is on the trade office's Forms page, where you download the application for the notary.

### You can found a GmbH

Your company now knows what a limited company takes: a notary who writes the articles, 25,000 EUR of share capital in the company account and an entry in the commercial register.

A sole trader or a partnership can now apply on the trade office site. The change is final, and the register's letter makes it official.

## Marketing basics

### Now available

- **Reviews** in Marketing shows what customers write about you, and new reviews now send you a notification.
- **Community** in Marketing lets you sponsor events, and event organisers now write to you with sponsoring requests.
- **Marketing campaigns** can now be trained in Research once you know how to manage employees.

### Who your customers are

Your company now understands why a customer picks one host over another: price, reliability and whether anyone answers the phone. The **Marketing** app now shows two more sections: **Reviews** collects what customers write about you, and **Community** sponsors events.

### What it leads to

Marketing basics is the foundation for two further trainings. **Product management** turns your services into proper product lines, and **Marketing campaigns** brings customers in on purpose rather than by accident.

Both are now available in Research.

## Memory reservation

### Now available

- **Memory reservation** is a switch on each cluster in Locations that keeps servers from freezing.

### Memory is not elastic

A server can promise more processor time than it has, because not every customer computes at once. Memory is different: when the workloads on a server need more RAM than it has, the server freezes, and every customer on it is down until something moves off.

Your team now knows how to keep that promise honest.

### Turning it on

Each cluster in Locations has a **Memory reservation** switch. With it on, the cluster refuses to place or move a workload onto a server whose booked RAM would exceed the RAM installed in it.

You sell fewer plans per server, and none of them freeze it.

## Network operations

### Now available

- **Transit** lets you buy bandwidth from carriers in the Network app.
- **Peering** connects you directly to other networks.
- **DDoS protection** can be switched on for each location.

### Beyond the home line

Your team now knows how real networks are run: buying transit from carriers, peering with other networks and keeping traffic flowing when someone decides to flood it.

### Transit and peering

The **Network** app already shows your lines and ports. With this training it can also buy transit from carriers, set up peering with other networks and switch on DDoS protection for each location.

A network with two upstreams survives one carrier having a bad day. A network with one upstream finds out how much its customers like you.

## Product management

### Now available

- **Products** is in the Pear Store, where you set up product lines, clusters and backups.

### From services to products

Your company now knows how to sell plans instead of improvising a price for every customer. A product line bundles one service with fixed plans, the licences it needs and the cluster it runs on.

### The Products app

**Products** is now in the Pear Store. It shows which products you sell in which zone, and every cluster with its servers, how full they are and how busy they get at peak times.

Web hosting runs on panel hosts and virtual machines run on hypervisor clusters. The free panels and hypervisors cost nothing and bring more tickets, the paid ones send a license bill every month, and switching later needs the host empty. Products is also where you set up nightly backups to another cluster.

## Shop systems

### Now available

- **Shop systems** in Marketing take orders through a bought order and provisioning system instead of email.
- **Stock** per product line decides how much the shop sells.

### Choosing a shop

Each shop system has its own price and its own modules. A module connects the shop to one software, such as a panel or a hypervisor, and lets the shop set up orders on it by itself once you have Provisioning automation. Some shops include many modules, others sell them one by one, and some take a share of the revenue instead of a licence. A new shop takes three days to set up, and only email orders arrive in that time.

### Stock

Every product line has a stock. Set a number and the shop sells that many, or let it follow the free room on your servers. When a line is sold out the shop shows it as sold out, and the visitor leaves without a lost sale. An order the shop cannot set up is cancelled and refunded.

## Provisioning automation

### Now available

- **Automatic** placement picks a host for you when you set up an order.
- **Place orders automatically** in Settings quotes order emails at your rates and runs accepted orders from account to setup by itself.

### Setup without picking a host

Setting up an order now offers **Automatic** next to your hosts. The game picks the first host in the order's city that has the disk for it.

### Place orders automatically

Settings has a new **Place orders automatically** switch. With it on, a shop order is invoiced and set up the moment it arrives, as long as the shop has a module for the software it lands on, and an order by email runs from the customer account to the setup the moment the customer accepts your quote.

An order email gets a quote at your own rate for the line, as long as a host in its city has room for it. An order with no room waits for you to quote it by hand. A step that cannot run, such as a setup with no room, waits in the inbox for you too.

## Fraud screening

### Now available

- **Screen orders with MaxMined** in Settings sends every new order to a scoring service before it reaches you.

### Scores instead of staff

MaxMined scores each order the moment it arrives, by email, form or shop. It declines most orders paid with stolen cards and turns away a few honest customers too. Declined orders show up as lost sales. It needs no staff time and order automation keeps running.

Every check costs a few cents, billed on the first of the month. With Review server orders by hand on as well, your staff only review the server orders MaxMined let through.

## High availability

### Now available

- **Live migration** moves running virtual machines between servers.
- **Auto-balancing** moves virtual machines off a server that runs hot.
- **Automatic failover** restarts virtual machines on another server when one fails.

### Machines that move

Your team now knows how to treat a hypervisor cluster as one big machine. Each cluster gets three switches: live migration moves running virtual machines between servers without the customer noticing, auto-balancing moves them off a server that runs hot, and automatic failover restarts them on the other servers within about five minutes when one fails.

### Room to fail into

Failover only helps when the other servers have room. A cluster packed to the brim restarts what fits and leaves the rest down until the broken server is back, and you hear about every machine it could not place.

Auto-balancing needs live migration, and live migration needs a hypervisor that can do it. HyperVee cannot.

### Balancing is an edition

Auto-balancing also needs a hypervisor that balances. VMwhere does it with its Enterprise Plus edition and HyperVee with SysCenter VMM, each billed per server a month. Proxmocks and OpenVeeZee never balance. OpenStash balances with Watchman for free, once your team has learned cloud orchestration.

## Cloud orchestration

### Now available

- **OpenStash** installs on your servers.
- **Cloud computing** can be sold from an OpenStash cluster with automatic failover.
- **Watchman** balances virtual machines across an OpenStash cluster at no extra cost.

### Free software, expensive knowledge

OpenStash costs nothing to download and a great deal to understand. Your team now runs its many services: identity, images, networks, volumes and the scheduler that places every machine. Customers start and stop their own virtual machines and pay by the hour.

### What it needs

Cloud computing needs a whole OpenStash cluster with automatic failover on. Other hypervisors keep selling virtual servers, but only OpenStash sells cloud computing.

## GPU computing

### Now available

- **GPU servers** can be sold as a product line on a hypervisor cluster with free cards.

### Cards for customers

Your team now knows how to hand whole graphics cards to virtual machines. A GPU server is a virtual machine that books one or more cards of the server it runs on, together with its share of processors, memory and disk.

### Where the cards go

Cards sit in the PCIe slots of a GPU 4U server, which takes up to four. A hypervisor cluster with a free card can sell the GPU server line, and every virtual machine keeps its cards until its customer leaves.

A card draws as much power as a small server, so check the rack before you add one.

## Marketing campaigns

### Now available

- **Channels**, **Campaigns** and **Awareness** in Marketing bring customers in on purpose.
- **Trade fairs** in Marketing lets you book stands.

### Being found on purpose

Your staff now knows how to run campaigns, track awareness and book trade fairs. Word of mouth still works, but it no longer has to work alone.

### The Marketing app

The **Marketing** app you bought your domain in now has four more sections. **Channels** sets up web design and search ads. **Campaigns** runs ads with a budget and a target. **Awareness** shows how well known you are, and **Trade fairs** books stands.

A campaign brings in requests, and the reviews decide how many of them become customers. Answering tickets quickly is still the cheapest advertising you will ever buy.

## Market research

### Now available

- **Market** is in the Pear Store and shows demand, customer requirements and every lost sale.

### Knowing what sells

Your company can now read the market: which products are in demand, what customers require before they sign and why a sale went to someone else.

### The Market app

**Market** is now in the Pear Store. It shows demand for each product, the requirements customers bring with them and a report for every sale you lost.

The lost-sale reports are the most honest feedback you will get. Customers who leave rarely bother to explain, but the report does it for them.

## Documentation

### Now available

- **Knowledge base** is in the Pear Store and answers basic setup questions before they reach your inbox.

### Answers before questions

Your team now writes down the answers it gives every week: how to upload a site, which server Outlook wants, where the name servers go. New customers ask these the most, and long-standing customers ask about other things.

### The Knowledge base app

**Knowledge base** is now in the Pear Store. Once it is installed, three in ten of the basic setup questions never reach your inbox, because the customer finds the article first. The app shows how often each article was read.

## Automation

### Now available

- **ChadGPT Support** and **Clipsy Reminders** are in the Pear Store and work your queue as bots.
- **Billing rules** now run by themselves instead of waiting for your staff.

### The bots are here

Somebody once suggested replacing everyone with AI and hoping the bot fixes it. Your company now knows how to do the first half.

A bot works day and night, never asks for a raise and never gets any better. It answers fast and is wrong often enough that someone has to clean up after it.

### ChadGPT Support and Clipsy Reminders

**ChadGPT Support** and **Clipsy Reminders** are now in the Pear Store. ChadGPT Support answers how-to and billing tickets, and Clipsy Reminders sends payment reminders. Each bot is its own monthly subscription and shows in the Staff app next to your team.

Your staff take the queue first during office hours, and the bots take whatever is left. Watch the follow-up tickets: a bot apologises beautifully and understands very little.
