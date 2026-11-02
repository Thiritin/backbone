import { HOME_URL } from "../../../sim/80-business/browser";
import { readSession, useSessionState } from "../../session";

// The page the home button and a new tab open, set by a site's "make this your home page" link.
const KEY = "browser.home";
export const homeUrl = (): string => readSession(KEY, HOME_URL);
export const useHome = () => useSessionState<string>(KEY, HOME_URL);
