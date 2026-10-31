# Lane plan: packages-provisioning

> Critic note (i18n): `src/i18n/en.ts` loads every `ui-*.ts` by glob and `lang.ts` loads every `<lang>/*.ts` by glob, so this lane's new English file is `src/i18n/ui-<topic>.ts` with mirrors `src/i18n/<lang>/ui-<topic>.ts`, and no `en.ts` or `lang.ts` registration edit is needed anywhere below that says otherwise.

Status: proposed. Source of truth for scope is `docs/design/panel-features.md` (sections "Packages and products", "Manual customer accounts", build order steps 2, 3, 4 and 9). Numbers extend `docs/design/economy.md`; console looks follow `docs/design/software.md`, sections 9 and 10.

This lane is the foundation for `shop-portal` and `game-servers`. Section 3.1 states the package data model on its own so those lanes can build on it without reading the rest.

## 1. Scope

Every feature this lane owns, with its tag and the line in `panel-features.md` it traces to.

| # | Feature | Tag | Traces to |
| --- | --- | --- | --- |
| F1 | Package store: a named `Spec` saved on a software installation (a `Cluster`), with add, edit, delete and copy | [Sim] | "Shared across all panels > Packages"; "Packages and products" |
| F2 | Provisioning from a package: the order books the package, the service keeps the sold spec, a smaller package oversells by hand | [Sim] | "Manual customer accounts" rules 2; "Overselling on panel hosts" (the by-hand half) |
| F3 | Extra provisioning parameters: host, package, username on `provisionOrder`; the optional account step keeps its signature | [Sim] | "Manual customer accounts" last rule |
| F4 | Order choices: the list of open orders a create form can take, with the prefilled fields and why an order is not ready | [Sim] (pure read helper) | "Manual customer accounts" rule 1 |
| F5 | Deep links from Support > Custom order to the create forms, and the console path and query plumbing they need | [UI] | "Manual customer accounts" rule 3 |
| F6 | Package screens: cPanic Add a Package, DirectAdmen User Packages, Pleskit Service Plans, FreePanel Account Plans, TCAdmen Game services, MultiKraft Plans, Pterodaktyl Nests and eggs, Proxmocks VM plans, VMwhere VM classes, HyperVee hardware profiles, OpenVeeZee plans, Horizont flavors | [UI] | "Packages and products" table |
| F7 | Create forms with an Order field: cPanic Create a New Account, DirectAdmen Create User, Pleskit Add Subscription, FreePanel Create Virtual Server, TCAdmen Add Service, MultiKraft Create Server, Pterodaktyl Create New Server, Proxmocks Create VM, VMwhere New Virtual Machine, HyperVee New Virtual Machine Wizard, OpenVeeZee Create container, Horizont Launch Instance | [UI] | build order 3 and 9 |
| F8 | Customers app > New customer form with an Order field | [UI] | build order 4 |
| F9 | Account list columns Package and Username in the panels' object tables | [UI] | "Usage bars per account" neighbour; needed by F6 |
| F10 | Change package on an existing account (cPanic Upgrade/Downgrade an Account and the equivalents) | [Sim] | "cPanic > Account Functions: Modify" |

Not owned here, and why:

- Products, prices and the order form product list belong to `shop-portal` ("Products live in the shop console"). This lane gives it the package name to point at.
- Game titles, slots and players online belong to `game-servers`. The package record has two reserved optional fields for them (section 3.1).
- Suspend, terminate, the oversell ratio per host and the usage readouts belong to `panel-host-sim` and `readouts`. This lane writes the one field they read (`Workload.promised`, section 3.2).
- Create forms for PowerDNZ, Mailpig, OpenVeePeeN, AnyConnekt, MinnIO and OwnClod belong to `mail-dns-vpn-storage`. They reuse the order picker and deep link from F4 and F5.
- Horizont projects and quotas and Proxmocks HA groups are deferred in `panel-features.md` and sit in `hypervisors-backups`. This lane owns no deferred item, so it has no deferred milestone. Milestone 17 (F10) is last because it is the one follow-up, and section 7 asks whether to build it.
- DirectAdmen resellers are deferred. Only the user packages screen is planned here.

## 2. Current state

What exists today, verified in the worktree.

