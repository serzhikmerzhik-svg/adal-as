import Image from "next/image";
import Link from "next/link";
import { getT } from "@/i18n/server";
import { Logo } from "@/components/Logo";
import { LoginForm } from "@/components/LoginForm";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import heroChef from "../../../public/img/hero-chef.jpg";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const [{ as }, t] = await Promise.all([searchParams, getT()]);
  const initialLogin = typeof as === "string" ? as : undefined;

  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col">
        <header className="px-4 sm:px-8 h-16 flex items-center justify-between gap-3">
          <Link href="/" aria-label={t.common.home}>
            <Logo />
          </Link>
          <LanguageSwitcher />
        </header>

        {/* Телефонда фото форманың үстіндегі жолақ, үлкен экранда оң жақтағы жартысы. */}
        <div className="relative h-36 mx-4 overflow-hidden rounded-2xl border border-line lg:hidden">
          <Image src={heroChef} alt="" placeholder="blur" fill sizes="100vw" className="object-cover object-[62%_35%]" />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-page/80 to-transparent" />
        </div>

        <main className="flex-1 flex items-start sm:items-center justify-center px-4 py-8 sm:py-12">
          <LoginForm key={initialLogin} initialLogin={initialLogin} />
        </main>
      </div>

      <aside className="relative hidden lg:block isolate overflow-hidden border-l border-line">
        <Image
          src={heroChef}
          alt={t.landing.heroAlt}
          placeholder="blur"
          fill
          sizes="55vw"
          priority
          className="-z-20 object-cover object-[62%_center]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgba(10,17,32,0.95)_0%,rgba(10,17,32,0.35)_45%,rgba(10,17,32,0.55)_100%)]"
        />
        <div className="absolute inset-x-0 bottom-0 p-10 xl:p-14">
          <p className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface/70 px-3 py-1 text-xs text-ink-2 backdrop-blur">
            <i aria-hidden="true" className="anim-live inline-block h-2 w-2 rounded-full bg-ok-500" />
            {t.login.asideBadge}
          </p>
          <p className="mt-4 max-w-lg text-3xl xl:text-4xl font-semibold leading-tight text-ink">
            {t.landing.titleStart}
            <span className="text-primary">{t.landing.titleAccent}</span>
          </p>
          <p className="mt-3 max-w-md text-ink-2">{t.login.asideText}</p>
          <p className="mt-8 text-[11px] text-muted">{t.common.photoCredit}</p>
        </div>
      </aside>
    </div>
  );
}
