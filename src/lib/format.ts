// Атаулар ұзын ("№52 жалпы білім беретін мектеп", "Ақ желкен, мейрамхана"), ал интерфейсте қысқа
// түр керек ("№52 мектеп", "«Ақ желкен»"). Толық атау title атрибутында қалады.
// Тілге тәуелді функциялар соңғы параметр ретінде тілді алады (әдепкісі — қазақша).
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dict";
import { latin } from "@/i18n/translit";

export function shortName(name: string, kind: string, locale: Locale = DEFAULT_LOCALE): string {
  const f = getDict(locale).format;
  const num = name.match(/№\s*(\d+)/)?.[1];
  const base = name.split(",")[0].trim();
  const text = (s: string) => (locale === "en" ? latin(s) : s);

  if (kind === "SCHOOL" && num && !name.includes(",")) {
    if (/гимназия/i.test(name)) return f.gymnasium(num);
    if (/лицей/i.test(name)) return f.lyceum(num);
    return f.school(num);
  }
  if (kind === "KINDERGARTEN") return num ? f.numbered(f.quote(text(base)), num) : f.quote(text(base));
  if (kind === "CANTEEN" || kind === "RESTAURANT" || kind === "CAFE") {
    return f.quote(text(base.length > 28 ? `${base.slice(0, 27)}…` : base));
  }
  return text(base.length > 30 ? `${base.slice(0, 29)}…` : base);
}

const DISTRICT_SHORT: Record<string, string> = {
  "Ақтау қ.": "Ақтау",
  "Жаңаөзен қ.": "Жаңаөзен",
  "Мұнайлы ауданы": "Мұнайлы",
  "Түпқараған ауданы": "Түпқараған",
  "Маңғыстау ауданы": "Маңғыстау ауд.",
  "Бейнеу ауданы": "Бейнеу",
  "Қарақия ауданы": "Қарақия",
};

/** Аудан атауы: "14-мкр" тілге қарай ("14 мкр", "mkr 14"), қалғаны қысқартылады. */
export function districtShort(district: string, locale: Locale = DEFAULT_LOCALE): string {
  const mkr = district.match(/^(\S+)-мкр$/)?.[1];
  if (mkr) {
    const label = getDict(locale).format.microdistrict(mkr);
    return locale === "en" ? latin(label) : label;
  }
  const short = DISTRICT_SHORT[district] ?? district;
  return locale === "en" ? latin(short) : short;
}

/** "13-й микрорайон, 51" → "13-мкр"; "микрорайон 29А, 5/6" → "29А-мкр"; "жилмассив Жалын, 374" → "Жалын". */
export function microdistrict(address: string): string | null {
  // JS-тегі \b тек латын әріптерін таниды, сондықтан кириллица әріптен кейін lookahead қолданылады.
  const numbered =
    address.match(/(\d+[А-Яа-яA-Za-z]?)-?й?\s+микрорайон/) ?? address.match(/микрорайон\s+(\d+[А-Яа-яA-Za-z]?)(?=[\s,]|$)/);
  if (numbered) return `${numbered[1]}-мкр`;
  const massiv = address.match(/жилмассив\s+([^,]+)/);
  if (massiv) return massiv[1].trim();
  return null;
}

export function placeLabel(district: string, address?: string | null, locale: Locale = DEFAULT_LOCALE): string {
  const mkr = address ? microdistrict(address) : null;
  return mkr ? `${districtShort(district, locale)}, ${districtShort(mkr, locale)}` : districtShort(district, locale);
}

// Браузерлерде kk-KZ локалінің ай атаулары жоқ ("M08 26", "09-24"), сондықтан күндер қолмен пішімделеді.
const pad = (n: number) => String(n).padStart(2, "0");

export function hm(date: string | Date): string {
  const d = new Date(date);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function hms(date: string | Date): string {
  const d = new Date(date);
  return `${hm(d)}:${pad(d.getSeconds())}`;
}

/** "24.09" */
export function ddmm(date: string | Date): string {
  const d = new Date(date);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
}

/** "24.09.2026" */
export function fullDate(date: string | Date): string {
  return `${ddmm(date)}.${new Date(date).getFullYear()}`;
}

/** "24.09.2026 22:26" */
export function dateTime(date: string | Date): string {
  return `${fullDate(date)} ${hm(date)}`;
}

/** "26 тамыз" / "26 августа" / "August 26" */
export function dayMonth(date: string | Date, locale: Locale = DEFAULT_LOCALE): string {
  const d = new Date(date);
  return getDict(locale).format.dayMonth(d.getDate(), d.getMonth());
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Бүгін → "11:38", кеше → "кеше 16:20", ертерек → "22.09 16:20". */
export function relativeTime(date: string | Date, locale: Locale = DEFAULT_LOCALE): string {
  const d = new Date(date);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return hm(d);
  if (sameDay(d, yesterday)) return `${getDict(locale).format.yesterday} ${hm(d)}`;
  return `${ddmm(d)} ${hm(d)}`;
}

export function daysSince(date: string | Date | null, locale: Locale = DEFAULT_LOCALE): string {
  const f = getDict(locale).format;
  if (!date) return f.notInspected;
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
  if (days <= 0) return f.today;
  return f.daysAgo(days);
}
