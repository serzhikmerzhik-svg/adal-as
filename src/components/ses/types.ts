import type { MapSchool } from "@/components/map/shared";

export type Level = "GREEN" | "YELLOW" | "RED";
export type Kind = MapSchool["kind"];

export type OverviewSchool = MapSchool & { district: { id: string; name: string } };

export type OverviewAlert = {
  id: string;
  level: "YELLOW" | "RED";
  reason: string;
  status: "OPEN" | "ACKNOWLEDGED" | "CLOSED";
  createdAt: string;
  relatedBatchId: string | null;
  /** Автоматты ереже: FRIDGE, OFF_PLAN, INGREDIENT, EATABILITY (кластер мен балл алерттерінде null). */
  rule: string | null;
  details: unknown;
  batchCode: string | null;
  tracedCount: number;
  school: { id: string; name: string; kind: Kind; address: string; district: { name: string } };
};

export type Unannounced = OverviewSchool & {
  address: string;
  lastInspectionAt: string | null;
  plannedInspectionAt: string | null;
  reasons: string[];
};

export type Overview = {
  generatedAt: string;
  schools: OverviewSchool[];
  alerts: OverviewAlert[];
  banner: OverviewAlert | null;
  kpi: {
    total: number;
    green: number;
    yellow: number;
    red: number;
    openAlerts: number;
    openRed: number;
    openYellow: number;
    overduePrescriptions: number;
  };
  unannounced: Unannounced[];
};

export type Stats = {
  journal: {
    total: number;
    withMenu: number;
    withPhoto: number;
    withTemp: number;
    deliveriesToday: number;
    violationsToday: number;
    missing: { id: string; name: string; kind: Kind }[];
    missingCount: number;
  };
  dynamics: { date: string; yellow: number; red: number }[];
  inspections: {
    id: string;
    type: "MONITORING" | "UNANNOUNCED" | "UNSCHEDULED";
    plannedAt: string;
    doneAt: string | null;
    result: string | null;
    school: { id: string; name: string; kind: Kind; riskLevel: Level };
  }[];
  prescriptions: { open: number; submitted: number; overdue: number };
};

export type SupplierRow = {
  id: string;
  name: string;
  bin: string;
  blocked: boolean;
  certificateValidUntil: string;
  certDaysLeft: number;
  products: string[];
  facilities: number;
  status: Level;
  note: string;
  batches: {
    id: string;
    code: string;
    product: string;
    producedAt: string;
    expiresAt: string;
    facilities: number;
    linkedToRed: boolean;
  }[];
};

export type PhotoStatus = "PENDING" | "OK" | "FLAGGED" | "ERROR" | "DISABLED";

export type PhotoRow = {
  id: string;
  createdAt: string;
  aiStatus: PhotoStatus;
  aiIssues: string[];
  aiPortionPct: number | null;
  aiSummary: string | null;
  aiModel: string | null;
  reviewedAt: string | null;
  imageUrl: string;
  menuItem: { name: string; standardPortionG: number | null } | null;
  school: { id: string; name: string; kind: Kind; district: { name: string } };
};

export type PhotoFeed = {
  photos: PhotoRow[];
  counts: { total: number; pending: number; ok: number; flagged: number; unreviewed: number; aiOff: number };
};

export const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return r.json();
  });
