# Research explainers

The sheet the game shows from the skill's panel in Research under "How it works", before and after the training, and when a training completes. Each `##` section is a skill, named exactly as in the research tree, and each `###` inside it is one page of the sheet. Pages use the same markup as intro.md: **bold** and plain paragraphs, plus `- ` lines, which show as a checklist.

## Monitoring

### What it unlocks

- **Failure notifications** tell you the moment a part breaks or a server hangs.
- **Nagiosaurus** is in the Pear Store. It adds a Monitoring tab to Security that lists your installed software with its known vulnerabilities, and it announces new low and high vulnerabilities as well as critical ones.

### Seeing failures

Without monitoring, a broken disk announces itself through an angry customer. Your company learns to watch its own hardware, so every failed part and every hung server sends you a notification the moment it happens.

The lights on the device fronts tell the same story either way. The difference is that you do not have to be looking at them.

## Employee management

### What it unlocks

- **Staff** is in the Pear Store, where you hire people and give each one a task.

### You are allowed to hire

Your company learns how to hire people, pay them and give them something to do. Doing all of it alone is heroic, and it is also the reason the tickets pile up while you sleep.

### The Staff app

**Staff** is in the Pear Store. Its job market lists support agents, bookkeepers, accountants, marketing managers and technicians, and you hire at a salary you agree on. Each person gets a task, such as answering tickets, and Shifts shows who is on duty in each hour of the week.

Salaries are paid every month whether the person is busy or not. A good hire pays for themselves in saved hours, and a bad one is still cheaper than burning out.

## Company law

### What it unlocks

- **Limited company** is on the trade office's Forms page in the Browser, where you download the application for the notary.

### You can found a GmbH

Your company learns what a limited company takes: a notary who writes the articles, 25,000 EUR of share capital in the company account and an entry in the commercial register.

The Forms page lists the limited company only with this training, and only for a registered company whose account plan fits the form. The notary and the register each bill a fee. The change is final, and the register's letter makes it official.

## Marketing basics

### What it unlocks

- **Reviews** in Marketing shows what customers write about you, and new reviews send you a notification.
- **Event sponsoring** appears as Community in Marketing, and event organisers write to you in Support with sponsoring requests.

### Who your customers are

Your company learns why a customer picks one host over another: price, reliability and whether anyone answers the phone. The **Marketing** app gets two more sections. **Reviews** collects what customers write about you and signs you up with review platforms that invite customers to write one. **Community** lists the events you sponsor.

### Sponsoring events

Every few weeks an event organiser writes to you in Support and asks for a sponsorship. A sponsored event brings awareness, know-how, reviews and customers when your services stay up, and costs you reviews and awareness when they do not.

### What it leads to

Marketing basics is the first step toward **Marketing campaigns**, which also needs Employee management.

## Memory reservation

### What it unlocks

- **Memory reservation** is a RAM setting on each cluster in Locations that keeps servers from freezing.

### Memory is not elastic

A server can promise more processor time than it has, because not every customer computes at once. Memory is different: when the workloads on a server need more RAM than it has, the server freezes, and every customer on it is down until something moves off.

Your team learns to keep that promise honest.

### Turning it on

Each cluster in Locations has a **RAM** setting with the choices **Overbook** and **Reserve**. With **Reserve** on, the cluster refuses to place or move a workload onto a server whose booked RAM would exceed the RAM installed in it.

You sell fewer plans per server, and none of them freeze it.

## Network operations

### What it unlocks

- **Network** is in the Pear Store and shows a map of your sites, manages DDoS protection and keeps your address registry.
- **Transit** is bought from carriers on the Network tab of each datacenter location in Locations.
- **Peering** is set up in the Peering view of the same tab, with an AS number and an exchange membership.

### Beyond the home line

Your team learns how real networks are run: buying transit from carriers, peering with other networks and keeping traffic flowing when someone decides to flood it.

### Transit and peering

The **Network** tab of a datacenter location in Locations shows its lines and ports. With this training it also orders transit from carriers, adds exchange ports and links the location to your other sites. Peering needs an AS number that you register and a membership at the location's exchange. You then request peering with other networks and answer their requests.

The **Network** app shows all your sites on a map, switches DDoS protection for the whole company and holds the address registry.

A network with two upstreams survives one carrier having a bad day. A network with one upstream finds out how much its customers like you.

