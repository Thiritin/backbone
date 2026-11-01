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
}

export const newTax = (): TaxState => ({ asked: null, answered: null, expected: 0, small: false, number: "", numberAt: null, since: 0 });
