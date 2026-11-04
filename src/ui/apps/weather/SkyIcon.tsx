import { Cloud, CloudMoon, CloudRain, CloudSnow, CloudSun, Moon, Sun } from "lucide-react";
import type { Sky } from "../../../sim/20-world/weather";

const ICONS = { sun: Sun, partly: CloudSun, cloud: Cloud, rain: CloudRain, snow: CloudSnow };

const NIGHT = { ...ICONS, sun: Moon, partly: CloudMoon };

export const SkyIcon = ({ kind, night = false }: { kind: Sky; night?: boolean }) => { const Icon = (night ? NIGHT : ICONS)[kind]; return <Icon className={`sky sky-${kind}`} />; };
