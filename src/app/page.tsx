import Image from "next/image";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getT } from "@/i18n/server";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  AlertIcon,
  EduIcon,
  InspectorIcon,
  KitchenIcon,
  NurseIcon,
  ParentIcon,
  PhotoCheckIcon,
  TraceIcon,
} from "@/components/Icons";
import heroChef from "../../public/img/hero-chef.jpg";

const ROLE_HOME: Record<string, string> = {
  KITCHEN: "/kitchen",
  NURSE: "/nurse",
  SES: "/ses",
  EDU: "/edu",
  ADMIN: "/training",
};

const FEATURE_ICONS = [AlertIcon, PhotoCheckIcon, TraceIcon];
const ROLE_TILES = [
  { key: "kitchen", login: "a12_kitchen", Icon: KitchenIcon },
  { key: "nurse", login: "a12_nurse", Icon: NurseIcon },
  { key: "ses", login: "ses1", Icon: InspectorIcon },
  { key: "edu", login: "edu1", Icon: EduIcon },
] as const;

export default async function Home() {
  const [session, t] = await Promise.all([getSession(), getT()]);
  const cabinetHref = session ? ROLE_HOME[session.role] : null;
  const l = t.landing;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Басты экран: асхана ас үйінің фотосы, сол жағы күңгірттелген — мәтін оқылады. */}
      <section className="relative isolate overflow-hidden border-b border-line">
        <Image
          src={heroChef}
          alt={l.heroAlt}
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

        <header className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <Logo />
          <div className="flex items-center gap-3">
            <LanguageSwitcher className="!bg-surface/70 backdrop-blur" />
            <Link href={cabinetHref ?? "/login"} className="btn btn-outline !bg-surface/70 backdrop-blur">
              {cabinetHref ? t.common.cabinet : t.common.login}
            </Link>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-4 pt-10 pb-20 sm:pt-20 sm:pb-28">
          <p className="anim-fade-up inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface/70 px-3 py-1 text-xs text-ink-2 backdrop-blur">
            <i aria-hidden="true" className="anim-live inline-block h-2 w-2 rounded-full bg-ok-500" />
            {l.eyebrow}
          </p>
          <h1
            className="anim-fade-up mt-5 max-w-3xl text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.06] tracking-tight text-ink"
            style={{ animationDelay: "60ms" }}
          >
            {l.titleStart}
            <span className="text-primary">{l.titleAccent}</span>
          </h1>
          <p className="anim-fade-up mt-5 max-w-xl text-base sm:text-lg text-ink-2" style={{ animationDelay: "120ms" }}>
            {l.lead}
          </p>
          <div className="anim-fade-up mt-8 flex flex-wrap gap-3" style={{ animationDelay: "180ms" }}>
            <Link href={cabinetHref ?? "/login"} className="btn btn-primary !min-h-12 !px-6 !text-base">
              {cabinetHref ? l.ctaCabinet : l.ctaLogin}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
          <dl className="anim-fade-up mt-12 grid max-w-xl grid-cols-3 gap-3" style={{ animationDelay: "240ms" }}>
            {l.heroStats.map((s) => (
              <div key={s.label} className="rounded-xl border border-line bg-surface/70 px-4 py-3 backdrop-blur">
                <dt className="sr-only">{s.label}</dt>
                <dd className="font-mono text-xl sm:text-2xl font-semibold text-primary tabular-nums">{s.value}</dd>
                <dd className="mt-0.5 text-xs text-muted">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="absolute bottom-2 right-4 text-[11px] text-muted">{t.common.photoCredit}</p>
      </section>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-12 space-y-14">
        <section className="grid gap-4 md:grid-cols-3" aria-label={l.featuresAria}>
          {l.features.map((f, i) => {
            const Icon = FEATURE_ICONS[i];
            return (
              <div key={f.title} className="anim-fade-up card p-6" style={{ animationDelay: `${i * 70}ms` }}>
                <span className="inline-flex rounded-xl bg-primary-soft p-2.5">
                  <Icon className="w-7 h-7" />
                </span>
                <h2 className="mt-4 text-lg font-semibold text-ink">{f.title}</h2>
                <p className="mt-1.5 text-sm text-muted">{f.text}</p>
              </div>
            );
          })}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-ink">{l.rolesTitle}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {ROLE_TILES.map((r, i) => (
              <Link
                key={r.key}
                href={`/login?as=${r.login}`}
                className="tile anim-fade-up card p-5 flex flex-col items-start gap-3"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <r.Icon />
                <span className="font-medium text-ink">{l.roles[r.key].label}</span>
                <span className="text-xs text-muted">{l.roles[r.key].hint}</span>
              </Link>
            ))}
            <div className="anim-fade-up card p-5 flex flex-col items-start gap-3" style={{ animationDelay: "240ms" }}>
              <ParentIcon />
              <span className="font-medium text-ink">{l.roles.parent.label}</span>
              <span className="text-xs text-muted">{l.roles.parent.hint}</span>
            </div>
          </div>
          <p className="text-sm text-muted">{l.extraNote}</p>
        </section>

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3" aria-label={l.statsAria}>
          {l.stats.map((s, i) => (
            <div key={s.label} className="anim-fade-up card p-5" style={{ animationDelay: `${i * 60}ms` }}>
              <p className="font-mono text-3xl font-semibold text-primary tabular-nums">{s.value}</p>
              <p className="mt-1 text-xs text-muted">{s.label}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-ink">{l.howTitle}</h2>
          <ol className="grid gap-3 sm:grid-cols-4">
            {l.steps.map((s, i) => (
              <li key={s.title} className="anim-fade-up card relative p-5" style={{ animationDelay: `${i * 80}ms` }}>
                <span className="font-mono text-sm font-semibold text-primary">{String(i + 1).padStart(2, "0")}</span>
                <p className="mt-2 font-semibold text-ink">{s.title}</p>
                <p className="mt-1 text-sm text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="max-w-6xl mx-auto px-4 py-5 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
          <span>{l.footerLeft}</span>
          <span>{l.footerRight}</span>
        </div>
      </footer>
    </div>
  );
}
