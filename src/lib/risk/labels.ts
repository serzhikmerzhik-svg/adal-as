export const RISK_COMPONENT_LABELS: Record<string, string> = {
  tempViolations: "Температура бұзушылықтары",
  missingPhotos: "Фото жүктелмеген күндер",
  parentRating: "Ата-ана бағасы төмен",
  complaintSpike: "Шағымдар жарылысы",
  supplierRisk: "Жеткізуші тәуекелі",
  inspectionAge: "Тексеру ескірген",
  overduePrescriptions: "Мерзімі өткен нұсқамалар",
};

export const LEVEL_LABEL: Record<string, string> = { GREEN: "Жасыл", YELLOW: "Сары", RED: "Қызыл" };
export const LEVEL_BADGE: Record<string, string> = {
  GREEN: "bg-brand-100 text-brand-700",
  YELLOW: "bg-amber-100 text-amber-700",
  RED: "bg-red-100 text-red-700",
};

export const SYMPTOM_LABELS: Record<string, string> = {
  NAUSEA: "Жүрек айну",
  VOMITING: "Құсу",
  DIARRHEA: "Диарея",
  FEVER: "Дене қызуы",
  ABDOMINAL_PAIN: "Іш ауыру",
  OTHER: "Басқа",
};

export const ALERT_STATUS_LABEL: Record<string, string> = {
  OPEN: "Ашық",
  ACKNOWLEDGED: "Қабылданды",
  CLOSED: "Жабық",
};

export const PRESCRIPTION_STATUS_LABEL: Record<string, string> = {
  OPEN: "Орындалуда",
  SUBMITTED: "Тексеруге жіберілді",
  ACCEPTED: "Қабылданды",
  REJECTED: "Қайтарылды",
};

export const INSPECTION_TYPE_LABEL: Record<string, string> = {
  MONITORING: "Мониторинг",
  UNANNOUNCED: "Кенет",
  UNSCHEDULED: "Жоспардан тыс",
};

export const symptomsText = (symptoms: string[]) => symptoms.map((s) => SYMPTOM_LABELS[s] ?? s).join(", ");
