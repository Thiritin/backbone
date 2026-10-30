import type { Product } from "../../../../sim/30-customers/customers";

// The company's own copy on its website.
export const BLURB: Record<Product, string> = {
  webHosting: "Puts your website online with PHP and a MySQL database.",
  vps: "Gives you a virtual server of your own with full root access.",
  gameServer: "Keeps your game server running while you sleep, so your clan does not have to.",
  dns: "Answers the DNS queries for your domains.",
  vpn: "Connects your office to the internet through an encrypted tunnel.",
  storage: "Keeps your files on disks that we look after.",
  cloud: "Runs your servers on a cluster that moves them when a host fails.",
  dedicated: "Rents you a whole physical server by the month.",
  colocation: "Houses your own servers in our racks with power and network.",
  gpu: "Rents you virtual servers with graphics cards for training and rendering.",
  ssl: "Puts the padlock in your visitors' address bar with a certificate for your domain.",
  domain: "",
};

export const FEATURES: Record<Product, string[]> = {
  webHosting: ["PHP and MySQL included", "Mailboxes under your domain", "Upload by FTP or the control panel"],
  vps: ["Full root access", "Choose your own operating system", "Upgrade without moving"],
  gameServer: ["Mods and maps by upload", "Restarts on its own after a crash", "Low ping from our racks"],
  dns: ["Zone editor in the control panel", "Changes live within minutes", "Two name servers"],
  vpn: ["Encrypted tunnel to your office", "Fixed IP address", "Works with every common router"],
  storage: ["Disks in a redundant array", "Access from anywhere", "Nightly checks of every disk"],
  cloud: ["Moves your servers when a host fails", "Pay for what you book", "Snapshots before every change"],
  dedicated: ["The whole machine is yours", "Remote console included", "Hardware swap by our staff"],
  colocation: ["Redundant power", "Uplink in our own network", "Access to your rack by appointment"],
  gpu: ["Graphics cards for training and rendering", "Booked by the month", "Drivers preinstalled"],
  ssl: ["Padlock in every browser", "Renewed for you every year", "Installed on your web space"],
  domain: [],
};

// Knowledge base articles for the basic how-to topics, as numbered steps.
export const KB_STEPS: Record<string, (domain: string) => string[]> = {
  upload: (d) => [
    "Open your FTP program and create a new connection.",
    `Enter ftp.${d} as the server and the login from your welcome email.`,
    "Copy your pages into the folder named htdocs. The start page must be called index.html or index.php.",
    "Open your domain in the browser. If you still see the old page, reload it once.",
  ],
  email: (d) => [
    "In Outlook, add a new account and choose the manual setup.",
    `Enter mail.${d} as the incoming server (IMAP, port 993) and as the outgoing server (SMTP, port 587).`,
    "Use your full email address as the user name and the mailbox password from the control panel.",
    "Send yourself a test email to check both directions.",
  ],
  dns: (d) => [
    "Log in to the registrar where you bought your domain.",
    `Replace the name servers with ns1.${d} and ns2.${d}.`,
    "Wait for the change to spread. Most visitors see your site within a few hours, a few take up to a day.",
  ],
  ssl: () => [
    "Order an SSL certificate for your domain in the control panel.",
    "We install it on your web space as soon as the domain points to us.",
    "Change the links on your pages from http to https so the padlock stays on every page.",
  ],
  ssh: (d) => [
    "Find the IP address and the root password in your welcome email.",
    "On Windoors, open PuTTYcat; on a Pear or Lunix machine, open a terminal.",
    `Connect with ssh root@<your IP> or through the console at panel.${d}.`,
    "Change the root password with passwd right after the first login.",
  ],
  phone: (d) => [
    "Open the mail settings on your phone and add an account of the type IMAP.",
    `Enter mail.${d} as the incoming and outgoing server.`,
    "Turn on SSL for both and use port 993 for incoming and 587 for outgoing mail.",
  ],
};

export interface Thread { product: Product; title: string; author: string; question: string; answer: string; replies: number; solved: boolean }

// The help desk: questions customers post often, each with the answer from the support team.
export const THREADS: Thread[] = [
  { product: "webHosting", title: "White page after the PHP update", author: "bakery_klaus", replies: 4, solved: true,
    question: "Since last night my shop shows only a white page. Nothing changed on my side.",
    answer: "Your shop software is older than the PHP version on the server. Switch the PHP version back in the control panel under Settings, then update the shop when you have time." },
  { product: "webHosting", title: "My emails land in spam", author: "anja.r", replies: 6, solved: true,
    question: "Everything I send to customers with Notmail ends up in their spam folder.",
    answer: "Send through our outgoing server with your login instead of your internet provider's server. That way the receiving side sees that the email really comes from your domain." },
  { product: "webHosting", title: "How do I restore yesterday's files?", author: "webmaster_tom", replies: 2, solved: true,
    question: "I deleted the wrong folder. Is there a backup?",
    answer: "We keep backups of every web space. Write to support with the folder and the time, and we put it back for you." },
  { product: "vps", title: "Locked myself out with the firewall", author: "devnull", replies: 3, solved: true,
    question: "I blocked port 22 by accident and now SSH times out.",
    answer: "Open the remote console in the control panel. It works without the network, so you can log in there and allow port 22 again." },
  { product: "vps", title: "Server feels slow in the evening", author: "m.weber", replies: 5, solved: false,
    question: "Between 8 and 10 pm my pages take several seconds to load.",
    answer: "Check with top which process uses the CPU at that time. If it is your own database, a larger plan helps; if not, write to us and we look at the host." },
  { product: "gameServer", title: "Map won't load after the mod upload", author: "xXfragXx", replies: 9, solved: true,
    question: "Uploaded the new map pack and now the server is stuck at loading.",
    answer: "One of the files is from an older game version. Remove the pack, restart the server and upload the files one by one to find the broken one." },
  { product: "dns", title: "New subdomain does not resolve", author: "petra_h", replies: 2, solved: true,
    question: "I added shop as a subdomain an hour ago but the browser does not find it.",
    answer: "Changes are live on our name servers within minutes, but your own computer may remember the old answer. Try again from your phone or wait an hour." },
  { product: "dedicated", title: "Disk shows errors in the log", author: "sysadmin_jo", replies: 3, solved: true,
    question: "The kernel log is full of read errors on the second disk.",
    answer: "Open a ticket with the serial number of the disk. Our staff swaps it during the next maintenance window, and the array rebuilds on its own." },
  { product: "storage", title: "Upload stops at 2 GB", author: "foto_lena", replies: 4, solved: true,
    question: "Large video files always fail at the same size.",
    answer: "Your upload program still uses an old protocol with a size limit. Switch to SFTP and the limit is gone." },
  { product: "ssl", title: "Padlock is gray on some pages", author: "kerstin_m", replies: 3, solved: true,
    question: "The certificate is installed, but some pages still say not secure.",
    answer: "Those pages load an image or script over http. Change the links to https and the padlock turns on." },
  { product: "cloud", title: "Why did my server restart?", author: "cto_bernd", replies: 2, solved: true,
    question: "Our app server rebooted at 3 am without any notice.",
    answer: "Its host failed and the cluster moved it to another one, which takes a restart. Your data stayed on the shared storage." },
  { product: "colocation", title: "Can I visit my rack on Saturday?", author: "netops_kai", replies: 1, solved: true,
    question: "We need to swap a switch this weekend.",
    answer: "Yes, book a slot with support a day in advance and bring your ID. Someone from our team lets you in." },
];
