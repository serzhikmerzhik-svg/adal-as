// СЭС бекіткен екі апталық циклдік мәзір (мектеп, балабақша): бүгін жоспардың қай күні және
// партиядағы өнім техкартаға сәйкес пе.

/** Цикл ұзындығы: 14 күнтізбелік күн (демалыс күндері де жоспарда бар — демо кез келген күні жұмыс істейді). */
export const PLAN_DAYS = 14;
const CYCLE_START = Date.UTC(2026, 0, 5); // дүйсенбі

/** Жоспар күні 1–14. Серверде todayDate() сияқты жергілікті күн алынады. */
export function planDay(date: Date = new Date()) {
  const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const n = Math.floor((day - CYCLE_START) / 86_400_000);
  return (((n % PLAN_DAYS) + PLAN_DAYS) % PLAN_DAYS) + 1;
}

/** Бекітілген мәзір тек мемлекет қаржыландыратын балалар нысандарына: мектеп пен балабақша. */
export const hasPlan = (kind: string) => kind === "SCHOOL" || kind === "KINDERGARTEN";

const normalize = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-яәғқңөұүһі0-9]/g, "");

/** Партиядағы өнім техкартадағы негізгі өнімге сәйкес пе: «Сиыр еті» ~ «Сиыр еті (жауырын)». */
export function ingredientMatches(mainIngredient: string, product: string) {
  const a = normalize(mainIngredient);
  const b = normalize(product);
  return a.length > 0 && b.length > 0 && (a.includes(b) || b.includes(a));
}
