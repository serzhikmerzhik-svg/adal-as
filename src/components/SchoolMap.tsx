"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
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
  GREEN: "#16a34a",
  YELLOW: "#ca8a04",
  RED: "#dc2626",
};

export function SchoolMap({ schools, basePath }: { schools: School[]; basePath: string }) {
  return (
    <MapContainer center={[44.0, 52.5]} zoom={7} className="h-full w-full rounded-2xl">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {schools.map((s) => (
        <CircleMarker
          key={s.id}
          center={[s.lat, s.lng]}
          radius={9}
          pathOptions={{ color: COLORS[s.riskLevel], fillColor: COLORS[s.riskLevel], fillOpacity: 0.8 }}
        >
          <Popup>
            <div className="space-y-1">
              <p className="font-semibold">{s.name}</p>
              <p className="text-sm">Тәуекел балы: {s.riskScore}</p>
              <Link href={`${basePath}/${s.id}`} className="text-emerald-700 underline text-sm">
                Толық ақпарат
              </Link>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
