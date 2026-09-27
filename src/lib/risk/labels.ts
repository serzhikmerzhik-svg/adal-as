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
  GREEN: "bg-ok-100 text-ok-700",
  YELLOW: "bg-warn-100 text-warn-700",
  RED: "bg-bad-100 text-bad-700",
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

// Реті маңызды: карта сүзгісі мен карточкалар осы ретпен шығады (білім беру → тамақтану).
export const FACILITY_KINDS = ["SCHOOL", "KINDERGARTEN", "RESTAURANT", "CAFE", "CANTEEN"] as const;
export type FacilityKindKey = (typeof FACILITY_KINDS)[number];

export const FACILITY_KIND_LABEL: Record<string, string> = {
  SCHOOL: "Мектеп асханасы",
  KINDERGARTEN: "Балабақша",
  RESTAURANT: "Мейрамхана",
  CAFE: "Кафе",
  CANTEEN: "Қоғамдық асхана",
};

export const FACILITY_KIND_PLURAL: Record<string, string> = {
  SCHOOL: "Мектеп асханалары",
  KINDERGARTEN: "Балабақшалар",
  RESTAURANT: "Мейрамханалар",
  CAFE: "Кафелер",
  CANTEEN: "Қоғамдық асханалар",
};

/** Мектеп пен балабақша — білім беру ұйымдары (Білім бөлімі көреді), қалғаны — қоғамдық тамақтану. */
export const isEducation = (kind: string) => kind === "SCHOOL" || kind === "KINDERGARTEN";

export const symptomsText = (symptoms: string[]) => symptoms.map((s) => SYMPTOM_LABELS[s] ?? s).join(", ");
