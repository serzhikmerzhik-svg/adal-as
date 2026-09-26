// Атаулар ұзын ("№52 жалпы білім беретін мектеп", "Ақ желкен, мейрамхана"), ал интерфейсте қысқа
// түр керек ("№52 мектеп", "«Ақ желкен»"). Толық атау title атрибутында қалады.

export function shortName(name: string, kind: string): string {
  const num = name.match(/№\s*(\d+)/)?.[1];
  const base = name.split(",")[0].trim();

  if (kind === "SCHOOL" && num && !name.includes(",")) {
    if (/гимназия/i.test(name)) return `№${num} гимназия`;
    if (/лицей/i.test(name)) return `№${num} лицей`;
    return `№${num} мектеп`;
  }
  if (kind === "KINDERGARTEN") return num ? `«${base}» №${num}` : `«${base}»`;
  if (kind === "CANTEEN" || kind === "RESTAURANT" || kind === "CAFE") {
    return base.length > 28 ? `«${base.slice(0, 27)}…»` : `«${base}»`;
  }
  return base.length > 30 ? `${base.slice(0, 29)}…` : base;
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

export function districtShort(district: string): string {
  return DISTRICT_SHORT[district] ?? district;
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

export function placeLabel(district: string, address?: string | null): string {
  const mkr = address ? microdistrict(address) : null;
  return mkr ? `${districtShort(district)}, ${mkr}` : districtShort(district);
}

// Браузерлерде kk-KZ локалінің ай атаулары жоқ ("M08 26", "09-24"), сондықтан күндер қолмен пішімделеді.
const KK_MONTHS = ["қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым", "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан"];
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

/** "26 тамыз" */
export function dayMonth(date: string | Date): string {
  const d = new Date(date);
  return `${d.getDate()} ${KK_MONTHS[d.getMonth()]}`;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Бүгін → "11:38", кеше → "кеше 16:20", ертерек → "22.09 16:20". */
export function relativeTime(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return hm(d);
  if (sameDay(d, yesterday)) return `кеше ${hm(d)}`;
  return `${ddmm(d)} ${hm(d)}`;
}

export function daysSince(date: string | Date | null): string {
  if (!date) return "Тексерілмеген";
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
  if (days <= 0) return "бүгін";
  return `${days} күн бұрын`;
}
