# Terminal shell

The Terminal grows from a network tool into a small Debian-style shell. Every machine the player can reach (the desk and any server they `ssh` into) gets a filesystem they can walk with `ls` and `cd` and change with `mkdir`, `touch`, `echo >`, `rm`, `mv` and `cp`. On top of that, `apt update` and `apt upgrade` become a second way to do what the Software and Security apps already do: bring a server's software and PHP up to date, with the same downtime and the same effect on open vulnerabilities. The desk runs the same shell, but upgrading it changes nothing in the game.

Files are flavour with one rule attached: they live on the machine's disks, so a server that loses its data loses the player's files too.

## What a session looks like

At the desk the player is `you`, so apt needs `sudo`, as it would on a real workstation:

```
you@desk $ apt update
E: Could not open lock file /var/lib/apt/lists/lock - open (13: Permission denied)
E: Unable to lock directory /var/lib/apt/lists/
you@desk $ sudo apt update
Hit:1 http://ftp.debian.org/debian sarge InRelease
Reading package lists... Done
All packages are up to date.
```

On a server the session is already root:

```
root@node003:~# mkdir notes
root@node003:~# echo "moved db to node004 on monday" > notes/todo
root@node003:~# ls -l
drwxr-xr-x 2 root root 4096 Mar 14 09:00 notes
root@node003:~# cat notes/todo
moved db to node004 on monday
root@node003:~# apt update && apt upgrade
Hit:1 http://ftp.debian.org/debian etch InRelease
Reading package lists... Done
2 packages can be upgraded. Run 'apt list --upgradable' to see them.
Reading package lists... Done
Building dependency tree... Done
The following packages will be upgraded:
  php5 cpanic
2 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.
Services on this server will be offline for about 30 minutes.
Do you want to continue? [Y/n] y
Setting up php5 (5.2.0-8) ...
Setting up cpanic (2007.1) ...
```

The `[Y/n]` prompt matters because an upgrade takes customers offline. `apt upgrade -y` skips it. Anything other than `y`, `Y` or an empty line aborts with `Abort.`

## The filesystem

Each machine has a small generated base tree plus whatever the player changed. The base tree is never stored; it is computed from the game state every time it is read:

| Path | Contents |
| --- | --- |
| `/etc/hostname` | The server's hostname, or `desk`. |
| `/etc/os-release` | The Debian release of the year the machine was bought. |
| `/etc/apt/sources.list` | One `deb` line for that release. |
| `/var/log/syslog` | The device's event log, as timestamped lines. |
| `/root` or `/home/you` | The home directory, empty at first. |

What the player changes is stored per machine as a flat map from absolute path to a file's text, a directory marker, or a deletion marker that hides a base entry. A new game starts with an empty map, so old saves load without work. To keep saves small, a machine holds at most 200 changed paths and a file at most 4 KB; past that, writes fail with `No space left on device`.

Each map remembers the hour of its first change. When a device's data is lost after that hour (a failed array, a rebuilt RAID), the map counts as empty and the next change starts a new one. Selling a device drops its map.

## The desktop in ~/Desktop

On the desk, `~/Desktop` is the desktop itself: every document there is a file named after its title, a repeated title with a number, as in `Untitled (2)`. A note's file is its text, so `cat`, `echo >>` and `edit` read and change the note, `mv` renames it, `rm` removes it, and a new file in `~/Desktop` becomes a new note. The desktop holds no folders, so `mkdir` there is refused.

Getting started is a file too, showing its steps with `[x]` for the done ones. It follows the game, so it is read-only: writing, moving or removing it answers `Permission denied`.

None of this is stored with the terminal's files; the documents are the only copy.

## edit

`edit <file>` opens the file in the whole Terminal window, or an empty buffer for a file that does not exist yet. Ctrl+S saves through the same action as every other change, so the size limit and the desktop rules apply. Ctrl+X or Escape closes the editor; with unsaved changes the first press shows `Unsaved changes` and the second closes without saving.

## Commands

The shell parses quotes (`"..."` and `'...'`), backslash escapes, `~`, relative paths with `.` and `..`, the redirections `>` and `>>`, and chains with `&&` and `;`. Pipes, globs, variables and job control are not part of it; those words fall through to `command not found` like any other unknown command.

The file commands are `pwd`, `cd`, `ls` (with `-l` and `-a`), `cat`, `edit`, `echo`, `touch`, `mkdir` (with `-p`), `rm` (with `-r` and `-f`), `rmdir`, `mv` and `cp` (with `-r`). Small informational commands come along because they cost one line each: `whoami`, `hostname`, `uname -a` and `date`. Errors use the real GNU wording, for example `rm: cannot remove 'x': No such file or directory`.

Tab completion learns paths: after a file command, the word completes against the current directory with spaces escaped, the same way it completes host names after `ssh` today.

## apt

`apt` and `apt-get` are the same command. `sudo` is required at the desk and ignored on a server.

`apt update` prints the mirror line for the machine's release and then how many packages can be upgraded. It does not change the game state; it exists so the habitual `apt update && apt upgrade` works.

`apt list --upgradable` and `apt upgrade` work from the same list of what is due on this server, built from the existing rules:

- a software cluster with a node on this server that `updateDue` reports, shown under the software's package name;
- a panel host anchored on this server that `phpDue` reports, shown as the PHP package of the current year (`php5`, `php7.0` and so on).

Confirming the upgrade runs `updateSoftware` for each due cluster and `upgradeNodePhp` for the server, so downtime, SLA hours and closed vulnerabilities are exactly what the Software app produces. The downtime line before the prompt is the longest `UPDATE_MINUTES` among the due clusters. A cluster spread over several servers is updated as a whole, as it is in the Software app.

On the desk, or on a server with nothing due, the list is empty and `apt upgrade` prints `0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.`

## Where the code goes

The shell stays a pure function from a line to output, as the Terminal is today. `src/sim/60-infra/terminal.ts` keeps parsing the line and routing it; the filesystem view and the file commands go into a new `src/sim/60-infra/shell.ts`, and apt into `src/sim/60-infra/apt.ts`. Every change to a file goes through `editFiles` in `src/sim/90-actions/files.ts`, called with plain operations (write, append, mkdir, rm, copy, move) so the action log can replay it; `apt upgrade` calls `upgradeServer` in `src/sim/90-actions/software.ts`. The `[Y/n]` prompt keeps the rest of the line, rewritten with `-y`, in the Terminal app's session state and runs it when the next line is `y` or empty. Output strings go through `src/i18n/terminal.ts`.

Tests: `tests/shell.test.ts` covers paths, the file commands, the size limits and the wipe on data loss; `tests/apt.test.ts` covers the sudo rule, the upgradable list, the prompt, and that an upgrade has the same effect as the Software app's update.

## Left out

`apt install` and `apt dist-upgrade` are not part of this. Installing software stays in the Software app, where placement and licences are shown.
