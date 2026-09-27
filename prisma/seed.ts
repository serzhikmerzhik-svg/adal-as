import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { PrismaClient, type DishCategory, type FacilityKind, type Prisma, type RiskLevel } from "@prisma/client";
import bcrypt from "bcryptjs";
import { recomputeSchoolRisk } from "../src/lib/risk/score";
import { mapLimit } from "../src/lib/concurrency";
import { microdistrict, schoolCipher } from "../src/lib/format";
import { hashDeviceKey, keyHint, newDeviceKey } from "../src/lib/devices";
import { ingredientMatches, planDay } from "../src/lib/plan";
import { KINDERGARTEN_PLAN, SCHOOL_PLAN, type PlanDish } from "./menu-plan";

const prisma = new PrismaClient();

/*
 * Ақтау қаласының 54 тамақтану нысаны.
 *
 * Орналасуы шынайы: нүктелер 2GIS-тегі нақты мектептердің, балабақшалардың, мейрамханалардың,
 * кафелер мен асханалардың дәл координаттарында (scripts/fetch-2gis.mjs → prisma/data/facilities.json).
 * Мектептер — Ақтаудың 34 мемлекеттік нөмірлі мектебі (№1–35, №4 жоқ), нөмірі шифрланған:
 * 1→A … 9→I, 0→J (№14 → «№AD», schoolCipher). Сценарийдегі бұзушылықтар мен «улану» ойдан
 * шығарылған, сондықтан нөмір ашық жазылмайды, ал басқа нысандардың атаулары ойдан шығарылған
 * (fictionalNames). Мекенжай шағын аудан деңгейінде қалады. Ішкі код (А-12, М-07…) тек сценарий
 * мен аккаунттарды байланыстыру үшін.
 */

type FacilityJson = { dgisId: string; kind: FacilityKind; name: string; address: string; lat: number; lng: number };

type Scenario = "green" | "greenInspected" | "training" | "yellowTemp" | "yellowPhoto" | "yellowRating" | "yellowOverdue";

// Мектептен басқа нысандардың атаулары ойдан шығарылған: сценарийдегі бұзушылықтар да ойдан
// шығарылған, сондықтан атау нақты нысанға таңылмауы керек. Әр атау 2GIS тізіміндегі 689 нақты
// атаумен салыстырылып, сәйкес келсе алынып тасталады (fictionalNames).
const NAME_POOL: Record<Exclude<FacilityKind, "SCHOOL">, string[]> = {
  KINDERGARTEN: [
    "Шұғыла", "Күншуақ", "Жұлдызай", "Құлыншақ", "Таңшолпан", "Еркетай", "Ботақан", "Нұршуақ", "Көгершін", "Гүлдәурен",
    "Айгөлек", "Сәбижан", "Ақмаржан", "Бүлдіршін", "Балауса", "Қуаныш", "Балдырған", "Қызғалдақ", "Ақбота", "Мөлдір",
  ],
  RESTAURANT: [
    "Ақ желкен", "Теңіз самалы", "Алтын шатыр", "Көкжиек", "Жағалау", "Қазына", "Тарлан", "Әсем кеш", "Ақсарай", "Мерей",
    "Шаңырақ", "Сазды кеш", "Үлкен дастарқан", "Маржан", "Толқын жағасы",
  ],
  CAFE: [
    "Тұмар", "Қарлығаш", "Жайлау", "Шекер", "Мейіз", "Бауырсақ", "Тәтті", "Көктем", "Самсагүл", "Жент", "Ақжелең",
    "Сырнай", "Дәмхана", "Бота", "Ләззат", "Шұбат",
  ],
  CANTEEN: [
    "Ырыс", "Сыбаға", "Ынтымақ", "Мереке", "Бірлік", "Құт-Береке", "Жылы ас", "Дәмді ас", "Ақ дастарқан", "Мол дастарқан",
    "Табыс", "Дастарқан",
  ],
};
const KIND_SUFFIX: Record<Exclude<FacilityKind, "SCHOOL">, string> = {
  KINDERGARTEN: "балабақша",
  RESTAURANT: "мейрамхана",
  CAFE: "кафе",
  CANTEEN: "асхана",
};

const KZ_TO_RU: Record<string, string> = { ә: "а", ғ: "г", қ: "к", ң: "н", ө: "о", ұ: "у", ү: "у", һ: "х", і: "и" };
const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[әғқңөұүһі]/g, (c) => KZ_TO_RU[c])
    .replace(/[^a-zа-яё0-9]/g, "");

