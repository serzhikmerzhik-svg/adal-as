"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_COOKIE, LOCALE_NAME, LOCALE_SHORT, type Locale } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/client";

/** Қаз / Рус / Eng: тілді cookie-ге жазып, серверден бетті қайта сызады. */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div className={`seg ${pending ? "opacity-70" : ""} ${className}`} role="group" aria-label={t.common.language}>
      {LOCALES.map((l) => (
        <button key={l} type="button" lang={l} aria-pressed={l === locale} aria-label={LOCALE_NAME[l]} onClick={() => choose(l)}>
          {LOCALE_SHORT[l]}
        </button>
      ))}
    </div>
  );
}