- **No package concept.** `rg -i package` over `src/sim` finds nothing that stores a named spec. Every order is a custom `Spec` the customer names (`src/sim/10-catalog/products.ts:13`, `Spec extends Resources` with `trafficGb`, `mailboxes`, and more).
- **A software installation is a `Cluster`.** `src/sim/60-infra/cluster.ts:33-50` holds `panel`, `platform`, `kind`, `vm`, `nodes`, `backup`, `datastores`. Defaults come from `clusterDefaults` (`cluster.ts:89`), and `blank()` in `src/sim/90-actions/clusters.ts:31-34` builds a new one. `deserialize` reaches every cluster through `upgradeCompute` (`src/sim/91-save/compute.ts:12-15`), which calls `clusterDefaults`. A new optional field on `Cluster` with a default in both places therefore loads from old saves.
- **Order steps.** `src/sim/30-market/manual.ts:27-28` lists `quote, account, invoice, domain, provision`. `stepError` (`manual.ts:66-86`) gates them in order and returns the error keys the forms will reuse (`error.needsAccount`, `error.needsInvoice`, `error.needsDomain`, `error.noCapacity`, `error.routeElsewhere`). `applyStep` (`manual.ts:122-170`) runs a queued step when the player's work time has passed. The provision branch is at `manual.ts:158-167`: it calls `provisionService` with `r.spec`, the route from `r.route`, and sets `prepaidUntil`.
- **Actions.** `createAccount` and `provisionOrder` are in `src/sim/90-actions/orders.ts:25-28`. Both go through `step()` (`orders.ts:16-23`), which stores the route on the request with `editRequest` and queues the work with `queue` (`src/sim/90-actions/support.ts:27-34`). Work minutes are `ACTION_MINUTES.orderAccount` 5 and `orderProvision` 15 (`src/sim/47-staff/activity.ts:11`).
- **Placement books the sold spec.** `provisionService` (`src/sim/90-actions/clusters.ts:431`) takes `Order { label, zone, clusterId, sla, price, spec, deviceId }`. `placeService` (`clusters.ts:383-424`) computes `size = sizeOf(v.spec)` at `clusters.ts:387` and books that. Re-placement after a resize or retention upgrade also derives the size from the spec (`manual.ts:238`, `src/sim/40-support/retention.ts:146`).
- **Usage scales with the booking.** `workloadUse` (`src/sim/60-infra/usage.ts:70-80`) returns `booked(w).vcpu * load` and `w.ramGb * (...)`, so a smaller booking only shrinks the use. Nothing today can book less than was sold. This is why the by-hand oversell in F2 needs the `promised` field.
- **Support UI.** `CustomCompose` (`src/ui/apps/support/CustomOrder.tsx:148-188`) shows one button per step. The account step is a button at `CustomOrder.tsx:171-172`, the provision step a `HostCards` pick plus one button at `CustomOrder.tsx:177-181`, with the label table `PROVISION` at `CustomOrder.tsx:134`.
- **Customers app.** `src/ui/apps/customers/CustomersApp.tsx:96-156` has a search bar and a table. There is no create action. `addCustomer` (`src/sim/90-actions/customers.ts:12`) is only called by `applyStep`.
- **Panel consoles are thin skins.** `src/ui/apps/browser/consoles/PanelBase.tsx` holds `Tab = "objects" | "nodes" | "software"` (line 25), `usePanelTab` (line 33), `Row` and `useRows` (lines 111-146), `RowsTable` (152) and `useSoftware` (211). The web panels have no create action at all: `consoleFeatures.create` is true for them (`src/sim/80-business/consoles.ts:44`) but only the hypervisors read it. Each panel's menu is built inline (`CPanic.tsx:21-25`, `TCAdmen.tsx:21`, `MultiKraft.tsx:21`, `Pterodaktyl.tsx:20`, `Pleskit.tsx:22`, `FreePanel.tsx:20-24`, `DirectAdmen.tsx:12`).
- **Hypervisor create is own-VM only.** `useNewVm` (`src/ui/apps/browser/consoles/HypervisorBase.tsx:185-204`) calls `createVm` or `deployFromSuite` for the player's own VMs. Each console wraps it in `Wizard` (`HypervisorBase.tsx:207-227`): `Proxmocks.tsx:70-78`, `VmWhere.tsx:252-265`, `HyperVee.tsx:91,188-197`, `OpenVeeZee.tsx:129-130,201`, `Horizont.tsx:106,133,206`. Customer VPS and game workloads are never created from a console.
- **Horizont already has a fixed flavor list.** `Horizont.tsx:19-23` defines `FLAVORS` (m1.tiny to m1.xlarge) and `flavorOf`; the launch modal's Flavor step lists them (`Horizont.tsx:206-212`).
- **The Browser address.** `split` (`src/sim/80-business/browser.ts:82-87`) already keeps path and query, `consoleAt` (`src/sim/80-business/consoles.ts:81-85`) picks the console by port, and `Resolved.page` of kind `console` carries only `hostname`, `clusterId`, `defaced` (`browser.ts:29`). The console never sees a path. `BrowserApp.tsx:165-170` opens a tab for a `url` focus, so another app can already open an address.
- **Era switch dates** are in each console: cPanic 2005/2014 (`CPanic.tsx:8`), Pleskit 2005/2015, DirectAdmen 2005/2018, FreePanel 2005/2016, TCAdmen 2005/2016, MultiKraft 2010/2018, Pterodaktyl 2016/2021, Proxmocks 2008/2015, VMwhere 2005/2015, HyperVee 2008/2012, OpenVeeZee 2005/2016, Horizont 2010/2016.
- **i18n.** `src/i18n/en.ts:35` globs every `src/i18n/ui-*.ts`, and `src/i18n/lang.ts:25` globs every `src/i18n/<lang>/*.ts`. A new `ui-packages.ts` in English and in each of `de`, `es`, `fr`, `it`, `pt` therefore needs no registration line. `tests/i18n.test.ts` checks keys and parameters across them.

## 3. Design

### 3.1 The package data model (the contract for other lanes)

