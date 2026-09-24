// 2GIS Catalog API-ден Ақтаудың барлық асханаларын, мектептері мен балабақшаларын және
// облыстың аудан орталықтарындағы мектептерді жүктеп, prisma/data/facilities.json-ға сақтайды.
// Іске қосу: node --env-file=.env scripts/fetch-2gis.mjs
//
// Демо-кілт шектеуі: бір сұранысқа 10 нәтиже × 5 бет = 50. Сондықтан аумақ тіктөртбұрыштарға
// бөлінеді, ал 50-ден көп нәтижесі бар тіктөртбұрыш тағы 4-ке бөлінеді (quadtree).
import { writeFileSync, mkdirSync } from "node:fs";

const KEY = process.env.NEXT_PUBLIC_2GIS_KEY;
if (!KEY) throw new Error("NEXT_PUBLIC_2GIS_KEY .env ішінде жоқ");

const MAX_RESULTS = 50;
let requests = 0;

async function search(q, bbox, page) {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const polygon = `POLYGON((${minLng} ${minLat},${maxLng} ${minLat},${maxLng} ${maxLat},${minLng} ${maxLat},${minLng} ${minLat}))`;
  const params = new URLSearchParams({
    q,
    type: "branch",
    page_size: "10",
    page: String(page),
    polygon,
    fields: "items.point,items.rubrics,items.adm_div",
    key: KEY,
  });
  requests += 1;
  const res = await fetch(`https://catalog.api.2gis.com/3.0/items?${params}`);
  const json = await res.json();
  if (json.meta.code === 404) return { total: 0, items: [] };
  if (json.meta.code !== 200) throw new Error(`${q} ${bbox}: ${json.meta.code} ${json.meta.error?.message}`);
  return { total: json.result.total, items: json.result.items };
}

async function collect(q, bbox, depth = 0) {
  const first = await search(q, bbox, 1);
  if (first.total > MAX_RESULTS && depth < 5) {
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const midLng = (minLng + maxLng) / 2;
    const midLat = (minLat + maxLat) / 2;
    const quads = [
      [minLng, minLat, midLng, midLat],
      [midLng, minLat, maxLng, midLat],
      [minLng, midLat, midLng, maxLat],
      [midLng, midLat, maxLng, maxLat],
    ];
    const parts = [];
    for (const quad of quads) parts.push(...(await collect(q, quad, depth + 1)));
    return parts;
  }
  const items = [...first.items];
  const pages = Math.min(5, Math.ceil(first.total / 10));
  for (let page = 2; page <= pages; page++) items.push(...(await search(q, bbox, page)).items);
  return items;
}

const KINDS = {
  CANTEEN: { query: "столовая", rubric: (r) => r === "Столовые" },
  SCHOOL: { query: "школа", rubric: (r) => ["Школы", "Частные школы", "Гимназии", "Лицеи"].includes(r) },
  KINDERGARTEN: { query: "детский сад", rubric: (r) => ["Детские сады", "Частные детские сады"].includes(r) },
};

// [minLng, minLat, maxLng, maxLat]
const AKTAU = [51.05, 43.56, 51.45, 43.78];
const DISTRICT_CENTERS = [
  { district: "Жаңаөзен қ.", bbox: [52.75, 43.28, 52.98, 43.40] },
  { district: "Бейнеу ауданы", bbox: [55.10, 45.26, 55.28, 45.38] },
  { district: "Маңғыстау ауданы", bbox: [52.05, 44.12, 52.20, 44.22] },
  { district: "Түпқараған ауданы", bbox: [50.18, 44.46, 50.34, 44.56] },
  { district: "Қарақия ауданы", bbox: [51.60, 43.14, 51.74, 43.24] },
];

function districtFor(item) {
  const names = (item.adm_div ?? []).map((d) => d.name).join(" ");
  if (/Мунайл/i.test(names)) return "Мұнайлы ауданы";
  if (/Актау/i.test(names)) return "Ақтау қ.";
  return null;
}

const byId = new Map();
function add(item, kind, district) {
  if (!item.point || byId.has(item.id)) return;
  const rubrics = (item.rubrics ?? []).map((r) => r.name);
  if (!rubrics.some(KINDS[kind].rubric)) return;
  byId.set(item.id, {
    dgisId: item.id,
    kind,
    name: item.name,
    address: item.address_name ?? "",
    lat: item.point.lat,
    lng: item.point.lon,
    rubric: rubrics.find(KINDS[kind].rubric),
    district,
  });
}

for (const [kind, { query }] of Object.entries(KINDS)) {
  const items = await collect(query, AKTAU);
  for (const item of items) {
    const district = districtFor(item);
    if (district) add(item, kind, district);
  }
  console.log(`Ақтау ${kind}: ${[...byId.values()].filter((f) => f.kind === kind).length}`);
}

for (const { district, bbox } of DISTRICT_CENTERS) {
  const items = await collect("школа", bbox);
  for (const item of items) add(item, "SCHOOL", district);
  console.log(`${district} SCHOOL: ${[...byId.values()].filter((f) => f.district === district).length}`);
}

const facilities = [...byId.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, "ru"));
mkdirSync("prisma/data", { recursive: true });
writeFileSync("prisma/data/facilities.json", JSON.stringify(facilities, null, 2));
console.log(`Барлығы: ${facilities.length} нысан, ${requests} сұраныс → prisma/data/facilities.json`);
