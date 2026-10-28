const EUR = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const EUR_CENTS = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });

export const euro = (v: number): string => EUR.format(v);
export const euroCents = (v: number): string => EUR_CENTS.format(v);
