# Server console

Software and RAID leave the server page. A server gets a screen instead, reached the way a real one is: the management controller's remote console on servers that carry one, a KVM cabled to the console end on the back, or a monitor plugged into that console end at the rack. On that screen the player goes through POST, enters the BIOS to set up RAID, boots from a USB stick and installs the software in a text-mode installer, exactly as they would with a crash cart in front of a rack. The server page keeps power, ports, supplies, remote access, lease and parts. Everything that was the Software tab and the RAID tab happens on the screen now, with the real consequences: a server left sitting in the BIOS serves nothing, and a reinstall erases the disk.

The remote access lane already built the plumbing this stands on: every server has a console end on its back, `consoleVia` says whether a controller or a KVM reaches it, `consoleScreen` returns the one line a console shows today (dark, the firmware prompt, hung, booting, login), the KVM page and the Terminal's `console` command print that line, and a hard power event leaves a server stuck at "Press F1 to continue, DEL to enter SETUP" 5% of the time. This plan turns that one line into a full screen and makes DEL do something.

## Ways to the screen

**Managed servers** (every model `hasBmc` says yes to) get a Console tile in the Actions tab of the server page and a Remote console button on the controller's page in the Browser, under the brand's real name: iDRAQ Virtual Console, iLOL Remote Console, SuperMacro iKVM, XClarify Remote Control. Both open the console window: its own desktop window, one per server, movable and resizable like any app window, so the player can keep three installs running side by side. The title bar carries the controller's quick actions on the right: Power (power on, graceful shutdown, reset, power cycle, power off, the same set the controller's Power tab offers), Media (phase 3, virtual media) and Keys (Ctrl+Alt+Del, Del, F2, F11, so a touchpad player and a player whose browser eats function keys can still get into setup). The console answers while the server is off and shows a black screen with the controller's "No signal" overlay. A hung controller shows nothing but the overlay, as its page does not load today.

**Servers behind a KVM** (a PiKVN or an IP-KVN 8 cabled to the console end) get the same window from the KVM's page in the Browser, where each target's last line becomes an Open console button, and from the Console tile on the server page, which `consoleVia` already answers. The title bar's Power group holds only what the KVM can press: nothing on a bare IP-KVN 8, power on, power off and reset with an ATX adapter or on a PiKVN. The KVM page itself keeps its one-line screen per target; the full screen lives in the window.

**At the rack**, clicking a server's console end on the back view plugs a monitor in. Nothing opens; the right part of the Locations app, the inspector, is replaced by the screen, with the status strip above it and the Power card below it, so the only controls left are the physical ones a person at the server has: press power, hold power, press reset, unplug and plug the cords. An Unplug monitor button in the strip puts the inspector back; selecting another device also unplugs. Only one monitor exists, so plugging it into a second server moves it. The monitor works where the player stands: always in the basement, in a datacenter only while the player is on site through the existing travel. From afar the console end is dimmed, and the server page's Remote access card already tells the player what would reach it: the controller, a KVM, or nothing.

The console end is drawn today as a plain management jack. It becomes the blue VGA trapezoid on servers, so the back view says what it is; switches and routers keep their RS-232 console jack. A managed server has both the controller's own network port and the console end, as a real one does, so a monitor fits it too.

## What the screen shows

The screen is a state machine driven by the server's power and boot state in the simulation plus a little real-time pacing in the UI. The simulation only knows whole hours, and a boot takes one, so the POST key window cannot live in the simulation: it is a real-time window the console shows at the start of a boot. `consoleScreen` grows from one line into the screen's state and keeps serving the KVM page and the Terminal, which print its first line.

| Server state | Screen |
| --- | --- |
| Off, no power, controller hung | Black, "No signal" |
| Booting, first seconds | Vendor POST splash: logo, memory count, "Press Del to enter Setup, F11 for boot menu", RAID controller banner listing the drives and the array |
| Booting, after the window | Text scroll of the operating system starting, or "Operating system not found" when the disks hold nothing |
| Stuck at the firmware prompt | "CMOS checksum error - Defaults loaded. Press F1 to continue, DEL to enter SETUP", waiting for a key |
| In setup | The BIOS setup, blue on grey text, keyboard driven |
| Boot menu | A list: the hard disk array, the USB stick, the network |
| Installing | The installer, with the catalog picker, the erase confirmation and the progress screen |
| Up, software installed | The software's login screen: a Debian `tty1` login for the panels, mail servers and OpenStash, VMwhere's grey and yellow direct console, HyperVee's Windows logon |
| Up, nothing installed | "Operating system not found", retrying every boot |
| Hung | The last screen, frozen, with a dead cursor |

POST shows for 8 real seconds after the server powers on, whatever the game speed; at 1× that is the first 8 game minutes of the one-hour boot. At Skip the boot is over before the splash is drawn, so a player who skips time misses the window, which is right. Pressing Del or F2 during the splash calls `enterSetup`; the simulation accepts the key during the whole boot hour (it cannot see seconds), the UI accepts it only while the splash is up. Missing the window means the server boots into what it has, and the way back is Reset, as the brief says. The 8 seconds and the splash are a calibration knob in one constant.

