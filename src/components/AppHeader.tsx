"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "./Logo";
import { LogoutButton } from "./LogoutButton";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { hms } from "@/lib/format";
import { useT } from "@/i18n/client";

function LiveClock() {
  const t = useT();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  return (
    <div className="hidden xl:flex items-center gap-2 text-xs text-muted">
      <i className="anim-live inline-block w-2 h-2 rounded-full bg-ok-600" />
      <span className="font-mono leading-tight">
        {now ? hms(now) : "--:--:--"} ·
        <br />
        {t.header.live}
      </span>
    </div>
  );
}

export function AppHeader({
  subtitle,
  roleLabel,
  backHref,
  sesNav = false,
  live = false,
}: {
  subtitle: string;
  roleLabel?: string;
  backHref?: string;
  sesNav?: boolean;
  live?: boolean;
}) {
  const t = useT();
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/ses" ? pathname === "/ses" : pathname === href || pathname.startsWith(`${href}/`);
  const nav = [
    { href: "/ses", label: t.header.nav.overview },
    { href: "/ses/alerts", label: t.header.nav.alerts },
    { href: "/ses/schools", label: t.header.nav.facilities },
    { href: "/ses/suppliers", label: t.header.nav.suppliers },
    { href: "/ses/menu-plan", label: t.header.nav.plan },
  ];

  return (
    <header className="sticky top-0 z-50 bg-surface border-b border-line">
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 h-16 flex items-center gap-4">
        {backHref && (
          <Link href={backHref} className="text-muted hover:text-ink text-xl leading-none" aria-label={t.common.back}>
            ←
          </Link>
        )}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <LogoMark />
          <span className="font-bold text-ink leading-tight">Adal As</span>
        </Link>
        <span className="hidden sm:block h-8 w-px bg-line" />
        <p className="hidden sm:block text-sm text-muted leading-tight max-w-[190px] line-clamp-2">{subtitle}</p>

        {sesNav && (
          <nav className="hidden md:flex items-center gap-1 ml-2">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  isActive(item.href) ? "bg-page font-semibold text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-3 sm:gap-4">
          {live && <LiveClock />}
          <LanguageSwitcher className="hidden sm:inline-flex" />
          {roleLabel && <span className="hidden lg:block text-sm text-ink leading-tight text-right">{roleLabel}</span>}
          <LogoutButton />
        </div>
      </div>

      {sesNav && (
        <nav className="md:hidden flex gap-1 overflow-x-auto px-4 pb-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm ${isActive(item.href) ? "bg-page font-semibold text-ink" : "text-muted"}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
      {/* Телефонда тіл ауыстырғышы екінші жолда. */}
      <div className="sm:hidden flex justify-end px-4 pb-2">
        <LanguageSwitcher />
      </div>
    </header>
  );
}
