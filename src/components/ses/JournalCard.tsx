import { ddmm, shortName } from "@/lib/format";
import type { Stats } from "./types";

function Progress({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink">{label}</span>
        <span className="font-mono tabular-nums text-ink">
          {value} / {total}
        </span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-page overflow-hidden">
        <div className="h-full rounded-full bg-navy-700 transition-[width] duration-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function JournalCard({ journal }: { journal: Stats["journal"] }) {
  const today = ddmm(new Date());
  const rest = journal.missingCount - journal.missing.length;

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[17px] font-semibold text-ink">Бүгінгі асхана журналдары</h2>
        <span className="font-mono text-xs text-muted">{today}</span>
      </div>
      <div className="space-y-4">
        <Progress label="Порция фотосы жүктелді" value={journal.withPhoto} total={journal.total} />
        <Progress label="Температура енгізілді" value={journal.withTemp} total={journal.total} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-page px-3 py-2.5">
          <p className="text-xs text-muted">Партия қабылданды</p>
          <p className="text-2xl font-semibold tabular-nums text-ink">{journal.deliveriesToday}</p>
        </div>
        <div className={`rounded-lg px-3 py-2.5 ${journal.violationsToday > 0 ? "bg-warn-50" : "bg-page"}`}>
          <p className={`text-xs ${journal.violationsToday > 0 ? "text-warn-700" : "text-muted"}`}>Температура бұзушылығы</p>
          <p className={`text-2xl font-semibold tabular-nums ${journal.violationsToday > 0 ? "text-warn-700" : "text-ink"}`}>
            {journal.violationsToday}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">
        {journal.missingCount === 0
          ? "Барлық нысан журналды толтырды."
          : `Журналы толтырылмаған: ${journal.missing.map((m) => shortName(m.name, m.kind)).join(", ")}${rest > 0 ? ` және тағы ${rest}` : ""}`}
      </p>
    </section>
  );
}