## Product management

### What it unlocks

- **Rates** per product line are set in euros per unit on the Options page of the shop admin.

### From services to products

Your company learns to sell plans instead of improvising a price for every customer. Every product line is priced per unit, such as per GB of disk, per vCPU or per mailbox, plus a setup fee.

### Setting rates

The Options page of the shop admin, which opens once a shop system is installed, has one card per product line with a field for every unit. The market's rate stands beside each field. An empty field charges the market's rate, and **Market rates** resets the whole line. The card also shows the price of the smallest plan at your rates and at the market's.

Your rates apply to new shop orders, and to the price an email quote starts at once a shop is active. Services you already sold keep their price. A price above the market brings fewer leads, and customers who find a service too expensive complain and leave.

## Shop systems

### What it unlocks

- **Shop systems** are installed from the settings of a panel host in the Browser, and every vendor sells its own on its own site.

### Installing a shop

A shop system runs in a web space of a panel host and counts against that panel's licence. It needs the company website from Marketing. Vendors sell a licence key once with paid updates or per server a month, and one gives the shop away for a share of the revenue. A new shop takes three days to set up, and only email orders arrive in that time.

### Modules and server groups

Each shop system has its own price and its own modules. A module connects the shop to one software, such as a panel or a hypervisor, and lets the shop set up orders on it by itself once you have Provisioning automation. Some shops include many modules, others sell them one by one.

The Servers page of the shop admin groups your servers. The shop sells only from groups that are for sale, and orders it cannot set up are cancelled and refunded.

### Stock

Every product line has a stock on the Options page of the shop admin. Set a number and the shop sells that many, or let it follow the free room on your servers if the shop supports it. When a line is sold out the shop shows it as sold out, and the visitor leaves without a lost sale.

## Provisioning automation

### What it unlocks

- **Automatic** placement picks a host for you when you set up an order.
- **Place orders automatically** in Settings quotes order emails at your rates and runs accepted orders from account to setup by itself.

### Setup without picking a host

Setting up an order in Support offers **Automatic** next to your hosts. The game picks a host in the order's city that has room for it.

### Place orders automatically

Settings has a **Place orders automatically** switch. With it on, a shop order is invoiced and set up the moment it arrives, as long as the shop has a module for the software it lands on, and an order by email runs from the customer account to the setup the moment the customer accepts your quote.

An order email gets a quote at your own rate for the line, as long as a host in its city has room for it. An order with no room waits for you to quote it by hand. A step that cannot run, such as a setup with no room, waits in the inbox for you too.

## Fraud screening

### What it unlocks

- **Screen orders with MaxMined** in Settings sends every new order to a scoring service before it reaches you.

### Scores instead of staff

MaxMined scores each order the moment it arrives, by email, form or shop. It declines most orders paid with stolen cards and turns away a few honest customers too. Declined orders show up as lost sales. It needs no staff time and order automation keeps running.

Every check costs a few cents, billed on the first of the month. With Review server orders by hand on as well, your staff only review the server orders MaxMined let through.

## Traffic billing

### What it unlocks

- **Traffic over plan** on the Dunning levels tab of Books answers every service that moves more traffic than its plan includes.

### One answer for everyone

Each day at noon the books look for services over their plan that you have not answered this month. Pick one answer and it goes out to all of them: throttle the service to its booked traffic, bill the overage at your traffic rate, or offer the customer a bigger plan. Off leaves every case to you on the customer page.

A bill or an offer covers a service for a month, so nobody gets two in a row. An upgrade offer still waits in Sales until you quote it.

## High availability

### What it unlocks

- **Live migration** moves running virtual machines between servers.
- **Auto-balancing** moves virtual machines off a server that runs hot.
- **Automatic failover** restarts virtual machines on another server when one fails.
- **Cloud servers** and other product lines that need failover can be sold from a cluster with automatic failover on.

### Machines that move

Your team learns to treat a hypervisor cluster as one big machine. The node list in the cluster's management console in the Browser shows three switches: live migration moves running virtual machines between servers without the customer noticing, auto-balancing moves them off a server that runs hot, and automatic failover restarts them on the other servers within about five minutes when one fails.

### Room to fail into

Failover only helps when the other servers have room. A cluster packed to the brim restarts what fits and leaves the rest down until the broken server is back, and you hear about every machine it could not place.

