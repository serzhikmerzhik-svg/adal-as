"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { load } from "@2gis/mapgl";
import { FACILITY_KIND_LABEL } from "@/lib/risk/labels";
import { placeLabel, shortName, microdistrict } from "@/lib/format";
import { AKTAU_VIEW, ZOOM_BUTTON_CLASS, type MapSchool, type SchoolMapProps } from "./shared";

type MapglApi = Awaited<ReturnType<typeof load>>;
type MapglMap = InstanceType<MapglApi["Map"]>;
type MapglHtmlMarker = InstanceType<MapglApi["HtmlMarker"]>;

const PIN = 16;
const BUBBLE = 36;
const FLY = { duration: 900 };
// Бұдан кіші масштабта жасыл нысандар қала бойынша бір көпіршікке біріктіріледі:
// әйтпесе алыстан қарағанда нүктелер бір дақ болып, теңізге дейін шығып кетеді.
const DETAIL_ZOOM = 10;

function boundsOf(points: { lat: number; lng: number }[]) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const pad = points.length === 1 ? 0.01 : 0;
  return {
    southWest: [Math.min(...lngs) - pad, Math.min(...lats) - pad],
    northEast: [Math.max(...lngs) + pad, Math.max(...lats) + pad],
  };
}

/** Шағын аудан: 2GIS мекенжайынан ("13-й микрорайон, 51") немесе аудан атауынан ("14-мкр"). */
function mkrOf(s: MapSchool) {
  const fromAddress = s.address ? microdistrict(s.address) : null;
  if (fromAddress) return fromAddress;
  return s.district?.name.endsWith("-мкр") ? s.district.name : null;
}

function pinLabel(s: MapSchool) {
  const mkr = mkrOf(s);
  return mkr ? `${shortName(s.name, s.kind)} · ${mkr}` : shortName(s.name, s.kind);
}

