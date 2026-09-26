"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { LevelDot } from "@/components/ui";
import { AKTAU_VIEW, type MapFocus } from "@/components/map/shared";
import { FACILITY_KIND_LABEL, FACILITY_KINDS, LEVEL_LABEL, isEducation } from "@/lib/risk/labels";
import type { Kind, Level, OverviewSchool, Unannounced } from "./types";

const SchoolMap = dynamic(() => import("@/components/SchoolMap").then((m) => m.SchoolMap), {
  ssr: false,
  loading: () => <div className="h-full w-full rounded-lg bg-page animate-pulse" />,
});

const LEVELS: Level[] = ["GREEN", "YELLOW", "RED"];

/** Картадағы белгінің пішіні: білім беру — дөңгелек, қоғамдық тамақтану — шаршы. */
function KindShape({ kind }: { kind: Kind }) {
  const shape = isEducation(kind) ? "rounded-full" : "rounded-[2px]";
  const fill = kind === "KINDERGARTEN" ? "border-2 border-current" : "bg-current";
  return <i aria-hidden="true" className={`inline-block w-2.5 h-2.5 shrink-0 ${shape} ${fill}`} />;
}

function Chip({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className="chip" aria-pressed={active} onClick={onClick}>
      {children}
      <span className="chip-count">{count}</span>
    </button>
  );
}

export function MapCard({
  schools,
  unannounced,
  basePath,
  focus,
  onFocus,
  kinds = FACILITY_KINDS,
}: {
  schools: OverviewSchool[];
  unannounced: Unannounced[];
  basePath?: string;
  focus: MapFocus | null;
  onFocus: (f: MapFocus) => void;
  /** Сүзгіде көрсетілетін түрлер (Білім бөлімі тек мектеп пен балабақшаны көреді). */
  kinds?: readonly Kind[];
}) {
  const [kind, setKind] = useState<"ALL" | Kind>("ALL");
  const [level, setLevel] = useState<"ALL" | Level>("ALL");

  const addresses = useMemo(() => new Map(unannounced.map((u) => [u.id, u.address])), [unannounced]);
  const matchKind = (s: OverviewSchool, k: "ALL" | Kind) => k === "ALL" || s.kind === k;
  const matchLevel = (s: OverviewSchool, l: "ALL" | Level) => l === "ALL" || s.riskLevel === l;

  const visible = schools
    .filter((s) => matchKind(s, kind) && matchLevel(s, level))
    .map((s) => (addresses.has(s.id) ? { ...s, address: addresses.get(s.id) } : s));

  // Әр батырмадағы сан екінші сүзгіні ескереді: «Мейрамхана» таңдалса, «Сары 2» — сары мейрамханалар.
  const kindCount = (k: "ALL" | Kind) => schools.filter((s) => matchKind(s, k) && matchLevel(s, level)).length;
  const levelCount = (l: "ALL" | Level) => schools.filter((s) => matchKind(s, kind) && matchLevel(s, l)).length;

  function apply(nextKind: "ALL" | Kind, nextLevel: "ALL" | Level) {
    setKind(nextKind);
    setLevel(nextLevel);
    const points = schools.filter((s) => matchKind(s, nextKind) && matchLevel(s, nextLevel));
    if (points.length === 0) return;
    if (nextKind === "ALL" && nextLevel === "ALL") onFocus({ key: Date.now(), kind: "view", ...AKTAU_VIEW });
    else onFocus({ key: Date.now(), kind: "points", points });
  }

  return (
    <section className="card p-5 flex flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
        <h2 className="text-[17px] font-semibold text-ink">Нысандар картасы</h2>
        <span className="text-xs text-muted">
          Көрсетілгені: <span className="font-mono tabular-nums text-ink">{visible.length}</span> / {schools.length}
        </span>
        <button
          type="button"
          className="ml-auto btn btn-sm btn-outline"
          onClick={() => onFocus({ key: Date.now(), kind: "view", ...AKTAU_VIEW })}
        >
          Ақтауға жақындату
        </button>
      </div>

      <div role="group" aria-label="Нысан түрі бойынша сүзгі" className="flex flex-wrap gap-1.5">
        <Chip active={kind === "ALL"} onClick={() => apply("ALL", level)} count={kindCount("ALL")}>
          Барлық нысан
        </Chip>
        {kinds.map((k) => (
          <Chip key={k} active={kind === k} onClick={() => apply(kind === k ? "ALL" : k, level)} count={kindCount(k)}>
            <KindShape kind={k} />
            {FACILITY_KIND_LABEL[k]}
          </Chip>
        ))}
      </div>

      <div role="group" aria-label="Тәуекел деңгейі бойынша сүзгі" className="mt-2 flex flex-wrap gap-1.5">
        <Chip active={level === "ALL"} onClick={() => apply(kind, "ALL")} count={levelCount("ALL")}>
          Барлық деңгей
        </Chip>
        {LEVELS.map((l) => (
          <Chip key={l} active={level === l} onClick={() => apply(kind, level === l ? "ALL" : l)} count={levelCount(l)}>
            <LevelDot level={l} />
            {LEVEL_LABEL[l]}
          </Chip>
        ))}
      </div>

      <div className="relative mt-3 h-[430px] rounded-lg border border-line overflow-hidden">
        <SchoolMap schools={visible} basePath={basePath} focus={focus} controls={false} />
        {visible.length === 0 && (
          <p className="absolute inset-x-0 top-3 z-10 mx-auto w-fit rounded-md bg-white/95 px-3 py-1.5 text-sm text-muted shadow-sm">
            Бұл сүзгі бойынша нысан жоқ
          </p>
        )}
      </div>

      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5"><KindShape kind="SCHOOL" /> білім беру</span>
        <span className="flex items-center gap-1.5"><KindShape kind="CAFE" /> қоғамдық тамақтану</span>
        <span className="ml-auto">Орналасуы: 2GIS</span>
      </p>
    </section>
  );
}