/** Код → ойдан шығарылған атау (мектептен басқа түрлер). Нақты Ақтау нысандарының атауымен сәйкес келетіндер алынып тасталады. */
function fictionalNames(real: FacilityJson[]) {
  const realFull = real.map((f) => normalize(f.name));
  const realBrands = real.map((f) => normalize(f.name.split(",")[0])).filter((b) => b.length >= 3);
  const taken = (word: string) => {
    const w = normalize(word);
    return realFull.some((r) => r.includes(w)) || realBrands.some((b) => w.includes(b));
  };

  const names = new Map<string, string>();
  for (const kind of Object.keys(NAME_POOL) as (keyof typeof NAME_POOL)[]) {
    const free = NAME_POOL[kind].filter((w) => !taken(w));
    if (free.length < CODES[kind].length) throw new Error(`${kind}: бос атау жетпеді (${free.length})`);
    CODES[kind].forEach((code, i) => names.set(code, `${free[i]}, ${KIND_SUFFIX[kind]}`));
  }
  return names;
}

/** Мемлекеттік жалпы білім беретін мектеп: 2GIS-те нөмірі бар (кешкі, арнайы және облыстағы ауыл мектептері кірмейді — олардың нөмірі қайталанады). */
const isStateSchool = (f: FacilityJson) => f.kind === "SCHOOL" && /№\s*\d+/.test(f.name) && !/Вечерн|Специальн|\sс\.\s/.test(f.name);

/** 2GIS атауы → шифрланған атау, түрі сақталады: «Школа-гимназия №19» → «№AI мектеп-гимназия». */
function cipherSchoolName(realName: string) {
  const n = Number(realName.match(/№\s*(\d+)/)![1]);
  const type = /школа-гимназия/i.test(realName)
    ? "мектеп-гимназия"
    : /гимназия/i.test(realName)
      ? "гимназия"
      : /школа-лицей/i.test(realName)
        ? "мектеп-лицей"
        : /лицей/i.test(realName)
          ? "лицей"
          : "жалпы білім беретін мектеп";
  return `№${schoolCipher(n)} ${type}`;
}
const STATE_SCHOOL_COUNT = 34;

// Басты назар — мектеп асханалары: Ақтаудың 34 мемлекеттік мектебі, 10 балабақша. Мейрамхана, кафе,
// қоғамдық асхана — қосымша (барлығы 10), жүйенің оларға да қолданылатынын көрсету үшін.
const CODES: Record<FacilityKind, string[]> = {
  SCHOOL: Array.from({ length: STATE_SCHOOL_COUNT }, (_, i) => `А-${String(i + 1).padStart(2, "0")}`),
  KINDERGARTEN: [...Array.from({ length: 9 }, (_, i) => `Б-0${i + 1}`), "Б-11"],
  RESTAURANT: ["М-01", "М-02", "М-03", "М-07"],
  CAFE: ["К-06", "К-09", "К-14"],
  CANTEEN: ["Ас-01", "Ас-03", "Ас-06"],
};

// Сценарий нысандары: код → қай шағын аудандағы нысан алынады (бірінші табылғаны) және рөлі.
const FIXED: Record<string, { mkr: string[]; scenario: Scenario; training?: boolean }> = {
  "А-12": { mkr: ["14"], scenario: "training", training: true },
  // №AD (№14 мектеп, 26-мкр): құрылғы демосы — термометр-щуп осы асханаға тіркеледі, геолокация тексерілмейді.
  "А-14": { mkr: ["26"], scenario: "green", training: true },
  "А-05": { mkr: ["7"], scenario: "green" },
  "А-19": { mkr: ["5"], scenario: "green" },
  "М-07": { mkr: ["11"], scenario: "green" },
  "М-03": { mkr: ["4"], scenario: "greenInspected" },
  "К-14": { mkr: ["15"], scenario: "yellowPhoto", training: true },
  "Ас-03": { mkr: ["27"], scenario: "yellowOverdue" },
  "Б-11": { mkr: ["32", "32Б", "31", "33", "29"], scenario: "yellowTemp" },
};
// Басқа сары нысандар (бастапқы күй: 9 сары, оның 5-і мектеп пен балабақша; қызылды /training тудырады).
const EXTRA_SCENARIO: Record<string, Scenario> = {
  "А-08": "yellowRating",
  "А-16": "yellowOverdue",
  "А-27": "yellowTemp",
  "А-33": "yellowPhoto",
  "К-09": "yellowRating",
  "Ас-01": "yellowPhoto",
};

// Автоматты ережелердің бастапқы мысалдары: СЭС тақтасында әр ереженің алерті көрінсін.
const RULE_SCENARIO: Record<string, "INGREDIENT" | "EATABILITY" | "OFF_PLAN"> = {
  "А-22": "INGREDIENT", // техкартада сиыр еті, партияда шұжық
  "А-30": "EATABILITY", // кеше балалар тағамның көбін жемеген
  "Б-04": "OFF_PLAN", // жоспардан тыс тағам
};

