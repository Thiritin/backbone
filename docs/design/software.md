# Operating systems, software and the browser

A machine (a server or one of the player's own virtual machines) runs an operating system, and software is installed on that operating system the way it is in real life: from the machine's console, by typing the commands the software's website gives, or through a GUI on Windoors. The USB stick and the VM's ISO stop carrying software and carry operating systems instead. Each software gets its own website in the Browser with details, prices, features and the install commands; the Browser gets a start page and a site index behind a home icon; the two virtual machine managers collapse into one, the hypervisor's web console; and every management console is modelled closely on the product it mocks, in two looks that change with the years.

This plan stands on `docs/design/console.md`, whose three phases are built: the console window, POST, the BIOS with Storage, the boot menu, the USB installer, Erase disk and the VM console with its ISO. What changes here is what the installer installs (an OS, not software), what comes after the OS boots (a login and a shell, or a desktop), and where software comes from (the Browser).

Values here are starting values. Every one that gets tuned lives in one catalog file.

## 1. Operating systems

Two operating systems. A software runs on one of them, or on both, following what the real one does.

| Id | Name | Mocks | Versions (year the version exists from) | License |
| --- | --- | --- | --- | --- |
| `lunix` | Debiant GNU/Lunix | Debian | 3.1 Sarge (2005), 4 Etch (2007), 5 Lenny (2009), 6 Squeeze (2011), 7 Wheezy (2013), 8 Jessie (2015), 9 Stretch (2017), 10 Buster (2019), 11 Bullseye (2021), 12 Bookworm (2023) | Free |
| `windoors` | Windoors Server | Windows Server | 2003 (2005), 2008 (2008), 2008 R2 (2010), 2012 (2012), 2012 R2 (2014), 2016 (2016), 2019 (2019), 2022 (2022), 2025 (2025) | 600 euros once per machine (server or VM) until 2015; from 2016, 4 euros a month per physical core of a server or per vCPU of a VM |

A license has eras, `licensing: { from; kind: "once" | "core" | "server" | "account" | "free"; fee }[]` on each OS and each software, and `licensingAt(entry, year)` picks the one of the year. In a `once` era the license is bought when the install starts, as a ledger line ("Windoors Server 2003 license, node001"), and belongs to the machine: `s.licenses: { id; machineId; boughtAt }[]`. A reinstall on the same machine pays nothing, a new machine pays again, and a machine that is sold, scrapped or deleted loses its licenses at the next month's bill. Without the cash the install is refused with the Shop's cash error. A VM from a template, the App Suite's included, buys its OS license the same way. Old saves give every machine that holds Windoors or VMwhere its license for free. A `once` era adds nothing to the monthly `licenseCost`.

An OS install takes the newest version that exists in the game year. Installed machines keep their version; there is no in-place upgrade (reinstall to upgrade). The version shows on the boot screen, the login screen, the machine's detail page and in `uname -a`.

Catalog: `src/sim/10-catalog/server-os.ts` (the existing `os.ts` holds the Pear desktop releases and keeps its name) with `ServerOsId`, `SERVER_OS`, `serverOsAt(id, year)`, `serverOsById`, the license eras, the boot minutes and install hours of section 4.

Install media. The USB stick (servers) and the ISO list (VMs, from the hypervisor console's Media menu and the VM console's title bar) hold the two operating systems and nothing else: "Debiant 8 netinst", "Windoors Server 2012 R2". `Workload.media` changes from `"iso"` to a `ServerOsId`; `deserialize` maps an old `"iso"` to `"lunix"`.

## 2. Software catalog changes

`src/sim/10-catalog/platforms.ts` keeps all 23 entries and gains these fields on `Software`:

| Field | Meaning |
| --- | --- |
| `os: ServerOsId[]` | Which operating systems it installs on. |
| `ports: number[]` | TCP ports it binds. Two software that share a port cannot be on one machine. |
| `exclusive?: "hypervisor"` | At most one hypervisor per machine, port or no port. |
| `install: { kind: "apt" \| "script" \| "gui"; package?: string; commands: string[] }` | How it gets onto a machine, below. |
| `site: Site` | The brand record its website and console draw from, section 8.3. |
| `licensing: LicenseEra[]` | The license eras of section 1, replacing `pricing` and `fee`. Every software has one era with its old pricing and fee, except VMwhere: 600 euros once per CPU socket of the node until 2023, 8 euros a month per physical core from 2024. |

The compatibility rule is one function, `conflict(a, b): string | null`, returning the `error.*` key of the reason (same port, two hypervisors), and `runsOn(sw, osId)`. `installBlock` calls both against everything already on the machine and keeps every reason it has today except "one control plane per machine", which this plan removes: a panel on a hypervisor node is legal when no port collides.

| Software | Mocks | OS | Ports | Install | Notes |
| --- | --- | --- | --- | --- | --- |
| cPanic | cPanel/WHM | lunix | 80, 443, 2082, 2083, 2086, 2087 | script | Paid. One line from the site. |
| Pleskit | Plesk | lunix, windoors | 80, 443, 8443, 8880 | script on lunix, gui on windoors | Paid. |
| DirectAdmen | DirectAdmin | lunix | 80, 443, 2222 | script | Paid. |
| FreePanel | ISPConfig/Webmin | lunix | 80, 443, 10000 | apt, 2 lines | Free. |
| OpenVeeZee | OpenVZ | lunix | none | apt, 3 lines (kernel, tools, reboot) | Free hypervisor. |
| OpenStash | OpenStack | lunix | 80, 443, 5000 | apt, 3 lines | Free hypervisor, from 2010. |
| VMwhere | VMware vSphere | lunix | 80, 443, 902 | script | Paid hypervisor. Sells the App Suite, section 5. |
| Proxmocks | Proxmox VE | lunix | 8006 | apt, 3 lines (repo, update, install) | Free hypervisor, from 2008. |
| HyperVee | Hyper-V | windoors | none | gui (Server Manager role) | Paid hypervisor, from 2008. |
| TCAdmen | TCAdmin | windoors | 80, 443, 8880 | gui (setup from its site) | Paid game panel. The only one in 2005, so the first game server needs a Windoors license. |
| MultiKraft | Multicraft | lunix, windoors | 80, 443, 8080 | script | Paid game panel, from 2010. |
| Pterodaktyl | Pterodactyl | lunix | 80, 443, 8080 | apt, 3 lines | Free game panel, from 2016. |
| Bound | BIND | lunix, windoors | 53 | apt, 1 line | Free DNS. No web console. |
| PowerDNZ | PowerDNS | lunix | 53, 8081 | apt, 2 lines | Free DNS. |
| Knut DNS | Knot DNS | lunix | 53 | apt, 1 line | Free DNS, from 2011. No web console. |
| OpenVeePeeN | OpenVPN Access Server | lunix, windoors | 943, 1194 | script | Free VPN. |
| Sysko AnyConnekt | Cisco AnyConnect | lunix | 443, 1194 | script | Paid VPN. Collides with every web panel on 443. |
| WireGuarded | WireGuard | lunix | 51820 | apt, 1 line | Free VPN, from 2018. No web console. |
| vsFTPeed | vsftpd | lunix | 21 | apt, 1 line | Free storage. No web console. |
| OwnClod | ownCloud | lunix | 80, 443 | apt, 2 lines | Free storage, from 2010. |
| MinnIO | MinIO | lunix, windoors | 9000, 9001 | script | Free storage, from 2016. |
| Postfixit | Postfix | lunix | 25, 587 | apt, 1 line | Free mail. No web console. |
| Mailpig | Mailcow | lunix | 25, 80, 443, 587, 143, 993 | apt, 3 lines | Free mail, from 2015. Collides with every web panel. |

`install.commands` is the exact list the website prints and the console accepts, in order. Proxmocks:

```
echo "deb http://download.proxmocks.com/debiant stretch pve-no-subscription" > /etc/apt/sources.list.d/pve.list
apt-get update
apt-get install -y proxmocks-ve
```

cPanic:

```
cd /home && curl -o latest -L https://securedownloads.cpanic.net/latest && sh latest
```

For `gui` the list is empty; the Windoors desktop installs it. `install` describes the Lunix way; on Windoors every software installs from the desktop, so Pleskit, MultiKraft, Bound, OpenVeePeeN and MinnIO carry their Lunix method. The `Site` records live in `src/sim/10-catalog/sites.ts` (both operating systems and every software), and a site whose look never changes has one era. `apt-get install <package>` with the catalog's `package` counts as the install for every `apt` software, so a player who knows the package name can skip the site; a software with a repo line needs that line first or the package is not found.

## 3. Machines and state

Software moves from the cluster to the machine. A machine is a `Device` or an own-VM `Workload`. Both gain:

| Field | Type | Meaning |
| --- | --- | --- |
| `os` | `{ id: ServerOsId; version: string; installedAt: number } \| null` | What the disk holds. `null` is an empty disk ("Operating system not found"). |
| `software` | `{ id: string; version: string; installedAt: number; doneAt: number \| null }[]` | What is installed. `doneAt` in the future means installing. |

`newGame` and `deserialize` derive both from the clusters an old save has: a node of a HyperVee cluster and every machine running TCAdmen gets Windoors, every other node and every own VM that runs software gets Lunix, an empty own VM and a server in no cluster get `null`; `software` from `Cluster.panel` and `Cluster.platform`. An old save loads with every machine installed and booted.

`Cluster` keeps `platform`, `panel` and `vm` as the derived control plane the rest of the sim reads (billing, products, migration, tickets, consoles). `installSoftware` writes the machine's list and still creates the cluster or panel host through the existing `installHypervisor`, `installPanel`, `installPanelInVm` underneath; `uninstallSoftware` the reverse through `dropCluster`, `leave`. The cluster layer is also where `createPanelVm`, `createSoftwareVm`, the test fixtures and the save migration create clusters directly, so the machine's list is written in the cluster layer itself (added in `installOnServer` and `installPanelInVm`, removed in `dropCluster` and `leave`, kept across `addNode`, cleared when a server is seized), not only in `installSoftware`.

`canInstall(s, machineId, softwareId)` in `90-actions/software.ts` gives the reasons in this order: another OS on the disk, a conflict with installed software, a server that is not free (`error.serverInUse` when it already hosts a cluster) or a VM that hosts one (`error.onePanel`), then an OS that is not up (`error.noOs`, `error.osNotUp`). A server still belongs to one cluster, so a panel on a Proxmocks node passes `conflict` and is still refused; a second control plane on one machine needs the cluster layer to hold two. The installer's erase empties `os` and `software`. VMs made in one click from a hypervisor console (`createPanelVm`, `createSoftwareVm`) start from a template with the software's first OS on the disk.

Licenses. `licenseCost` adds the Windoors fee of a core era (4 euros per core or vCPU) and the App Suite per cluster; its result keeps the `{ panel, platform }` shape the tests assert, with Windoors under `platform`. The monthly ledger has one line for all Windoors machines ("Windoors Server, 3 machines") and one per App Suite cluster ("VMwhere App Suite, Cloud 1"); a Windoors machine in no cluster is billed there too.

## 4. The install pipeline

Every machine goes through the same states; the console shows them.

1. **Empty disk.** A server shows POST and then "Operating system not found"; a VM has no BIOS and goes straight there. Both exist today.
2. **Boot from media.** Server: F11 in POST and the USB stick, when it is plugged in and written (section 4.1). VM: the Media menu mounts an ISO and the VM boots from it on the next start (exists as `setMedia`; the ISO becomes one of two).
3. **OS installer.** The existing `installer.tsx` stops listing software and becomes two installers. Lunix: the Debiant text-mode installer, five screens (language, hostname, partition disks with the erase confirmation the current installer already has for a busy target, installing with a progress bar, reboot). Windoors: Setup (edition, license terms, "Where do you want to install", copying files with a percentage, two reboots). `installOs(machineId, osId, confirm?)` replaces the installer's software pick: refused unless the machine booted from media that holds that OS (a server from the stick after `bootFromUsb`, a VM with that ISO in `media`); sets `os` with `installedAt` at the hour the install is done and holds `bootUntil` until the first boot after it; a reset, a pulled plug or a stopped VM mid-install leaves `os` null. The erase and busy-target rules of `installCase` stay as they are. A server boots from its disk once the install starts, a VM ejects its ISO.
4. **First boot.** Lunix boots to `tty1` login (any key logs in as root; the hostname is the machine's). Windoors boots to the logon screen, then the desktop.
5. **Install software.** Lunix: type the commands from the software's site into the console or over `ssh` from the Terminal. Windoors: Server Manager on the desktop. `installSoftware(machineId, softwareId)` is refused unless the machine is booted with an OS the software runs on and nothing conflicts; it then runs for `installHours` and the console shows the method's progress text.
6. **Done.** The software's console comes alive at the machine's address in the Browser. For a hypervisor the cluster exists from `doneAt`, for a panel the panel host, as `switching.doneAt` works today.

Timings at 1× (one game minute a real second):

| Step | Game time | What the player sees |
| --- | --- | --- |
| POST (servers) | 3 minutes | the existing splash and key window |
| Lunix boot | 20 minutes | 20 seconds of kernel and service lines |
| Windoors boot | 40 minutes | logo and bar, then the logon |
| Lunix install | 1 hour | the installer's progress bar |
| Windoors install | 2 hours | Setup's percentage, two reboots |
| Software install | `installHours` from the catalog | apt lines, script stage lines, a Windoors progress bar |

Skipping time skips the screens; at 1× they run in real time. Boot screens are UI pacing driven by `bootUntil`; the install hours are simulation. POST is `BOOT_MINUTES` (3) and every boot of a machine with an installed OS adds the OS's boot minutes to `bootUntil` (`bootHours` in `60-infra/status.ts`).

`machineScreen(s, machineId, loggedIn?)` in `60-infra/oob.ts` is the state machine the console renders: `dark`, `post`, `stuck`, `setup`, `bootMenu` (with the operating systems on the media), `notFound`, `osInstall` (os, progress), `booting` (os, the last boot minutes of `bootUntil`), `login` (os), `desktop` (Windoors once `loggedIn`), `installing` (software, progress) and `hung`. `consoleScreen` derives its first line from it.

Uninstall: Lunix `apt-get remove <package>` or the site's uninstall line; Windoors from Server Manager. Refused while the software is a control plane with workloads, with today's reason.

### 4.1 Media

The installer media are real objects: ISO images the player downloads and one USB stick.

- **Images.** `s.media.images` lists the operating systems whose ISO the player has downloaded, once each. The Download page of the Debiant and Windoors sites has a Download ISO button on every release the year allows; any of them adds the OS, since the installer always installs the newest version of the year. A download takes no game time, and Windoors needs no license to download (the license is paid at install).
- **The stick.** `s.media.stick` holds the OS written on it and the server it is in. Write to USB stick, next to the release list on the same page, writes the OS once its image is downloaded; the stick holds one OS at a time. The stick plugs in at the USB port on every server front in the rack's front view, or with the Plug in USB stick tile in the server's inspector. Where the player stands, or in the basement, it is in at once; at a datacenter the player is away from it is hand work of two minutes (`PLUG_HOURS`), with remote hands or a friend through the hand-work sheet, and the stick is in once it is done. Plugging into another server moves it. Unplug works where the player stands. The stick is never lost.
- **Boot.** The boot menu lists "USB: <OS> <version>" only while the stick is in that server and holds an OS, and `bootFromUsb` is refused with "No bootable device" otherwise. The BIOS main page shows the USB device or Not Present. A server that booted from the stick and loses it shows Operating system not found until it boots again. `installOs` on a server needs the stick to hold that OS.
- **VMs.** The VM console's Media menu and the hypervisor consoles' Media menus list `mountableImages(s)`, the downloaded images; Eject stays. `setMedia` refuses an image that is not downloaded.
- **New game and old saves.** No images, the stick empty and out. Machines that already have an OS keep it.

Actions in `90-actions/media.ts`: `downloadImage(osId)`, `writeStick(osId)`, `plugStick(deviceId, how?)`, `unplugStick()`. Tests: `tests/media.test.ts`; the console and install suites plug the stick through the `withStick` fixture.

## 5. App installers on paid platforms

VMwhere sells the **VMwhere App Suite** (mocks the vSphere Marketplace and OVF appliances): 25 euros a month per cluster, bought from a tile in the vSphear console. With it, the New Virtual Machine wizard gains a "Deploy from App Suite" creation type listing every software the game year allows on either OS: pick one and the VM is created, the OS installed and the software installed in one step, without a console, in the software's `installHours` plus one hour. The Windoors license still applies and the wizard's summary says so. Without the suite, VMwhere VMs install like every other. No other hypervisor gets one-click installs.

`buyAppSuite(clusterId)`, `cancelAppSuite(clusterId)`, `deployFromSuite(clusterId, size, softwareId)` in `90-actions/suite.ts`. `Cluster.appSuite: boolean`, default false. The deployed VM gets the software's first OS from the start and the software's install finishes `SUITE_OS_HOURS` (1) after its own install hours.

## 6. Terminal and SSH

`ssh <host>` opens a session on a booted Lunix machine as today; a Windoors machine refuses ("Connection refused", no sshd), an unbooted or empty machine times out. On a session:

- `apt-get install <package>` and `apt install <package>`: known, compatible and (where the catalog has a repo line) with the repo added: the install starts and apt's progress lines print over the install hours the way `top` refreshes today. Unknown: today's "Unable to locate package". Incompatible: the conflict reason.
- `echo ... > /etc/apt/sources.list.d/<x>.list` lines, `wget`, `curl` and `sh` lines and the `cd ... && curl ... && sh` one-liner are matched whole (after whitespace normalisation) against the catalog's `commands`. A `script` software installs when its line runs.
- `apt-get remove <package>` uninstalls; `dpkg -l` lists installed software with versions; `uname -a` prints the OS and version.
- A repo line counts once its file in `/etc/apt/sources.list.d/` holds the line's `deb` entry, so it is the shell's own `echo ... >` that adds it. Packages a site installs before its own (`linux-image-openveezee`, `pdnz-backend-sqlite3`) set up at once and change nothing. A script line is matched whole before the shell splits the line at `&&`; a lone `curl`, `wget` or `sh` that matches nothing fails the way the real tool does.
- An install the Terminal started prints three progress lines (`INSTALL_STEPS`) at a quarter, half and three quarters of its install hours, then a done line, through `watchStep`.

The machine's own console runs the same shell once logged in, so the Terminal and the console are two doors to one session. `src/sim/60-infra/apt.ts` grows into this; the shell stays in `shell.ts`; `runLine` is exposed per machine so the console screen can call it.

## 7. The console screens

`src/ui/apps/console/` as built, with these changes and additions. Each screen is a colour set and a font, no art.

**Kept as built**: no signal, POST, the stuck prompt, the BIOS, the boot menu (its USB entry names the OS on the stick, "USB: Debiant 8 netinst" or "USB: Windoors Server 2012 R2", and is there only while the stick is in), Operating system not found, hung, the VM console's title bar (Media lists the downloaded ISOs).

**Lunix installer**: blue background, grey boxes with red title bars, white text, as the Debiant installer looks in every year. Tab and Enter move through the five screens of section 4, after the installer boot menu (Install, Erase disk, Reboot) that also holds the bare-metal erase.

**Lunix boot and login**: black, the kernel lines in white, a `Debiant GNU/Lunix 8 node001 tty1` banner and `node001 login:`. Any key logs in as root; the prompt runs the shell with the Terminal's line editing (shared, not forked). From Debiant 8 the boot shows green `[ OK ]` lines instead of plain ones. The lines follow game time over the OS's boot minutes, so they run in real time at 1x and skipping time skips them. The login lasts until the machine boots again; `exit` returns to it.

**Software install progress on Lunix**: apt's "Reading package lists, Unpacking, Setting up" lines; a script installer's stage lines ("Fetching, Installing packages, Configuring"); printed over the install hours.

**Windoors Setup**, two eras. 2003: the blue text-mode first stage ("Setup is loading files"), then the silver GUI stage with the left-hand step list (Collecting information, Dynamic update, Preparing installation, Installing Windoors, Finalizing installation) and a minutes-remaining line. 2008 and later: the dark blue "Install Windoors" window with the logo, the edition list, "Where do you want to install Windoors?" and the "Installing Windoors" checklist with percentages. The era follows the version installed. The 2003 partition list deletes with D (the bare-metal erase); the later window has Delete next to Next. Both reach the same erase confirmation as the Debiant partitioner.

**Windoors boot and logon**, three eras. 2003: the black boot screen with the scrolling bar, "Welcome", the olive desktop. 2008 to 2012 R2: the green bar, the blue logon, the desktop. 2016 and later: the flat spinner, the flat logon and desktop. The desktop holds a taskbar with a Start button and the clock, and one window that opens on login: Server Manager.

**The software's own screens on a booted machine** replace today's per-software login looks (`debian`, `dcui`, `windows`): the screen is the OS's, not the software's. VMwhere's grey and yellow DCUI stays as the look of a Lunix machine running VMwhere, since that is what the product shows.

### 7.1 Windoors Server Manager

The GUI that installs software on Windoors, modelled on the real one of each era.

- 2003: "Manage Your Server", the white page with the green header band and the roles list with "Add or remove a role". HyperVee appears from 2008. The catalog's `gui` software that is not a role (TCAdmen, Pleskit) installs from **Add or Remove Programs**, "Add New Programs", listing the installers from their sites (every `gui` software whose year has come; the download is implied).
- 2008 to 2012 R2: the Server Manager console with the tree on the left (Roles, Features, Diagnostics, Configuration, Storage) and the Add Roles Wizard (Before You Begin, Server Roles with the checkbox list, Confirmation, Progress, Results). HyperVee is a role; the others under "Programs and Features, Install a program from the network".
- 2016 and later: the flat dashboard with the tiles ("Add roles and features", "Add other servers to manage") and the wizard with the left-hand step list.

Installing calls `installSoftware`; the wizard's Progress page shows the bar and the hours left. Server Manager lists what is installed or installing with a Remove button, which calls `uninstallSoftware`. Programs install in a wizard without the step list; the 2016 wizard lists roles and programs together. Logging off is in the Start menu.

## 8. The Browser

### 8.1 Toolbar, start page and home

The toolbar gains a **home icon** left of the address bar. Home is the site index, `www.yahoy.com/dir/`. A new browser session's first tab opens there. The bookmarks bar keeps the company site once launched and the registrar under contract; the Sponsor-Bored and console bookmarks go away, since the index lists them.

### 8.2 The index

Two looks, switching in 2013.

- 2005: white page, the red Yahoy! wordmark, a search box that only filters the list, and a two-column directory of categories in blue underlined links with the count in brackets after each, the way the Yahoo! Directory listed sites. A category shows its sites with a one-line description from the site record.
- 2013 and later: the purple Yahoy! wordmark, a white card per category with its sites as rows with the favicon.

Categories, in this order, each site from the year it exists:

1. **Operating systems**: Debiant, Windoors Server.
2. **Virtualization**: OpenVeeZee, OpenStash, VMwhere, Proxmocks, HyperVee.
3. **Hosting panels**: cPanic, Pleskit, DirectAdmen, FreePanel.
4. **Game panels**: TCAdmen, MultiKraft, Pterodaktyl.
5. **DNS**: Bound, PowerDNZ, Knut DNS.
6. **VPN**: OpenVeePeeN, Sysko AnyConnekt, WireGuarded.
7. **Storage**: vsFTPeed, OwnClod, MinnIO.
8. **Mail**: Postfixit, Mailpig.
9. **Domain resellers**: NameCheep, GoDuddy Reseller, InterNetY, OpenSRSly.
10. **Community**: Sponsor-Bored.
11. **Hardware**: every manufacturer site.
12. **<Company name>**: the company site, and one row per console the company runs ("Proxmocks VE node001", "cPanic vm001"), each a live link; the row is grey with "down" when the host cannot be reached. This category replaces the console bookmarks.
13. **Video**: youtub.com.

A software before its `from` year is absent and its address resolves to Not found. In the 2005 look a category opens at `/dir/<category>`, for example `/dir/virtualization`; the 2013 look shows every category at once. Every other path on the host shows the index.

### 8.3 Site records and eras

Every software and OS has a `Site` record in its catalog entry: `host` (bare, `proxmocks.com`; the Browser accepts it with and without `www.`), `tagline`, `blurb` (two sentences), `features` (five to seven short lines), `eras: [{ from, look }]` with two entries. The Browser resolves the host to `{ kind: "software", id }` or `{ kind: "os", id }`. Pages: Home, Features, Pricing, Download (or Install), at `/`, `/features`, `/pricing`, `/download`, with a nav bar. Pricing shows the license as the catalog has it and the Windoors note where the software needs it. Download holds the commands in a `pre` block with a Copy button that puts them on the real clipboard; for `gui` software it says the software installs from the Windoors desktop. For software without a web console (section 10) it first says in one sentence what the server becomes after the install, such as a DNS server answering on port 53.

Each site is its own component and stylesheet under `src/ui/apps/browser/sites/software/<id>.tsx` and `.css`; shared pieces (nav, pricing table, commands block) in `SoftwareSite.tsx`. A look is a colour set, a font stack, a header layout and a hero; no images, code-drawn marks only. One `eraOf(eras, year)` helper in `src/ui/apps/browser/sites/era.ts` shared by every site and console. Every software with a site record resolves from its `from` year; one without its own component yet renders a plain site from `SoftwareSite.tsx`, and a component is registered in `sites/software/registry.tsx`. An OS site's Download page lists its releases up to the game year.

| Site | Early look (from) | Late look (from) |
| --- | --- | --- |
| cPanic | 2005: dark blue header, orange wordmark, grey sidebar nav, Verdana | 2014: white, orange and blue flat wordmark, hero with a screenshot block, Open Sans |
| Pleskit | 2005: navy header, light blue page, boxed news column, Arial | 2015: white with purple accents, cards, Roboto |
| DirectAdmen | 2005: plain white, black Times text, a yellow price table, last touched in 2003 | 2018: dark hero, green accent, one-page scroller |
| FreePanel | 2005: SourceForge-era grey, a left nav of links, a bare Download link | 2016: GitHub-era white, monospace headings, a README feel |
| OpenVeeZee | 2005: wiki look, white, grey left sidebar, a download table by kernel | 2016: the same wiki with a blue header band |
| OpenStash | 2010: red wordmark, white, big "Get started" | 2017: dark navy hero, red accent, cards |
| VMwhere | 2005: corporate grey, blue tabs, product matrix, small print | 2015: white, teal and dark blue, product tiles, the App Suite tile |
| Proxmocks | 2008: orange and dark grey, sidebar with forum links, wiki feel | 2016: white, orange accent, flat hero with "Download ISO" and "Install on Debiant" blocks |
| HyperVee | 2008: the Macrosoft TechNet look, blue header, breadcrumbs, dense text | 2016: the flat Macrosoft docs look, left tree |
| TCAdmen | 2005: black and lime green, forum-style front page, Tahoma | 2016: dark grey, green accent, flat tiles |
| MultiKraft | 2010: dark grey, dirt-brown header, blocky heading font | 2018: white, green, cards |
| Pterodaktyl | 2016: dark blue, flat landing page with a terminal block | 2021: white, blue accent, docs-site look |
| Bound | 2005: white, ISC-style blue, dense, Times | 2019: white, blue, cards |
| PowerDNZ | 2005: white and orange, a left nav, Verdana | 2016: dark header, orange, docs look |
| Knut DNS | 2011: white, red accent, sober | 2020: white, red, cards |
| OpenVeePeeN | 2005: white and orange, the old download list | 2017: dark, orange, cards |
| Sysko AnyConnekt | 2005: the Sysko corporate blue, product tabs, tiny type | 2016: white, teal, product tiles |
| WireGuarded | 2018: white, a red mark, a man page feel, monospace | same |
| vsFTPeed | 2005: a bare white page, Courier, a changelog, unchanged forever | same |
| OwnClod | 2010: white, blue, rounded buttons | 2016: dark blue hero, cards |
| MinnIO | 2016: dark, red accent, terminal block | 2021: white, red, cards |
| Postfixit | 2005: white, Courier headings, the mailing-list look, unchanged forever | same |
| Mailpig | 2015: dark, pink accent, flat | same |
| Debiant | 2005: the red swirl mark, white, the left nav, Verdana | 2015: the same with a red header band |
| Windoors Server | 2005: the Macrosoft 2005 look, blue gradient header, product boxes | 2012: flat Metro tiles, white |

Paid sites switch earlier; free ones keep a look longer.


**Domains.** No address in the game uses a reserved example domain. Every host is a pun under a real-looking TLD, as company domains already are (`basement-hosting.de`): `.com` for paid and corporate products (`.net` where the real one lives there), `.org` for open-source projects, `.io` for projects from 2015 on, `.de` for German brands, `.cz` for Knut DNS, and a Macrosoft subdomain for HyperVee and Windoors. Install commands fetch from subdomains of the product's own domain. `www.` stays optional on every host.

| Site | Host |
| --- | --- |
| Yahoy! index | yahoy.com (`/dir/`) |
| Sponsor-Bored | sponsorbored.net |
| YouTub | youtub.com |
| Debiant | debiant.org |
| Windoors Server | windoors.macrosoft.com |
| HyperVee | hypervee.macrosoft.com |
| cPanic | cpanic.com (downloads at cpanic.net) |
| Pleskit | pleskit.com |
| DirectAdmen | directadmen.com |
| FreePanel | freepanel.org |
| OpenVeeZee | openveezee.org |
| OpenStash | openstash.org |
| VMwhere | vmwhere.com |
| Proxmocks | proxmocks.com |
| TCAdmen | tcadmen.com |
| MultiKraft | multikraft.com |
| Pterodaktyl | pterodaktyl.io |
| Bound | bound.org |
| PowerDNZ | powerdnz.com |
| Knut DNS | knut-dns.cz |
| OpenVeePeeN | openveepeen.net |
| Sysko AnyConnekt | anyconnekt.sysko.com |
| WireGuarded | wireguarded.io |
| vsFTPeed | vsftpeed.org |
| OwnClod | ownclod.org |
| MinnIO | minn.io |
| Postfixit | postfixit.org |
| Mailpig | mailpig.io |
| NameCheep | namecheep.com |
| GoDuddy Reseller | goduddy.com |
| InterNetY | internety.de |
| OpenSRSly | opensrsly.com |
| Dwell, Hewlett-Packet, SuperMacro, Lenovoid, Sysko, Aristotle, Fortinope, Pablo Alto, Pandoot, MicroTick, Eatin | dwell.com, hewlett-packet.com, supermacro.com, lenovoid.com, sysko.com, aristotle.com, fortinope.com, pablo-alto.com, pandoot.com, microtick.com, eatin.com |
| Junipurr | junipurr.net |
| AVN | avn.de |

### 8.4 Domain reseller sites

Built: each registrar is its own component under `src/ui/apps/browser/sites/registrars/<id>.tsx` with its stylesheet, two eras each from `REGISTRAR_ERAS`; the actions (domain search and buy, TLD prices, contract, account with transfer and renewal dates) are shared blocks in `RegistrarPage.tsx` that each site lays out its own way:

- NameCheep: 2005: orange and white, a domain search box front and centre, a grid of TLD prices, Verdana. 2015: flat orange and dark grey, big search, cards, Open Sans.
- GoDuddy Reseller: 2005: loud green and black, three columns of offers, "Reseller plans" boxes, a hero with too much text. 2016: white, green buttons, a calmer grid.
- InterNetY: 2005: a German reseller, white and blue, a dense two-column TLD table, Arial, "Impressum" in the footer. 2014: the same with a blue header band and bigger type.
- OpenSRSly: 2005: a developer's site, white, grey, Courier API notes, a login box. 2016: dark header, teal accent, docs look.

### 8.5 Sponsor-Bored

Built (`src/ui/apps/browser/sites/SponsorBoard.tsx`, `src/sim/80-business/sponsorboard.ts`). Two eras, styled in `sponsorboard.css`: 2005: a phpBB-style forum board, blue and white, Verdana, bevelled buttons, avatars as coloured squares and a visitor counter in the footer. 2014: a flat community-site look, white, blue, cards, round avatars. It leaves the bookmarks bar and sits in the index under Community.

### 8.6 Hardware sites

Every manufacturer in the hardware catalog but the generic parts maker has its own site, one component and stylesheet per brand under `src/ui/apps/browser/sites/vendors/<id>.tsx` and `.css`, with shared pieces (nav, product table, news list, support text) in `VendorSite.tsx` and the brand list with each late look's first year in `vendors/registry.tsx`. Each wears two eras through `eraOf`: a colour set, a font stack, a header layout and a hero, no images, code-drawn marks. Pages, at `/`, `/products`, `/news` and `/support`:

- **Home**: the hero, the product classes the brand builds, and its latest releases.
- **Products**: what the Shop sells from the brand this month, one table per class, each model with the year it came out and its price.
- **News**: the brand's releases so far, newest first, one line each with the month and year, the model and one sentence from a per-class template ("Dwell ships the Balanced 1U G1, a 1U server with 2 cores and 8 GB of RAM.").
- **Support**: one paragraph and the support term the catalog gives the brand's models.

A release is a server model, multi-node chassis or network or power device a brand sells, at the month it reaches the shop from that brand (the catalog year shifted by the brand's release offset). CPUs and spare parts carry no manufacturer with a site and are left out; the CPU makers appear in the server lines. When a release month arrives in play the News app posts one item per brand and month, from Heize online, with a link that opens the brand's News page in the Browser. Releases that exist when a game starts are not news.

| Site | Early look (2005) | Late look (from) |
| --- | --- | --- |
| Dwell | blue gradient bar, white page, product-category boxes, Verdana | 2013: flat white, a full-width blue hero, a humanist sans |
| Hewlett-Packet | dark blue bar with a boxed mark, dense product grid, Arial | 2013: white, the blue circle mark, large light headings |
| SuperMacro | green and grey, dense bordered tables, Verdana | 2016: flat white, green hero, cards |
| Lenovoid | white and grey, red wordmark, dark gradient hero, Arial | 2014: red header band, dark hero, bold type |
| Sysko | corporate blue with product tabs and tiny type | 2015: white and teal, product tiles |
| Junipurr | white with green rules, a serif wordmark, a product column | 2014: dark navy, green accents, flat |
| Aristotle | navy header, cream page, Georgia italics | 2015: white, dark navy hero, flat tiles |
| Fortinope | grey gradient header, red accents, Tahoma | 2014: white, red hero, cards with a red edge |
| Pablo Alto | charcoal start-up page, orange accents, Trebuchet | 2015: white, a big orange hero |
| Pandoot | navy and grey parts catalogue with bordered tables | 2016: white, blue cards |
| AVN | white with a grey left nav in German, Impressum in the footer | 2014: red header band, the same left nav |
| MicroTick | a bare dark blue bar over plain tables, Verdana | 2017: the same bones in a lighter blue |
| Eatin | corporate blue gradient bar, Arial | 2015: white, a blue hero |

## 9. Hypervisor consoles, one VM manager

The Virtual machines app leaves the registry and the dock; its detail view, migrate, restore and recover actions and its incident lines move into the hypervisor consoles. The console at the hypervisor node's address is the only place VMs are made, watched, resized, moved and deleted. Each hypervisor gets its own component and stylesheet under `src/ui/apps/browser/consoles/<id>/` with a layout, a VM list, a VM detail page, a creation wizard, a Media menu and a Console button (opening the existing VM console window), modelled on the product in two eras.

| Console | Layout | VM detail page | Create wizard | Eras |
| --- | --- | --- | --- | --- |
| Proxmocks VE | Datacenter tree on the left (Datacenter, node, VMs by id), content right with a tab row (Summary, Console, Hardware, Options, Backup), a task log pane at the bottom | Summary: CPU, memory and disk as bars, status, uptime, node, IP; Hardware: the rows (Memory, Processors, Hard Disk, CD/DVD Drive with the mounted ISO, Network Device); Console button top right | The numbered-tab wizard: General (node, VM ID, name), OS (ISO pick), Hard Disk, CPU, Memory, Network, Confirm | 2008: ExtJS grey, blue gradient headers, Tahoma. 2015: flat ExtJS, white, the orange mark |
| VMwhere vSphear | Inventory tree left (datacenter, cluster, hosts, VMs), tabs right (Summary, Monitor, Configure, Datastores, Networks), Recent Tasks at the bottom | Summary: guest OS, the Tools line, resource tiles, a dark console thumbnail with "Launch Web Console" | "New Virtual Machine" with the left-hand step list (creation type, name, compute resource, storage, customize hardware, ready to complete); with the App Suite, "Deploy from App Suite" as a creation type | 2005: the grey and yellow fat client, Tahoma, glyph toolbar icons. 2015: the blue web client, Arial, flat |
| HyperVee Manager | MMC three-pane: tree left, VM list in the middle with a details pane below, Actions pane right | The Settings dialog as a page: left list (Hardware: BIOS, Memory, Processor, IDE Controller with the DVD Drive and ISO, Network Adapter; Management: Name, Checkpoints), right form | "New Virtual Machine Wizard": Specify Name, Specify Generation (from 2012), Assign Memory, Configure Networking, Connect Virtual Hard Disk, Installation Options (the ISO), Summary | 2008: Vista-era MMC, Segoe, white and light blue. 2012: the same MMC with flat chrome |
| OpenVeeZee Web Panel | Old PHP admin: top bar, left menu of links, tables with alternating rows | A table of the container's fields (CTID, hostname, IP, template, status, limits), buttons below | A one-page form (CTID, hostname, template, RAM, disk, IP) | 2005: grey and blue, Verdana, bevelled buttons. 2016: the same with a dark top bar |
| OpenStash Horizont | Horizon dashboard: dark left sidebar (Project, Compute, Overview, Instances, Images, Key Pairs), white content with a table | Instance Overview: info table (name, ID, status, zone, flavor, IP), Log and Console tabs | "Launch Instance" as a modal with the left step list (Details, Source, Flavor, Networks) | 2010: Ubuntu-purple Horizon. 2016: the dark-sidebar Horizon, red mark |

Shared behaviour on every hypervisor console: the VM list with state and load; VM actions (start, stop, reset, resize, migrate when `consoleFeatures` allows it, delete, restore, recover) through today's actions; Console; Media; the node list with usage. The Software tab and its "<console> VM" buttons go away (a VM gets software from its own console).

## 10. Panel, game, mail, DNS, VPN and storage consoles by era

Each software with a web console gets its own component and stylesheet, modelled on the product. The actions stay what `ConsoleBody` has today (objects, nodes, update, auto-update, backups, migrate, clean up); only the chrome changes. Software without a web console (Bound, Knut DNS, WireGuarded, vsFTPeed, Postfixit) shows the host page with a plain text status listing in the style of the product's CLI (`named-checkconf`, `wg show`, `mailq`).

| Console | Early look | Late look |
| --- | --- | --- |
| cPanic (WHM) | 2005: the x3 look, dark blue left menu with a search box, grey content, icon rows as tiles, Verdana | 2014: the flat "Paper Lantern", white, blue left bar with grouped sections |
| Pleskit | 2005: the 8.x look, dark blue left menu, light blue content, an icon grid per page | 2015: the Onyx look, white, dark grey sidebar, flat cards |
| DirectAdmen | 2005: the enhanced skin, white, grey top bar, three columns of underlined links | 2018: the Evolution skin, dark top bar, cards, a search |
| FreePanel | 2005: Webmin-style blue left tree and grey tables | 2016: white, left menu, Bootstrap-flat |
| TCAdmen | 2005: ASP.NET grey and black, a left tree of game servers, tables | 2016: TCAdmen 2, dark grey, green |
| MultiKraft | 2010: dark grey, brown header, server tables with status dots | 2018: white, green, cards |
| Pterodaktyl | 2016: the dark blue panel, server cards with CPU and RAM meters | 2021: the same, flatter, with the sidebar |
| PowerDNZ Admin | 2005: white, orange, a zone table | 2016: dark header, orange, cards |
| OpenVeePeeN Access | 2005: the orange and grey admin with a left menu | 2017: dark, orange, cards |
| Sysko AnyConnekt | 2005: the Sysko blue ASDM-style tabs | 2016: white, teal, flat |
| OwnClod | 2010: white, blue top bar, a file list | 2016: dark blue top bar, cards |
| MinnIO Console | 2016: dark, red, a bucket list | 2021: white, red, cards |
| Mailpig | 2015: the dark Mailcow-style admin, pink accent, tabs (Mailboxes, Domains, Queue) | same |

Built so far: the seven hosting and game panels (cPanic to Pterodaktyl) and the six DNS, VPN, storage and mail consoles (PowerDNZ Admin to Mailpig). Each lives in `consoles/<id>/` and lays out the blocks of `consoles/PanelBase.tsx` (object rows, nodes, software facts and actions, the backup schedule, the login form) in its own chrome; the `CONSOLES` map in `ConsolePage.tsx` routes a software to its component, and software without an entry still wears the shared frames. The look switches on January 1 of the late year in the table. The pages each panel shows:

| Console | Pages | Layout |
| --- | --- | --- |
| cPanic | List Accounts, Cluster Status, Software and Updates | left menu with a Find box filtering it; software actions as icon tiles under a Server Information table |
| Pleskit | Websites & Domains, Nodes, Tools & Settings | early: tools as an icon grid in boxes; late: two flat cards (server information, updates and server management) |
| DirectAdmen | Home, Web spaces, Nodes | Home holds three columns (Server Manager links, Server Tools links, Server Info); late adds a search in the top bar that filters web spaces |
| FreePanel | Web spaces, Nodes, Software and updates | category tree (Servers, Cluster, System) on the left |
| TCAdmen | Game Servers, System Settings | a tree of game servers on the left filters the table to one server |
| MultiKraft | Servers, Settings | early: a table with status dots, memory and CPU; late: one card per server |
| Pterodaktyl | Servers, Settings | one card per server with CPU and memory meters; the top bar becomes a sidebar in the late look |
| PowerDNZ Admin | Zones, Server | one row per zone (the customer's web domain or its name, numbered past the first); late adds stat cards for zones, accounts and version |
| OpenVeePeeN Access | Status Overview, Software Updates | left menu grouped Status and Configuration; early: a gateway table; late: one card per gateway and a current-users card |
| Sysko AnyConnekt | Home, Configuration | Device Information and VPN Gateways boxes; early tabs are icon buttons in the blue bar |
| OwnClod | Files, Admin | early: a file list with one folder per volume; late: folder cards with a usage bar |
| MinnIO Console | Buckets, Settings | dark sidebar; early: a bucket list; late: bucket cards |
| Mailpig | Mailboxes, Domains, Queue, Configuration | tabs over one pane; mailboxes are admin, support, billing and one per employee at the company domain |

The CLI host pages print, under "This host serves no web page", a root prompt on the machine's hostname and: Bound `named-checkconf -z` and `rndc status` (zones and count), Knut DNS `knotc status` and `knotc zone-status`, WireGuarded `wg show` (one peer per VPN user, a handshake while the gateway runs), vsFTPeed the last ten lines of its log (a login and an upload per running volume), Postfixit `postconf myhostname mydomain` and `mailq`.

## 11. Economy

Add to `docs/design/economy.md` under "Platforms and licenses":

- Windoors Server: 600 euros once per machine until 2015, paid when the OS install starts; from 2016, 4 euros a month per physical core of a server or per vCPU of a VM, billed with the licenses.
- VMwhere: 600 euros once per CPU socket of the node until 2023, paid when the install starts; from 2024, 8 euros a month per physical core.
- VMwhere App Suite: 25 euros a month per VMwhere cluster.
- OS install hours (Lunix 1, Windoors 2) and boot minutes (Lunix 20, Windoors 40) add to every install's time to serve.
- A panel on a hypervisor node is allowed when no port collides; the old "one control plane per server" rule is gone.

## 12. Tests

One seeded suite per lane under `tests/`:

- `server-os.test.ts`: the catalog, `serverOsAt` by year, Windoors billed per machine, an old save gets `os` and `software` filled from its clusters, `media: "iso"` maps to lunix.
- `software-compat.test.ts`: every pair through `conflict`; a web panel next to Mailpig refused; Bound plus OpenVeePeeN plus a panel on one host accepted; two hypervisors refused; HyperVee and TCAdmen refused on Lunix; a panel on a Proxmocks node accepted.
- `install-pipeline.test.ts`: empty disk boots to not found; boot from media installs the OS over its hours; a reset mid-install leaves the disk empty; a software install refused before the OS is up; the hypervisor cluster exists from `doneAt`; uninstall refused with workloads.
- `apt-install.test.ts`: the Proxmocks three lines in order install it; out of order the package is not found; `apt-get install cpanic` not found (script install); the cPanic line installs; `ssh` to Windoors refused; `dpkg -l`.
- `app-suite.test.ts`: buy, deploy in one step, billed monthly, cancel.
- `browser-index.test.ts`: the index by year and category, the company category follows the clusters, the home url, software hosts resolve, a pre-`from` host is not found.
- UI: `console-screens.test.ts` for the screen by machine state and era; one render test per site and console that mounts it in both eras without throwing. `tests/console.test.ts` keeps passing with its installer assertions moved from software to OS.

## 13. Lanes and order

Every lane: `lane-build` on Opus, its own brief, commits with a pathspec on the `software` branch in the worktree, changelog bullets under today's date, docs in the same commit, a green typecheck and suite redirected to a file and grepped, a browser walk of its own flow.

| Lane | Builds | Depends on |
| --- | --- | --- |
| A | Sections 1, 2, 3, 11: the server OS catalog, software fields and `conflict`, machine `os` and `software`, save defaults, licenses, `installBlock` by OS and conflict, clusters derived. Tests `server-os`, `software-compat`. | nothing |
| B | Sections 4, 5, 6: `installOs` replacing the software installer's pick, media per OS, boot and install hours, the App Suite, the Terminal and apt commands. Tests `install-pipeline`, `apt-install`, `app-suite`. | A |
| C | Sections 7 and 7.1: the OS installers, Lunix login and shell, software progress, Windoors Setup, boot, desktop and Server Manager. Test `console-screens`. | B |
| D1 | Sections 8.1 to 8.3 framework: home icon, start page, index, `SoftwareSite`, `eraOf`, the two OS sites and the twelve virtualization, panel and game sites. Test `browser-index`. | A |
| D2 | Section 8.3: the eleven DNS, VPN, storage and mail sites. | D1 |
| E | Sections 8.4 and 8.5: the four registrar sites and the Sponsor-Bored eras. | D1 (for `eraOf`) |
| F | Section 9: the five hypervisor consoles, VmApp removed. | B, C |
| G1 | Section 10: the seven panel and game consoles. | D1 (for `eraOf`) |
| G2 | Section 10: the six DNS, VPN, storage and mail consoles and the CLI host pages. | G1 (for the shared base) |

Order, two lanes at a time: A alone; B and D1; C and D2; E and G1; F and G2; then one verification lane that plays the first hour (buy a server, boot, BIOS, install Lunix, install Proxmocks from its site, make a VM, mount Windoors, install TCAdmen from Server Manager, sell a game server) and files what breaks.

## 14. Decisions taken here, open to change

- VMwhere installs on Lunix as a package rather than as its own appliance OS, to keep two operating systems.
- "Move Sponsorboard" is read as: the board leaves the bookmarks bar and sits in the index next to the reseller sites. If the intent was a board under each reseller's site, that is a link on each reseller page.
- No web server software is added; the compatibility examples use the DNS, VPN and panel software the catalog has.
- The Windoors license is per machine and flat; no per-core tiers.
- OS versions are install-time only; no in-place upgrades.
- The index host is `yahoy.com`; the search box only filters.
- The per-software login looks on a booted server go away in favour of the OS's screens; VMwhere's DCUI stays.
