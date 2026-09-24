import { LevelDot } from "@/components/ui";
import type { Overview } from "./types";

function Kpi({
  label,
  value,
  caption,
  dot,
  alarm = false,
  delay,
}: {
  label: string;
  value: number;
  caption: string;
  dot?: "GREEN" | "YELLOW" | "RED";
  alarm?: boolean;
  delay: number;
}) {
  return (
    <div
      className={`anim-fade-up rounded-xl border px-5 py-4 ${alarm ? "border-bad-300 bg-bad-50" : "border-line bg-white"}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className={`flex items-center gap-2 text-sm ${alarm ? "font-semibold text-bad-700" : "text-muted"}`}>
        {dot && <LevelDot level={dot} />}
        {label}
      </p>
      <p className={`mt-1 text-4xl font-semibold tabular-nums ${alarm ? "text-bad-600" : "text-ink"}`}>{value}</p>
      <p className={`mt-1 text-xs ${alarm ? "text-bad-700" : "text-muted"}`}>{caption}</p>
    </div>
  );
}

export function KpiRow({ kpi }: { kpi: Overview["kpi"] }) {
  const pct = kpi.total ? Math.round((kpi.green / kpi.total) * 100) : 0;
  return (
    <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <Kpi label="Жасыл нысандар" value={kpi.green} caption={`${kpi.total} нысанның ${pct}%-ы`} dot="GREEN" delay={0} />
      <Kpi label="Сары нысандар" value={kpi.yellow} caption="Кенет тексеруге ұсынылады" dot="YELLOW" delay={50} />
      <Kpi
        label="Қызыл нысандар"
        value={kpi.red}
        caption={kpi.red > 0 ? "Шұғыл: улану кластері" : "Қазір қызыл нысан жоқ"}
        dot="RED"
        alarm={kpi.red > 0}
        delay={100}
      />
      <Kpi label="Ашық алерттер" value={kpi.openAlerts} caption={`${kpi.openRed} қызыл · ${kpi.openYellow} сары`} delay={150} />
      <Kpi
        label="Мерзімі өткен нұсқамалар"
        value={kpi.overduePrescriptions}
        caption={kpi.overduePrescriptions > 0 ? "Орындау мерзімі өтті" : "Барлығы мерзімінде"}
        delay={200}
      />
    </section>
  );
}
