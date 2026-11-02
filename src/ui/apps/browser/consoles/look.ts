import { createContext, useContext } from "react";
import { en, t as base } from "../../../../i18n/en";

export type Look = "cpanic" | "pleskit" | "directadmen" | "freepanel";
export const LookContext = createContext<Look>("cpanic");

// The shared web space tools speak cPanic by default; "key@look" in the dictionaries holds another panel's own wording.
export const lookT = (look: Look) => (key: string, params?: Record<string, string | number>): string =>
  base(en[`${key}@${look}`] ? `${key}@${look}` : key, params);
export const useT = () => lookT(useContext(LookContext));
