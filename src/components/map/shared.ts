import type { FacilityKindKey } from "@/lib/risk/labels";

export type MapSchool = {
  id: string;
  name: string;
  kind: FacilityKindKey;
  lat: number;
  lng: number;
  riskScore: number;
  riskLevel: "GREEN" | "YELLOW" | "RED";
  district?: { name: string };
  address?: string;
};

/** Картаны сырттан басқару: key өзгерген сайын карта осы көрініске ұшады. */
export type MapFocus =
  | { key: number; kind: "view"; lat: number; lng: number; zoom: number }
  | { key: number; kind: "points"; points: { lat: number; lng: number }[] };

export type SchoolMapProps = {
  schools: MapSchool[];
  basePath?: string;
  focus?: MapFocus | null;
  /** Картаның өз «Ақтау» батырмасы (СЭС бетінде ол карточка тақырыбында тұрады). */
  controls?: boolean;
};

export const RISK_COLORS: Record<MapSchool["riskLevel"], string> = {
  GREEN: "#2e8b57",
  YELLOW: "#e0a526",
  RED: "#c62828",
};

// Ескерту: Leaflet [ендік, бойлық], ал 2GIS MapGL [бойлық, ендік] ретін қолданады.
export const AKTAU_VIEW = { lat: 43.657, lng: 51.168, zoom: 12.6 };

export const ZOOM_BUTTON_CLASS = "bg-white px-3 py-1.5 text-sm text-ink border border-line-strong hover:bg-page";