```ts
// src/sim/80-business/packages.ts (pure, no React)
export interface PackageDef {
  // Unique per installation, compared case-insensitively. It is the key: like WHM, a package cannot be renamed.
  name: string;
  // The product line the package serves; a panel host serves "webHosting", a game panel or hypervisor "gameServer", a hypervisor "vps".
  product: Product;
  // What the package books and what its screen shows. Only vcpu, ramGb and diskGb are booked in this lane.
  // trafficGb and mailboxes are shown and carried, and read by later lanes.
  spec: Spec;
  // Reserved for game-servers: a title id and a slot count. Absent on every package from this lane.
  title?: string;
  slots?: number;
}
```

- `Cluster` gets `packages?: PackageDef[]`. `clusterDefaults` and `blank()` set `packages: []`; readers use `c.packages ?? []`. Old saves load through `upgradeCompute`, which already runs `clusterDefaults` for every cluster (`compute.ts:15`).
- A package is a property of one installation. Removing or switching the installation removes its packages, as uninstalling a real panel does. Migrating a web space to a host that lacks the package keeps the service's recorded package name and shows it greyed in the list; nothing else happens.
- `Service` gets `pkg?: string` (the package name it was provisioned with) and `username?: string` (web hosting only). Both are optional, so old services read as "Custom" and no username.
- `SalesRequest` gets `pkg?: string` and `username?: string`, stored by the provision action the way `route` is stored today (`orders.ts:21`). `pkg` is the package **name**, resolved against the cluster that takes the order. This is deliberate: a shop product (shop-portal) stores one name and every member of a server group is expected to carry a package of that name, exactly as WHMCS resolves a product's package name on each server.
- `Workload` gets `promised?: Resources`, set only when the package books less than was sold. It is the one field `panel-host-sim` and `readouts` read to show booked against sold.
- Helpers in `packages.ts`: `packagesOf(c)`, `packageNamed(c, name)`, `covers(pkg, spec)`, `bookingFor(pkg, spec): { book: Resources; promised?: Resources }`, `referencePrice(pkg, year, sla)` (calls `marketPrice` so every screen can show a suggested monthly price, which is not stored), `defaultSpecFor(product, year)` (calls `sizeSpec` to prefill the Add form), and `missingOn(s, clusterIds, name)` for shop groups.
- Package names are limited to 24 characters of letters, digits, space, dash and underscore. A package never carries a price; the price lives on the shop product.

### 3.2 F1 and F2: store and provisioning from a package

State: as in 3.1. `newGame` has no clusters, so its default is the empty `packages` that `blank()` writes on every install, plus the `clusterDefaults` line for loaded saves.

Actions in `src/sim/90-actions/packages.ts` (registered in `src/sim/90-actions/index.ts`, a one-line shared hotspot):

- `addPackage(s, clusterId, def)`: errors `error.unknownCluster`, `error.packageProduct` (the installation does not sell that product), `error.packageName`, `error.packageTaken`, `error.packageSpec` (non-finite, zero or negative resources), `error.packageLimit`. Returns `{ ok: true, id: name }`.
- `editPackage(s, clusterId, name, spec)`: changes the spec for **future** accounts only. Existing services keep what they were booked at, as the economy rule "in development, no compensation work" asks.
- `deletePackage(s, clusterId, name)`: `error.packageInUse` while any active service on that cluster carries `pkg === name`.
- `copyPackages(s, fromClusterId, toClusterId)`: adds the source's packages the target lacks, same product only. This is the "sync" the shop groups need; it costs nothing.

Provisioning:

- `provisionOrder(s, ticketId, route, opts?: { package?: string; username?: string })`. The three-argument call stays valid. With `opts`, the action validates the package against the target cluster (`error.packageMissing`, `error.packageProduct`), validates the username for web hosting, stores `pkg` and `username` on the request with `editRequest`, then queues the work as today. `route` is the "host" parameter the plan names: a cluster id or a node's device id (`routeTarget`, `src/sim/60-infra/routes.ts:62`).
- `applyStep` provision branch (`manual.ts:158-167`) reads `r.pkg` and `r.username`, resolves the package on the target cluster, and passes `pkg: { name, book, promised }` and `username` to `provisionService`. When `r.pkg` is unset or the package is gone it behaves exactly as today, which is also what automation (`AUTOMATION` runs, `manual.ts:201-204`) does until `shop-portal` sets `pkg` from a product.
- `provisionService`/`addService` write `Service.pkg` and `Service.username`. `placeService` books `v.pkgBook ?? sizeOf(v.spec)` where the booking is stored on the service as `pkgBook?: Resources` next to `pkg` so a restore or re-placement books the same size. `Workload.promised` is set when any dimension of the booking is below the sold size.
- A resize or an upgrade (`manual.ts:238`, `retention.ts:146`) books the new sold spec and clears `pkgBook` and `promised`; the service keeps its `pkg` name for display.
- The booking never exceeds what the package says, and a package larger than the order books the package size. A larger package has no other effect.

Economy numbers (new rows under `economy.md` "Tickets and work rates", Time per action, and under "Usage curves and overcommit"):

