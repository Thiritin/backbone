# Web panel operations

The web hosting panels (cPanic, Pleskit, DirectAdmen, FreePanel) copy the server management screens of the products they parody. This plan removes the actions a real panel never offers on its own host and adds the pages a real one has: services, components, backups and updates.

## Removed from web panels

- Remove host and Resize host leave the panel's software page. A panel manages sites, not the machine it runs on. The sim actions stay for the hypervisors and the Locations app.
- Take all sites offline leaves the software page and the cPanic Service Manager. Single sites are suspended on their row; the host-wide switch stays only in the Security app for vulnerability mitigation.
- The oversell cap input leaves the web panels. Booking limits are set in the Locations app. Game panels keep theirs.
- The release channel, auto updates and the update button move from the software page to the Updates page.
- Backups move from the software page to the Backup Manager page.

## Added

### Server restart [UI]

A Restart server action on the software page reboots the host machine with `reboot` from `90-actions/hardware.ts` (the VM's host when the panel runs in a VM). The console shows the boot progress it already shows for a halted machine.

### Services [Sim + UI]

Every web panel host runs a service list by family, held in `src/sim/60-infra/panel-services.ts`:

- cPanic: cpsrvd, httpd, php-fpm, mysql, exim, dovecot, pure-ftpd, named, sshd.
- Pleskit: psa, apache, nginx, php-fpm, mysql, postfix, dovecot, proftpd, bind, sshd.
- DirectAdmen: directadmin, httpd, php-fpm, mysql, exim, dovecot, proftpd, named, sshd.
- FreePanel: webmin, apache, php-fpm, mysql, postfix, dovecot, proftpd, bind, sshd.

Service ids that a component slot owns (mail, ftp, web) show the installed component's name. State: `webpanel.restarts: Record<hostId, Record<serviceId, hour>>` holds the hour a restart finishes. `restartService(s, hostId, serviceId)` sets it to now plus `RESTART_MINUTES` (2); while it runs the service shows Restarting and the sites on the host count as down for the web and php services (`hostPerf` and the status of the host's sites read it). Restarting web or php clears `appBroken` and `phpBroken` entries of the host's sites. Restarting a service that is already restarting fails with `error.restarting`.

### Components [Sim + UI]

A component slot is one part of the stack the panel installs for the player, in `src/sim/10-catalog/panel-components.ts`:

- `mail`: Exim (cPanic default), Postfix (Pleskit, FreePanel default), qmail (Pleskit until 2012).
- `ftp`: Pure-FTPd (cPanic default), ProFTPD (Pleskit, DirectAdmen, FreePanel default), vsftpd (FreePanel).
- `web`: Apache, nginx in front of Apache (Pleskit from 2012, cPanic from 2017), LiteSpeed (DirectAdmen from 2010).
- `module` (several at once, each with a monthly fee per host): WordPress Toolkit (Pleskit from 2016, cPanic from 2018), ImunifyAV (every panel from 2018), SpamAssassin (every panel), Site Builder (Pleskit, cPanic from 2008).

All company and product names are puns. Each entry has `id`, `slot`, `name`, `from` (first year), `panels` (families), `fee` (euro per month, 0 for free), `installMinutes`. State: `webpanel.components: Record<hostId, { mail?: string; ftp?: string; web?: string; modules: string[] }>`; a missing host or slot means the family default. `installComponent(s, hostId, componentId)` swaps the slot (or adds the module) after `installMinutes`, held in `webpanel.installing: Record<hostId, { id: string; until: number }>`; one install at a time per host, else `error.installing`. `removeModule(s, hostId, componentId)` drops a module. Module fees are booked monthly with the panel licence costs. Modules carry no customer-facing price yet; that comes with products.

### Backup Manager [Sim + UI]

Every web panel gets a Backup Manager page copying Plesk's: a list of backups (date, size, type, state), Back Up Now, Scheduled Backup Settings, Remote Storage Settings. The data is the cluster's `jobs` and the restore points on its workloads (`60-infra/backups.ts`).

- Remote Storage Settings picks the backup server (`setBackup`) and the schedule (daily, weekly, off); Scheduled Backup Settings sets the time of day and how many to keep (`saveJob`).
- Opening a backup lists the sites it holds, one row per workload with a point at that hour, with a Restore button each.
- `restoreSite(s, hostId, serviceId, pointAt)` restores one site from one point: fails with `error.backupStoreOffline` when the backup server is halted or unreachable, with `error.restoring` while another restore runs on the host. It sets `webpanel.restoring: Record<serviceId, { from: number; until: number }>`; the restore takes `RESTORE_MINUTES_PER_GB` (3) times the site's disk use, the site is down while it runs, and when it finishes `appBroken`, `phpBroken` and a hacked flag for the site are cleared and the site's `appVersion` is the one the point holds.

### Updates [UI]

A software page only for updating, shown when `autoUpdates(software, year)` is true for the family: the installed version, the release channel picker, the auto update switch and the update button with the task log of past updates. A panel without auto updates in that year has no Updates page; the player updates it from the shell. The software page keeps only the facts and the PHP actions.

## Lanes

1. Sim services and components (`panel-services.ts`, `panel-components.ts`, `90-actions/panel-ops.ts`, state in `webpanel.ts`, tests).
2. Sim restore (`restoreSite` in `90-actions/backups.ts`, tick progress, tests).
3. UI cleanup, Restart server, Updates page (`PanelBase.tsx`, `HostSettings.tsx`, the four panel files).
4. UI Services and Components pages (after 1).
5. UI Backup Manager (after 2).
