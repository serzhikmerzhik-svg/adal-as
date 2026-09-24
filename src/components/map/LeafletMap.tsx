"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import Link from "next/link";
import { FACILITY_KIND_LABEL } from "@/lib/risk/labels";
import { AKTAU_VIEW, REGION_VIEW, RISK_COLORS, ZOOM_BUTTON_CLASS, type SchoolMapProps } from "./shared";

function ZoomButtons() {
  const map = useMap();
  return (
    <div className="absolute top-3 right-3 z-[1000] flex shadow-sm">
      <button type="button" className={ZOOM_BUTTON_CLASS} onClick={() => map.flyTo([AKTAU_VIEW.lat, AKTAU_VIEW.lng], AKTAU_VIEW.zoom, { duration: 1.2 })}>
        Ақтау
      </button>
      <button type="button" className={`${ZOOM_BUTTON_CLASS} border-l-0`} onClick={() => map.flyTo([REGION_VIEW.lat, REGION_VIEW.lng], REGION_VIEW.zoom, { duration: 1.2 })}>
        Облыс
      </button>
    </div>
  );
}

/** 2GIS кілті жоқ кезде қолданылатын OpenStreetMap картасы. */
export function LeafletMap({ schools, basePath }: SchoolMapProps) {
  return (
    <MapContainer center={[REGION_VIEW.lat, REGION_VIEW.lng]} zoom={REGION_VIEW.zoom} className="h-full w-full rounded-lg isolate">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomButtons />
      {schools
        .filter((s) => s.riskLevel === "RED")
        .map((s) => (
          <CircleMarker
            key={`pulse-${s.id}`}
            center={[s.lat, s.lng]}
            radius={9}
            interactive={false}
            pathOptions={{ color: RISK_COLORS.RED, fill: false, className: "marker-red-pulse" }}
          />
        ))}
      {schools.map((s) => (
        <CircleMarker
          key={s.id}
          center={[s.lat, s.lng]}
          radius={s.riskLevel === "GREEN" ? 7 : 9}
          pathOptions={{ color: "#ffffff", weight: 2, fillColor: RISK_COLORS[s.riskLevel], fillOpacity: 0.95 }}
        >
          <Popup>
            <div className="space-y-1">
              <p className="font-semibold">{s.name}</p>
              <p className="text-sm">
                {FACILITY_KIND_LABEL[s.kind]} · Тәуекел балы: {s.riskScore}
              </p>
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