The stuck prompt is the other door. F1 there is `continueBoot` as today (two minutes over a controller or console, a hand task on site), and DEL is `enterSetup` without any timing, since the server is waiting anyway. A player who wants into the BIOS of a server that boots too fast for them has a slower, surer route: Reset, and hope for the prompt. That is a joke the game does not need to explain.

A server in setup does not finish booting. `booting` stays true, its workloads stay down, and the status strip says "In BIOS setup" so the player sees from the rack why a site is dark. Exiting setup (F10 Save and exit, or Esc Discard) resumes the boot from where it was. That is the trap this feature adds on purpose: open a BIOS on a production server, get distracted, and customers notice.

## The BIOS

Three pages, left and right arrows to switch, up and down to move, Enter to change, Esc to leave. Each setting cycles through its values on Enter like a real setup.

**Main** shows the model, BIOS date, CPU, memory and the drives, and holds the system time (display only).

**Storage** is the RAID tab moved here: the level (none, 1, 5, 6, 10, dimmed where the drive count does not fit), the rebuild rate, usable capacity, what the array survives, and a running rebuild with its percentage. Changing the level on an array that holds data asks "Delete the array and all data on it?" and marks the data lost on confirmation, through the same `setRaid` as today with its power-off rule replaced by an in-setup rule. The rebuild rate stays changeable here and, on managed servers, in a Storage tab on the controller's page, since a real controller exposes it from the OS as well and a reboot for a rebuild rate would be cruel.

**Boot** holds the boot order (hard disk, USB, network) and is mostly there so the player can set USB first and get the installer without the boot menu. The boot menu (F11 during POST) is the quicker path and the guide teaches that one.

The BIOS's cursor and page are UI state in the session. Only "in setup" and every actual setting change touch the simulation.

## Installing

The player's USB stick is always plugged in and always holds the current catalog; the game does not model writing images. Booting from it shows the installer, a blue text-mode screen with the same catalog the Add Software sheet shows today, grouped the same way (hypervisors, hosting panels, game panels, mail), with each item's license, install hours and the year it exists from, and items that cannot go on this machine dimmed with the reason when picked. `installBlock` already produces every reason; the installer only renders them.

Picking software leads to the target screen: the array as the BIOS configured it, its usable size, and what is on it. Three cases.

1. **Empty disks.** "Install cPanic to the 2 × 500 GB RAID 1 array" with Install and Back. Install starts the install as `installSoftware` does today and the screen becomes the progress screen.
2. **Software installed, nothing running on it.** The screen names the software that will be erased. Confirming erases it and installs the new one: `uninstallSoftware` then `installSoftware`, one action so a failed second half leaves the first undone.
3. **Software installed and in use.** The screen lists what dies: the cluster, its workloads by hostname, how many customers they belong to, and which have a backup. The player types the server's hostname to confirm; a button is too easy for this one. Confirming marks the data lost exactly as a lost array does (`dataLost`, the loss report on the next tick, backups restorable where they exist, the same tickets and churn), drops the cluster and starts the install. This is the one place the game lets a player destroy customer data on purpose, and it should feel like it.

The progress screen runs for the software's install hours, in game time, with the usual installer stages (partitioning, base system, the software's own package, first boot) spread over the hours so something moves. The cluster's `switching` already holds the finish hour. When it finishes the server reboots on its own and lands on the software's login screen. Resetting or powering off during the progress screen aborts the install: the disks are empty, nothing else is lost, the server boots to "Operating system not found" and the stick is still there. That is also the answer to a wrong click in the picker: reset, boot from USB again, pick again.

Uninstalling without installing anything stays where it already is, in the software's own console under Software (Remove), and the installer offers Erase disk next to the catalog for the player who wants bare metal, which runs `uninstallSoftware` under the same confirmations as a reinstall.

Joining another cluster, today a tile menu entry, moves to the cluster's console Nodes tab as Add node, listing `joinableServers`. A fresh install never joins on its own.

## What leaves the server page

The Software tab and the RAID tab go, with the Add Software sheet behind the tiles and the `setup` field in the store that opens it. The status strip keeps one Software line with the installed software, its version and the install or update state, since a glance at the rack must still answer "what runs here". The Actions tab gets the Console tile wherever `consoleVia` finds a way in. The guide step "Install a hypervisor or a web panel from the server's Add Software tile." becomes two steps, one to boot the stick and one to pick the software, and ticks on `bootFromUsb` and on the install starting.

VMs open the same installer from the ISO on their virtual console; the VMs app has no Software grid.

## Simulation

