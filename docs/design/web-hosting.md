# Web hosting inside the panels

This document redesigns web hosting so that each web space is a real thing the player can open and work in. Today a web space is a row in a panel table: cPanic's customer side shows read-only pages computed from numbers, the shop system appears after a 72-hour timer, and databases, mail and FTP exist only as labels. After this redesign, a web space has its own files, domains, databases, mailboxes, FTP accounts and cron jobs, and the player manages them in the panel the way a real admin would.

It replaces the install flow in `plans/shop-software.md` and `plans/web-presence.md` (lane `app-catalogue`) and extends `panel-features.md` (Web panels). Plans that already shipped stay valid. This document only changes how the player reaches the same results.

## 1. Goals

- Opening a web space shows the panel's real customer screen (the cPanic icon grid, the Pleskit subscription page, the DirectAdmen user level, the Virtualmin server page) with working tools behind each icon.
- Installing software, including the player's own shop system, is the real procedure: get the archive, upload it, create a database, run the web installer and log in with the admin account chosen there.
- Databases, mail, FTP, DNS, SSL and cron are features of a web space and are managed inside the panel. The standalone consoles (Mailpig, Postfixit, PowerDNZ) stay as the products for dedicated mail and DNS hosts.
- Customer sites are reachable in the Browser at their domain and show what their files would show.
- The same model runs behind every web panel. Each panel is a skin with its own labels, layout and quirks.

## 2. The web space

A web space is one hosting account on a panel host: a cPanic account, a Pleskit subscription, a DirectAdmen user or a Virtualmin virtual server. It already exists in the sim as a workload on a panel cluster. It gains the following parts.

| Part | Contents | Real counterpart |
| --- | --- | --- |
| Files | A tree under the home directory: `public_html` (or `httpdocs` in Pleskit), `logs`, `tmp`, `mail`, `.htaccess` | File Manager, FTP |
| Domains | Main domain, addon domains, subdomains and parked aliases, each pointing at a folder | Addon Domains, Subdomains |
| Databases | MySQL databases and users with a password and privileges per database; size in MB | MySQL Databases, phpMyAdmin |
| Mail | Mailboxes with quota, forwarders, autoresponders, catch-all, spam filter level | Email Accounts |
| FTP | FTP accounts with a home folder and a quota | FTP Accounts |
| DNS | The zone of each domain, edited in the panel's zone editor | Zone Editor |
| SSL | A certificate per domain: none, bought, or AutoSSL from 2016 | SSL/TLS, AutoSSL |
| PHP | The PHP version per domain where the panel allows it (EasyApachy, MultiPHP) | MultiPHP Manager |
| Cron | Scheduled commands with an interval | Cron Jobs |
| Usage | Disk, bandwidth, inodes, databases and mailboxes against the package limits | Statistics sidebar |

Package limits (`packages-provisioning.md`) gain counts for databases, mailboxes, FTP accounts, addon domains and subdomains. The panel refuses to create one past the limit with the panel's own message.

### 2.1 Storing it without bloating saves

A player can run thousands of customer web spaces. Storing every file and mailbox would make saves huge, so customer web spaces are derived:

- A customer web space's contents are generated from its workload, app, seed and age every time they are shown, as `Customer.tsx` already does for its file list. Nothing is stored for it.
- A web space stores only what the player changed: files they uploaded or deleted, databases, users, mailboxes and FTP accounts they created, and settings they edited. Each change is an entry in an overlay on top of the derived contents.
- The player's own web spaces (company website, shop, webmail) are ordinary web spaces that start empty and are filled entirely by the player's actions.

New state: `s.webspaces: Record<workloadId, WebspaceOverlay>`, default `{}` in `newGame` and filled by `deserialize`. A web space with no overlay entry is pure derivation.

### 2.2 What the files mean to the sim

Files are mostly flavour, but a few of them have effects:

- An app is installed when its folder and its config file exist and its database exists. Deleting `wp-config.php` breaks the site and the next visitor opens a ticket.
- A shop is running when its folder is reachable from a domain, its database holds its tables and its installer has finished.
- A leftover `install` folder after a shop install is a security finding: the Advisor and the security roll treat it like an unpatched app (real WHMCS refuses to run until the folder is gone).
- Disk use is the sum of derived and uploaded sizes, so a large upload can push a web space over its quota.

