import type { GameState } from "../50-state";

// ponytail: every service counts as online until milestone 3 links services to devices and clusters.
export const serviceOnline = (_s: GameState, _serviceId: string): boolean => true;
