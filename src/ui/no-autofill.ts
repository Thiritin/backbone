// Game logins are fake; keep real password managers from filling or saving them.
export const noAutofill = {
  autoComplete: "off",
  "data-bwignore": true,
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-form-type": "other",
} as const;
