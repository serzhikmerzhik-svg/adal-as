import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { Logo } from "@/components/Logo";
import { HeroCarousel } from "@/components/HeroCarousel";
import { KitchenIcon, NurseIcon, InspectorIcon, EduIcon, ParentIcon, TrainingIcon } from "@/components/Icons";

const ROLE_HOME: Record<string, string> = {
  KITCHEN: "/kitchen",
  NURSE: "/nurse",
  SES: "/ses",
  EDU: "/edu",
  ADMIN: "/training",
};

const ROLE_TILES = [
  { label: "Асхана", hint: "Фото, температура, партия", login: "a12_kitchen", Icon: KitchenIcon },
  { label: "Медбике", hint: "Белгілер, аты-жөнсіз", login: "a12_nurse", Icon: NurseIcon },
  { label: "СЭС инспекторы", hint: "Карта, дабыл, нұсқама", login: "ses1", Icon: InspectorIcon },
  { label: "Білім басқармасы", hint: "Тек оқу режимі", login: "edu1", Icon: EduIcon },
];

const STATS = [
  { value: "~300", label: "Бесшоқыдағы улану зардап шеккендері, 2024" },
  { value: "2", label: "Маңғыстаудағы жаппай улану, 2024–2025" },
  { value: "689", label: "Ақтаудағы тамақтану нысаны — 2GIS деректері" },
  { value: "5 сек", label: "СЭС бақылау орталығының жаңару жиілігі" },
];

const STEPS = [
  { n: "1", title: "Деректер", text: "Асхана күн сайын порция фотосын, температураны, партияны енгізеді." },
  { n: "2", title: "Тәуекел", text: "Жүйе әр нысанға 0–100 балл есептейді: жасыл, сары, қызыл." },
  { n: "3", title: "Дабыл", text: "Белгілер кластері — СЭС-ке қызыл дабыл, мәзір бұғатталады." },
  { n: "4", title: "Түзету", text: "Инспектор нұсқама береді, асхана фото-дәлелмен орындайды." },
];

export default async function Home() {
  const session = await getSession();
  const cabinetHref = session ? ROLE_HOME[session.role] : null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-line">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Logo />
          <Link
            href={cabinetHref ?? "/login"}
            className="btn btn-outline"
          >
            {cabinetHref ? "Кабинет" : "Кіру"}
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 space-y-10">
        <section className="anim-fade-up text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-ink">Асханалар мен СЭС арасындағы ерте ескерту</h1>
          <p className="text-muted max-w-2xl mx-auto">
            Ақтаудың барлық асханалары, мектептері мен балабақшалары бір картада. Улану туралы ақпарат
            ауруханаға түскенде емес, алғашқы белгілерде келеді.
          </p>
        </section>

        <section className="anim-fade-up" style={{ animationDelay: "80ms" }}>
          <HeroCarousel />
        </section>

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ROLE_TILES.map((t, i) => (
            <Link
              key={t.label}
              href={`/login?as=${t.login}`}
              className="tile anim-fade-up card p-5 flex flex-col items-center text-center gap-3"
              style={{ animationDelay: `${150 + i * 60}ms` }}
            >
              <t.Icon />
              <span className="font-medium text-ink">{t.label}</span>
              <span className="text-xs text-muted">{t.hint}</span>
            </Link>
          ))}
          <div
            className="tile anim-fade-up card p-5 flex flex-col items-center text-center gap-3"
            style={{ animationDelay: "390ms" }}
          >
            <ParentIcon />
            <span className="font-medium text-ink">Ата-ана, келуші</span>
            <span className="text-xs text-muted">QR арқылы мәзір мен баға, логинсіз</span>
          </div>
          <Link
            href="/login?as=admin"
            className="tile anim-fade-up card col-span-2 sm:col-span-3 p-5 flex items-center justify-between gap-4"
            style={{ animationDelay: "450ms" }}
          >
            <div>
              <p className="font-semibold text-ink">Оқу-жаттығу режимі</p>
              <p className="text-sm text-muted">Белгі → қызыл дабыл → партияны қадағалау → нұсқама → жабу</p>
            </div>
            <span className="anim-float bg-primary-soft rounded-lg p-3">
              <TrainingIcon className="w-9 h-9" />
            </span>
          </Link>
        </section>

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STATS.map((s, i) => (
            <div
              key={s.label}
              className="anim-fade-up card p-5"
              style={{ animationDelay: `${500 + i * 60}ms` }}
            >
              <p className="text-2xl font-bold text-primary">{s.value}</p>
              <p className="text-xs text-muted mt-1">{s.label}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">Қалай жұмыс істейді</h2>
          <div className="grid sm:grid-cols-4 gap-3">
            {STEPS.map((s, i) => (
              <div
                key={s.n}
                className="anim-fade-up card p-5 space-y-2"
                style={{ animationDelay: `${650 + i * 80}ms` }}
              >
                <span className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-primary-soft text-primary font-bold text-sm">
                  {s.n}
                </span>
                <p className="font-semibold text-ink">{s.title}</p>
                <p className="text-sm text-muted">{s.text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-line">
        <div className="max-w-5xl mx-auto px-4 py-5 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
          <span>Smart City Aktau хакатоны · Mangystau Hub</span>
          <span>Оқушылардың жеке деректері сақталмайды</span>
        </div>
      </footer>
    </div>
  );
}
