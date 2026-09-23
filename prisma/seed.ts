import { PrismaClient, RiskLevel } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Мектеп атаулары мен координаттары демо үшін берілген (2GIS/білім басқармасынан алынған
// нақты тізіммен кейін ауыстырылады).

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

async function main() {
  console.log("Тазалау...");
  await clearAll();

  console.log("Аудандар...");
  const districtNames = [
    "Ақтау қ.",
    "Жаңаөзен қ.",
    "Мұнайлы ауданы",
    "Түпқараған ауданы",
    "Маңғыстау ауданы",
    "Бейнеу ауданы",
    "Қарақия ауданы",
  ];
  const districts = new Map<string, string>();
  for (const name of districtNames) {
    const d = await prisma.district.create({ data: { name } });
    districts.set(name, d.id);
  }

  console.log("Мектептер...");
  type SchoolSeed = { name: string; address: string; lat: number; lng: number; district: string; isDemo?: boolean };
  const schoolSeeds: SchoolSeed[] = [
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
    { name: "№22 мектеп-гимназиясы", address: "Ақтау, 30-шағын аудан", lat: 43.6845, lng: 51.2350, district: "Ақтау қ." },
    { name: "№1 мектебі", address: "Жаңаөзен қ., Достық көшесі", lat: 43.3401, lng: 52.8602, district: "Жаңаөзен қ." },
    { name: "№3 мектебі", address: "Жаңаөзен қ., Абай көшесі", lat: 43.3355, lng: 52.8534, district: "Жаңаөзен қ." },
    { name: "№5 жалпы білім беретін мектебі", address: "Жаңаөзен қ., Тәуелсіздік даңғылы", lat: 43.3448, lng: 52.8677, district: "Жаңаөзен қ." },
    { name: "Мұнайлы ауданы №2 мектебі", address: "Мұнайлы ауданы, Атамекен а.", lat: 43.5978, lng: 51.3822, district: "Мұнайлы ауданы" },
    { name: "Мұнайлы ауданы №4 мектебі", address: "Мұнайлы ауданы, Қызылтөбе а.", lat: 43.5601, lng: 51.4213, district: "Мұнайлы ауданы" },
    { name: "Форт-Шевченко мектебі", address: "Түпқараған ауданы, Форт-Шевченко қ.", lat: 44.51, lng: 50.26, district: "Түпқараған ауданы" },
    { name: "Құрық мектебі", address: "Қарақия ауданы, Құрық кенті", lat: 43.19, lng: 51.67, district: "Қарақия ауданы" },
    { name: "Шетпе мектебі", address: "Маңғыстау ауданы, Шетпе кенті", lat: 44.17, lng: 52.12, district: "Маңғыстау ауданы" },
    { name: "Бейнеу №1 мектебі", address: "Бейнеу ауданы, Бейнеу кенті", lat: 45.32, lng: 55.19, district: "Бейнеу ауданы" },
    { name: "Бейнеу №3 мектебі", address: "Бейнеу ауданы, Бейнеу кенті", lat: 45.324, lng: 55.196, district: "Бейнеу ауданы" },
  ];

  const schools = [];
  for (const s of schoolSeeds) {
    const school = await prisma.school.create({
      data: {
        name: s.name,
        address: s.address,
        lat: s.lat,
        lng: s.lng,
        studentsCount: randInt(300, 1200),
        districtId: districts.get(s.district)!,
        isDemo: !!s.isDemo,
      },
    });
    schools.push({ ...school, seedTag: s.isDemo ? "demo" : "normal" });
  }
  const demoSchool = schools.find((s) => s.isDemo)!;

  console.log("Жеткізушілер...");
  const supplierData = [
    { name: 'ЖШС "Мангистау Азык-Тулик"', bin: "010140012345", certDays: 400 },
    { name: 'ЖШС "Каспий Нан"', bin: "020240067890", certDays: 250 },
    { name: 'ИП "Аймана Тагам"', bin: "030340011122", certDays: 10 },
    { name: 'ЖШС "Батыс Азык"', bin: "040440033344", certDays: 180 },
    { name: 'ЖШС "Актау Даму Азык-Тулик"', bin: "050540055566", certDays: 320 },
  ];
  const suppliers = [];
  for (const s of supplierData) {
    const supplier = await prisma.supplier.create({
      data: {
        name: s.name,
        bin: s.bin,
        certificateValidUntil: daysAgo(-s.certDays),
      },
    });
    suppliers.push(supplier);
  }

  console.log("Партиялар мен жеткізулер...");
  const products = ["Тауық еті", "Сиыр еті котлеті", "Картоп", "Сүт", "Нан", "Күріш", "Жұмыртқа", "Пияз"];
  const batches = [];
  for (let i = 0; i < 25; i++) {
    const supplier = suppliers[i % suppliers.length];
    const producedAt = daysAgo(randInt(1, 20));
    const expiresAt = new Date(producedAt);
    expiresAt.setDate(expiresAt.getDate() + randInt(5, 30));
    const batch = await prisma.batch.create({
      data: {
        code: `B-${2000 + i}`,
        product: products[i % products.length],
        producedAt,
        expiresAt,
        supplierId: supplier.id,
      },
    });
    batches.push(batch);
  }

  // Демо-мектептің бүгінгі котлета партиясы (B-2000) тағы 2 мектепке жеткізілсін.
  const sharedBatch = batches[0];
  const otherTwoSchools = schools.filter((s) => !s.isDemo).slice(0, 2);
  for (const school of [demoSchool, ...otherTwoSchools]) {
    await prisma.delivery.create({
      data: { batchId: sharedBatch.id, schoolId: school.id, deliveredAt: daysAgo(0) },
    });
  }

  for (const school of schools) {
    const deliveryCount = randInt(3, 6);
    for (let i = 0; i < deliveryCount; i++) {
      const batch = batches[randInt(0, batches.length - 1)];
      await prisma.delivery.create({
        data: { batchId: batch.id, schoolId: school.id, deliveredAt: daysAgo(randInt(0, 13)) },
      });
    }
  }

  console.log("30 күндік тарих (мәзір, фото, температура, бағалар)...");
  const menuNames = ["Көже", "Ет тұшпара", "Плов", "Балық котлеті", "Макарон бефстроганов", "Сорпа"];

  // Ерекше 3 мектеп сары деңгейде болу үшін: temp-бұзушылық / фото жоқ / төмен баға
  const yellowByTemp = schools[1].id;
  const yellowByMissingPhoto = schools[2].id;
  const yellowByLowRating = schools[3].id;

  for (const school of schools) {
    for (let day = 29; day >= 0; day--) {
      const date = daysAgo(day);
      const itemsToday = randInt(1, 2);
      for (let ix = 0; ix < itemsToday; ix++) {
        const batch = batches[randInt(0, batches.length - 1)];
        const menuItem = await prisma.menuItem.create({
          data: {
            schoolId: school.id,
            date,
            name: menuNames[randInt(0, menuNames.length - 1)],
            standardPortionG: randInt(150, 300),
            batchId: batch.id,
          },
        });

        const skipPhoto = school.id === yellowByMissingPhoto && day < 10 && Math.random() < 0.6;
        if (!skipPhoto) {
          await prisma.kitchenLog.create({
            data: {
              schoolId: school.id,
              menuItemId: menuItem.id,
              type: "PHOTO",
              photoUrl: "https://placehold.co/400x300?text=Portion",
              createdAt: date,
              createdById: "seed",
            },
          });
        }

        const isTempViolationSchool = school.id === yellowByTemp && day < 14 && Math.random() < 0.4;
        const fridgeTemp = isTempViolationSchool ? rand(8, 12) : rand(2, 6);
        await prisma.kitchenLog.create({
          data: {
            schoolId: school.id,
            menuItemId: menuItem.id,
            type: "FRIDGE_TEMP",
            valueC: Number(fridgeTemp.toFixed(1)),
            isViolation: fridgeTemp < 2 || fridgeTemp > 6,
            createdAt: date,
            createdById: "seed",
          },
        });
        const hotTemp = isTempViolationSchool ? rand(45, 60) : rand(65, 85);
        await prisma.kitchenLog.create({
          data: {
            schoolId: school.id,
            menuItemId: menuItem.id,
            type: "HOT_TEMP",
            valueC: Number(hotTemp.toFixed(1)),
            isViolation: hotTemp < 65,
            createdAt: date,
            createdById: "seed",
          },
        });
      }

      if (day % 3 === 0) {
        const lowRatingSchool = school.id === yellowByLowRating;
        const rating = lowRatingSchool ? randInt(1, 3) : randInt(3, 5);
        await prisma.parentFeedback.create({
          data: {
            schoolId: school.id,
            rating,
            comment: rating <= 2 ? "Тағам сапасына көңіл толмайды" : null,
            createdAt: date,
          },
        });
      }
    }
  }

  console.log("Тәуекел тарихы (RiskSnapshot)...");
  for (const school of schools) {
    let base = 8;
    if (school.id === yellowByTemp || school.id === yellowByMissingPhoto || school.id === yellowByLowRating) {
      base = 30;
    }
    if (school.isDemo) base = 22;

    for (let day = 29; day >= 0; day--) {
      const drift = (29 - day) * 0.8;
      const noise = rand(-4, 4);
      let score = Math.max(0, Math.min(100, Math.round(base + drift + noise)));
      if ((school.id === yellowByTemp || school.id === yellowByMissingPhoto || school.id === yellowByLowRating) && day < 10) {
        score = Math.max(score, 40 + randInt(0, 15));
      }
      const level: RiskLevel = score >= 70 ? "RED" : score >= 40 ? "YELLOW" : "GREEN";
      await prisma.riskSnapshot.create({
        data: {
          schoolId: school.id,
          score,
          level,
          components: { seed: true },
          computedAt: daysAgo(day),
        },
      });
      if (day === 0) {
        await prisma.school.update({ where: { id: school.id }, data: { riskScore: score, riskLevel: level } });
      }
    }

    await prisma.inspection.create({
      data: {
        schoolId: school.id,
        inspectorId: "seed",
        type: "MONITORING",
        plannedAt: daysAgo(randInt(20, 60)),
        doneAt: daysAgo(randInt(20, 60)),
        result: "Бұзушылық анықталмады",
      },
    });
    await prisma.school.update({
      where: { id: school.id },
      data: { lastInspectionAt: daysAgo(randInt(20, 60)) },
    });
  }

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

  console.log("Дайын. Демо-мектеп ID:", demoSchool.id, demoSchool.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
