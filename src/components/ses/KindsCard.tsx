import { FACILITY_KIND_PLURAL, FACILITY_KINDS } from "@/lib/risk/labels";
import type { Kind, OverviewSchool } from "./types";

/** Нысан түрлері бойынша тәуекел деңгейлерінің бөлінісі (жасыл / сары / қызыл). */
export function KindsCard({ schools, kinds = FACILITY_KINDS }: { schools: OverviewSchool[]; kinds?: readonly Kind[] }) {
  const rows = kinds.map((kind) => {
    const items = schools.filter((s) => s.kind === kind);
    const count = (level: string) => items.filter((s) => s.riskLevel === level).length;
    return { kind, total: items.length, green: count("GREEN"), yellow: count("YELLOW"), red: count("RED") };
  });
  const max = Math.max(1, ...rows.map((r) => r.total));

  return (
    <section className="card p-5">
      <h2 className="text-[17px] font-semibold text-ink mb-4">Нысан түрлері бойынша</h2>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.kind} className="grid grid-cols-[140px_1fr_32px] items-center gap-3 text-sm">
            <span className="text-ink truncate">{FACILITY_KIND_PLURAL[r.kind]}</span>
            <div
              className="flex h-3 gap-0.5"
              style={{ width: `${Math.max(8, (r.total / max) * 100)}%` }}
              title={`Жасыл ${r.green} · Сары ${r.yellow} · Қызыл ${r.red}`}
            >
              {r.green > 0 && <i className="h-full rounded-sm bg-ok-600" style={{ flexGrow: r.green, minWidth: 6 }} />}
              {r.yellow > 0 && <i className="h-full rounded-sm bg-warn-500" style={{ flexGrow: r.yellow, minWidth: 8 }} />}
              {r.red > 0 && <i className="h-full rounded-sm bg-bad-600" style={{ flexGrow: r.red, minWidth: 8 }} />}
            </div>
            <span className="text-right font-mono tabular-nums text-ink">{r.total}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        {rows.map((r) =>
          r.yellow + r.red > 0 ? (
            <span key={r.kind}>
              {FACILITY_KIND_PLURAL[r.kind]}: {r.yellow > 0 && `${r.yellow} сары`}
              {r.yellow > 0 && r.red > 0 && ", "}
              {r.red > 0 && `${r.red} қызыл`}
            </span>
          ) : null,
        )}
      </p>
    </section>
  );
}
