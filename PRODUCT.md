# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

TypeScript, Vite and React, with the simulation in plain TypeScript, as set in [docs/design/gdd.md](docs/design/gdd.md). Hosted as a static site on GitHub Pages.

## Users

Tech people first: sysadmins, hosters and network engineers who enjoy recognizing real infrastructure (racks, ports, transit, peering, dunning) in a game. Management-sim players are welcome, but the detail is tuned for people who know what a cross-connect is. They play in a desktop browser with mouse and keyboard, in sessions of an hour or more.

## Product Purpose

Backbone is a management game about running a whole hosting company, from a basement in 2005 to an own datacenter. Every department (support, billing, infrastructure, network, marketing) starts as clicks the player makes by hand, and the game is about automating yourself out of each job by hiring staff and later AI bots. Success is a player who feels the pressure of a growing company and the relief of each automation.

## Positioning

It simulates the business of hosting, not just the hardware: an outage floods the support inbox, unanswered tickets lose customers, and unpaid invoices need dunning. Real infrastructure is simplified but stays recognizable to an engineer, and real companies appear as parody names.

## Operating Context

The whole game is played on a fake desktop inside the browser: a menu bar with time controls, date and cash; a dock of apps; draggable windows; and notifications. The player keeps several windows open at once and switches between them while the clock runs. Nothing pauses automatically.

## Capabilities and Constraints

- Free, open-source (MIT), static site with no server, no accounts and no multiplayer. Saves stay in the browser.
- Desktop browsers only, 1280 px wide and up. Smaller screens get a short notice instead of the game.
- English only at launch. Player-facing text still goes through i18n labels.
- Set in Western Europe from 2005 on, with prices in euros.
- Every real company appears under a pun on its name.

## Brand Commitments

- The interface is a macOS-style desktop, clean and light like macOS, with a dark mode.
- Interface text in Inter, numbers in a monospace font so columns line up, icons from Lucide.
- Rack and server fronts are drawn in code, so every device has a consistent, detailed front.

## Evidence on Hand

The design docs in [docs/design/](docs/design/). There are no screenshots, logos, testimonials or player numbers yet, and none may be invented.

## Product Principles

- Automate yourself out of the job: every system works by hand first, and automation is visible relief.
- Real infrastructure, simplified: close enough to reality that an engineer nods, never a spreadsheet of fake numbers.
- Problems cascade like the real thing: the interface shows how one failure becomes tickets, churn and lost money.
- The desktop is the game: every system is an app the player opens, arranges and keeps an eye on.