/** 2GIS MapGL векторлық картасы. Нысандар — тәуекел түсімен боялған HTML-маркерлер. */
export function DgisMap({ schools, basePath, focus, controls = true, apiKey }: SchoolMapProps & { apiKey: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<MapglApi | null>(null);
  const mapRef = useRef<MapglMap | null>(null);
  const markersRef = useRef<MapglHtmlMarker[]>([]);
  const [ready, setReady] = useState(false);
  const [detailed, setDetailed] = useState(AKTAU_VIEW.zoom >= DETAIL_ZOOM);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    load().then((api) => {
      if (cancelled || !containerRef.current) return;
      apiRef.current = api;
      const map = new api.Map(containerRef.current, {
        center: [AKTAU_VIEW.lng, AKTAU_VIEW.lat],
        zoom: AKTAU_VIEW.zoom,
        key: apiKey,
        lang: "ru",
      });
      map.on("click", () => setSelectedId(null));
      map.on("zoomend", () => setDetailed(map.getZoom() >= DETAIL_ZOOM));
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

  // SWR әр 5 секунд сайын жаңа объектілер береді; маркерлерді тек деңгейлер, құрам немесе
  // масштаб белдеуі шынымен өзгергенде ғана қайта саламыз.
  const signature = useMemo(
    () => `${detailed}|${schools.map((s) => `${s.id}:${s.riskLevel}`).join(",")}`,
    [schools, detailed],
  );
  const schoolsRef = useRef(schools);
  useEffect(() => {
    schoolsRef.current = schools;
  }, [schools]);

  useEffect(() => {
    const api = apiRef.current;
    const map = mapRef.current;
    if (!ready || !api || !map) return;
    const current = schoolsRef.current;

    markersRef.current.forEach((m) => m.destroy());
    const markers: MapglHtmlMarker[] = [];

    const addPin = (s: MapSchool, withLabel: boolean) => {
      const el = document.createElement("div");
      el.className = `map-pin kind-${s.kind} level-${s.riskLevel}`;
      el.title = `${s.name} · балл ${s.riskScore}`;
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", `${s.name}: ${s.riskScore}`);
      const dot = document.createElement("span");
      dot.className = "map-dot";
      el.appendChild(dot);
      if (withLabel) {
        const label = document.createElement("span");
        label.className = "map-label";
        label.textContent = pinLabel(s);
        el.appendChild(label);
      }
      el.addEventListener("click", () => setSelectedId(s.id));
      markers.push(
        new api.HtmlMarker(map, {
          coordinates: [s.lng, s.lat],
          html: el,
          anchor: [PIN / 2, PIN / 2],
          interactive: true,
          zIndex: s.riskLevel === "RED" ? 4 : s.riskLevel === "YELLOW" ? 3 : 1,
        }),
      );
    };

    const flagged = current.filter((s) => s.riskLevel !== "GREEN");
    if (detailed) {
      current.filter((s) => s.riskLevel === "GREEN").forEach((s) => addPin(s, false));
    } else {
      // Мекенжайдың бірінші бөлігі — қала ("Ақтау, 14-мкр" → "Ақтау").
      const byCity = new Map<string, MapSchool[]>();
      for (const s of current) {
        const key = s.address?.split(",")[0].trim() || s.district?.name || "—";
        byCity.set(key, [...(byCity.get(key) ?? []), s]);
      }
      for (const [district, items] of byCity) {
        const el = document.createElement("div");
        el.className = "map-bubble";
        el.textContent = String(items.length);
        el.title = `${district}: ${items.length} нысан`;
        el.addEventListener("click", () =>
          map.fitBounds(boundsOf(items), { padding: { top: 40, bottom: 40, left: 40, right: 40 }, maxZoom: 13, animation: FLY }),
        );
        const lat = items.reduce((sum, s) => sum + s.lat, 0) / items.length;
        const lng = items.reduce((sum, s) => sum + s.lng, 0) / items.length;
        markers.push(
          new api.HtmlMarker(map, { coordinates: [lng, lat], html: el, anchor: [BUBBLE / 2, BUBBLE / 2], interactive: true, zIndex: 0 }),
        );
      }
    }
    flagged.forEach((s) => addPin(s, true));
    markersRef.current = markers;
    // signature schools-тың мазмұнын білдіреді; schoolsRef арқылы соңғы деректер алынады.
  }, [signature, ready, detailed]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !focus) return;
    if (focus.kind === "view") {
      map.setCenter([focus.lng, focus.lat], FLY);
      map.setZoom(focus.zoom, FLY);
    } else if (focus.points.length > 0) {
      map.fitBounds(boundsOf(focus.points), { padding: { top: 50, bottom: 50, left: 50, right: 50 }, maxZoom: 15, animation: FLY });
    }
  }, [focus, ready]);

  const selected = selectedId ? schools.find((s) => s.id === selectedId) : null;

  function flyTo(view: { lat: number; lng: number; zoom: number }) {
    mapRef.current?.setCenter([view.lng, view.lat], FLY);
    mapRef.current?.setZoom(view.zoom, FLY);
  }

  return (
    <div className="map-dark relative h-full w-full rounded-lg overflow-hidden isolate">
      <div ref={containerRef} className="absolute inset-0" />

      {controls && (
        // Оң жақ жоғарғы бұрышта 2GIS-тің өз масштаб батырмалары тұр.
        <div className="absolute top-3 left-3 z-10 flex shadow-sm">
          <button type="button" className={ZOOM_BUTTON_CLASS} onClick={() => flyTo(AKTAU_VIEW)}>
            Ақтау
          </button>
        </div>
      )}

      {selected && (
        <div className="anim-slide-in absolute left-3 bottom-8 z-10 card shadow-md p-3 pr-8 max-w-[280px]">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="absolute top-1.5 right-2 text-muted hover:text-ink"
            aria-label="Жабу"
          >
            ×
          </button>
          <p className="font-semibold text-sm text-ink" title={selected.name}>{shortName(selected.name, selected.kind)}</p>
          <p className="text-xs text-muted mt-0.5">
            {FACILITY_KIND_LABEL[selected.kind]}
            {selected.district && ` · ${placeLabel(selected.district.name, selected.address)}`} · балл {selected.riskScore}
          </p>
          {basePath && (
            <Link href={`${basePath}/${selected.id}`} className="text-primary underline text-xs mt-1 inline-block">
              Толық ақпарат
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
