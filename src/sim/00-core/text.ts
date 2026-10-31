import { t } from "../../i18n/en";

// Catalog text is read through getters, so it follows the active language and saves never hold it.
export function textRecord<T extends string>(prefix: string, rec: Record<T, string>): Record<T, string> {
  const out = {} as Record<T, string>;
  for (const k of Object.keys(rec) as T[]) Object.defineProperty(out, k, { get: () => t(`${prefix}.${k}`), enumerable: true });
  return out;
}

// Keys read "<prefix>.<id>.<field>".
export function textFields<T extends { id: string }>(prefix: string, items: T[], fields: (keyof T & string)[]): T[] {
  for (const it of items) for (const f of fields) Object.defineProperty(it, f, { get: () => t(`${prefix}.${it.id}.${f}`), enumerable: true });
  return items;
}
