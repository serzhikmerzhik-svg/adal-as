import Link from "next/link";
import { hm, placeLabel, shortName } from "@/lib/format";
import type { OverviewAlert } from "./types";

export function AlertBanner({ alert }: { alert: OverviewAlert }) {
  const s = alert.school;
  return (
    <div className="anim-slide-down flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-bad-300 bg-bad-50 px-5 py-3">
      <i className="anim-live inline-block w-2.5 h-2.5 rounded-full bg-bad-600" />
      <p className="flex-1 min-w-[240px] text-sm text-ink">
        <span className="font-semibold text-bad-700">Жаңа қызыл алерт · {hm(alert.createdAt)}</span>{" "}
        {shortName(s.name, s.kind)} ({placeLabel(s.district.name, s.address)}): {alert.reason}. Бүгінгі мәзір бұғатталды
        {alert.tracedCount > 0 && `, сол партия тағы ${alert.tracedCount} нысанға жеткізілген`}.
      </p>
      <Link href={`/ses/alerts/${alert.id}`} className="btn btn-primary">
        Алертті ашу
      </Link>
    </div>
  );
}
