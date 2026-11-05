// Rexoffice looks different by calendar year: the first light flat app, the dashboard app, the current one.
export type Era = "early" | "dash" | "modern";
export const eraOf = (year: number): Era => (year < 2017 ? "early" : year < 2023 ? "dash" : "modern");
