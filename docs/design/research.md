# Research explainers

The sheet the game shows when a training completes, and again from the skill's panel in Research under "How it works". Each `##` section is a skill, named exactly as in the research tree, and each `###` inside it is one page of the sheet. Pages use the same markup as intro.md: **bold** and plain paragraphs.

## Monitoring

### Your team can see now

Until today, a broken disk announced itself through an angry customer. Your company now knows how to watch its own hardware, so every failed part sends you a notification the moment it breaks.

The lights on the device fronts still tell the same story. The difference is that you no longer have to be looking at them.

### Dock badges

**Dock badges** are now in the Pear Store. Once installed, each app in the dock shows a red count of what waits for you there: open tickets in Support, unpaid invoices in Billing and failed parts in Locations.

Open the Pear Store from the Shop under Software and choose Get. Pear bills the subscription monthly, as Pear does.

## Employee management

### You are allowed to hire

Your company now knows how to hire people, pay them and give them something to do. Doing all of it alone was heroic, and it was also the reason the tickets piled up while you slept.

### The Staff app

**Staff** is now in the Pear Store. It shows the job market, lets you hire at a salary you agree on and assigns each person a task, such as answering tickets.

Salaries are paid every month whether the person is busy or not. A good hire pays for themselves in saved hours, and a bad one is still cheaper than burning out.

## Marketing basics

### Who your customers are

Your company now understands why a customer picks one host over another: price, reliability and whether anyone answers the phone. This knowledge has no app of its own.

### What it leads to

Marketing basics is the foundation for two further trainings. **Product management** turns your services into proper product lines, and **Marketing campaigns** brings customers in on purpose rather than by accident.

Both are now available in Research.

## Memory reservation

### Memory is not elastic

A server can promise more processor time than it has, because not every customer computes at once. Memory is different: when the workloads on a server need more RAM than it has, the server freezes, and every customer on it is down until something moves off.

Your team now knows how to keep that promise honest.

### Turning it on

Each cluster in Locations has a **Memory reservation** switch. With it on, the cluster refuses to place or move a workload onto a server whose booked RAM would exceed the RAM installed in it.

You sell fewer plans per server, and none of them freeze it.

## Network operations

### Beyond the home line

Your team now knows how real networks are run: buying transit from carriers, peering with other networks and keeping traffic flowing when someone decides to flood it.

### Transit and peering

The **Network** app already shows your lines and ports. With this training it can also buy transit from carriers, set up peering with other networks and switch on DDoS protection for each location.

A network with two upstreams survives one carrier having a bad day. A network with one upstream finds out how much its customers like you.

## Product management

### From services to products

Your company now knows how to sell plans instead of improvising a price for every customer. A product line bundles one service with fixed plans, the licences it needs and the cluster it runs on.

### The Products app

**Products** is now in the Pear Store. It shows which products you sell in which zone, and every cluster with its servers, how full they are and how busy they get at peak times.

Web hosting runs on panel hosts and virtual machines run on hypervisor clusters. The free panels and hypervisors cost nothing and bring more tickets, the paid ones send a license bill every month, and switching later needs the host empty. Products is also where you set up nightly backups to another cluster.

## High availability

### Machines that move

Your team now knows how to treat a hypervisor cluster as one big machine. Each cluster gets three switches: live migration moves running virtual machines between servers without the customer noticing, auto-balancing moves them off a server that runs hot, and automatic failover restarts them on the other servers within about five minutes when one fails.

### Room to fail into

Failover only helps when the other servers have room. A cluster packed to the brim restarts what fits and leaves the rest down until the broken server is back, and you hear about every machine it could not place.

Auto-balancing needs live migration, and live migration needs a hypervisor that can do it. HyperVee cannot.

## GPU computing

### Cards for customers

Your team now knows how to hand whole graphics cards to virtual machines. A GPU server is a virtual machine that books one or more cards of the server it runs on, together with its share of processors, memory and disk.

### Where the cards go

Cards sit in the PCIe slots of a GPU 4U server, which takes up to four. A hypervisor cluster with a free card can sell the GPU server line, and every virtual machine keeps its cards until its customer leaves.

A card draws as much power as a small server, so check the rack before you add one.

## Marketing campaigns

### Being found on purpose

Your staff now knows how to run campaigns and how to keep an eye on what customers write about you. Word of mouth still works, but it no longer has to work alone.

### The Marketing app

**Marketing** is now in the Pear Store. It runs campaigns with a budget and a target, collects the reviews customers leave and shows how you score on the review platforms.

A campaign brings in requests, and the reviews decide how many of them become customers. Answering tickets quickly is still the cheapest advertising you will ever buy.

## Market research

### Knowing what sells

Your company can now read the market: which products are in demand, what customers require before they sign and why a sale went to someone else.

### The Market app

**Market** is now in the Pear Store. It shows demand for each product, the requirements customers bring with them and a report for every sale you lost.

The lost-sale reports are the most honest feedback you will get. Customers who leave rarely bother to explain, but the report does it for them.

## Automation

### The bots are here

Somebody once suggested replacing everyone with AI and hoping the bot fixes it. Your company now knows how to do the first half.

A bot works day and night, never asks for a raise and never gets any better. It answers fast and is wrong often enough that someone has to clean up after it.

### ChadGPT Support and Clipsy Reminders

**ChadGPT Support** and **Clipsy Reminders** are now in the Pear Store. ChadGPT Support answers how-to and billing tickets, and Clipsy Reminders sends payment reminders. Each bot is its own monthly subscription and shows in the Staff app next to your team.

Your staff take the queue first during office hours, and the bots take whatever is left. Watch the follow-up tickets: a bot apologises beautifully and understands very little.
