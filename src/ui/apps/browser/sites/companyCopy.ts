import { t } from "../../../../i18n/en";
import type { Product } from "../../../../sim/30-customers/customers";

// The company's own copy on its website.
export const BLURB: Record<Product, string> = {
  webHosting: t("browser-sites-1.blurb.webHosting"),
  vps: t("browser-sites-1.blurb.vps"),
  gameServer: t("browser-sites-1.blurb.gameServer"),
  dns: t("browser-sites-1.blurb.dns"),
  vpn: t("browser-sites-1.blurb.vpn"),
  storage: t("browser-sites-1.blurb.storage"),
  cloud: t("browser-sites-1.blurb.cloud"),
  dedicated: t("browser-sites-1.blurb.dedicated"),
  colocation: t("browser-sites-1.blurb.colocation"),
  gpu: t("browser-sites-1.blurb.gpu"),
  ssl: t("browser-sites-1.blurb.ssl"),
  domain: "",
};

export const FEATURES: Record<Product, string[]> = {
  webHosting: [t("browser-sites-1.feature.webHosting.0"), t("browser-sites-1.feature.webHosting.1"), t("browser-sites-1.feature.webHosting.2")],
  vps: [t("browser-sites-1.feature.vps.0"), t("browser-sites-1.feature.vps.1"), t("browser-sites-1.feature.vps.2")],
  gameServer: [t("browser-sites-1.feature.gameServer.0"), t("browser-sites-1.feature.gameServer.1"), t("browser-sites-1.feature.gameServer.2")],
  dns: [t("browser-sites-1.feature.dns.0"), t("browser-sites-1.feature.dns.1"), t("browser-sites-1.feature.dns.2")],
  vpn: [t("browser-sites-1.feature.vpn.0"), t("browser-sites-1.feature.vpn.1"), t("browser-sites-1.feature.vpn.2")],
  storage: [t("browser-sites-1.feature.storage.0"), t("browser-sites-1.feature.storage.1"), t("browser-sites-1.feature.storage.2")],
  cloud: [t("browser-sites-1.feature.cloud.0"), t("browser-sites-1.feature.cloud.1"), t("browser-sites-1.feature.cloud.2")],
  dedicated: [t("browser-sites-1.feature.dedicated.0"), t("browser-sites-1.feature.dedicated.1"), t("browser-sites-1.feature.dedicated.2")],
  colocation: [t("browser-sites-1.feature.colocation.0"), t("browser-sites-1.feature.colocation.1"), t("browser-sites-1.feature.colocation.2")],
  gpu: [t("browser-sites-1.feature.gpu.0"), t("browser-sites-1.feature.gpu.1"), t("browser-sites-1.feature.gpu.2")],
  ssl: [t("browser-sites-1.feature.ssl.0"), t("browser-sites-1.feature.ssl.1"), t("browser-sites-1.feature.ssl.2")],
  domain: [],
};

// Knowledge base articles for the basic how-to topics, as numbered steps.
export const KB_STEPS: Record<string, (domain: string) => string[]> = {
  upload: (d) => [
    t("browser-sites-1.kb.upload.0"),
    t("browser-sites-1.kb.upload.1", { d }),
    t("browser-sites-1.kb.upload.2"),
    t("browser-sites-1.kb.upload.3"),
  ],
  email: (d) => [
    t("browser-sites-1.kb.email.0"),
    t("browser-sites-1.kb.email.1", { d }),
    t("browser-sites-1.kb.email.2"),
    t("browser-sites-1.kb.email.3"),
  ],
  dns: (d) => [
    t("browser-sites-1.kb.dns.0"),
    t("browser-sites-1.kb.dns.1", { d }),
    t("browser-sites-1.kb.dns.2"),
  ],
  ssl: () => [
    t("browser-sites-1.kb.ssl.0"),
    t("browser-sites-1.kb.ssl.1"),
    t("browser-sites-1.kb.ssl.2"),
  ],
  ssh: (d) => [
    t("browser-sites-1.kb.ssh.0"),
    t("browser-sites-1.kb.ssh.1"),
    t("browser-sites-1.kb.ssh.2", { d }),
    t("browser-sites-1.kb.ssh.3"),
  ],
  phone: (d) => [
    t("browser-sites-1.kb.phone.0"),
    t("browser-sites-1.kb.phone.1", { d }),
    t("browser-sites-1.kb.phone.2"),
  ],
};

export interface Thread { product: Product; title: string; author: string; question: string; answer: string; replies: number; solved: boolean }

// The help desk: questions customers post often, each with the answer from the support team.
export const THREADS: Thread[] = [
  { product: "webHosting", title: t("browser-sites-1.thread.0.title"), author: "bakery_klaus", replies: 4, solved: true,
    question: t("browser-sites-1.thread.0.question"),
    answer: t("browser-sites-1.thread.0.answer") },
  { product: "webHosting", title: t("browser-sites-1.thread.1.title"), author: "anja.r", replies: 6, solved: true,
    question: t("browser-sites-1.thread.1.question"),
    answer: t("browser-sites-1.thread.1.answer") },
  { product: "webHosting", title: t("browser-sites-1.thread.2.title"), author: "webmaster_tom", replies: 2, solved: true,
    question: t("browser-sites-1.thread.2.question"),
    answer: t("browser-sites-1.thread.2.answer") },
  { product: "vps", title: t("browser-sites-1.thread.3.title"), author: "devnull", replies: 3, solved: true,
    question: t("browser-sites-1.thread.3.question"),
    answer: t("browser-sites-1.thread.3.answer") },
  { product: "vps", title: t("browser-sites-1.thread.4.title"), author: "m.weber", replies: 5, solved: false,
    question: t("browser-sites-1.thread.4.question"),
    answer: t("browser-sites-1.thread.4.answer") },
  { product: "gameServer", title: t("browser-sites-1.thread.5.title"), author: "xXfragXx", replies: 9, solved: true,
    question: t("browser-sites-1.thread.5.question"),
    answer: t("browser-sites-1.thread.5.answer") },
  { product: "dns", title: t("browser-sites-1.thread.6.title"), author: "petra_h", replies: 2, solved: true,
    question: t("browser-sites-1.thread.6.question"),
    answer: t("browser-sites-1.thread.6.answer") },
  { product: "dedicated", title: t("browser-sites-1.thread.7.title"), author: "sysadmin_jo", replies: 3, solved: true,
    question: t("browser-sites-1.thread.7.question"),
    answer: t("browser-sites-1.thread.7.answer") },
  { product: "storage", title: t("browser-sites-1.thread.8.title"), author: "foto_lena", replies: 4, solved: true,
    question: t("browser-sites-1.thread.8.question"),
    answer: t("browser-sites-1.thread.8.answer") },
  { product: "ssl", title: t("browser-sites-1.thread.9.title"), author: "kerstin_m", replies: 3, solved: true,
    question: t("browser-sites-1.thread.9.question"),
    answer: t("browser-sites-1.thread.9.answer") },
  { product: "cloud", title: t("browser-sites-1.thread.10.title"), author: "cto_bernd", replies: 2, solved: true,
    question: t("browser-sites-1.thread.10.question"),
    answer: t("browser-sites-1.thread.10.answer") },
  { product: "colocation", title: t("browser-sites-1.thread.11.title"), author: "netops_kai", replies: 1, solved: true,
    question: t("browser-sites-1.thread.11.question"),
    answer: t("browser-sites-1.thread.11.answer") },
];
