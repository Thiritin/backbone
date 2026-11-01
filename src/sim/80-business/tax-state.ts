// The tax office's file on the company; kept free of imports so the state module can load it first.
export interface TaxState {
  // Hour the questionnaire was posted and hour the player answered it; null before.
  asked: number | null;
  answered: number | null;
  expected: number;
  small: boolean;
  // The tax number and the hour its letter lands; the number counts from then on.
  number: string;
  numberAt: number | null;
  // The registration year: the VAT period is monthly in it and the next calendar year.
  since: number;
  // Returns owed to the office, filed or open, oldest first.
  returns: TaxReturn[];
  // The last year the January check ran; 0 before the first.
  checked: number;
}

// A return for the hours [from, to). booked is what filing booked; late is set once the surcharge letter went out and
// estimate holds the estimate letter's id.
export interface TaxReturn {
  id: string; kind: "vat" | "year"; year: number; from: number; to: number; dueAt: number;
  filedAt: number | null; booked: number; late: boolean; estimate: string | null;
}

export const newTax = (): TaxState => ({ asked: null, answered: null, expected: 0, small: false, number: "", numberAt: null, since: 0, returns: [], checked: 0 });
