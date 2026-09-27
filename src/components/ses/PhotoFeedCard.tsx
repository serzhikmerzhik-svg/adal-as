"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { FACILITY_KIND_LABEL } from "@/lib/risk/labels";
import { hm, shortName } from "@/lib/format";
import { issueLabels } from "@/lib/photo/verdict";
import { fetcher, type PhotoFeed, type PhotoRow, type PhotoStatus } from "./types";

export const PHOTO_STATUS: Record<PhotoStatus, { label: string; className: string }> = {
  PENDING: { label: "ИИ талдап жатыр…", className: "bg-primary-soft text-primary" },
  OK: { label: "ИИ: қалыпты", className: "bg-ok-100 text-ok-700" },
  FLAGGED: { label: "ИИ: күмәнді", className: "bg-warn-100 text-warn-700" },
  ERROR: { label: "ИИ жауап бермеді", className: "bg-page text-muted border border-line" },
  DISABLED: { label: "ИИ қосылмаған", className: "bg-page text-muted border border-line" },
};

// Инспектор кезегі жоғарыда: қаралмаған күмәнді фотолар, содан кейін талданып жатқандар, қалғаны уақыт бойынша.
function rank(p: PhotoRow) {
  if (p.aiStatus === "FLAGGED" && !p.reviewedAt) return 0;
  if (p.aiStatus === "PENDING") return 1;
  return 2;
}

function PhotoItem({ photo, readOnly, onReviewed }: { photo: PhotoRow; readOnly: boolean; onReviewed: () => void }) {
  const [busy, setBusy] = useState(false);
  const status = PHOTO_STATUS[photo.aiStatus];
  const name = shortName(photo.school.name, photo.school.kind);
  const dish = photo.menuItem?.name ?? "Тағам";

  async function review() {
    setBusy(true);
    try {
      await fetch(`/api/ses/photos/${photo.id}`, { method: "PATCH" });
      onReviewed();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="anim-fade-up flex gap-3 rounded-lg border border-line p-2.5">
      <a
        href={photo.imageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-primary"
        aria-label={`Фотоны үлкейту: ${dish}, ${name}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.imageUrl}
          alt={`${dish} порциясы, ${name}`}
          width={80}
          height={80}
          loading="lazy"
          className="h-20 w-20 rounded-md bg-page object-cover"
        />
      </a>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <Link href={`/ses/school/${photo.school.id}`} className="truncate font-semibold text-ink hover:text-primary" title={photo.school.name}>
            {name}
          </Link>
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted">{hm(photo.createdAt)}</span>
        </div>
        <p className="truncate text-xs text-muted">
          {FACILITY_KIND_LABEL[photo.school.kind]} · {photo.school.district.name} · {dish}
          {photo.menuItem?.standardPortionG ? ` · ${photo.menuItem.standardPortionG} г` : ""}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ${status.className}`}>
            {photo.aiStatus === "PENDING" && <i aria-hidden="true" className="anim-live mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary" />}
            {status.label}
          </span>
          {photo.aiPortionPct !== null && <span className="text-xs text-muted">порция ≈ {photo.aiPortionPct}%</span>}
          {issueLabels(photo.aiIssues).map((label) => (
            <span key={label} className="text-xs font-medium text-warn-700">
              {label}
            </span>
          ))}
        </div>
        {photo.aiSummary && photo.aiStatus !== "PENDING" && (
          <p className="mt-1 line-clamp-2 text-xs text-muted" title={photo.aiModel ? `Модель: ${photo.aiModel}` : undefined}>
            {photo.aiSummary}
          </p>
        )}
        {photo.reviewedAt ? (
          <p className="mt-1 text-xs font-medium text-ok-700">Инспектор қарады · {hm(photo.reviewedAt)}</p>
        ) : (
          !readOnly &&
          photo.aiStatus === "FLAGGED" && (
            <button type="button" onClick={review} disabled={busy} className="btn btn-sm btn-outline mt-2">
              {busy ? "..." : "Қаралды"}
            </button>
          )
        )}
      </div>
    </li>
  );
}

/** Асханалар жүктеген порция фотолары: ИИ бәрін тексереді, инспектор тек күмәнділерін қарайды. */
export function PhotoFeedCard({
  readOnly = false,
  include,
}: {
  readOnly?: boolean;
  /** Мысалы, Білім бөлімі тек мектеп пен балабақша фотоларын көреді. */
  include?: (photo: PhotoRow) => boolean;
}) {
  const { data, mutate, error } = useSWR<PhotoFeed>("/api/ses/photos", fetcher, { refreshInterval: 5000 });
  const [filter, setFilter] = useState<"all" | "flagged">("all");

  const photos = (data?.photos ?? []).filter((p) => !include || include(p));
  const flagged = photos.filter((p) => p.aiStatus === "FLAGGED" && !p.reviewedAt);
  const pending = photos.filter((p) => p.aiStatus === "PENDING").length;
  const list = (filter === "flagged" ? flagged : photos).slice().sort((a, b) => rank(a) - rank(b));

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div>
          <h2 className="text-[17px] font-semibold text-ink">Порция фотолары · ИИ тексеруі</h2>
          <p className="text-xs text-muted" aria-live="polite" aria-atomic="true">
            {data
              ? `Бүгін ${photos.length} фото · ${flagged.length} күмәнді${pending ? ` · ${pending} тексерілуде` : ""}`
              : "Жүктелуде…"}
          </p>
        </div>
        <div className="seg" role="group" aria-label="Фото сүзгісі">
          <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
            Барлығы {photos.length}
          </button>
          <button type="button" aria-pressed={filter === "flagged"} onClick={() => setFilter("flagged")}>
            Күмәнді {flagged.length}
          </button>
        </div>
      </div>

      {error && !data ? (
        <p className="mt-4 text-sm text-bad-600">Фотоларды жүктеу мүмкін болмады. 5 секундтан кейін қайта көреді.</p>
      ) : list.length === 0 ? (
        <p className="mt-4 rounded-lg bg-page px-4 py-6 text-center text-sm text-muted">
          {filter === "flagged"
            ? "Қаралмаған күмәнді фото жоқ."
            : "Бүгін әзірге фото жоқ. Асхана порция фотосын жүктегенде ол осында 5 секунд ішінде шығады, ИИ оны мәзір мен нормамен салыстырады."}
        </p>
      ) : (
        <ul className="mt-4 grid max-h-[520px] grid-cols-1 gap-2.5 overflow-y-auto md:grid-cols-2 xl:grid-cols-3">
          {list.map((photo) => (
            <PhotoItem key={photo.id} photo={photo} readOnly={readOnly} onReviewed={() => mutate()} />
          ))}
        </ul>
      )}
    </section>
  );
}
