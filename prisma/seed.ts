import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { PrismaClient, type FacilityKind, type Prisma, type RiskLevel } from "@prisma/client";
import bcrypt from "bcryptjs";
import { recomputeSchoolRisk } from "../src/lib/risk/score";
import { mapLimit } from "../src/lib/concurrency";
import { microdistrict } from "../src/lib/format";

const prisma = new PrismaClient();

/*
 * Ақтау қаласының 60 тамақтану нысаны.
 *
 * Орналасуы шынайы: нысандар 2GIS-тегі нақты мектептер, балабақшалар, мейрамханалар, кафелер мен
 * асханалар тұрған шағын аудандардан алынады (scripts/fetch-2gis.mjs → prisma/data/facilities.json).
 * Бірақ сценарийдегі бұзушылықтар мен «улану» ойдан шығарылған, сондықтан нақты нысандарды
 * айыптамау үшін атаулары кодпен ауыстырылады (А-12, М-07…), мекенжайы шағын аудан деңгейінде
 * қалады, координаттары ~100 м-ге ығыстырылады.
 */

type FacilityJson = { dgisId: string; kind: FacilityKind; name: string; address: string; lat: number; lng: number };

type Scenario = "green" | "greenInspected" | "training" | "yellowTemp" | "yellowPhoto" | "yellowRating" | "yellowOverdue";

const KIND_NAME: Record<FacilityKind, string> = {
  SCHOOL: "Мектеп асханасы",
  KINDERGARTEN: "Балабақша",
  RESTAURANT: "Мейрамхана",
  CAFE: "Кафе",
  CANTEEN: "Қоғамдық асхана",
};

// Код префиксі мен нөмірлері (CLAUDE.md §10: 24 мектеп, 10 балабақша, 18 мейрамхана/кафе, 8 асхана).
const CODES: Record<FacilityKind, string[]> = {
  SCHOOL: Array.from({ length: 24 }, (_, i) => `А-${String(i + 1).padStart(2, "0")}`),
  KINDERGARTEN: [...Array.from({ length: 9 }, (_, i) => `Б-0${i + 1}`), "Б-11"],
  RESTAURANT: Array.from({ length: 9 }, (_, i) => `М-0${i + 1}`),
  CAFE: Array.from({ length: 9 }, (_, i) => `К-${String(i + 6).padStart(2, "0")}`),
  CANTEEN: Array.from({ length: 8 }, (_, i) => `Ас-0${i + 1}`),
};

// Сценарий нысандары: код → қай шағын аудандағы нысан алынады (бірінші табылғаны) және рөлі.
const FIXED: Record<string, { mkr: string[]; scenario: Scenario; training?: boolean }> = {
  "А-12": { mkr: ["14"], scenario: "training", training: true },
  "А-05": { mkr: ["7"], scenario: "green" },
  "А-19": { mkr: ["5"], scenario: "green" },
  "М-07": { mkr: ["11"], scenario: "green" },
  "М-03": { mkr: ["4"], scenario: "greenInspected" },
  "К-14": { mkr: ["15"], scenario: "yellowPhoto", training: true },
  "Ас-03": { mkr: ["27"], scenario: "yellowOverdue" },
  "Б-11": { mkr: ["32", "32Б", "31", "33", "29"], scenario: "yellowTemp" },
};
// Басқа сары нысандар (бастапқы күй: 9 сары, қызыл жоқ — қызылды /training тудырады).
const EXTRA_SCENARIO: Record<string, Scenario> = {
  "А-08": "yellowRating",
  "М-02": "yellowPhoto",
  "М-05": "yellowTemp",
  "К-09": "yellowRating",
  "Ас-01": "yellowPhoto",
  "Ас-06": "yellowTemp",
};

const MENU: Record<FacilityKind, string[]> = {
  SCHOOL: ["Көже", "Ет тұшпара", "Палау", "Балық котлеті", "Макарон бефстроганов", "Сорпа"],
  KINDERGARTEN: ["Сүт ботқасы", "Тауық сорпасы", "Картоп пюресі", "Бу котлеті", "Жеміс компоты"],
  RESTAURANT: ["Бешбармақ", "Қуырдақ", "Лағман", "Стейк", "Балық сорпасы", "Палау"],
  CAFE: ["Бургер", "Лағман", "Самса", "Шашлық", "Цезарь салаты", "Манты"],
  CANTEEN: ["Сорпа", "Палау", "Манты", "Котлет гарнирмен", "Лағман"],
};
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

