"use client";

import Link from "next/link";
import { alertText } from "@/lib/alertText";
import { hm, placeLabel, shortName } from "@/lib/format";
import { useLocale, useT } from "@/i18n/client";
import type { OverviewAlert } from "./types";

export function AlertBanner({ alert }: { alert: OverviewAlert }) {
  const t = useT();
  const locale = useLocale();
  const s = alert.school;
  // Улану кластерінде мәзір бұғатталады және партия басқа нысандарға қадағаланады; тоңазытқыш ақауында — жоқ.
  const cluster = !alert.rule;
  return (
    <div className="anim-slide-down flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-bad-300 bg-bad-50 px-5 py-3">
      <i className="anim-live inline-block h-2.5 w-2.5 rounded-full bg-bad-600" />
      <p className="min-w-[240px] flex-1 text-sm text-ink">
        <span className="font-semibold text-bad-700">{t.ses.alerts.bannerTitle(hm(alert.createdAt))}</span>{" "}
        {shortName(s.name, s.kind, locale)} ({placeLabel(s.district.name, s.address, locale)}): {alertText(alert, t, locale)}
        {cluster && `. ${t.ses.alerts.bannerMenu}`}
        {cluster && alert.tracedCount > 0 && `. ${t.ses.alerts.traced(alert.tracedCount)}`}.
      </p>
      <Link href={`/ses/alerts/${alert.id}`} className="btn btn-primary">
        {t.ses.alerts.open}
      </Link>
    </div>
  );
}
