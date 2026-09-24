"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import Link from "next/link";

type School = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  riskScore: number;
  riskLevel: "GREEN" | "YELLOW" | "RED";
};

const COLORS: Record<School["riskLevel"], string> = {
  GREEN: "#1d9d74",
  YELLOW: "#d99a06",
  RED: "#dc2626",
};

// 2GIS Raster Tiles API. Демо-кілт бір айға беріледі, сондықтан кілт жоқ немесе мерзімі
// біткен жағдайда карта OpenStreetMap тайлдарына қайтады.
const DGIS_KEY = process.env.NEXT_PUBLIC_2GIS_KEY;
const TILES = DGIS_KEY
  ? {
      url: `https://tile{s}.maps.2gis.com/v2/tiles/online_hd/{z}/{x}/{y}.png?key=${DGIS_KEY}`,
      subdomains: "01234",
      attribution: '&copy; <a href="https://2gis.kz">2GIS</a>',
    }
  : {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      subdomains: "abc",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    };

const REGION_VIEW = { center: [44.0, 52.5] as [number, number], zoom: 7 };
const AKTAU_VIEW = { center: [43.66, 51.19] as [number, number], zoom: 12 };

function ZoomButtons() {
  const map = useMap();
  const btn = "bg-white px-3 py-1.5 text-sm text-ink border border-slate-300 hover:bg-slate-50";
  return (
    <div className="absolute top-3 right-3 z-[1000] flex shadow-sm">
      <button type="button" className={btn} onClick={() => map.flyTo(AKTAU_VIEW.center, AKTAU_VIEW.zoom, { duration: 1.2 })}>
        Ақтау
      </button>
      <button type="button" className={`${btn} border-l-0`} onClick={() => map.flyTo(REGION_VIEW.center, REGION_VIEW.zoom, { duration: 1.2 })}>
        Облыс
      </button>
    </div>
  );
}

export function SchoolMap({ schools, basePath }: { schools: School[]; basePath?: string }) {
  return (
    <MapContainer center={REGION_VIEW.center} zoom={REGION_VIEW.zoom} className="h-full w-full rounded-lg isolate">
      <TileLayer url={TILES.url} subdomains={TILES.subdomains} attribution={TILES.attribution} />
      <ZoomButtons />
      {schools
        .filter((s) => s.riskLevel === "RED")
        .map((s) => (
          <CircleMarker
            key={`pulse-${s.id}`}
            center={[s.lat, s.lng]}
            radius={9}
            interactive={false}
            pathOptions={{ color: COLORS.RED, fill: false, className: "marker-red-pulse" }}
          />
        ))}
      {schools.map((s) => (
        <CircleMarker
          key={s.id}
          center={[s.lat, s.lng]}
          radius={s.riskLevel === "GREEN" ? 7 : 9}
          pathOptions={{ color: "#ffffff", weight: 2, fillColor: COLORS[s.riskLevel], fillOpacity: 0.95 }}
        >
          <Popup>
            <div className="space-y-1">
              <p className="font-semibold">{s.name}</p>
              <p className="text-sm">Тәуекел балы: {s.riskScore}</p>
              {basePath && (
                <Link href={`${basePath}/${s.id}`} className="text-brand-700 underline text-sm">
                  Толық ақпарат
                </Link>
              )}
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