// Мектеп пен балабақша мәзірі СЭС бекіткен жоспардан (prisma/menu-plan.ts), басқаларында еркін мәзір.
const PLAN: Partial<Record<FacilityKind, PlanDish[][]>> = { SCHOOL: SCHOOL_PLAN, KINDERGARTEN: KINDERGARTEN_PLAN };
const MENU: Record<"RESTAURANT" | "CAFE" | "CANTEEN", [string, DishCategory][]> = {
  RESTAURANT: [["Бешбармақ", "MAIN"], ["Қуырдақ", "MAIN"], ["Лағман", "MAIN"], ["Стейк", "MAIN"], ["Балық сорпасы", "SOUP"], ["Палау", "MAIN"]],
  CAFE: [["Бургер", "MAIN"], ["Лағман", "MAIN"], ["Самса", "MAIN"], ["Шашлық", "MAIN"], ["Цезарь салаты", "COLD"], ["Манты", "MAIN"]],
  CANTEEN: [["Сорпа", "SOUP"], ["Палау", "MAIN"], ["Манты", "MAIN"], ["Гарнирмен котлет", "MAIN"], ["Лағман", "MAIN"]],
};
// Беру температурасы нормада: сорпа мен ыстық сусын ≥75 °C, екінші тағам ≥65 °C.
const SERVE_RANGE: Record<DishCategory, [number, number] | null> = { SOUP: [76, 84], HOT_DRINK: [76, 82], MAIN: [66, 78], COLD: null };

// Асхана қызметкерлері: аты-жөні сақталмайды, тек лауазымы мен бас әріптері.
const STAFF_ROLES = ["Бас аспаз", "Аспаз", "Аспаз көмекшісі"];
const INITIALS = "АБГДЕЖЗКЛМНОРСТШ";
const CAPACITY: Record<FacilityKind, [number, number]> = {
  SCHOOL: [400, 1200],
  KINDERGARTEN: [80, 280],
  RESTAURANT: [40, 160],
  CAFE: [20, 80],
  CANTEEN: [60, 200],
};

// Детерминирленген кездейсоқ сандар: seed әр жолы бірдей нысандар мен координаттар береді.
let rngState = 20260926;
function rng() {
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rand = (min: number, max: number) => rng() * (max - min) + min;
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d;
}

async function insertChunked<T>(label: string, rows: T[], insert: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += 5000) await insert(rows.slice(i, i + 5000));
  console.log(`  ${label}: ${rows.length}`);
}