| Value | Amount |
| --- | --- |
| Packages per installation | 12 |
| Provision step with a package that covers the order | 8 minutes (`ACTION_MINUTES.orderProvisionPackage`) |
| Provision step with a custom spec or a smaller package | 15 minutes (unchanged `orderProvision`) |
| Account step | 5 minutes (unchanged) |
| Smallest package that may be booked against a sold spec | vCPU 25%, RAM 50%, disk 50% of the sold size; below that `error.packageTooSmall` |
| Web hosting username length | 8 characters before 2012, 16 from 2012; lowercase letters and digits, starting with a letter, unique among services |

The saving of 7 minutes is the reason to build a package; staff divide it by their speed like every action (`economy.md`, line 733).

Tick effects: none are added. The consequence of overselling by hand runs through the existing loop. `workloadUse` (`usage.ts:79`) scales `vcpu`, `ramGb` and `diskGb` by `w.promised ?? w` instead of by the booking, so use is the sold size times the load. Node CPU contention (`cores ÷ busy vCPUs`) and the disk stall over 100% then slow the customer's service, which sets `slowedAt` (`src/sim/85-products/products.ts:274-276`) and costs the monthly review. That is the "existing slowdown risk" the plan names. `panel-host-sim`'s oversell ratio per host multiplies the booking on top and reads the same field.

### 3.3 F3 and F4: extra parameters and order choices

`orderChoices(s, products: Product[]): OrderChoice[]` in `src/sim/30-market/manual.ts` (pure). One entry per live order ticket whose request is accepted:

```ts
export interface OrderChoice {
  ticketId: string; requestId: string; name: string; domain?: string;
  product: Product; spec: Spec; sla: Sla; city: string; quote: number | null;
  paid: boolean;           // the invoice is paid; the player may still provision before
  next: OrderStep | null;  // the step the order waits at
  error: string | null;    // stepError(...) for the step the form performs, an i18n key
  suggestedUsername?: string;
}
```

It never exposes `shady`. The contact email is not modelled, so forms that need an address show `contact@<domain>` derived from the domain, with no state. `suggestedUsername(s, domain, year)` takes the domain's letters and digits up to the length limit and appends a number on a clash.

### 3.4 F5: deep links and the console path

- `Resolved.page` of kind `console` gets `path: string` (`browser.ts:29`); `machinePage` passes the path from `split` (`browser.ts:121-125`).
- `ConsolePage` passes `path` to the console (`PanelProps.path?: string`). A new pure `parseCreate(path)` returns `{ screen: "create"; order?: string } | { screen: "packages" } | null` for the console's own real-looking paths.
- `consoles.ts` gets `CREATE_PATH` and `createLink(s, clusterId, ticketId): string | null`. It returns the console address plus the path, for example `https://node001.example.de:2087/scripts/wwwacct?order=tkt12`. Paths imitate the real products: cPanic `/scripts/wwwacct`, DirectAdmen `/CMD_ACCOUNT_USER`, Pleskit `/admin/subscription/create`, FreePanel `/virtual-server/domain_form.cgi`, TCAdmen `/Services/Create`, MultiKraft `/servers/create`, Pterodaktyl `/admin/servers/new`, Proxmocks `/?create=vm`, VMwhere `/ui/app/vm/new`, HyperVee `/vm/new`, OpenVeeZee `/virtual-servers/create`, Horizont `/project/instances/launch`. A fragment is dropped by `split` already, so Proxmocks uses a query.
- `createFormFor(family, product): boolean` lists the consoles that have a form. The Support link only replaces the direct button when it is true, so each console milestone flips one entry and every pull request stays green.
- A signed-out console shows its login first and keeps the address, so the form opens right after login (`ConsolePage.tsx:49-55` keeps the login per hostname in session state, and the tab keeps its history entry).

### 3.5 F6: package screens, per console

Each screen sits in the console's menu through a new `Tab` value `"packages"` and imitates the real screen. The record is the same `PackageDef`; only the labels differ. All screens have Add, Edit and Delete, a usage count column (services with that `pkg`), and a Copy to another server action when the player has more than one installation of the kind.

