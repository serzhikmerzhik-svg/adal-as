"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { AppHeader } from "@/components/AppHeader";
import { LevelPill } from "@/components/ui";
import { fetcher, type Kind, type Level } from "@/components/ses/types";
import { daysSince, placeLabel, shortName } from "@/lib/format";
import { FACILITY_KIND_LABEL, FACILITY_KIND_PLURAL, LEVEL_LABEL } from "@/lib/risk/labels";

type Row = {
  id: string;
  name: string;
  kind: Kind;
  rubric: string | null;
  address: string;
  riskScore: number;
  riskLevel: Level;
  lastInspectionAt: string | null;
  district: { name: string };
};

const PAGE = 50;

export default function SchoolsPage() {
  const { data } = useSWR<{ schools: Row[] }>("/api/ses/schools", fetcher, { refreshInterval: 30000 });
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"ALL" | Kind>("ALL");
  const [district, setDistrict] = useState("ALL");
  const [level, setLevel] = useState<"ALL" | Level>("ALL");
  const [limit, setLimit] = useState(PAGE);

  const schools = useMemo(() => data?.schools ?? [], [data]);
  const districts = useMemo(() => Array.from(new Set(schools.map((s) => s.district.name))), [schools]);
  const query = q.trim().toLowerCase();
  const filtered = schools.filter(
    (s) =>
      (kind === "ALL" || s.kind === kind) &&
      (district === "ALL" || s.district.name === district) &&
      (level === "ALL" || s.riskLevel === level) &&
      (!query || s.name.toLowerCase().includes(query) || s.address.toLowerCase().includes(query)),
  );

  return (
    <div className="min-h-screen pb-12">
      <AppHeader subtitle="Нысандар · Ақтау қаласы" roleLabel="Инспектор · СЭС" sesNav live />
      <main className="max-w-[1440px] mx-auto px-4 lg:px-8 py-6 space-y-4">
        <section className="card p-4 flex flex-wrap items-center gap-2">
          <input
            className="field !w-full sm:!w-72"
            placeholder="Атауы немесе мекенжайы бойынша іздеу"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PAGE);
            }}
          />
          <select className="field !w-auto" value={kind} onChange={(e) => setKind(e.target.value as "ALL" | Kind)} aria-label="Түрі">
            <option value="ALL">Барлық түр</option>
            {(["SCHOOL", "KINDERGARTEN", "CANTEEN"] as const).map((k) => (
              <option key={k} value={k}>{FACILITY_KIND_PLURAL[k]}</option>
            ))}
          </select>
          <select className="field !w-auto" value={district} onChange={(e) => setDistrict(e.target.value)} aria-label="Аудан">
            <option value="ALL">Барлық аудан</option>
            {districts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select className="field !w-auto" value={level} onChange={(e) => setLevel(e.target.value as "ALL" | Level)} aria-label="Деңгей">
            <option value="ALL">Барлық деңгей</option>
            {(["RED", "YELLOW", "GREEN"] as const).map((l) => (
              <option key={l} value={l}>{LEVEL_LABEL[l]}</option>
            ))}
          </select>
          <span className="ml-auto text-sm text-muted">{filtered.length} нысан · 2GIS деректері</span>
        </section>

        <section className="card p-5">
          {!data ? (
            <div className="h-96 animate-pulse" />
          ) : (
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="table-head text-left border-b border-line">
                    <th className="py-2 pr-3 font-medium">Нысан</th>
                    <th className="py-2 pr-3 font-medium">Түрі</th>
                    <th className="py-2 pr-3 font-medium">Аудан</th>
                    <th className="py-2 pr-3 font-medium">Мекенжай</th>
                    <th className="py-2 pr-3 font-medium">Балл</th>
                    <th className="py-2 pr-3 font-medium">Деңгей</th>
                    <th className="py-2 font-medium">Соңғы тексеру</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, limit).map((s) => (
                    <tr key={s.id} className="border-b border-line last:border-0 hover:bg-page/60">
                      <td className="py-2.5 pr-3">
                        <Link href={`/ses/school/${s.id}`} className="font-semibold text-ink hover:text-primary" title={s.name}>
                          {shortName(s.name, s.kind)}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3 text-muted">{s.rubric ?? FACILITY_KIND_LABEL[s.kind]}</td>
                      <td className="py-2.5 pr-3">{placeLabel(s.district.name, s.address)}</td>
                      <td className="py-2.5 pr-3 text-muted">{s.address}</td>
                      <td className="py-2.5 pr-3 font-mono tabular-nums">{s.riskScore}</td>
                      <td className="py-2.5 pr-3"><LevelPill level={s.riskLevel} /></td>
                      <td className="py-2.5 text-muted whitespace-nowrap">{daysSince(s.lastInspectionAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > limit && (
                <button type="button" className="btn btn-outline btn-sm mt-4" onClick={() => setLimit(limit + PAGE)}>
                  Тағы көрсету ({filtered.length - limit})
                </button>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
