"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import Link from "next/link";
import { FACILITY_KIND_LABEL } from "@/lib/risk/labels";
import { shortName } from "@/lib/format";
import { AKTAU_VIEW, RISK_COLORS, ZOOM_BUTTON_CLASS, type MapFocus, type SchoolMapProps } from "./shared";

function ZoomButtons() {
  const map = useMap();
  return (
    <div className="absolute top-3 right-3 z-[1000] flex shadow-sm">
      <button type="button" className={ZOOM_BUTTON_CLASS} onClick={() => map.flyTo([AKTAU_VIEW.lat, AKTAU_VIEW.lng], AKTAU_VIEW.zoom, { duration: 1.2 })}>
        Ақтау
      </button>
    </div>
  );
}

function FocusController({ focus }: { focus?: MapFocus | null }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    if (focus.kind === "view") {
      map.flyTo([focus.lat, focus.lng], focus.zoom, { duration: 1 });
    } else if (focus.points.length > 0) {
      const bounds = focus.points.map((p) => [p.lat, p.lng] as [number, number]);
      map.flyToBounds(bounds, { maxZoom: 15, padding: [50, 50], duration: 1 });
    }
  }, [focus, map]);
  return null;
}

/** 2GIS кілті жоқ кезде қолданылатын OpenStreetMap картасы. */
export function LeafletMap({ schools, basePath, focus, controls = true }: SchoolMapProps) {
  return (
    <MapContainer center={[AKTAU_VIEW.lat, AKTAU_VIEW.lng]} zoom={AKTAU_VIEW.zoom} className="map-dark h-full w-full rounded-lg isolate">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {controls && <ZoomButtons />}
      <FocusController focus={focus} />
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
              <p className="font-semibold" title={s.name}>{shortName(s.name, s.kind)}</p>
              <p className="text-sm">
                {FACILITY_KIND_LABEL[s.kind]} · Тәуекел балы: {s.riskScore}
              </p>
              {basePath && (
                <Link href={`${basePath}/${s.id}`} className="text-primary underline text-sm">
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
