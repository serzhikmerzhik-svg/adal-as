"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { load } from "@2gis/mapgl";
import { FACILITY_KIND_LABEL } from "@/lib/risk/labels";
import { AKTAU_VIEW, REGION_VIEW, ZOOM_BUTTON_CLASS, type MapSchool, type SchoolMapProps } from "./shared";

type MapglApi = Awaited<ReturnType<typeof load>>;
type MapglMap = InstanceType<MapglApi["Map"]>;
type MapglHtmlMarker = InstanceType<MapglApi["HtmlMarker"]>;

const DOT_SIZE = 16;
const FLY = { duration: 1200 };

/** 2GIS MapGL векторлық картасы. Мектептер — тәуекел түсімен боялған HTML-нүктелер. */
export function DgisMap({ schools, basePath, apiKey }: SchoolMapProps & { apiKey: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<MapglApi | null>(null);
  const mapRef = useRef<MapglMap | null>(null);
  const markersRef = useRef<MapglHtmlMarker[]>([]);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<MapSchool | null>(null);

  useEffect(() => {
    let cancelled = false;
    load().then((api) => {
      if (cancelled || !containerRef.current) return;
      apiRef.current = api;
      const map = new api.Map(containerRef.current, {
        center: [REGION_VIEW.lng, REGION_VIEW.lat],
        zoom: REGION_VIEW.zoom,
        key: apiKey,
        lang: "ru",
      });
      map.on("click", () => setSelected(null));
      mapRef.current = map;
      setReady(true);
    });
    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.destroy());
      markersRef.current = [];
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, [apiKey]);

  // SWR әр 5 секунд сайын жаңа деректер әкеледі — нүктелерді қайта саламыз (22 маркер, арзан).
  useEffect(() => {
    const api = apiRef.current;
    const map = mapRef.current;
    if (!ready || !api || !map) return;

    markersRef.current.forEach((m) => m.destroy());
    markersRef.current = schools.map((school) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = `dgis-dot dgis-${school.riskLevel} dgis-kind-${school.kind}`;
      dot.title = school.name;
      dot.setAttribute("aria-label", `${school.name}: ${school.riskScore}`);
      dot.addEventListener("click", () => setSelected(school));
      return new api.HtmlMarker(map, {
        coordinates: [school.lng, school.lat],
        html: dot,
        anchor: [DOT_SIZE / 2, DOT_SIZE / 2],
        interactive: true,
        zIndex: school.riskLevel === "RED" ? 3 : school.riskLevel === "YELLOW" ? 2 : 1,
      });
    });
  }, [schools, ready]);

  // Таңдалған мектептің балы жаңарса, карточка да жаңарады.
  const selectedLive = selected ? (schools.find((s) => s.id === selected.id) ?? selected) : null;

  function flyTo(view: { lat: number; lng: number; zoom: number }) {
    mapRef.current?.setCenter([view.lng, view.lat], FLY);
    mapRef.current?.setZoom(view.zoom, FLY);
  }

  return (
    <div className="relative h-full w-full rounded-lg overflow-hidden isolate">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Оң жақ жоғарғы бұрышта 2GIS-тің өз масштаб батырмалары тұр */}
      <div className="absolute top-3 left-3 z-10 flex shadow-sm">
        <button type="button" className={ZOOM_BUTTON_CLASS} onClick={() => flyTo(AKTAU_VIEW)}>
          Ақтау
        </button>
        <button type="button" className={`${ZOOM_BUTTON_CLASS} border-l-0`} onClick={() => flyTo(REGION_VIEW)}>
          Облыс
        </button>
      </div>

      {selectedLive && (
        <div className="anim-slide-in absolute left-3 bottom-8 z-10 bg-white rounded-md shadow-md p-3 pr-8 max-w-[260px]">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="absolute top-1.5 right-2 text-slate-400 hover:text-ink"
            aria-label="Жабу"
          >
            ×
          </button>
          <p className="font-semibold text-sm text-ink">{selectedLive.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {FACILITY_KIND_LABEL[selectedLive.kind]} · Тәуекел балы: {selectedLive.riskScore}
          </p>
          {basePath && (
            <Link href={`${basePath}/${selectedLive.id}`} className="text-brand-700 underline text-xs mt-1 inline-block">
              Толық ақпарат
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