Auto-balancing needs live migration, and live migration needs a hypervisor that can do it. HyperVee and OpenVeeZee cannot.

### Balancing is an edition

Auto-balancing also needs a hypervisor that balances. VMwhere does it with its Enterprise Plus edition and HyperVee with SysCenter VMM, each billed per server a month. Proxmocks and OpenVeeZee never balance. OpenStash balances with Watchman for free, once your team has learned cloud orchestration.

## Cloud orchestration

### What it unlocks

- **OpenStash** installs on your servers.
- **Cloud servers** can be listed in Marketing under Products once an OpenStash cluster has automatic failover on.
- **Watchman** balances virtual machines across an OpenStash cluster at no extra cost.

### Free software, expensive knowledge

OpenStash costs nothing to download and a great deal to understand. Your team learns to run its many services: identity, images, networks, volumes and the scheduler that places every machine. Customers start and stop their own virtual machines and pay by the hour.

### What it needs

Cloud servers need a whole OpenStash cluster with automatic failover on. Other hypervisors keep selling virtual servers, but only OpenStash sells cloud servers.

## GPU computing

### What it unlocks

- **GPU servers** can be listed in Marketing under Products and sold from a hypervisor cluster with a free card.

### Cards for customers

Your team learns to hand whole graphics cards to virtual machines. A GPU server is a virtual machine that books 1, 2, 4 or 8 cards of the server it runs on, together with its share of processors, memory and disk.

### Where the cards go

Cards sit in the PCIe slots of a GPU 4U server, which takes four cards, or eight from 2017. Older 2U servers take one. A hypervisor cluster with a free card can sell the GPU server line, and every virtual machine keeps its cards until its customer leaves.

A card draws as much power as a small server, so check the rack before you add one.

## Marketing campaigns

### What it unlocks

- **Marketing** gets the Campaigns, Awareness and Trade fairs sections and more ad channels.

### Being found on purpose

Your staff learns to run campaigns, track awareness and book trade fairs. Word of mouth works either way, but it no longer has to work alone.

### The Marketing app

**Campaigns** runs ads and outreach with a budget and a target group. **Awareness** shows how well known you are, and **Trade fairs** books stands. **Channels** adds Goggle Ads and, from 2023, AI ads for campaigns to use.

A campaign brings in requests, and the reviews decide how many of them become customers. Answering tickets quickly is still the cheapest advertising you will ever buy.

## Market research

### What it unlocks

- **Market** is in the Pear Store and shows demand, customer requirements and every lost sale.

### Knowing what sells

Your company learns to read the market: which products are in demand, what customers require before they sign and why a sale went to someone else.

### The Market app

**Market** is in the Pear Store. It shows demand for each product, the requirements customers bring with them and a report for every sale you lost.

The lost-sale reports are the most honest feedback you will get. Customers who leave rarely bother to explain, but the report does it for them.

## Documentation

### What it unlocks

- **Knowledge base** is in the Pear Store and answers basic setup questions before they reach your inbox.

### Answers before questions

Your team writes down the answers it gives every week: how to upload a site, which server Outlook wants, where the name servers go. New customers ask these the most, and long-standing customers ask about other things.

### The Knowledge base app

**Knowledge base** is in the Pear Store. Once it is installed, three in ten of the basic setup questions never reach your inbox, because the customer finds the article first. The app shows how often each article was read, and the articles appear on your company website.

## Automation

### What it unlocks

- **ChadGPT Support** and **Clipsy Reminders** are in the Pear Store and work your queue as bots.
- **Billing rules** on the Dunning levels tab of Books run by themselves instead of waiting for your staff.

### Bots and rules

Somebody once suggested replacing everyone with AI and hoping the bot fixes it. Your company learns to do the first half. The billing rules in Books also stop waiting for staff hours.

A bot works day and night, never asks for a raise and never gets any better. It answers fast and is wrong often enough that someone has to clean up after it.

### ChadGPT Support and Clipsy Reminders

**ChadGPT Support** and **Clipsy Reminders** are in the Pear Store. ChadGPT Support answers how-to and billing tickets, and Clipsy Reminders sends payment reminders. Each bot is its own monthly subscription and shows in the Staff app next to your team.

Your staff take the queue first during office hours, and the bots take whatever is left. Watch the follow-up tickets: a bot apologises beautifully and understands very little.