| Console | Real screen imitated | Fields shown | Early look | Late look |
| --- | --- | --- | --- | --- |
| cPanic | WHM > Packages > Add a Package, List Packages, Edit a Package | Package Name, Disk Quota (MB), Monthly Bandwidth Limit, Max Email Accounts, CloudLinux "Resource Limits": CPU and Memory | x3: dark blue left menu, grey content, flat grey form with a section header per group ("Resources", "Settings") | Paper Lantern: white cards, one card per section, blue buttons |
| DirectAdmen | Reseller Level > Manage User Packages > Create Package (`CMD_PACKAGES_USER`) | Package name, Bandwidth, Disk Space, Email Accounts, plus CPU and Memory limits as extra rows | Enhanced skin: three columns of underlined links on the home page, a plain table | Evolution: cards, dark top bar |
| Pleskit | Tools & Settings > Service Plans > Add Plan, Resources tab | Plan name, Disk space, Traffic, Mailboxes, plus CPU and Memory | 8.x: tabs "Resources, Permissions, Mail", light blue content | Onyx: flat, tabs "Hosting Plans" and "Resources" |
| FreePanel | Virtualmin > System Settings > Account Plans > Create account plan | Plan name, Quota, Bandwidth, Max mailboxes, plus CPU and Memory | Webmin classic: blue left tree, grey two-column form | Authentic: white, left menu, Bootstrap-flat form |
| TCAdmen | Games / Game services list with the service defaults dialog | Name, vCPU, RAM, Disk. The Title and Slots columns appear when `game-servers` lands | ASP.NET grey and black, tree left, plain grid | Dark grey and green |
| MultiKraft | Plans (the hoster's plan list; RAM is the plan unit) | Name, RAM (MB), vCPU, Disk | Dark grey with brown header, status-dot table | White and green cards |
| Pterodaktyl | Admin > Nests > Eggs, with the server Limits block (CPU Limit in %, Memory, Disk) | Nest (a single "Generic" nest until `game-servers`), Egg name (the package name), CPU limit (100% is 1 vCPU), Memory, Disk | Dark blue panel, one card per egg | Flat with a sidebar entry "Nests" |
| Proxmocks | The nearest real object is a VM template's Hardware tab. The screen is a Datacenter tree entry "VM Plans" with a grid in the ExtJS style: ID, Name, Cores, Memory, Disk, Used by | Name, Cores, Memory, Disk | 2008 grey ExtJS, blue gradient header | 2015 flat ExtJS, white, orange mark |
| VMwhere | Menu > Policies and Profiles > VM Classes (a class is a named CPU and memory size) | Name, vCPU, Memory, Storage | 2005 grey and yellow fat client dialog | 2015 blue web client list |
| HyperVee | System Center library > Profiles > Hardware Profiles | Profile name, Processor, Memory, Disk | Vista-era MMC three-pane | 2012 flat MMC |
| OpenVeeZee | Plans (the SolusVM plan list; the closest real object is a Virtuozzo configuration sample) | Name, RAM, Disk, CPU units | Green band, Verdana, bevelled buttons | Same under a dark top bar |
| Horizont | Admin > Compute > Flavors (Name, VCPUs, RAM, Root Disk, Public) | Name, VCPUs, RAM, Root Disk. The five built-in `m1.*` flavors from `Horizont.tsx:19-23` are listed first as public, read-only rows | Ubuntu-purple Horizon | Dark-sidebar Horizon |

Where the product has no sizes at all (Proxmocks), the screen is labelled in the product's own words and the plan names are a game addition; the real-world equivalent is the hosting-platform plan list the product is usually driven by.

Defaults on the Add form come from `defaultSpecFor(product, year)`, so a first package of a new host is a sensible one. The form never auto-creates packages.

### 3.6 F7: create forms, per console

Every form starts with an **Order** field (a select of `orderChoices` for the console's products, orders that are not ready listed disabled with the reason from `error`). Picking an order fills name, domain, product, sold spec and city and shows a read-only summary row. The fields the player decides are **Host or node**, **Package** (a select with "Custom, as ordered" first, then the packages that cover the order, then smaller ones marked "oversells"), and **Username** (web hosting). The submit button runs `provisionOrder(ticket, route, { package, username })`. The button disables while the ticket has work in progress (`tk.work`), and a toast reports "Queued" and the finished account appears when the work time passes.

| Console | Real screen imitated | Where the Order field goes |
| --- | --- | --- |
| cPanic | WHM > Account Functions > Create a New Account (`/scripts/wwwacct`): "Domain Information" (Domain, Username, Password, Email), "Package", "Settings", "DNS Settings" | A first section "Order" above Domain Information; Domain and Username prefill from it. Password is a display field the game ignores |
| DirectAdmin | Admin or Reseller Level > Create User (`CMD_ACCOUNT_USER`): Username, Email, Password, Domain, Package | A first row "Order" |
| Pleskit | Websites & Domains > Add Subscription: Domain name, Username, Password, Service plan; Plesk has a customer record first, which the order's customer already is | Above "Domain name" |
| FreePanel | Virtualmin > Create Virtual Server (`domain_form.cgi`): Domain name, Description, Administration password, Account plan | Above "Domain name" |
| TCAdmen | Services > Add Service (Create Service): Game, Customer, Slots, Host | Above "Game" |
| MultiKraft | Servers > Create Server: name, plan, node | Above "Name" |
| Pterodaktyl | Admin > Servers > Create New: Core Details, Allocation Management, Resource Management | First field of Core Details |
| Proxmocks | Create VM wizard: General tab (Node, VM ID, Name). With an order the VM is the customer's VPS. Without an order the wizard is the player's own VM, as today | General tab, field "Order"; the Resource Pool slot of the real General tab hosts the Plan select |
| VMwhere | New Virtual Machine wizard: creation type, name, compute resource, storage, customize hardware. A creation type "Customer order" next to "Create a new virtual machine" | First step |
| HyperVee | New Virtual Machine Wizard: Specify Name, Assign Memory, Connect Virtual Hard Disk, Summary | Specify Name page |
| OpenVeeZee | One-page Create Virtual Server form (CTID, hostname, template, RAM, disk, IP) | First row |
| Horizont | Launch Instance modal: Details, Source, Flavor, Networks | Details step |

Game servers are also sold from hypervisor clusters (`SERVES.cloud` includes `gameServer`, `platforms.ts:133`), so the hypervisor forms accept `vps`, `gameServer`, `cloud` orders. Orders for GPU, dedicated, colocation, DNS, VPN and storage keep the old direct buttons until their own console lanes add a form. Orders with GPUs use the custom spec as ordered; GPU packages are not offered.

### 3.7 F8: Customers > New customer

A "New customer" button in the Customers app bar opens `NewCustomer.tsx`, imitating the WHMCS "Clients > Add New Client" page (the pun product is WHMCache): sections "Personal Information" (Name, Company), "Order", and an "Add Client" button. The Order select lists accepted orders without an account (`orderChoices` where `next` is `account`). It fills Name and Company read-only from the order. The button runs `createAccount(ticketId)`. The component is exported so `shop-portal`'s "Shop console > Add client" reuses it. A new customer's payment habit and `shady` flag come from the order as today (`manual.ts:137-138`); neither is shown.

### 3.8 F9: account list columns

`Row` gains `pkg?: string` and `user?: string` (`PanelBase.tsx:111`). `useRows` fills them from the service (`PanelBase.tsx:121`). Each console shows them in its own list header: cPanic List Accounts columns "Username" and "Package", DirectAdmin "Package", Pleskit "Subscription plan", FreePanel "Plan". Game and hypervisor lists show the package name in the existing `sub` line.

### 3.9 F10: change package

`changePackage(s, serviceId, name)`: books the new package on the existing workload, in place when the node has room, else `error.noCapacity`. It reuses `resize` from `manual.ts:238` and sets `promised` by the same rule as provisioning. It costs `ACTION_MINUTES.techOp`. UI: cPanic Account Functions > Upgrade/Downgrade an Account, DirectAdmin Modify User > Package, Pleskit subscription > Change Plan, FreePanel Edit Virtual Server > Account plan, and the resize dialogs of the game and hypervisor consoles gain a Plan select. `panel-host-sim` owns Suspend and Terminate in the same Account Functions menu; this lane owns the package switch only.

## 4. Milestones

Each one is a pull request, green with `npm run typecheck`, `npm test`, `npm run build`. Every sim change has its seeded test listed.

1. **Package store.** `PackageDef`, `Cluster.packages` with defaults in `clusterDefaults` and `blank()`, the pure helpers, actions `addPackage`, `editPackage`, `deletePackage`, `copyPackages`, English and translated error keys in `ui-packages.ts`. No UI. Tests in `tests/packages.test.ts`: add, edit, duplicate name, limit of 12, wrong product, delete while in use, copy skips existing names, an old save without `packages` loads with `[]`, a round trip through `serialize` and `deserialize` keeps packages.
2. **Provision from a package.** `Service.pkg`, `pkgBook`, `username`, `SalesRequest.pkg`, `username`, `Workload.promised`; `provisionOrder` options; `applyStep`, `provisionService`, `placeService`; `orderChoices` and `suggestedUsername`; `workloadUse` scaling by `promised`; the 8-minute step. Tests in `tests/package-provision.test.ts`: a covering package books the package size and keeps the sold spec; a smaller package books less and sets `promised`; below the floor fails with `error.packageTooSmall`; a larger package books the larger size; the three-argument `provisionOrder` behaves as before; a missing package fails; username rules by year and uniqueness; step minutes 8 and 15; with the same seed an oversold web space on a full node gets a lower `perf` than an exact one; `tests/manual-orders.test.ts` still passes untouched.
3. **Plumbing and cPanic Add a Package.** Console `path` in `Resolved`, `parseCreate`, `CREATE_PATH`, `createLink`, `createFormFor`, the shared `PackageForms.tsx` (`OrderPicker`, `PackageFields`, `PackageTable`), `Tab` gets `"packages"`, the cPanic Packages menu with Add, Edit, Delete in both eras. Tests: `tests/package-links.test.ts` (resolve keeps path and query, `createLink` per family, `createFormFor` false for consoles without a form) and an added case in `tests/panel-consoles.test.tsx` rendering both cPanic eras with and without packages.
4. **cPanic Create a New Account and the Support link.** `Tab` gets `"create"`; the form with the Order field; `CustomCompose` shows a link instead of the Provision button when `createFormFor` is true, keeping `HostCards`; the List Accounts Package and Username columns (F9 for cPanic). Tests: `tests/package-forms.test.tsx` (the form renders prefilled from a seeded open order, a not-ready order is disabled with its reason, the Support link appears only for a console with a form) and a sim-level case in `tests/package-provision.test.ts` that the form's call equals the action.
5. **Proxmocks VM plans and Create VM.** The VM Plans entry; the Order field and Plan select in the General tab of the wizard; `useNewVm` gains order mode; `HypervisorBase.tsx` gets a shared `PlanSelect`. Tests: `tests/hypervisor-consoles.test.tsx` cases (order mode creates a customer VPS, no order keeps the own-VM path) and `tests/package-forms.test.tsx`.
6. **TCAdmen Game services and Add Service.** Packages screen and form, the game panel kind (`kind: "game"`) and game servers on hypervisors share the `gameServer` product. Tests: `tests/game-panels.test.ts` additions and `tests/package-forms.test.tsx`.
7. **Customers > New customer.** `NewCustomer.tsx`, the button, `useFocus("Customers")` for the Support link, the Support account row becomes a link. Tests: `tests/package-forms.test.tsx` (renders the order list, the call equals `createAccount`), `tests/customer-actions.test.ts` unchanged and passing.
8. **DirectAdmen User Packages and Create User.** Tests: `tests/panel-consoles.test.tsx`, `tests/package-forms.test.tsx`.
9. **Pleskit Service Plans and Add Subscription.** Same tests.
10. **FreePanel Account Plans and Create Virtual Server.** Same tests.
11. **MultiKraft Plans and Create Server.** Same tests plus `tests/game-panels.test.ts`.
12. **Pterodaktyl Nests and eggs and Create New Server.** Same tests plus `tests/game-panels.test.ts`.
13. **VMwhere VM classes and the Customer order creation type.** `tests/hypervisor-consoles.test.tsx`.
14. **HyperVee Hardware Profiles and the wizard Order page.** Same.
15. **OpenVeeZee Plans and Create container.** Same.
16. **Horizont Flavors and Launch Instance Order field.** The built-in flavors become read-only public rows; `flavorOf` also matches stored flavors. Same tests.
17. **Change package (F10).** `changePackage` and the per-console Plan select. Tests in `tests/package-provision.test.ts`: in-place change, no capacity, floor, `promised` set and cleared.

Milestones 8 to 12 and 13 to 16 are independent of each other and can land in any order or in parallel once milestone 4 and milestone 5 are in.

## 5. Files touched

Shared hotspots are marked **[HOT]**. "Edits" lists the line or block touched.

| M | Creates | Edits |
| --- | --- | --- |
| 1 | `src/sim/80-business/packages.ts`, `src/sim/90-actions/packages.ts`, `src/i18n/ui-packages.ts`, `src/i18n/{de,es,fr,it,pt}/ui-packages.ts`, `tests/packages.test.ts` | **[HOT]** `src/sim/60-infra/cluster.ts` (the `Cluster` field and `clusterDefaults`), **[HOT]** `src/sim/90-actions/clusters.ts` (`blank()`), **[HOT]** `src/sim/90-actions/index.ts` (module list, one line). `50-state.ts`, `91-save` need no edit: the default flows through `clusterDefaults` and `upgradeCompute`, and the optional service and request fields need no fill |
| 2 | `tests/package-provision.test.ts` | **[HOT]** `src/sim/30-customers/customers.ts` (`Service.pkg`, `pkgBook`, `username`), **[HOT]** `src/sim/30-market/market.ts` (`SalesRequest.pkg`, `username`), **[HOT]** `src/sim/60-infra/cluster.ts` (`Workload.promised`), `src/sim/30-market/manual.ts` (`applyStep`, `orderChoices`), **[HOT]** `src/sim/90-actions/clusters.ts` (`placeService`, `provisionService`, `Order`), `src/sim/90-actions/orders.ts`, `src/sim/90-actions/customers.ts` (`addService`), **[HOT]** `src/sim/60-infra/usage.ts` (`workloadUse`), `src/sim/47-staff/activity.ts` (`ACTION_MINUTES`), `src/sim/30-market/manual.ts` (`stepMinutes`), `docs/design/economy.md`, `src/i18n/ui-packages.ts` and the five translations. `consoles.ts` is not touched |
| 3 | `src/ui/apps/browser/consoles/PackageForms.tsx`, `tests/package-links.test.ts` | **[HOT]** `src/sim/80-business/browser.ts` (`Resolved.page` console path), **[HOT]** `src/sim/80-business/consoles.ts` (`CREATE_PATH`, `createLink`, `createFormFor`), `src/ui/apps/browser/BrowserApp.tsx` (passes path), **[HOT]** `src/ui/apps/browser/consoles/ConsolePage.tsx` (path prop), **[HOT]** `src/ui/apps/browser/consoles/PanelBase.tsx` (`PanelProps.path`, `Tab` union, `usePanelTab`), `src/ui/apps/browser/consoles/cpanic/CPanic.tsx`, `cpanic.css`, `tests/panel-consoles.test.tsx`, ui-packages files |
| 4 | `tests/package-forms.test.tsx` | `CPanic.tsx`, `cpanic.css`, **[HOT]** `PanelBase.tsx` (`Row.pkg`, `Row.user`, `useRows`, `RowsTable`), `src/ui/apps/support/CustomOrder.tsx`, `PackageForms.tsx`, ui-packages files |
| 5 | none | `Proxmocks.tsx`, `proxmocks.css`, **[HOT]** `HypervisorBase.tsx` (`useNewVm` order mode, `PlanSelect`), `PackageForms.tsx`, `consoles.ts` (`createFormFor`), ui-packages files, `tests/hypervisor-consoles.test.tsx` |
| 6 | none | `TCAdmen.tsx`, `tcadmen.css`, **[HOT]** `PanelBase.tsx` (`Tab` use only), `consoles.ts` (`createFormFor`), ui-packages files, `tests/game-panels.test.ts` |
| 7 | `src/ui/apps/customers/NewCustomer.tsx` | `CustomersApp.tsx`, `customers.css`, `CustomOrder.tsx`, `tests/package-forms.test.tsx`, ui-packages files |
| 8 to 12 | none | One console component and stylesheet each (`DirectAdmen.tsx`, `Pleskit.tsx`, `FreePanel.tsx`, `MultiKraft.tsx`, `Pterodaktyl.tsx`), `consoles.ts` (`createFormFor`), ui-packages files, tests |
| 13 to 16 | none | One console component and stylesheet each (`VmWhere.tsx`, `HyperVee.tsx`, `OpenVeeZee.tsx`, `Horizont.tsx`), `HypervisorBase.tsx` only for a shared helper if needed, `consoles.ts` (`createFormFor`), ui-packages files, `tests/hypervisor-consoles.test.tsx` |
| 17 | none | `src/sim/90-actions/packages.ts`, `src/sim/30-market/manual.ts` (reuse `resize`), the six panel components' account and resize dialogs, ui-packages files, `tests/package-provision.test.ts` |

Hotspot summary: `PanelBase.tsx` (milestones 3, 4, 6), `HypervisorBase.tsx` (5), `cluster.ts` and `clusters.ts` (1, 2), `customers.ts` and `market.ts` type edits (2), `usage.ts` (2), `browser.ts` and `consoles.ts` (3, then one line per console milestone), `ConsolePage.tsx` (3), `90-actions/index.ts` (1). `en.ts` needs no registration edit because `ui-packages.ts` is picked up by the `ui-*.ts` glob; `50-state.ts`, `91-save` and tick are not touched. The only `Tab` union edit that can collide with other lanes is the added `"packages"` and `"create"` values in milestones 3 and 4; the other lanes add their own values to the same line, which is a one-line rebase.

Translations: every English key added in a milestone gets the same key in `src/i18n/{de,es,fr,it,pt}/ui-packages.ts` in the same pull request. Key prefix: `pkg.`; error keys keep the `error.` prefix the actions return.

## 6. Dependencies

Lane ids are from the program list.

- **Must land first:** none for milestones 1 and 2, which are sim-only and touch nothing other lanes write. Milestone 3 onward prefer `readouts` first, because `readouts` rewrites the same menus and `PanelBase.tsx` blocks and lands the `Tab` additions the other lanes then extend; if `readouts` is late, milestone 3 lands first and `readouts` rebases over a one-line union change.
- **This lane needs from `panel-host-sim`:** nothing to start. The Package and Username columns (F9) and the change-package action (F10) sit beside its Suspend and Terminate items in the cPanic Account Functions menu, so milestone 17 should follow its account functions. If its DirectAdmen login levels land first, the DirectAdmen packages screen moves under Reseller Level (milestone 8); otherwise it sits in the flat Admin menu.
- **This lane blocks:**
  - `shop-portal`: needs milestone 1 (store, `copyPackages`, `missingOn`) and milestone 2 (`SalesRequest.pkg`, `applyStep` reading it) to build products that point at a package name, and milestone 7 for the reusable `NewCustomer` form behind "Shop console > Add client".
  - `game-servers`: needs milestone 1 (the reserved `title` and `slots`), milestone 2 and the package screens of milestones 6, 11 and 12, where it adds the Title and Slots fields to TCAdmen, the RAM-only MultiKraft plan and the Pterodaktyl nest tree. Its slots-to-resources conversion writes `spec`, so capacity and pricing keep working.
  - `panel-host-sim`: reads `Workload.promised` (milestone 2) for its booked-against-sold readout and its oversell ratio.
  - `mail-dns-vpn-storage`: reuses `OrderPicker`, `createLink`, `createFormFor` and the `provisionOrder` options (milestones 2 and 3) for the create forms of its consoles.
  - `web-services`: reads `Service.username` for per-account features and the package name in its Pleskit and cPanic tables; it needs milestone 2 only.
  - `hypervisors-backups`: its Horizont projects and quotas and Proxmocks HA groups sit on the plans and flavors from milestones 5 and 16; flavors are the quota unit.

## 7. Open questions

Only decisions that are the user's.

1. **Is the Order field required on the create forms?** Recommendation: yes for customer services, so every service has a customer and an order thread, and the "few orders a week" cost is real. The hypervisor forms keep the own-VM path when the field is empty, so installing software in the player's own VMs is unchanged.
2. **Does editing a package change existing accounts?** Recommendation: no. It applies to accounts created afterwards, which keeps Edit cheap and avoids a bulk resize rule. Change package (milestone 17) is the explicit way to move an account.
3. **How far may a package undercut the sold spec?** Recommendation: vCPU down to 25%, RAM and disk down to 50% of what was sold (section 3.2). The floors stop a package from being a free way to book nothing, and `panel-host-sim`'s per-host ratio sits on top.
4. **Build milestone 17 (change package)?** Recommendation: yes, last. It completes Account Functions: Modify, and it is the only place a mistake in a package choice can be repaired without terminating the account. Say no if resize through an order is enough.
5. **Where does the Support link open for an order with several fitting hosts?** Recommendation: on the host selected in the existing host cards, defaulting to the best host (`hostFor`). The player changes the host on the form.
