// Тәуекел логикасының барлық шектері мен салмақтары осы жерде тұрады.
// Температура нормалары — орналастырылған мәндер, ҚР санитарлық қағидаларынан тексеру қажет.

import type { DishCategory } from "@prisma/client";

export const TEMP = {
  FRIDGE_MIN: 2, // °C
  FRIDGE_MAX: 6, // °C
  HOT_MIN: 65, // °C, екінші тағам мен гарнир берілгенде
  SOUP_MIN: 75, // °C, сорпа мен ыстық сусын берілгенде
  COLD_MAX: 14, // °C, суық тағам
};

/** Тағам санаты бойынша беру температурасының нормасы. */
export const SERVE_NORM: Record<DishCategory, { min?: number; max?: number }> = {
  SOUP: { min: TEMP.SOUP_MIN },
  HOT_DRINK: { min: TEMP.SOUP_MIN },
  MAIN: { min: TEMP.HOT_MIN },
  COLD: { max: TEMP.COLD_MAX },
};

// Асхана құрылғылары (термометр-щуп, тоңазытқыш датчигі): POST /api/device/readings.
export const DEVICE = {
  ARM_WINDOW_S: 120, // «Өлшеу» басылғаннан кейін осы уақытта келген өлшем сол тағамға жазылады
  EARLY_READING_S: 30, // өлшем «Өлшеу» басылмай тұрып келсе, 30 с ішінде оны да тағамға жазуға болады (ескі өлшем жабыспасын)
  MIN_INTERVAL_MS: 1500, // бір құрылғыдан бұдан жиі сұраныс қабылданбайды
  ONLINE_MIN: 10, // соңғы сигнал осы минуттан жаңа болса — «желіде»
  FRIDGE_CONSECUTIVE: 3, // тоңазытқыш: қатарынан 3 өлшем нормадан жоғары → қызыл алерт
};

// Жеке деректер: медбике тіркеген баланың аты-жөні осы мерзімнен кейін өшіріледі (күнделікті cron).
export const PRIVACY = {
  NAME_RETENTION_DAYS: 30,
};

// Қайтарылған табақтар фотосы: ИИ жеу индексін (жеген үлес, %) бағалайды.
export const EATABILITY = {
  LOW_PCT: 50, // осыдан төмен → сары алерт: дайындау технологиясын тексеру ұсынылады
};

export const CLUSTER = {
  WINDOW_MIN: 120, // терезе, минут
  MIN_REPORTS: 3, // осы және одан көп тіркеу болса, қызыл алерт
  GI_SYMPTOMS: ["NAUSEA", "VOMITING", "DIARRHEA", "ABDOMINAL_PAIN"] as const,
  TRACE_DAYS: 3, // партияны қадағалау терезесі
};

export const RISK_THRESHOLDS = {
  YELLOW_MIN: 40,
  RED_MIN: 70,
};

export const RISK_WEIGHTS = {
  TEMP_VIOLATION_POINTS: 5,
  TEMP_VIOLATION_MAX: 25,
  TEMP_VIOLATION_DAYS: 14,

  MISSING_PHOTO_POINTS: 5,
  MISSING_PHOTO_MAX: 15,
  MISSING_PHOTO_DAYS: 10,

  PARENT_RATING_MAX: 15,
  PARENT_RATING_LOW: 15, // avg < 3.0
  PARENT_RATING_MID: 8, // avg < 3.5
  PARENT_RATING_DAYS: 14,

  COMPLAINT_SPIKE_MAX: 10,
  COMPLAINT_SPIKE_DAYS: 3,
  COMPLAINT_SPIKE_BASELINE_DAYS: 14,
  COMPLAINT_SPIKE_MULTIPLIER: 2,
  COMPLAINT_SPIKE_MIN_COUNT: 3,

  SUPPLIER_RISK_MAX: 15,
  SUPPLIER_RISK_ALERT_DAYS: 30,

  INSPECTION_AGE_MAX: 10,
  INSPECTION_AGE_STALE_DAYS: 180,
  INSPECTION_AGE_WARN_POINTS: 5,
  INSPECTION_AGE_WARN_DAYS: 90,

  OVERDUE_PRESCRIPTION_POINTS: 5,
  OVERDUE_PRESCRIPTION_MAX: 10,
};