## 3. Customer screens per panel

Each web panel gets a customer side that copies its real product. "Log in as user" from the admin list opens it. Every icon leads to a working page over the model in section 2.

| Panel | Customer side | Signature details |
| --- | --- | --- |
| cPanic | Icon grid grouped into Files, Databases, Domains, Email, Metrics, Security, Software, Advanced; stats sidebar on the right | X3 theme before 2012, Paper Lantern 2014, Jupiter 2021; "Fantastiko De Luxe" then "Softaculus" in Software |
| Pleskit | Subscription page with Websites and Domains, Mail, Applications, Files, Databases, File Sharing tabs | "Open in web" button per domain; WordPrass Toolkit card |
| DirectAdmen | User level with Account Manager, Email Manager, Advanced Features, System Info and Files | Plain table look; reseller and admin levels above it |
| FreePanel | Virtualmin virtual server page with the left module tree | Webmin modules for MySQL, Postfix and ProFTPD |

The admin side of each panel stays as it is today and gains links into the customer side.

## 4. Tools inside the panel

### 4.1 File Manager

A two-pane file manager in the panel's look: a folder tree on the left and a listing with name, size, modified date and permissions on the right. Actions are Upload, New File, New Folder, Rename, Move, Delete, Extract, Compress and Change Permissions. Upload takes a file from the player's Downloads (`src/ui/downloads.ts`). Extract unpacks a `.zip` or `.tar.gz` into its folder tree. The upload takes time from the archive size over the office's line speed, as downloads already do.

### 4.2 Databases

- **MySQL Databases** creates databases and users and grants a user privileges on a database, with the prefix `<account>_` that real cPanel adds.
- **phpMyAdmon** opens from the panel and lists the tables of a database with their row counts and sizes. Tables come from the app that uses the database (`wp_posts`, `tblclients` and so on), and their row counts grow with the site's age and traffic.
- A database counts towards the web space's disk and towards the host's MySQL load, which feeds the existing overload readouts.
- Databases always run on the same host as the web space, with `localhost` as the database host, as on a standard shared hosting server. A separate database server is a later plan.

### 4.3 Mail

Mailboxes, forwarders, autoresponders and a spam filter per web space. Webmail (SquirrelMeal, later the newer clients) opens a mailbox in the Browser. The existing mail plans (`mail-core.md`, `mail-suite.md`) keep their sim effects: mail volume per web space drives the host's Exim load, spam and blacklisting incidents. Mailpig and Postfixit stay the products for dedicated mail servers, and a panel can hand its mail to one of them through MX records.

### 4.4 FTP

FTP accounts with a home folder and a quota. A desktop FTP program, FileGorilla (the FileZilla pun), is a free download from its own site in the Browser and installs like any other desktop program. It connects with host, user and password and shows local files (Downloads) on the left and the web space on the right. Uploading through FTP and through the File Manager do the same thing. In the 2005 era FTP is the normal way to upload, since early File Managers are slow and cap uploads at a few MB. SFTP arrives as a checkbox once the era has it.

### 4.5 Domains, DNS, SSL, PHP and cron

These screens edit the parts listed in section 2. The zone editor writes to the same DNS model that PowerDNZ shows. SSL uses `certificates.ts` and AutoSSL from `web-services.md`. Cron jobs run hourly at most and appear as host load.

### 4.6 App installer

Fantastiko (from 2005) and Softaculus (from 2009) stay as the shortcut planned in `web-presence.md`: pick an app, a domain and a folder, and the installer creates the files, the database and the admin account in one step. This is how customers install their own apps. Shop systems are listed there only in the eras when the real installers carried them, and the player may install their own shop through it too: the installer still asks for the licence key and the admin account, and creates the folder, the database and the user that section 5 sets up by hand.

## 5. Installing the shop system by hand

This replaces the "Install" button and the 72-hour setup timer.

