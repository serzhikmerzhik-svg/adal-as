import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { PrismaClient, type FacilityKind, type Prisma, type RiskLevel } from "@prisma/client";
import bcrypt from "bcryptjs";
import { recomputeSchoolRisk } from "../src/lib/risk/score";

const prisma = new PrismaClient();

// Нысандар (асханалар, мектептер, балабақшалар) — 2GIS Catalog API-ден алынған нақты тізім
// (scripts/fetch-2gis.mjs → prisma/data/facilities.json). Асхана журналы, бағалар, партиялар
// мен тәуекел тарихы — демо үшін жасалған деректер.
//
// Жолдар createMany арқылы үлкен топтармен жазылады: Supabase-ке әр сұраныс желі арқылы жүреді.

type FacilityJson = {
  dgisId: string;
  kind: FacilityKind;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rubric: string;
  district: string;
};

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d;
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number) {
  return Math.floor(rand(min, max + 1));
}

async function insertChunked<T>(label: string, rows: T[], insert: (chunk: T[]) => Promise<unknown>) {
  const size = 5000;
  for (let i = 0; i < rows.length; i += size) {
    await insert(rows.slice(i, i + size));
  }
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

// Әр нысанның деректері осы сценарийге сай әдейі құрылады, сондықтан нақты тәуекел
// логикасы оларды күтілген деңгейге шығарады (жасыл = 0, демо ≈ 25–33, сарылар ≈ 43–45).
type Scenario = "green" | "demo" | "yellowTemp" | "yellowPhoto" | "yellowRating";

const HISTORY_DAYS = { green: 14, scenario: 30 }; // тәуекел терезелері ≤ 14 күн
const MENU = {
  SCHOOL: ["Көже", "Ет тұшпара", "Палау", "Балық котлеті", "Макарон бефстроганов", "Сорпа"],
  KINDERGARTEN: ["Сүт ботқасы", "Тауық сорпасы", "Картоп пюресі", "Бу котлеті", "Жеміс компоты"],
  CANTEEN: ["Бешбармақ", "Лағман", "Палау", "Манты", "Сорпа", "Котлет гарнирмен"],
};
const PEOPLE: Record<FacilityKind, [number, number]> = {
  SCHOOL: [300, 1200],
  KINDERGARTEN: [60, 280],
  CANTEEN: [80, 400],
};

async function main() {
  // 2GIS деректерін ашық репозиторийде қайта таратпау үшін бұл файл git-ке кірмейді.
  const dataFile = "prisma/data/facilities.json";
  if (!existsSync(dataFile)) {
    throw new Error(`${dataFile} жоқ. Алдымен іске қосыңыз: node --env-file=.env scripts/fetch-2gis.mjs`);
  }
  const facilitiesJson: FacilityJson[] = JSON.parse(readFileSync(dataFile, "utf8"));
  console.log(`2GIS нысандары: ${facilitiesJson.length}`);

  console.log("Тазалау...");
  await clearAll();

  const districtNames = [
    "Ақтау қ.",
    "Жаңаөзен қ.",
    "Мұнайлы ауданы",
    "Түпқараған ауданы",
    "Маңғыстау ауданы",
    "Бейнеу ауданы",
    "Қарақия ауданы",
  ];
  const districtIds = new Map(districtNames.map((name) => [name, randomUUID()]));
  await prisma.district.createMany({ data: districtNames.map((name) => ({ id: districtIds.get(name)!, name })) });

  const facilities = facilitiesJson.map((f) => ({ ...f, id: randomUUID() }));
  const inAktau = (kind: FacilityKind) => facilities.filter((f) => f.kind === kind && f.district === "Ақтау қ.");

  // Демо: Ақтаудағы нөмірлі мемлекеттік мектеп. Ортақ партия оған қоса бір балабақша мен
  // бір қоғамдық асханаға жеткізілген — партияны қадағалау мектептен тыс нысандарды да табады.
  // Демо-мектеп пен балабақша бір шағын ауданда (13-й м-н) — бір жеткізушінің маршруты.
  const pick = (kind: FacilityKind, name: string) =>
    inAktau(kind).find((f) => f.name.startsWith(name)) ?? inAktau(kind)[0];
  const demo = pick("SCHOOL", "Общеобразовательная средняя школа №17");
  const tracedKindergarten = pick("KINDERGARTEN", "Айналайын, детский сад №54");
  const tracedCanteen = pick("CANTEEN", "Береке, столовая");
  const yellowTemp = pick("CANTEEN", "Асия, столовая");
  const yellowPhoto = inAktau("KINDERGARTEN").filter((f) => f.rubric === "Детские сады")[3];
  const yellowRating = facilities.find((f) => f.kind === "SCHOOL" && f.district === "Жаңаөзен қ.")!;

  const scenario = new Map<string, Scenario>(facilities.map((f) => [f.id, "green" as Scenario]));
  scenario.set(demo.id, "demo");
  scenario.set(yellowTemp.id, "yellowTemp");
  scenario.set(yellowPhoto.id, "yellowPhoto");
  scenario.set(yellowRating.id, "yellowRating");

  const inspectionDates = new Map<string, Date | null>();
  for (const f of facilities) {
    const sc = scenario.get(f.id)!;
    inspectionDates.set(f.id, sc === "yellowPhoto" ? null : sc === "green" ? daysAgo(randInt(20, 60)) : daysAgo(200));
  }

  console.log("Нысандар, жеткізушілер, партиялар...");
  await insertChunked("нысандар", facilities, (chunk) =>
    prisma.school.createMany({
      data: chunk.map((f) => ({
        id: f.id,
        kind: f.kind,
        dgisId: f.dgisId,
        rubric: f.rubric,
        name: f.name,
        address: f.address,
        lat: f.lat,
        lng: f.lng,
        studentsCount: randInt(...PEOPLE[f.kind]),
        districtId: districtIds.get(f.district)!,
        isDemo: f.id === demo.id,
        parentToken: randomUUID(),
        lastInspectionAt: inspectionDates.get(f.id),
      })),
    }),
  );

  const suppliers = [
    { name: 'ЖШС "Маңғыстау Азық-Түлік"', bin: "010140012345", certDays: 400 },
    { name: 'ЖШС "Каспий Нан"', bin: "020240067890", certDays: 250 },
    { name: 'ЖК "Аймана Тағам"', bin: "030340011122", certDays: 10 },
    { name: 'ЖШС "Батыс Азық"', bin: "040440033344", certDays: 180 },
    { name: 'ЖШС "Ақтау Даму Азық-Түлік"', bin: "050540055566", certDays: 320 },
  ].map((s) => ({ id: randomUUID(), name: s.name, bin: s.bin, certificateValidUntil: daysAgo(-s.certDays) }));
  await prisma.supplier.createMany({ data: suppliers });

  const products = ["Сиыр еті котлеті", "Тауық еті", "Картоп", "Сүт", "Нан", "Күріш", "Жұмыртқа", "Пияз"];
  const batches = Array.from({ length: 40 }, (_, i) => {
    const producedAt = daysAgo(randInt(1, 20));
    const expiresAt = new Date(producedAt);
    expiresAt.setDate(expiresAt.getDate() + randInt(5, 30));
    return {
      id: randomUUID(),
      code: `B-${2000 + i}`,
      product: products[i % products.length],
      producedAt,
      expiresAt,
      supplierId: suppliers[i % suppliers.length].id,
    };
  });
  await prisma.batch.createMany({ data: batches });

  // Ортақ котлета партиясы (B-2000) бүгін демо-мектепке, балабақшаға және асханаға жеткізілген.
  const sharedBatch = batches[0];
  const deliveries: Prisma.DeliveryCreateManyInput[] = [demo, tracedKindergarten, tracedCanteen].map((f) => ({
    batchId: sharedBatch.id,
    schoolId: f.id,
    deliveredAt: daysAgo(0),
  }));
  for (const f of facilities) {
    const count = randInt(2, 4);
    for (let i = 0; i < count; i++) {
      deliveries.push({ batchId: batches[randInt(1, batches.length - 1)].id, schoolId: f.id, deliveredAt: daysAgo(randInt(1, 13)) });
    }
  }
  await insertChunked("жеткізулер", deliveries, (c) => prisma.delivery.createMany({ data: c }));

  console.log("Асхана журналы мен бағалар...");
  const menuItems: Prisma.MenuItemCreateManyInput[] = [];
  const logs: Prisma.KitchenLogCreateManyInput[] = [];
  const feedback: Prisma.ParentFeedbackCreateManyInput[] = [];

  for (const f of facilities) {
    const sc = scenario.get(f.id)!;
    const menuNames = MENU[f.kind];
    const days = sc === "green" ? HISTORY_DAYS.green : HISTORY_DAYS.scenario;
    let tempViolationsLeft = { yellowTemp: 99, yellowPhoto: 4, yellowRating: 2, demo: 2, green: 0 }[sc];

    for (let day = days - 1; day >= 0; day--) {
      // Демо-мектептің бүгінгі мәзірін демо «1-қадам» өзі жасайды.
      if (sc === "demo" && day === 0) continue;
      const date = daysAgo(day);
      const itemsToday = randInt(1, 2);

      for (let ix = 0; ix < itemsToday; ix++) {
        const menuItemId = randomUUID();
        menuItems.push({
          id: menuItemId,
          schoolId: f.id,
          date,
          name: menuNames[randInt(0, menuNames.length - 1)],
          standardPortionG: randInt(150, 300),
          batchId: batches[randInt(1, batches.length - 1)].id,
        });

        const skipPhoto = (sc === "yellowPhoto" && day < 5) || (sc === "demo" && day === 1);
        if (!skipPhoto) {
          logs.push({ schoolId: f.id, menuItemId, type: "PHOTO", photoUrl: "https://placehold.co/400x300?text=Portion", createdAt: date, createdById: "seed" });
        }

        const violate =
          day < 14 && tempViolationsLeft > 0 && (sc === "yellowTemp" ? day % 2 === 0 : ix === 0 && day % 3 === 0);
        if (violate) tempViolationsLeft -= 1;
        const fridge = violate ? Number(rand(8, 11).toFixed(1)) : Number(rand(2.5, 5.5).toFixed(1));
        logs.push({ schoolId: f.id, menuItemId, type: "FRIDGE_TEMP", valueC: fridge, isViolation: violate, createdAt: date, createdById: "seed" });
        const hot = Number(rand(68, 82).toFixed(1));
        logs.push({ schoolId: f.id, menuItemId, type: "HOT_TEMP", valueC: hot, isViolation: false, createdAt: date, createdById: "seed" });
      }

      if (sc === "yellowRating" && day < 14) {
        // Төмен бағалар + соңғы 3 күнде шағымдар жарылысы.
        const count = day < 3 ? 3 : 1;
        for (let k = 0; k < count; k++) {
          feedback.push({ schoolId: f.id, rating: randInt(1, 2), comment: "Тағам суық, порция аз", createdAt: date });
        }
      } else if (day % 3 === 0) {
        const rating = sc === "yellowTemp" ? 3 : sc === "demo" ? randInt(3, 4) : randInt(4, 5);
        feedback.push({ schoolId: f.id, rating, comment: null, createdAt: date });
      }
    }
  }

  await insertChunked("мәзір", menuItems, (c) => prisma.menuItem.createMany({ data: c }));
  await insertChunked("асхана журналы", logs, (c) => prisma.kitchenLog.createMany({ data: c }));
  await insertChunked("бағалар", feedback, (c) => prisma.parentFeedback.createMany({ data: c }));

  await insertChunked(
    "тексерулер",
    facilities.filter((f) => inspectionDates.get(f.id)),
    (chunk) =>
      prisma.inspection.createMany({
        data: chunk.map((f) => {
          const at = inspectionDates.get(f.id)!;
          return { schoolId: f.id, inspectorId: "seed", type: "MONITORING" as const, plannedAt: at, doneAt: at, result: "Бұзушылық анықталмады" };
        }),
      }),
  );

  console.log("Тәуекел тарихы...");
  const snapshots: Prisma.RiskSnapshotCreateManyInput[] = [];
  const target: Record<Scenario, number> = { green: 5, demo: 30, yellowTemp: 43, yellowPhoto: 45, yellowRating: 45 };
  const zeroComponents = { tempViolations: 0, missingPhotos: 0, parentRating: 0, complaintSpike: 0, supplierRisk: 0, inspectionAge: 0, overduePrescriptions: 0 };
  for (const f of facilities) {
    const sc = scenario.get(f.id)!;
    const end = target[sc];
    for (let day = 29; day >= 1; day--) {
      const trend = end === 5 ? 5 : 8 + ((29 - day) / 29) * (end - 8);
      const score = Math.max(0, Math.min(100, Math.round(trend + rand(-4, 4))));
      const level: RiskLevel = score >= 70 ? "RED" : score >= 40 ? "YELLOW" : "GREEN";
      snapshots.push({ schoolId: f.id, score, level, components: { seed: true }, computedAt: daysAgo(day) });
    }
    // Жасыл нысандардың бүгінгі балы деректерден анық 0 — нақты есептеуді тек сценарийлерге жүргіземіз
    // (әр есептеу ДБ-ға ~7 сұраныс жасайды, 500+ нысан үшін бұл жергілікті ортада сағатқа созылады).
    if (sc === "green") snapshots.push({ schoolId: f.id, score: 0, level: "GREEN", components: zeroComponents });
  }
  await insertChunked("тәуекел снапшоттары", snapshots, (c) => prisma.riskSnapshot.createMany({ data: c }));

  console.log("Пайдаланушылар...");
  const passwordHash = await bcrypt.hash("demo123", 10);
  await prisma.user.createMany({
    data: [
      { login: "kitchen_demo", passwordHash, name: "Асхана қызметкері (демо)", role: "KITCHEN", schoolId: demo.id },
      { login: "nurse_demo", passwordHash, name: "Медбике (демо)", role: "NURSE", schoolId: demo.id },
      { login: "ses1", passwordHash, name: "СЭС инспекторы", role: "SES", schoolId: null },
      { login: "edu1", passwordHash, name: "Білім басқармасы қызметкері", role: "EDU", schoolId: null },
      { login: "admin", passwordHash, name: "Әкімші", role: "ADMIN", schoolId: null },
    ],
  });

  console.log("Сценарий нысандарының бүгінгі тәуекелі (нақты логикамен)...");
  for (const f of [demo, tracedKindergarten, tracedCanteen, yellowTemp, yellowPhoto, yellowRating]) {
    const { score, level } = await recomputeSchoolRisk(f.id);
    console.log(`  [${scenario.get(f.id)}] ${f.name}: ${score} ${level}`);
  }

  console.log("Дайын. Демо-мектеп:", demo.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
