export type MapSchool = {
  id: string;
  name: string;
  kind: "SCHOOL" | "KINDERGARTEN" | "CANTEEN";
  lat: number;
  lng: number;
  riskScore: number;
  riskLevel: "GREEN" | "YELLOW" | "RED";
};

export type SchoolMapProps = { schools: MapSchool[]; basePath?: string };

export const RISK_COLORS: Record<MapSchool["riskLevel"], string> = {
  GREEN: "#1d9d74",
  YELLOW: "#d99a06",
  RED: "#dc2626",
};

// Ескерту: Leaflet [ендік, бойлық], ал 2GIS MapGL [бойлық, ендік] ретін қолданады.
export const REGION_VIEW = { lat: 44.0, lng: 52.5, zoom: 7 };
export const AKTAU_VIEW = { lat: 43.66, lng: 51.19, zoom: 12 };

export const ZOOM_BUTTON_CLASS = "bg-white px-3 py-1.5 text-sm text-ink border border-slate-300 hover:bg-slate-50";
