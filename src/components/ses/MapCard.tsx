"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { LevelDot } from "@/components/ui";
import { AKTAU_VIEW, type MapFocus } from "@/components/map/shared";
import { FACILITY_KIND_PLURAL } from "@/lib/risk/labels";
import type { Kind, OverviewSchool, Unannounced } from "./types";

const SchoolMap = dynamic(() => import("@/components/SchoolMap").then((m) => m.SchoolMap), {
  ssr: false,
  loading: () => <div className="h-full w-full rounded-lg bg-page animate-pulse" />,
});

export function MapCard({
  schools,
  unannounced,
  basePath,
  focus,
  onFocus,
}: {
  schools: OverviewSchool[];
  unannounced: Unannounced[];
  basePath?: string;
  focus: MapFocus | null;
  onFocus: (f: MapFocus) => void;
}) {
  const [district, setDistrict] = useState("ALL");
  const [kind, setKind] = useState<"ALL" | Kind>("ALL");

  const districts = useMemo(() => Array.from(new Set(schools.map((s) => s.district.name))), [schools]);
  const addresses = useMemo(() => new Map(unannounced.map((u) => [u.id, u.address])), [unannounced]);

  const visible = schools
    .filter((s) => (district === "ALL" || s.district.name === district) && (kind === "ALL" || s.kind === kind))
    .map((s) => (addresses.has(s.id) ? { ...s, address: addresses.get(s.id) } : s));

  const count = (level: string) => visible.filter((s) => s.riskLevel === level).length;

  function selectDistrict(value: string) {
    setDistrict(value);
    const points = schools.filter((s) => value === "ALL" || s.district.name === value);
    if (points.length) onFocus({ key: Date.now(), kind: "points", points });
  }

  return (
    <section className="card p-5 flex flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
        <h2 className="text-[17px] font-semibold text-ink">Нысандар картасы</h2>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1.5"><LevelDot level="GREEN" /> Жасыл {count("GREEN")}</span>
          <span className="flex items-center gap-1.5"><LevelDot level="YELLOW" /> Сары {count("YELLOW")}</span>
          <span className="flex items-center gap-1.5"><LevelDot level="RED" /> Қызыл {count("RED")}</span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted" htmlFor="map-district">Аудан</label>
          <select id="map-district" className="field !w-auto !py-1.5" value={district} onChange={(e) => selectDistrict(e.target.value)}>
            <option value="ALL">Барлық аудан</option>
            {districts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            aria-label="Нысан түрі"
            className="field !w-auto !py-1.5"
            value={kind}
            onChange={(e) => setKind(e.target.value as "ALL" | Kind)}
          >
            <option value="ALL">Барлық түр</option>
            {(["SCHOOL", "KINDERGARTEN", "CANTEEN"] as const).map((k) => (
              <option key={k} value={k}>{FACILITY_KIND_PLURAL[k]}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-outline !py-1.5"
            onClick={() => onFocus({ key: Date.now(), kind: "view", ...AKTAU_VIEW })}
          >
            Ақтауға жақындату
          </button>
        </div>
      </div>

      <div className="h-[430px] rounded-lg border border-line overflow-hidden">
        <SchoolMap schools={visible} basePath={basePath} focus={focus} controls={false} />
      </div>

      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5"><i className="inline-block w-2.5 h-2.5 rounded-full bg-muted" /> мектеп</span>
        <span className="flex items-center gap-1.5"><i className="inline-block w-2.5 h-2.5 rounded-full border-2 border-muted" /> балабақша</span>
        <span className="flex items-center gap-1.5"><i className="inline-block w-2.5 h-2.5 rounded-[2px] bg-muted" /> асхана</span>
        <span>· сандар — аудандағы нысандар, басқанда жақындайды</span>
        <span className="ml-auto">Деректер: 2GIS</span>
      </p>
    </section>
  );
}
