import type { Locale } from "../config";
import { en } from "./en";
import { kk, type Dict } from "./kk";
import { ru } from "./ru";

const DICTS: Record<Locale, Dict> = { kk, ru, en };

export function getDict(locale: Locale): Dict {
  return DICTS[locale];
}

export type { Dict };
