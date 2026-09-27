import Image from "next/image";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { Logo } from "@/components/Logo";
import {
  AlertIcon,
  EduIcon,
  InspectorIcon,
  KitchenIcon,
  NurseIcon,
  ParentIcon,
  PhotoCheckIcon,
  TraceIcon,
  TrainingIcon,
} from "@/components/Icons";
import heroChef from "../../public/img/hero-chef.jpg";

const ROLE_HOME: Record<string, string> = {
  KITCHEN: "/kitchen",
  NURSE: "/nurse",
  SES: "/ses",
  EDU: "/edu",
  ADMIN: "/training",
};

const HERO_STATS = [
  { value: "689", label: "тамақтану нысаны, 2GIS" },
  { value: "5 сек", label: "СЭС бетінің жаңаруы" },
  { value: "0–100", label: "әр нысанның тәуекел балы" },
];

const FEATURES = [
  {
    title: "Ерте ескерту",
    text: "2 сағатта 3+ оқушыда ішек-қарын белгісі — СЭС-ке бірден қызыл дабыл, мәзір бұғатталады.",
    Icon: AlertIcon,
  },
  {
    title: "ИИ порция тексеруі",
    text: "Асхана жүктеген әр фотоны ИИ мәзір мен нормамен салыстырады, инспектор тек күмәндісін қарайды.",
    Icon: PhotoCheckIcon,
  },
  {
    title: "Партияны қадағалау",
    text: "Сол ет не сүт партиясын алған басқа мектептер мен мейрамханалар бір сәтте анықталады.",
    Icon: TraceIcon,
  },
];

const ROLE_TILES = [
  { label: "Асхана", hint: "Фото, температура, партия", login: "a12_kitchen", Icon: KitchenIcon },
  { label: "Медбике", hint: "Белгілер, аты-жөнсіз", login: "a12_nurse", Icon: NurseIcon },
  { label: "СЭС инспекторы", hint: "Карта, дабыл, нұсқама", login: "ses1", Icon: InspectorIcon },
  { label: "Білім бөлімі", hint: "Тек оқу режимі", login: "edu1", Icon: EduIcon },
];

const STATS = [
  { value: "~300", label: "Бесшоқыдағы улану зардап шеккендері, 2024" },
  { value: "2", label: "Маңғыстаудағы жаппай улану, 2024–2025" },
  { value: "689", label: "Ақтаудағы тамақтану нысаны — 2GIS деректері" },
  { value: "5 сек", label: "СЭС бақылау орталығының жаңару жиілігі" },
];

const STEPS = [
  { n: "01", title: "Деректер", text: "Асхана күн сайын порция фотосын, температураны, партияны енгізеді." },
  { n: "02", title: "Тәуекел", text: "Жүйе әр нысанға 0–100 балл есептейді: жасыл, сары, қызыл." },
  { n: "03", title: "Дабыл", text: "Белгілер кластері — СЭС-ке қызыл дабыл, мәзір бұғатталады." },
  { n: "04", title: "Түзету", text: "Инспектор нұсқама береді, асхана фото-дәлелмен орындайды." },
];

