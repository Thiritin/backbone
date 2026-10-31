import { Cloud, CloudRain, CloudSnow, CloudSun, Sun } from "lucide-react";
import type { Sky } from "../../../sim/20-world/weather";

const ICONS = { sun: Sun, partly: CloudSun, cloud: Cloud, rain: CloudRain, snow: CloudSnow };

export const SkyIcon = ({ kind }: { kind: Sky }) => { const Icon = ICONS[kind]; return <Icon className={`sky sky-${kind}`} />; };
