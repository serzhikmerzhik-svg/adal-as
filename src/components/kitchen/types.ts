import type { PhotoStatus } from "@/components/ses/types";

// /api/kitchen/today жауабының түрлері (асхана беті мен оның компоненттері).

export type DishCategory = "SOUP" | "MAIN" | "HOT_DRINK" | "COLD";

export type KitchenLog = {
  id: string;
  type: "PHOTO" | "FRIDGE_TEMP" | "HOT_TEMP" | "WASTE";
  valueC: number | null;
  photoUrl: string | null;
  isViolation: boolean;
  createdAt: string;
  source: "MANUAL" | "DEVICE";
  aiStatus: PhotoStatus | null;
  aiIssues: string[];
  aiPortionPct: number | null;
  aiWastePct: number | null;
  aiSummary: string | null;
};

export type MenuItem = {
  id: string;
  name: string;
  category: DishCategory;
  standardPortionG: number | null;
  blocked: boolean;
  planItemId: string | null;
  offPlanReason: string | null;
  planItem: { mainIngredient: string; composition: string } | null;
  batch: { code: string; product: string; supplier: { name: string; blocked: boolean } } | null;
  logs: KitchenLog[];
};

export type PlanItem = {
  id: string;
  name: string;
  category: DishCategory;
  portionG: number;
  mainIngredient: string;
  composition: string;
};

export type Device = {
  id: string;
  kind: "PROBE" | "FRIDGE";
  label: string;
  keyHint: string;
  lastSeenAt: string | null;
  lastValue: number | null;
  armedTarget: string | null;
  armedAt: string | null;
};

export type StaffMember = {
  id: string;
  label: string;
  checks: { id: string; createdAt: string; aiStatus: PhotoStatus; aiIssues: string[]; aiSummary: string | null }[];
};

export type BatchOption = { id: string; code: string; product: string; supplier: { name: string; blocked: boolean } };

export type Prescription = { id: string; text: string; dueAt: string; status: string };

export type Supplier = { id: string; name: string; blocked: boolean };

export type TodayResponse = {
  school?: { name: string; kind: string; code: string | null };
  planDay?: number | null;
  plan?: PlanItem[];
  menuItems?: MenuItem[];
  prescriptions?: Prescription[];
  suppliers?: Supplier[];
  devices?: Device[];
  staff?: StaffMember[];
  batches?: BatchOption[];
  fridgeLogs?: { id: string; valueC: number | null; isViolation: boolean; source: "MANUAL" | "DEVICE"; createdAt: string }[];
};