1. **Get the archive.** Buy or trial the key on the vendor's site. The site's Downloads page gives `whmcache_5.2.zip` (or the variant's real archive name) into Downloads.
2. **Prepare a domain.** In the company's web space, add the subdomain `portal` (folder `public_html/portal`), or use a folder under the main domain. The zone gets the record automatically, as real panels do.
3. **Upload.** Upload the archive with the File Manager or FTP and extract it into the folder.
4. **Create the database.** In MySQL Databases, create a database and a user and grant all privileges.
5. **Run the installer.** Open `portal.<domain>/install/` in the Browser. The installer copies the real one for each variant: licence agreement, requirements check (PHP version, ionCube Loader for WHMCache, writable folders), licence key, database host, name, user and password, then the first admin's name, e-mail, username and password.
6. **Clean up.** The installer finishes by asking to delete the `install` folder. The admin refuses to load while it exists, in variants that really did that.
7. **Log in.** `portal.<domain>/admin/` asks for the username and password chosen in step 5. Wrong credentials fail with the variant's own message. A lost password has two ways back. The "Forgot password?" link sends a reset mail to the admin's mailbox. Or the player opens the shop's admin table in phpMyAdmon (`tbladmins` in WHMCache, the variant's own table elsewhere), edits the admin row and sets the password field with the MD5 function; the shop accepts it at the next login and stores it in its current hash format, as real shop systems do with legacy hashes.

Failures are real and tell the player what is wrong in the variant's own words: a wrong database password gives "Access denied for user", a PHP version below the requirement fails the requirements check, a missing ionCube Loader stops WHMCache until it is enabled in the panel's PHP settings.

Updates follow the same path: download the new archive, upload it over the old files and open the upgrade script. The sim's version of the shop changes when the upgrade script has run.

Moving the shop to another host is a real move: copy the files, export and import the database through phpMyAdmon or the panel's backup, and point the `portal` record at the new host.

## 6. Visiting sites in the Browser

Every domain that points at a web space opens in the Browser:

- A customer's site renders a page in the look of its app and era (a default WordPrass theme, a Joomlah template, a static page), generated from the seed. A broken site shows the real error: "Error establishing a database connection", a PHP fatal error, a 500 page, or the panel's default "account suspended" page.
- `portal.<domain>` shows the store front once the shop is installed. Before that it shows the panel's default index page ("Index of /" or the cPanic placeholder), never a bare "Not found".
- An unpointed domain shows the registrar's parking page.

## 7. Customer behaviour on top of it

The model in section 2 lets customers ask for things the player does in the panel:

- Support tickets name a task: "Please create a database for my shop", "My mailbox is full", "I cannot log in to FTP", "My site shows Error establishing a database connection". The player solves them in the customer's web space, and the ticket closes when the state matches.
- Customers on cheaper packages hit the database or mailbox limit and ask for an upgrade, which is a sale.
- Compromised sites leave files behind (a `.php` shell in `wp-content/uploads`) that the player can find and delete. Cleaning a site is a task in the File Manager instead of one button.

## 8. Build order

1. **Model and storage.** `WebspaceOverlay`, derivation of customer contents, package counts for the new parts, save defaults, seeded tests.
2. **File Manager and Downloads upload.** cPanic first, then the other panels as skins.
3. **Databases and phpMyAdmon.**
4. **Shop install by hand.** Vendor downloads, installer wizard per variant, chosen admin credentials, `install` folder rule, removal of the 72-hour timer and the Install button. Old saves with an installed shop get a web space with the shop's files, database and an admin account `admin` with a password shown once in a mail.
5. **Site visits in the Browser.** Customer sites, error pages, default index pages.
6. **Mail and FTP.** Mailbox and FTP screens, the FTP program, the webmail link.
7. **Domains, DNS, SSL, PHP and cron screens.**
8. **Customer tickets that name panel tasks.**
9. **Remaining panels' customer sides.** Pleskit, DirectAdmen and FreePanel layouts over the same tools.

## 9. Decisions

- Every customer web space can be opened and edited in its panel, not only those a ticket points at.
- Fantastiko and Softaculus may install the player's own shop once a real installer carried that shop system. Installing by hand stays possible in every era.
- Databases always live on the same host as the web server.
- Realism comes first: every screen, message and step copies the real product of its era.
- The FTP program is FileGorilla, a free download.
- A lost shop admin password is recovered through the reset mail or by editing the admin table in phpMyAdmon.