export default async function Home() {
  const session = await getSession();
  const cabinetHref = session ? ROLE_HOME[session.role] : null;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Басты экран: асхана ас үйінің фотосы, сол жағы күңгірттелген — мәтін оқылады. */}
      <section className="relative isolate overflow-hidden border-b border-line">
        <Image
          src={heroChef}
          alt="Асхана ас үйінде тағам дайындап жатқан аспазшы"
          priority
          placeholder="blur"
          fill
          sizes="100vw"
          className="-z-20 object-cover object-[62%_center]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#0a1120_0%,rgba(10,17,32,0.94)_34%,rgba(10,17,32,0.55)_66%,rgba(10,17,32,0.8)_100%)]"
        />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-page to-transparent" />

        <header className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Logo />
          <Link href={cabinetHref ?? "/login"} className="btn btn-outline !bg-surface/70 backdrop-blur">
            {cabinetHref ? "Кабинет" : "Кіру"}
          </Link>
        </header>

        <div className="max-w-6xl mx-auto px-4 pt-10 pb-20 sm:pt-20 sm:pb-28">
          <p className="anim-fade-up inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface/70 px-3 py-1 text-xs text-ink-2 backdrop-blur">
            <i aria-hidden="true" className="anim-live inline-block h-2 w-2 rounded-full bg-ok-500" />
            Smart City Aktau · СЭС-ке арналған ерте ескерту жүйесі
          </p>
          <h1
            className="anim-fade-up mt-5 max-w-2xl text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.06] tracking-tight text-ink"
            style={{ animationDelay: "60ms" }}
          >
            Әр порция — <span className="text-primary">бақылауда</span>
          </h1>
          <p className="anim-fade-up mt-5 max-w-xl text-base sm:text-lg text-ink-2" style={{ animationDelay: "120ms" }}>
            Асхана фото мен температураны енгізеді, ИИ порцияны тексереді, СЭС тәуекелді картадан көреді. Улану туралы
            хабар ауруханадан емес, алғашқы белгіден келеді.
          </p>
          <div className="anim-fade-up mt-8 flex flex-wrap gap-3" style={{ animationDelay: "180ms" }}>
            <Link href={cabinetHref ?? "/login"} className="btn btn-primary !min-h-12 !px-6 !text-base">
              {cabinetHref ? "Кабинетке өту" : "Жүйеге кіру"}
              <span aria-hidden="true">→</span>
            </Link>
            <Link href="/login?as=admin" className="btn btn-outline !min-h-12 !px-6 !text-base !bg-surface/70 backdrop-blur">
              Оқу-жаттығу режимі
            </Link>
          </div>
          <dl className="anim-fade-up mt-12 grid max-w-xl grid-cols-3 gap-3" style={{ animationDelay: "240ms" }}>
            {HERO_STATS.map((s) => (
              <div key={s.label} className="rounded-xl border border-line bg-surface/70 px-4 py-3 backdrop-blur">
                <dt className="sr-only">{s.label}</dt>
                <dd className="font-mono text-xl sm:text-2xl font-semibold text-primary tabular-nums">{s.value}</dd>
                <dd className="mt-0.5 text-xs text-muted">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="absolute bottom-2 right-4 text-[11px] text-muted">Фото: Pylyp Sukhenko / Unsplash</p>
      </section>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-12 space-y-14">
        <section className="grid gap-4 md:grid-cols-3" aria-label="Мүмкіндіктер">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="anim-fade-up card p-6" style={{ animationDelay: `${i * 70}ms` }}>
              <span className="inline-flex rounded-xl bg-primary-soft p-2.5">
                <f.Icon className="w-7 h-7" />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-ink">{f.title}</h2>
              <p className="mt-1.5 text-sm text-muted">{f.text}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-ink">Кім қолданады</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {ROLE_TILES.map((t, i) => (
              <Link
                key={t.label}
                href={`/login?as=${t.login}`}
                className="tile anim-fade-up card p-5 flex flex-col items-start gap-3"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <t.Icon />
                <span className="font-medium text-ink">{t.label}</span>
                <span className="text-xs text-muted">{t.hint}</span>
              </Link>
            ))}
            <div className="anim-fade-up card p-5 flex flex-col items-start gap-3" style={{ animationDelay: "240ms" }}>
              <ParentIcon />
              <span className="font-medium text-ink">Ата-ана, келуші</span>
              <span className="text-xs text-muted">QR арқылы мәзір мен баға, логинсіз</span>
            </div>
            <Link
              href="/login?as=admin"
              className="tile anim-fade-up card col-span-2 sm:col-span-3 p-5 flex items-center justify-between gap-4 border-primary/30"
              style={{ animationDelay: "300ms" }}
            >
              <div>
                <p className="font-semibold text-ink">Оқу-жаттығу режимі</p>
                <p className="text-sm text-muted">Белгі → қызыл дабыл → партияны қадағалау → нұсқама → жабу</p>
              </div>
              <span className="anim-float rounded-xl bg-primary-soft p-3">
                <TrainingIcon className="w-9 h-9" />
              </span>
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3" aria-label="Мәселенің көлемі">
          {STATS.map((s, i) => (
            <div key={s.label} className="anim-fade-up card p-5" style={{ animationDelay: `${i * 60}ms` }}>
              <p className="font-mono text-3xl font-semibold text-primary tabular-nums">{s.value}</p>
              <p className="mt-1 text-xs text-muted">{s.label}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-ink">Қалай жұмыс істейді</h2>
          <ol className="grid gap-3 sm:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.n} className="anim-fade-up card relative p-5" style={{ animationDelay: `${i * 80}ms` }}>
                <span className="font-mono text-sm font-semibold text-primary">{s.n}</span>
                <p className="mt-2 font-semibold text-ink">{s.title}</p>
                <p className="mt-1 text-sm text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="max-w-6xl mx-auto px-4 py-5 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
          <span>Smart City Aktau хакатоны · Mangystau Hub</span>
          <span>Оқушылардың жеке деректері сақталмайды</span>
        </div>
      </footer>
    </div>
  );
}
