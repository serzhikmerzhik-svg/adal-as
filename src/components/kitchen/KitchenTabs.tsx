"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/client";

/** Асхана бетінің қойындылары: күнделікті журнал бөлек, құрылғылар мен QR-тұғыр бөлек. */
export function KitchenTabs() {
  const t = useT();
  const pathname = usePathname();
  const tabs: [string, string][] = [
    ["/kitchen", t.kitchen.tabs.journal],
    ["/kitchen/devices", t.kitchen.tabs.devices],
    ["/kitchen/qr", t.kitchen.tabs.qr],
  ];
  return (
    <nav aria-label={t.kitchen.subtitle} className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-page p-1 print:hidden">
      {tabs.map(([href, label]) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-2 py-2 text-center text-sm font-medium transition-colors ${
              active ? "bg-surface-2 text-primary shadow-[inset_0_0_0_1px_var(--color-line-strong)]" : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
