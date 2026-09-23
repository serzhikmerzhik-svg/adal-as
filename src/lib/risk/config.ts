// Тәуекел логикасының барлық шектері мен салмақтары осы жерде тұрады.
// Температура нормалары — орналастырылған мәндер, ҚР санитарлық қағидаларынан тексеру қажет.

export const TEMP = {
  FRIDGE_MIN: 2, // °C
  FRIDGE_MAX: 6, // °C
  HOT_MIN: 65, // °C, ыстық тағам берілгенде
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