// Бір TRUNCATE ... CASCADE: атомарлы әрі жылдам. Кезекпен deleteMany жасағанда қосулы тұрған сайт
// (мысалы, after() ішіндегі тәуекел есептеу) арада жаңа жазба қосып, FK қатесіне әкелетін.
async function clearAll() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE "Prescription", "Inspection", "Alert", "RiskSnapshot", "ParentFeedback", "SymptomReport", "KitchenLog",
      "MenuItem", "MenuPlanItem", "Delivery", "Batch", "Supplier", "CaptureToken", "DeviceReading", "Device",
      "StaffCheck", "Staff", "User", "School", "District" CASCADE`,
  );
}

function shuffled<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

type Located = FacilityJson & { mkr: string };

/** 2GIS-те мекенжайы жоқ нысанға (мысалы, №31 мектеп) шағын аудан ең жақын белгілі нысаннан алынады. */
function nearestMkr(f: FacilityJson, known: Located[]) {
  const d2 = (k: Located) => (k.lat - f.lat) ** 2 + ((k.lng - f.lng) * Math.cos((f.lat * Math.PI) / 180)) ** 2;
  return known.reduce((best, k) => (d2(k) < d2(best) ? k : best)).mkr;
}

/** Әр түрден нысандарды таңдайды: алдымен сценарий нысандары, қалғаны әр шағын аудан кезекпен. */
function pickEstablishments(all: FacilityJson[]) {
  const picked: { code: string; kind: FacilityKind; name?: string; mkr: string; lat: number; lng: number; scenario: Scenario; training: boolean }[] = [];
  const located: Located[] = all.map((f) => ({ ...f, mkr: microdistrict(f.address)?.replace(/-мкр$/, "") ?? "" }));
  const numbered = located.filter((f) => /^\d/.test(f.mkr));
  for (const kind of Object.keys(CODES) as FacilityKind[]) {
    // Мектептер — барлық мемлекеттік мектеп (Шыгыс-1, промзона, Умирзак та), басқалары — нөмірлі шағын аудандардан.
    const pool: Located[] = (
      kind === "SCHOOL"
        ? located.filter(isStateSchool).map((f) => ({ ...f, mkr: f.mkr || nearestMkr(f, numbered) }))
        : located.filter((f) => f.kind === kind && /^\d/.test(f.mkr))
    ).sort((a, b) => a.dgisId.localeCompare(b.dgisId));
    const used = new Set<string>();
    const codes = CODES[kind];
    const assigned = new Map<string, Located>();

    for (const code of codes.filter((c) => FIXED[c])) {
      const want = FIXED[code].mkr;
      const hit = want.map((m) => pool.find((f) => f.mkr === m && !used.has(f.dgisId))).find(Boolean);
      if (!hit) throw new Error(`${code}: ${want.join("/")}-мкр ішінде ${kind} табылмады`);
      used.add(hit.dgisId);
      assigned.set(code, hit);
    }

    // Қалған кодтар: шағын аудандар араласқан ретпен кезекпен, нысандар бір жерге жиналып қалмас үшін.
    const queues = shuffled(Array.from(new Set(pool.map((f) => f.mkr)))).map((m) =>
      pool.filter((f) => f.mkr === m && !used.has(f.dgisId)),
    );
    const rest = codes.filter((c) => !assigned.has(c));
    for (let i = 0; rest.length > 0; i = (i + 1) % queues.length) {
      if (queues.every((q) => q.length === 0)) throw new Error(`${kind}: нысан жетпеді`);
      const f = queues[i].shift();
      if (f) assigned.set(rest.shift()!, f);
    }

    for (const code of codes) {
      const f = assigned.get(code)!;
      picked.push({
        code,
        kind,
        name: kind === "SCHOOL" ? cipherSchoolName(f.name) : undefined,
        mkr: f.mkr,
        lat: f.lat,
        lng: f.lng,
        scenario: FIXED[code]?.scenario ?? EXTRA_SCENARIO[code] ?? "green",
        training: !!FIXED[code]?.training,
      });
    }
  }
  return picked;
}

async function main() {
  const dataFile = "prisma/data/facilities.json";
  if (!existsSync(dataFile)) throw new Error(`${dataFile} жоқ. Алдымен: node --env-file=.env scripts/fetch-2gis.mjs`);
  const password = process.env.SEED_PASSWORD;
  if (!password) throw new Error("SEED_PASSWORD .env ішінде жоқ");

  const real = JSON.parse(readFileSync(dataFile, "utf8")) as FacilityJson[];
  const names = fictionalNames(real);
  const facilities = pickEstablishments(real).map((f) => ({
    ...f,
    name: f.name ?? names.get(f.code)!,
    id: randomUUID(),
  }));
  const byCode = new Map(facilities.map((f) => [f.code, f]));
  console.log(`Нысандар: ${facilities.length}`);

  console.log("Тазалау...");
  await clearAll();

  // "14" → "14-мкр"; нөмірсіз аймақтар ("Шыгыс-1", "Промзона 5", "Умирзак") сол қалпында.
  const place = (mkr: string) => (/^\d/.test(mkr) ? `${mkr}-мкр` : mkr);
  const order = (m: string) => parseInt(m) || 1000;
  const mkrs = Array.from(new Set(facilities.map((f) => f.mkr))).sort((a, b) => order(a) - order(b) || a.localeCompare(b));
  const districtIds = new Map(mkrs.map((m) => [m, randomUUID()]));
  await prisma.district.createMany({ data: mkrs.map((m) => ({ id: districtIds.get(m)!, name: place(m) })) });

  const inspection = (sc: Scenario): { at: Date | null; result: string } => {
    switch (sc) {
      case "yellowPhoto":
        return { at: null, result: "" };
      case "training":
        return { at: daysAgo(112), result: "Ескертулермен: ыдыс жуу аймағы" };
      case "greenInspected":
        return { at: daysAgo(5), result: "Бұзушылық анықталмады" };
      case "yellowOverdue":
        return { at: daysAgo(41), result: "Бұзушылықтар анықталды: тоңазытқыш" };
      case "green":
        return { at: daysAgo(randInt(20, 150)), result: "Бұзушылық жоқ" };
      default:
        return { at: daysAgo(randInt(190, 230)), result: "Ескертулермен" };
    }
  };
  const inspections = new Map(facilities.map((f) => [f.id, inspection(f.scenario)]));

  console.log("Нысандар, жеткізушілер, партиялар...");
  await prisma.school.createMany({
    data: facilities.map((f) => ({
      id: f.id,
      code: f.code,
      kind: f.kind,
      name: f.name,
      address: `Ақтау, ${place(f.mkr)}`,
      lat: f.lat,
      lng: f.lng,
      studentsCount: randInt(...CAPACITY[f.kind]),
      districtId: districtIds.get(f.mkr)!,
      isTraining: f.training,
      parentToken: randomUUID(),
      lastInspectionAt: inspections.get(f.id)!.at,
    })),
  });

  // Жеткізушілер шартты атаулармен (нақты компанияларды айыптамау үшін). Д-ның сертификаты 8 күннен кейін бітеді.
  const supplierDefs = [
    { name: "Жеткізуші А", bin: "180540011122", certDays: 300, prefix: "Н-10", products: ["Нан", "Ұн"] },
    { name: "Жеткізуші Б", bin: "150240033344", certDays: 210, prefix: "К-24", products: ["Сиыр еті", "Тауық еті", "Шұжық"] },
    { name: "Жеткізуші В", bin: "170740055566", certDays: 400, prefix: "С-30", products: ["Сүт", "Айран"] },
    { name: "Жеткізуші Г", bin: "190940077788", certDays: 150, prefix: "Ж-50", products: ["Картоп", "Пияз", "Алма"] },
    { name: "Жеткізуші Д", bin: "160340099900", certDays: 8, prefix: "С-31", products: ["Ірімшік", "Қаймақ"] },
    { name: "Жеткізуші Е", bin: "200140012121", certDays: 260, prefix: "Б-08", products: ["Каспий балығы"] },
  ];
  const suppliers = supplierDefs.map((s) => ({ ...s, id: randomUUID() }));
  await prisma.supplier.createMany({
    data: suppliers.map((s) => ({ id: s.id, name: s.name, bin: s.bin, certificateValidUntil: daysAgo(-s.certDays) })),
  });

  const batches: Prisma.BatchCreateManyInput[] = [];
  for (const s of suppliers) {
    for (let i = 0; i < 6; i++) {
      const producedAt = daysAgo(randInt(1, 18));
      const expiresAt = new Date(producedAt);
      expiresAt.setDate(expiresAt.getDate() + randInt(5, 25));
      batches.push({
        id: randomUUID(),
        code: `${s.prefix}${20 + i * 11}`,
        product: s.products[i % s.products.length],
        producedAt,
        expiresAt,
        supplierId: s.id,
      });
    }
  }
  // Сценарийдің ет партиясы: К-2417 (Жеткізуші Б) бүгін А-12, А-05, А-19 мектептеріне және М-07 мейрамханасына.
  const sharedBatch: Prisma.BatchCreateManyInput = {
    id: randomUUID(),
    code: "К-2417",
    product: "Сиыр еті",
    producedAt: daysAgo(2),
    expiresAt: daysAgo(-5),
    supplierId: suppliers[1].id,
  };
  batches.push(sharedBatch);
  await prisma.batch.createMany({ data: batches });
  const otherBatches = batches.filter((b) => b.id !== sharedBatch.id);
  // Ереже мысалы: А-22-ге бүгін шұжық партиясы келді, ол сиыр етінің орнына тағамға байланады.
  const sausageBatch = otherBatches.find((b) => b.product === "Шұжық")!;

  const deliveries: Prisma.DeliveryCreateManyInput[] = ["А-12", "А-05", "А-19", "М-07"].map((code) => ({
    batchId: sharedBatch.id!,
    schoolId: byCode.get(code)!.id,
    deliveredAt: daysAgo(0),
  }));
  deliveries.push({ batchId: sausageBatch.id!, schoolId: byCode.get("А-22")!.id, deliveredAt: daysAgo(0) });
  for (const f of facilities) {
    const count = randInt(2, 4);
    for (let i = 0; i < count; i++) {
      deliveries.push({ batchId: otherBatches[randInt(0, otherBatches.length - 1)].id!, schoolId: f.id, deliveredAt: daysAgo(randInt(1, 13)) });
    }
  }
  await insertChunked("жеткізулер", deliveries, (c) => prisma.delivery.createMany({ data: c }));

  console.log("Екі апталық мәзір жоспары (СЭС бекіткен)...");
  const planRows = (Object.entries(PLAN) as [FacilityKind, PlanDish[][]][]).flatMap(([kind, days]) =>
    days.flatMap((dishes, i) =>
      dishes.map((d) => ({
        id: randomUUID(),
        kind,
        day: i + 1,
        name: d.name,
        category: d.category,
        portionG: d.portionG,
        mainIngredient: d.main,
        composition: d.composition,
        approvedAt: daysAgo(20),
      })),
    ),
  );
  await prisma.menuPlanItem.createMany({ data: planRows });
  const planFor = (kind: FacilityKind, date: Date) => planRows.filter((p) => p.kind === kind && p.day === planDay(date));
  // Тағамның негізгі өніміне сай партия (техкарта бойынша); сайы болмаса — партиясыз.
  const batchFor = (product: string) => {
    const matching = otherBatches.filter((b) => ingredientMatches(product, b.product));
    return matching.length ? matching[randInt(0, matching.length - 1)].id! : null;
  };

  console.log("30 күндік ас үй журналы мен бағалар...");
  const menuItems: Prisma.MenuItemCreateManyInput[] = [];
  const logs: Prisma.KitchenLogCreateManyInput[] = [];
  const feedback: Prisma.ParentFeedbackCreateManyInput[] = [];
  const ruleAlerts: Prisma.AlertCreateManyInput[] = [];
  type SeedDish = { name: string; category: DishCategory; portionG: number; planItemId: string | null; main: string | null; offPlan?: string };

  for (const f of facilities) {
    const sc = f.scenario;
    let tempViolationsLeft = { yellowTemp: 99, yellowOverdue: 5, yellowRating: 2, yellowPhoto: 0, training: 2, green: 0, greenInspected: 0 }[sc];

    for (let day = 29; day >= 0; day--) {
      // А-12-нің бүгінгі журналын оқу-жаттығу режимінің 1-қадамы өзі толтырады.
      if (sc === "training" && day === 0) continue;
      const date = daysAgo(day);
      const free = MENU[f.kind as keyof typeof MENU];
      const dishes: SeedDish[] = PLAN[f.kind]
        ? planFor(f.kind, date).map((p) => ({ name: p.name, category: p.category, portionG: p.portionG, planItemId: p.id, main: p.mainIngredient }))
        : Array.from({ length: randInt(1, 2) }, () => {
            const [name, category] = free[randInt(0, free.length - 1)];
            return { name, category, portionG: randInt(200, 350), planItemId: null, main: null };
          });
      const rule = RULE_SCENARIO[f.code];
      if (rule === "OFF_PLAN" && day === 0) {
        dishes.push({ name: "Макаронмен шұжық", category: "MAIN", portionG: 200, planItemId: null, main: null, offPlan: "Сиыр еті уақытында жеткізілмеді" });
      }

      dishes.forEach((d, ix) => {
        const menuItemId = randomUUID();
        const sausage = rule === "INGREDIENT" && day === 0 && d.category === "MAIN" && d.main;
        menuItems.push({
          id: menuItemId,
          schoolId: f.id,
          date,
          name: d.name,
          category: d.category,
          standardPortionG: d.portionG,
          planItemId: d.planItemId,
          offPlanReason: d.offPlan ?? null,
          batchId: sausage ? sausageBatch.id : d.offPlan ? null : d.main ? batchFor(d.main) : otherBatches[randInt(0, otherBatches.length - 1)].id,
        });
        if (sausage) {
          ruleAlerts.push({
            schoolId: f.id,
            level: "YELLOW",
            rule: "INGREDIENT",
            reason: `«${d.name}»: техкартада «${d.main}», ал партияда «Шұжық» (${sausageBatch.code})`,
            details: { key: menuItemId, menuItemId, dish: d.name, expected: d.main, actual: "Шұжық", batchCode: sausageBatch.code },
          });
        }
        if (d.offPlan) {
          ruleAlerts.push({
            schoolId: f.id,
            level: "YELLOW",
            rule: "OFF_PLAN",
            reason: `Жоспардан тыс тағам: «${d.name}» — ${d.offPlan}`,
            details: { key: menuItemId, menuItemId, dish: d.name, note: d.offPlan },
          });
        }

        const skipPhoto = (sc === "yellowPhoto" && day < 3) || (sc === "training" && day === 1);
        if (!skipPhoto) {
          logs.push({ schoolId: f.id, menuItemId, type: "PHOTO", photoUrl: "https://placehold.co/400x300?text=Portion", createdAt: date, createdById: "seed" });
        }
        // Тоңазытқыш күніне бір рет (бірінші тағамның жазбасында), беру температурасы әр ыстық тағамға.
        if (ix === 0) {
          const violate = day < 14 && tempViolationsLeft > 0 && (sc === "yellowTemp" ? day % 2 === 0 : day % 3 === 0);
          if (violate) tempViolationsLeft -= 1;
          const fridge = violate ? Number(rand(8, 11).toFixed(1)) : Number(rand(2.5, 5.5).toFixed(1));
          logs.push({ schoolId: f.id, menuItemId, type: "FRIDGE_TEMP", valueC: fridge, isViolation: violate, createdAt: date, createdById: "seed" });
        }
        const serve = SERVE_RANGE[d.category];
        if (serve) {
          logs.push({ schoolId: f.id, menuItemId, type: "HOT_TEMP", valueC: Number(rand(...serve).toFixed(1)), isViolation: false, createdAt: date, createdById: "seed" });
        }
        // Қайтарылған табақтар (жеу индексі): соңғы аптада екінші тағамға, ИИ бағасы қалыпты.
        if (PLAN[f.kind] && d.category === "MAIN" && day >= 1 && day <= 7) {
          const lowEat = rule === "EATABILITY" && day === 1;
          if (lowEat) {
            ruleAlerts.push({
              schoolId: f.id,
              level: "YELLOW",
              rule: "EATABILITY",
              reason: `«${d.name}»: жеу индексі 32% — балалар тағамның көбін жемеген, дайындау технологиясын тексеру ұсынылады`,
              details: { key: menuItemId, menuItemId, dish: d.name, eatPct: 32 },
              createdAt: new Date(date.getTime() + 2 * 3600_000),
            });
          }
          logs.push({
            schoolId: f.id,
            menuItemId,
            type: "WASTE",
            photoUrl: "https://placehold.co/400x300?text=Trays",
            aiStatus: "OK",
            aiWastePct: lowEat ? 68 : randInt(6, 28),
            aiSummary: lowEat ? "Табақтардың көбінде тағам түгел дерлік қалған." : "Табақтардың көбі бос, қалдық аз.",
            aiModel: "seed",
            aiCheckedAt: date,
            createdAt: date,
            createdById: "seed",
          });
        }
      });

      const lowRatings = sc === "yellowRating" || sc === "yellowPhoto";
      if (lowRatings && day < 14) {
        // Төмен бағалар және соңғы 3 күнде шағымдар жарылысы.
        for (let k = 0; k < (day < 3 ? 3 : 1); k++) {
          feedback.push({ schoolId: f.id, rating: randInt(1, 2), comment: "Тамақ суық, порция аз", createdAt: date });
        }
      } else if (day % 3 === 0) {
        const rating = sc === "yellowTemp" || sc === "yellowOverdue" ? 3 : sc === "training" ? randInt(3, 4) : randInt(4, 5);
        feedback.push({ schoolId: f.id, rating, comment: null, createdAt: date });
      }
    }
  }
  await insertChunked("мәзір", menuItems, (c) => prisma.menuItem.createMany({ data: c }));
  await insertChunked("ас үй журналы", logs, (c) => prisma.kitchenLog.createMany({ data: c }));
  await insertChunked("бағалар", feedback, (c) => prisma.parentFeedback.createMany({ data: c }));
  await insertChunked("ереже алерттері", ruleAlerts, (c) => prisma.alert.createMany({ data: c }));

  console.log("Смена алдындағы тексеру мен құрылғылар...");
  // Мектеп пен балабақшада үш қызметкер. Бүгін таңертең көбі форма тексеруінен өткен; оқу-жаттығу
  // нысандарында (А-12, №AD) тексеру қорғауда тірі көрсетіледі. Фото сақталмайды — тек нәтиже.
  const morning = new Date();
  morning.setHours(8, 0, 0, 0);
  const checkBase = Math.min(morning.getTime(), Date.now() - 90 * 60_000);
  const letter = () => INITIALS[randInt(0, INITIALS.length - 1)];
  const staffRows: Prisma.StaffCreateManyInput[] = [];
  const checkRows: Prisma.StaffCheckCreateManyInput[] = [];
  for (const f of facilities.filter((x) => PLAN[x.kind])) {
    STAFF_ROLES.forEach((role, i) => {
      const id = randomUUID();
      staffRows.push({ id, schoolId: f.id, label: `${role} · ${letter()}. ${letter()}.` });
      if (f.training) return;
      const issue = f.code === "А-27" && i === 2 ? "HEAD_UNCOVERED" : f.code === "Б-02" && i === 1 ? "NO_GLOVES" : null;
      const at = new Date(checkBase + (i * 6 + randInt(0, 4)) * 60_000);
      checkRows.push({
        staffId: id,
        schoolId: f.id,
        createdAt: at,
        aiStatus: issue ? "FLAGGED" : "OK",
        aiIssues: issue ? [issue] : [],
        aiSummary: issue === "HEAD_UNCOVERED" ? "Шаш бас киімнің астынан шығып тұр." : issue ? "Қолғап киілмеген." : "Бас киім, қолғап және алжапқыш бар.",
        aiModel: "seed",
        aiCheckedAt: at,
      });
    });
  }
  await prisma.staff.createMany({ data: staffRows });
  await prisma.staffCheck.createMany({ data: checkRows });

  // №AD асханасының тағам термометрі (датчик): кілт .env ішіндегі DEMO_DEVICE_KEY (құрылғының бағдарламасына да сол жазылады).
  // Кілт тұрақты болғандықтан, seed қайта жүргізілсе де құрылғы жұмысын жалғастырады.
  const devices: Prisma.DeviceCreateManyInput[] = [];
  const demoKey = process.env.DEMO_DEVICE_KEY?.trim();
  if (demoKey) {
    devices.push({ schoolId: byCode.get("А-14")!.id, kind: "PROBE", label: "Тағам термометрі", keyHash: hashDeviceKey(demoKey), keyHint: keyHint(demoKey) });
  } else {
    console.log("  DEMO_DEVICE_KEY жоқ: №AD термометрін /kitchen бетінен қосыңыз");
  }
  // А-12 ет тоңазытқышының датчигі (жаттығу сценарийі үшін): соңғы тәулік өлшемдері қалыпты, кілті ешкімге берілмейді.
  const fridgeKey = newDeviceKey();
  const fridgeId = randomUUID();
  const training = byCode.get("А-12")!;
  devices.push({ id: fridgeId, schoolId: training.id, kind: "FRIDGE", label: "Ет тоңазытқышы", keyHash: hashDeviceKey(fridgeKey), keyHint: keyHint(fridgeKey), lastSeenAt: new Date(), lastValue: 3.9 });
  await prisma.device.createMany({ data: devices });
  await prisma.deviceReading.createMany({
    data: Array.from({ length: 48 }, (_, i) => ({
      deviceId: fridgeId,
      schoolId: training.id,
      value: i === 47 ? 3.9 : Number(rand(3.1, 4.8).toFixed(1)),
      createdAt: new Date(Date.now() - (47 - i) * 30 * 60_000),
    })),
  });

  await prisma.inspection.createMany({
    data: facilities
      .filter((f) => inspections.get(f.id)!.at)
      .map((f) => {
        const { at, result } = inspections.get(f.id)!;
        return { schoolId: f.id, inspectorId: "seed", type: "MONITORING" as const, plannedAt: at!, doneAt: at!, result };
      }),
  });

  // yellowOverdue нысандарында мерзімі өтіп кеткен екі нұсқама.
  await prisma.prescription.createMany({
    data: facilities
      .filter((f) => f.scenario === "yellowOverdue")
      .flatMap((f) => [
        { schoolId: f.id, text: "Тоңазытқыштың термостатын ауыстырып, температура журналын күн сайын толтыру", dueAt: daysAgo(2) },
        { schoolId: f.id, text: "Ет өнімдерін бөлек сақтау сөресін орнату", dueAt: daysAgo(5) },
      ]),
  });

  console.log("Тәуекел тарихы (өткен 29 күн)...");
  const target: Record<Scenario, number> = { green: 5, greenInspected: 3, training: 26, yellowTemp: 43, yellowPhoto: 48, yellowRating: 45, yellowOverdue: 43 };
  const snapshots: Prisma.RiskSnapshotCreateManyInput[] = [];
  for (const f of facilities) {
    const end = target[f.scenario];
    for (let day = 29; day >= 1; day--) {
      const trend = end <= 5 ? end : 8 + ((29 - day) / 29) * (end - 8);
      const score = Math.max(0, Math.min(100, Math.round(trend + rand(-4, 4))));
      const level: RiskLevel = score >= 70 ? "RED" : score >= 40 ? "YELLOW" : "GREEN";
      snapshots.push({ schoolId: f.id, score, level, components: { seed: true }, computedAt: daysAgo(day) });
    }
  }
  await insertChunked("тәуекел снапшоттары", snapshots, (c) => prisma.riskSnapshot.createMany({ data: c }));

  console.log("Пайдаланушылар...");
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.createMany({
    data: [
      { login: "a12_kitchen", passwordHash, name: "Мектеп асханасы", role: "KITCHEN", schoolId: byCode.get("А-12")!.id },
      { login: "a12_nurse", passwordHash, name: "Мектеп медбикесі", role: "NURSE", schoolId: byCode.get("А-12")!.id },
      { login: "m07_kitchen", passwordHash, name: "Мейрамхана асханасы", role: "KITCHEN", schoolId: byCode.get("М-07")!.id },
      // №AD мектеп асханасы (№14 мектеп, 26-мкр): термометр-щуп демосы.
      { login: "ad_kitchen", passwordHash, name: "№AD мектеп асханасы", role: "KITCHEN", schoolId: byCode.get("А-14")!.id },
      { login: "ses1", passwordHash, name: "СЭС инспекторы", role: "SES", schoolId: null },
      { login: "edu1", passwordHash, name: "Білім бөлімі", role: "EDU", schoolId: null },
      { login: "admin", passwordHash, name: "Әкімші", role: "ADMIN", schoolId: null },
    ],
  });

  // Бүгінгі балды нақты тәуекел логикасы есептейді (cron есептейтінмен бірдей).
  console.log("Бүгінгі тәуекел (нақты логикамен, 4 параллель)...");
  // 4 параллель: ДБ алыс, әр есептеу бірнеше сұраныс жасайды, ал қосулы сайт та сол пулды қолданады.
  await mapLimit(facilities, 4, (f) => recomputeSchoolRisk(f.id));
  const summary = await prisma.school.groupBy({ by: ["riskLevel"], _count: true });
  console.log("  деңгейлер:", summary.map((s) => `${s.riskLevel}=${s._count}`).join(" "));
  const scenarioRows = await prisma.school.findMany({
    where: { code: { in: [...Object.keys(FIXED), ...Object.keys(EXTRA_SCENARIO), ...Object.keys(RULE_SCENARIO)] } },
    select: { code: true, name: true, address: true, riskScore: true, riskLevel: true },
    orderBy: { code: "asc" },
  });
  for (const r of scenarioRows) console.log(`  ${r.code} «${r.name}» (${r.address}): ${r.riskScore} ${r.riskLevel}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