New on `Device`: `setup: boolean` (in the BIOS; the tick keeps `bootUntil` one hour ahead while it is set) and `bootFrom: "disk" | "usb" | "net"` (the boot order's first entry, defaulting to disk). Both get defaults in `newGame` and `deserialize`. Which server the monitor hangs on is UI state in the session, not save state.

New actions in `src/sim/90-actions/console.ts`: `enterSetup(deviceId)` (refused unless the server is booting or stuck), `exitSetup(deviceId, save)`, `setBootOrder(deviceId, first)`, `bootFromUsb(deviceId)` (the boot menu pick; refused unless booting), `reinstallSoftware(deviceId, softwareId, confirmHostname?)` and `eraseDisk(deviceId, confirmHostname?)`. `continueBoot` stays in `remote.ts` and clears `stuck` as today. `setRaid` swaps its power-off rule for off-or-in-setup. `installSoftware` is refused on a server unless it booted from USB, so the only door to the installer is the stick; the test fixtures that call `installPanel` and `installHypervisor` directly keep working, since those are the cluster layer below. `consoleScreen` gains the setup, boot menu and installer states and the POST and login looks, and the KVM page and Terminal keep printing its first line.

Text the simulation produces goes through i18n keys: the setup and installer screens, the erase confirmation, the error for a key outside POST, the status strip line. The remote lane's `term.console.*` keys are the seed of that file.

Tests, one seeded suite `tests/console.test.ts`: setup only while booting or stuck, boot held while in setup and resumed on exit, RAID change in setup and refused up, USB boot gating the installer, reinstall over an empty cluster, reinstall over a used cluster reporting the loss and restoring from backup, abort on reset leaving empty disks, old saves loading with the defaults.

## UI

`src/ui/apps/console/`: `Screen.tsx` (the state machine and the screens), `bios.tsx`, `installer.tsx`, `console.css` with the few looks (POST, BIOS, installer, Debian, DCUI, Windows), each a colour set and a font, no art. `ConsoleWindow.tsx` is the managed and KVM window; it keys on the device like a note window keys on its doc (`win.doc` today), so `openApp` gets a sibling that opens one window per machine, and the title bar's quick actions come from `consoleVia` and the existing `powerOptions`. The monitor path renders `Screen` inside the Locations app in place of `Inspector`. Keyboard goes to the screen while its window is front or the monitor is plugged in, through one `onKey` that the soft-key row calls too.

The console end's hit rectangle in `RackFront.tsx` exists for cabling; a click without a drag plugs the monitor in, a drag still pulls a cable. `mgmt.tsx` draws the server's end as the VGA trapezoid.

Window controls sit in the title bar as a group on the right, before close, in the window chrome's own style, so they read as part of the console and not as app content.

## Phases

All three phases are built. The console window, the KVM and monitor paths, POST, the stuck prompt's Del, the BIOS with its Storage page, the status line, the boot menu, the USB installer with its three cases, Erase disk and the abort on reset are in; the Software tab and the Add Software entry are gone from servers. Cuts against the plan: the Boot page and the boot order with it (the boot menu is the way; `bootFrom` only says what this boot came from), the two guide steps (one step, since the checklist cannot hold a step that is true only while the stick is booted), and restoring a backup onto the erased server (the services end with the data, which is the one place the plan's "restorable where they exist" is not true yet). `installSoftware` stays open to tests; the installer's doors are `installFromUsb` and `installFromIso`. A VM's install cannot be aborted: stopping the VM or ejecting the ISO leaves it running to the end, since a VM has no plug to pull. The media is the one VM field (`media`), loaded and ejected by `setMedia`. The game ticks by the minute since, and a boot takes three game minutes, so the POST splash lasts the boot instead of a real-time window and the key counts for the whole boot; pausing is the sure way in. Leaving the setup reboots the server, so the splash shows again.

1. Console window and monitor with the screen state machine, POST, the stuck prompt's DEL, BIOS with Storage, the status line, the RAID tab removed. A server becomes installable and configurable without the Software tab existing, with the installer still reached from the Add Software sheet underneath.
2. Boot menu, USB boot, the installer with its three target cases, abort on reset, Erase disk, the Software tab and Add Software sheet removed, the guide steps, the changelog bullets.
3. VMs: the hypervisor's console page gets a Console button per VM that opens the same window with Media in the title bar, where the player loads the catalog ISO; a VM has no BIOS and no RAID, so it boots straight to the ISO or to "Operating system not found". The VMs app loses its Software grid.

Each phase lands green with its tests and its changelog bullet. Phases 1 and 2 touch the same files and go in order; 3 stands alone.

## Open points

The POST window length and the install stage names want tuning against play; both are single constants. Whether the Boot page is worth having next to the boot menu is a question for the first playtest, and it is the first thing to cut. Game panels (TCAdmen and the others) and the mail servers share the Debian login look until anyone misses a distinct one. The Terminal's `console` command prints the screen's first line and takes no keys; a serial BIOS over it is a later lane if anyone asks.