async function clearAll() {
  await prisma.prescription.deleteMany();
  await prisma.inspection.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.riskSnapshot.deleteMany();
  await prisma.parentFeedback.deleteMany();
  await prisma.symptomReport.deleteMany();
  await prisma.kitchenLog.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.user.deleteMany();
  await prisma.school.deleteMany();
  await prisma.district.deleteMany();
}

function shuffled<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Әр түрден нысандарды таңдайды: алдымен сценарий нысандары, қалғаны әр шағын аудан кезекпен. */
function pickEstablishments(all: FacilityJson[]) {
  const picked: { code: string; kind: FacilityKind; mkr: string; lat: number; lng: number; scenario: Scenario; training: boolean }[] = [];
  for (const kind of Object.keys(CODES) as FacilityKind[]) {
    type Candidate = FacilityJson & { mkr: string };
    const pool: Candidate[] = all
      .map((f) => ({ ...f, mkr: microdistrict(f.address)?.replace(/-мкр$/, "") ?? "" }))
      .filter((f) => f.kind === kind && /^\d/.test(f.mkr))
      .sort((a, b) => a.dgisId.localeCompare(b.dgisId));
    const used = new Set<string>();
    const codes = CODES[kind];
    const assigned = new Map<string, Candidate>();

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
        mkr: f.mkr,
        // ~100 м ығысу: нақты ғимаратты көрсетпеу үшін.
        lat: f.lat + rand(-0.0011, 0.0011),
        lng: f.lng + rand(-0.0014, 0.0014),
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

  const facilities = pickEstablishments(JSON.parse(readFileSync(dataFile, "utf8")) as FacilityJson[]).map((f) => ({
    ...f,
    id: randomUUID(),
  }));
  const byCode = new Map(facilities.map((f) => [f.code, f]));
  console.log(`Нысандар: ${facilities.length}`);

  console.log("Тазалау...");
  await clearAll();

  const mkrs = Array.from(new Set(facilities.map((f) => f.mkr))).sort((a, b) => parseInt(a) - parseInt(b));
  const districtIds = new Map(mkrs.map((m) => [m, randomUUID()]));
  await prisma.district.createMany({ data: mkrs.map((m) => ({ id: districtIds.get(m)!, name: `${m}-мкр` })) });

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
      name: `${KIND_NAME[f.kind]} ${f.code}`,
      address: `Ақтау, ${f.mkr}-мкр`,
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
    { name: "Жеткізуші Б", bin: "150240033344", certDays: 210, prefix: "К-24", products: ["Сиыр еті", "Тауық еті"] },
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

  const deliveries: Prisma.DeliveryCreateManyInput[] = ["А-12", "А-05", "А-19", "М-07"].map((code) => ({
    batchId: sharedBatch.id!,
    schoolId: byCode.get(code)!.id,
    deliveredAt: daysAgo(0),
  }));
  for (const f of facilities) {
    const count = randInt(2, 4);
    for (let i = 0; i < count; i++) {
      deliveries.push({ batchId: otherBatches[randInt(0, otherBatches.length - 1)].id!, schoolId: f.id, deliveredAt: daysAgo(randInt(1, 13)) });
    }
  }
  await insertChunked("жеткізулер", deliveries, (c) => prisma.delivery.createMany({ data: c }));

  console.log("30 күндік ас үй журналы мен бағалар...");
  const menuItems: Prisma.MenuItemCreateManyInput[] = [];
  const logs: Prisma.KitchenLogCreateManyInput[] = [];
  const feedback: Prisma.ParentFeedbackCreateManyInput[] = [];

  for (const f of facilities) {
    const sc = f.scenario;
    let tempViolationsLeft = { yellowTemp: 99, yellowOverdue: 5, yellowRating: 2, yellowPhoto: 0, training: 2, green: 0, greenInspected: 0 }[sc];

    for (let day = 29; day >= 0; day--) {
      // А-12-нің бүгінгі журналын оқу-жаттығу режимінің 1-қадамы өзі толтырады.
      if (sc === "training" && day === 0) continue;
      const date = daysAgo(day);
      const itemsToday = randInt(1, 2);

      for (let ix = 0; ix < itemsToday; ix++) {
        const menuItemId = randomUUID();
        menuItems.push({
          id: menuItemId,
          schoolId: f.id,
          date,
          name: MENU[f.kind][randInt(0, MENU[f.kind].length - 1)],
          standardPortionG: randInt(150, 350),
          batchId: otherBatches[randInt(0, otherBatches.length - 1)].id,
        });

        const skipPhoto = (sc === "yellowPhoto" && day < 3) || (sc === "training" && day === 1);
        if (!skipPhoto) {
          logs.push({ schoolId: f.id, menuItemId, type: "PHOTO", photoUrl: "https://placehold.co/400x300?text=Portion", createdAt: date, createdById: "seed" });
        }
        const violate = day < 14 && tempViolationsLeft > 0 && (sc === "yellowTemp" ? day % 2 === 0 : ix === 0 && day % 3 === 0);
        if (violate) tempViolationsLeft -= 1;
        const fridge = violate ? Number(rand(8, 11).toFixed(1)) : Number(rand(2.5, 5.5).toFixed(1));
        logs.push({ schoolId: f.id, menuItemId, type: "FRIDGE_TEMP", valueC: fridge, isViolation: violate, createdAt: date, createdById: "seed" });
        logs.push({ schoolId: f.id, menuItemId, type: "HOT_TEMP", valueC: Number(rand(68, 82).toFixed(1)), isViolation: false, createdAt: date, createdById: "seed" });
      }

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

  await prisma.inspection.createMany({
    data: facilities
      .filter((f) => inspections.get(f.id)!.at)
      .map((f) => {
        const { at, result } = inspections.get(f.id)!;
        return { schoolId: f.id, inspectorId: "seed", type: "MONITORING" as const, plannedAt: at!, doneAt: at!, result };
      }),
  });

  // Ас-03: мерзімі өтіп кеткен екі нұсқама.
  await prisma.prescription.createMany({
    data: [
      { schoolId: byCode.get("Ас-03")!.id, text: "Тоңазытқыштың термостатын ауыстырып, температура журналын күн сайын толтыру", dueAt: daysAgo(2) },
      { schoolId: byCode.get("Ас-03")!.id, text: "Ет өнімдерін бөлек сақтау сөресін орнату", dueAt: daysAgo(5) },
    ],
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
      { login: "a12_kitchen", passwordHash, name: "А-12 ас үйі", role: "KITCHEN", schoolId: byCode.get("А-12")!.id },
      { login: "a12_nurse", passwordHash, name: "А-12 медбикесі", role: "NURSE", schoolId: byCode.get("А-12")!.id },
      { login: "m07_kitchen", passwordHash, name: "М-07 ас үйі", role: "KITCHEN", schoolId: byCode.get("М-07")!.id },
      { login: "ses1", passwordHash, name: "СЭС инспекторы", role: "SES", schoolId: null },
      { login: "edu1", passwordHash, name: "Білім бөлімі", role: "EDU", schoolId: null },
      { login: "admin", passwordHash, name: "Әкімші", role: "ADMIN", schoolId: null },
    ],
  });

  // Бүгінгі балды нақты тәуекел логикасы есептейді (cron есептейтінмен бірдей).
  console.log("Бүгінгі тәуекел (нақты логикамен, 10 параллель)...");
  await mapLimit(facilities, 10, (f) => recomputeSchoolRisk(f.id));
  const summary = await prisma.school.groupBy({ by: ["riskLevel"], _count: true });
  console.log("  деңгейлер:", summary.map((s) => `${s.riskLevel}=${s._count}`).join(" "));
  const scenarioRows = await prisma.school.findMany({
    where: { code: { in: [...Object.keys(FIXED), ...Object.keys(EXTRA_SCENARIO)] } },
    select: { code: true, address: true, riskScore: true, riskLevel: true },
    orderBy: { code: "asc" },
  });
  for (const r of scenarioRows) console.log(`  ${r.code} (${r.address}): ${r.riskScore} ${r.riskLevel}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
