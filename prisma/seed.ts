import { randomUUID } from "node:crypto";
import { PrismaClient, type Prisma, type RiskLevel } from "@prisma/client";
import bcrypt from "bcryptjs";
import { recomputeSchoolRisk } from "../src/lib/risk/score";

const prisma = new PrismaClient();

// Мектеп атаулары мен координаттары демо үшін берілген (2GIS/білім басқармасынан алынған
// нақты тізіммен кейін ауыстырылады).
//
// Жолдар бір-бірден емес, createMany арқылы топтап жазылады: Supabase-ке әр сұраныс
// желі арқылы жүреді, сондықтан мыңдаған жеке INSERT сағаттарға созылады.

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
  const size = 1000;
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

// Әр мектептің деректері осы сценарийге сай әдейі құрылады, сондықтан нақты тәуекел
// логикасы оларды күтілген деңгейге шығарады (жасыл ≈0, демо ≈25–33, сарылар ≈43–45).
type Scenario = "green" | "demo" | "yellowTemp" | "yellowPhoto" | "yellowRating";

async function main() {
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

  const schoolSeeds = [
    { name: "№1 мектеп-гимназиясы", address: "Ақтау, 5-шағын аудан", lat: 43.6525, lng: 51.1725, district: "Ақтау қ." },
    { name: "№2 жалпы білім беретін мектебі", address: "Ақтау, 3-шағын аудан", lat: 43.6481, lng: 51.1653, district: "Ақтау қ." },
    { name: "№4 мектеп-лицейі", address: "Ақтау, 7-шағын аудан", lat: 43.6612, lng: 51.1892, district: "Ақтау қ." },
    { name: "№5 жалпы білім беретін мектебі", address: "Ақтау, 12-шағын аудан", lat: 43.6702, lng: 51.2015, district: "Ақтау қ.", isDemo: true },
    { name: "№6 мектебі", address: "Ақтау, 9-шағын аудан", lat: 43.6389, lng: 51.1487, district: "Ақтау қ." },
    { name: "№8 дарынды балаларға арналған мектеп", address: "Ақтау, 4-шағын аудан", lat: 43.6551, lng: 51.1601, district: "Ақтау қ." },
    { name: "№10 жалпы білім беретін мектебі", address: "Ақтау, 14-шағын аудан", lat: 43.6789, lng: 51.2231, district: "Ақтау қ." },
    { name: "№12 мектебі", address: "Ақтау, 1-шағын аудан", lat: 43.6435, lng: 51.1398, district: "Ақтау қ." },
    { name: "№15 мектеп-лицейі", address: "Ақтау, 15-шағын аудан", lat: 43.6655, lng: 51.2102, district: "Ақтау қ." },
    { name: "№17 жалпы білім беретін мектебі", address: "Ақтау, 6-шағын аудан", lat: 43.6499, lng: 51.1799, district: "Ақтау қ." },
    { name: "№19 мектебі", address: "Ақтау, 2-шағын аудан", lat: 43.6412, lng: 51.1552, district: "Ақтау қ." },
    { name: "№22 мектеп-гимназиясы", address: "Ақтау, 30-шағын аудан", lat: 43.6845, lng: 51.235, district: "Ақтау қ." },
    { name: "Жаңаөзен №1 мектебі", address: "Жаңаөзен қ., Достық көшесі", lat: 43.3401, lng: 52.8602, district: "Жаңаөзен қ." },
    { name: "Жаңаөзен №3 мектебі", address: "Жаңаөзен қ., Абай көшесі", lat: 43.3355, lng: 52.8534, district: "Жаңаөзен қ." },
    { name: "Жаңаөзен №5 мектебі", address: "Жаңаөзен қ., Тәуелсіздік даңғылы", lat: 43.3448, lng: 52.8677, district: "Жаңаөзен қ." },
    { name: "Мұнайлы ауданы №2 мектебі", address: "Мұнайлы ауданы, Атамекен а.", lat: 43.5978, lng: 51.3822, district: "Мұнайлы ауданы" },
    { name: "Мұнайлы ауданы №4 мектебі", address: "Мұнайлы ауданы, Қызылтөбе а.", lat: 43.5601, lng: 51.4213, district: "Мұнайлы ауданы" },
    { name: "Форт-Шевченко мектебі", address: "Түпқараған ауданы, Форт-Шевченко қ.", lat: 44.51, lng: 50.26, district: "Түпқараған ауданы" },
    { name: "Құрық мектебі", address: "Қарақия ауданы, Құрық кенті", lat: 43.19, lng: 51.67, district: "Қарақия ауданы" },
    { name: "Шетпе мектебі", address: "Маңғыстау ауданы, Шетпе кенті", lat: 44.17, lng: 52.12, district: "Маңғыстау ауданы" },
    { name: "Бейнеу №1 мектебі", address: "Бейнеу ауданы, Бейнеу кенті", lat: 45.32, lng: 55.19, district: "Бейнеу ауданы" },
    { name: "Бейнеу №3 мектебі", address: "Бейнеу ауданы, Бейнеу кенті", lat: 45.324, lng: 55.196, district: "Бейнеу ауданы" },
  ];

  const schools = schoolSeeds.map((s) => ({ ...s, id: randomUUID(), isDemo: !!s.isDemo }));
  const demoSchool = schools.find((s) => s.isDemo)!;
  const nonDemo = schools.filter((s) => !s.isDemo);

  // Ортақ партияны алатын 2 мектеп (nonDemo[0], nonDemo[1]) демода сарыға көтерілуі керек,
  // сондықтан олар жасыл басталады. Сары сценарийлер басқа мектептерге беріледі.
  const scenario = new Map<string, Scenario>(schools.map((s) => [s.id, "green" as Scenario]));
  scenario.set(demoSchool.id, "demo");
  scenario.set(nonDemo[5].id, "yellowTemp");
  scenario.set(nonDemo[8].id, "yellowPhoto");
  scenario.set(nonDemo[12].id, "yellowRating");

  const inspectionDates = new Map<string, Date | null>();
  for (const s of schools) {
    const sc = scenario.get(s.id)!;
    inspectionDates.set(s.id, sc === "yellowPhoto" ? null : sc === "green" ? daysAgo(randInt(20, 60)) : daysAgo(200));
  }

  console.log("Мектептер, жеткізушілер, партиялар...");
  await prisma.school.createMany({
    data: schools.map((s) => ({
      id: s.id,
      name: s.name,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      studentsCount: randInt(300, 1200),
      districtId: districtIds.get(s.district)!,
      isDemo: s.isDemo,
      parentToken: randomUUID(),
      lastInspectionAt: inspectionDates.get(s.id),
    })),
  });

  const suppliers = [
    { name: 'ЖШС "Маңғыстау Азық-Түлік"', bin: "010140012345", certDays: 400 },
    { name: 'ЖШС "Каспий Нан"', bin: "020240067890", certDays: 250 },
    { name: 'ЖК "Аймана Тағам"', bin: "030340011122", certDays: 10 },
    { name: 'ЖШС "Батыс Азық"', bin: "040440033344", certDays: 180 },
    { name: 'ЖШС "Ақтау Даму Азық-Түлік"', bin: "050540055566", certDays: 320 },
  ].map((s) => ({ id: randomUUID(), name: s.name, bin: s.bin, certificateValidUntil: daysAgo(-s.certDays) }));
  await prisma.supplier.createMany({ data: suppliers });

  const products = ["Сиыр еті котлеті", "Тауық еті", "Картоп", "Сүт", "Нан", "Күріш", "Жұмыртқа", "Пияз"];
  const batches = Array.from({ length: 25 }, (_, i) => {
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

  // Демо-мектептің бүгінгі котлета партиясы (B-2000) тағы 2 мектепке жеткізілген — партияны қадағалау демосы.
  const sharedBatch = batches[0];
  const deliveries: Prisma.DeliveryCreateManyInput[] = [demoSchool, nonDemo[0], nonDemo[1]].map((s) => ({
    batchId: sharedBatch.id,
    schoolId: s.id,
    deliveredAt: daysAgo(0),
  }));
  for (const s of schools) {
    const count = randInt(3, 6);
    for (let i = 0; i < count; i++) {
      deliveries.push({ batchId: batches[randInt(1, batches.length - 1)].id, schoolId: s.id, deliveredAt: daysAgo(randInt(1, 13)) });
    }
  }
  await prisma.delivery.createMany({ data: deliveries });

  console.log("30 күндік тарих...");
  const menuNames = ["Көже", "Ет тұшпара", "Палау", "Балық котлеті", "Макарон бефстроганов", "Сорпа"];
  const menuItems: Prisma.MenuItemCreateManyInput[] = [];
  const logs: Prisma.KitchenLogCreateManyInput[] = [];
  const feedback: Prisma.ParentFeedbackCreateManyInput[] = [];

  for (const school of schools) {
    const sc = scenario.get(school.id)!;
    let tempViolationsLeft = { yellowTemp: 99, yellowPhoto: 4, yellowRating: 2, demo: 2, green: 0 }[sc];

    for (let day = 29; day >= 0; day--) {
      // Демо-мектептің бүгінгі мәзірін демо «1-қадам» өзі жасайды.
      if (sc === "demo" && day === 0) continue;
      const date = daysAgo(day);
      const itemsToday = randInt(1, 2);

      for (let ix = 0; ix < itemsToday; ix++) {
        const menuItemId = randomUUID();
        menuItems.push({
          id: menuItemId,
          schoolId: school.id,
          date,
          name: menuNames[randInt(0, menuNames.length - 1)],
          standardPortionG: randInt(150, 300),
          batchId: batches[randInt(1, batches.length - 1)].id,
        });

        const skipPhoto = (sc === "yellowPhoto" && day < 5) || (sc === "demo" && day === 1);
        if (!skipPhoto) {
          logs.push({ schoolId: school.id, menuItemId, type: "PHOTO", photoUrl: "https://placehold.co/400x300?text=Portion", createdAt: date, createdById: "seed" });
        }

        const violate =
          day < 14 && tempViolationsLeft > 0 && (sc === "yellowTemp" ? day % 2 === 0 : ix === 0 && day % 3 === 0);
        if (violate) tempViolationsLeft -= 1;
        const fridge = violate ? Number(rand(8, 11).toFixed(1)) : Number(rand(2.5, 5.5).toFixed(1));
        logs.push({ schoolId: school.id, menuItemId, type: "FRIDGE_TEMP", valueC: fridge, isViolation: violate, createdAt: date, createdById: "seed" });
        const hot = Number(rand(68, 82).toFixed(1));
        logs.push({ schoolId: school.id, menuItemId, type: "HOT_TEMP", valueC: hot, isViolation: false, createdAt: date, createdById: "seed" });
      }

      if (sc === "yellowRating" && day < 14) {
        // Төмен бағалар + соңғы 3 күнде шағымдар жарылысы.
        const count = day < 3 ? 3 : 1;
        for (let k = 0; k < count; k++) {
          feedback.push({ schoolId: school.id, rating: randInt(1, 2), comment: "Тағам суық, порция аз", createdAt: date });
        }
      } else if (day % 3 === 0) {
        const rating = sc === "yellowTemp" ? 3 : sc === "demo" ? randInt(3, 4) : randInt(4, 5);
        feedback.push({ schoolId: school.id, rating, comment: null, createdAt: date });
      }
    }
  }

  await insertChunked("мәзір", menuItems, (c) => prisma.menuItem.createMany({ data: c }));
  await insertChunked("асхана журналы", logs, (c) => prisma.kitchenLog.createMany({ data: c }));
  await insertChunked("ата-ана бағалары", feedback, (c) => prisma.parentFeedback.createMany({ data: c }));

  await prisma.inspection.createMany({
    data: schools
      .filter((s) => inspectionDates.get(s.id))
      .map((s) => {
        const at = inspectionDates.get(s.id)!;
        return { schoolId: s.id, inspectorId: "seed", type: "MONITORING" as const, plannedAt: at, doneAt: at, result: "Бұзушылық анықталмады" };
      }),
  });

  console.log("Тәуекел тарихы (өткен 29 күн)...");
  const snapshots: Prisma.RiskSnapshotCreateManyInput[] = [];
  const target: Record<Scenario, number> = { green: 5, demo: 30, yellowTemp: 43, yellowPhoto: 45, yellowRating: 45 };
  for (const s of schools) {
    const end = target[scenario.get(s.id)!];
    for (let day = 29; day >= 1; day--) {
      const trend = end === 5 ? 5 : 8 + ((29 - day) / 29) * (end - 8);
      const score = Math.max(0, Math.min(100, Math.round(trend + rand(-4, 4))));
      const level: RiskLevel = score >= 70 ? "RED" : score >= 40 ? "YELLOW" : "GREEN";
      snapshots.push({ schoolId: s.id, score, level, components: { seed: true }, computedAt: daysAgo(day) });
    }
  }
  await insertChunked("тәуекел снапшоттары", snapshots, (c) => prisma.riskSnapshot.createMany({ data: c }));

  console.log("Пайдаланушылар...");
  const passwordHash = await bcrypt.hash("demo123", 10);
  await prisma.user.createMany({
    data: [
      { login: "kitchen_demo", passwordHash, name: "Асхана қызметкері (демо)", role: "KITCHEN", schoolId: demoSchool.id },
      { login: "nurse_demo", passwordHash, name: "Медбике (демо)", role: "NURSE", schoolId: demoSchool.id },
      { login: "ses1", passwordHash, name: "СЭС инспекторы", role: "SES", schoolId: null },
      { login: "edu1", passwordHash, name: "Білім басқармасы қызметкері", role: "EDU", schoolId: null },
      { login: "admin", passwordHash, name: "Әкімші", role: "ADMIN", schoolId: null },
    ],
  });

  // Бүгінгі балды нақты тәуекел логикасы есептейді (cron есептейтінмен бірдей болуы үшін).
  console.log("Бүгінгі тәуекелді есептеу...");
  for (const s of schools) {
    const { score, level } = await recomputeSchoolRisk(s.id);
    console.log(`  ${s.name}: ${score} ${level}`);
  }

  console.log("Дайын. Демо-мектеп:", demoSchool.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
