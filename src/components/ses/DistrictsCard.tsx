import type { OverviewSchool } from "./types";

export function DistrictsCard({ schools }: { schools: OverviewSchool[] }) {
  const rows = new Map<string, { name: string; green: number; yellow: number; red: number; total: number }>();
  for (const s of schools) {
    const r = rows.get(s.district.name) ?? { name: s.district.name, green: 0, yellow: 0, red: 0, total: 0 };
    r.total += 1;
    if (s.riskLevel === "GREEN") r.green += 1;
    else if (s.riskLevel === "YELLOW") r.yellow += 1;
    else r.red += 1;
    rows.set(s.district.name, r);
  }
  const list = Array.from(rows.values()).sort((a, b) => b.total - a.total);
  const max = Math.max(1, ...list.map((r) => r.total));
  // Шағын аудандардың жолағы көрінуі үшін ұзындық логарифм бойынша есептеледі (Ақтауда 340+, Түпқарағанда 3).
  const width = (n: number) => (n === 0 ? 0 : Math.max(6, (Math.log(n + 1) / Math.log(max + 1)) * 100));

  return (
    <section className="card p-5">
      <h2 className="text-[17px] font-semibold text-ink mb-4">Аудандар бойынша</h2>
      <div className="space-y-2.5">
        {list.map((r) => (
          <div key={r.name} className="grid grid-cols-[120px_1fr_36px] items-center gap-3 text-sm">
            <span className="text-ink truncate">{r.name}</span>
            <div className="flex h-3 gap-0.5" style={{ width: `${width(r.total)}%` }} title={`Жасыл ${r.green} · Сары ${r.yellow} · Қызыл ${r.red}`}>
              <i className="h-full rounded-sm bg-ok-600" style={{ flexGrow: r.green, minWidth: r.green ? 6 : 0 }} />
              {r.yellow > 0 && <i className="h-full rounded-sm bg-warn-500" style={{ flexGrow: r.yellow, minWidth: 8 }} />}
              {r.red > 0 && <i className="h-full rounded-sm bg-bad-600" style={{ flexGrow: r.red, minWidth: 8 }} />}
            </div>
            <span className="text-right font-mono tabular-nums text-ink">{r.total}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted">Барлығы {schools.length} нысан · 2GIS деректері</p>
    </section>
  );
}
