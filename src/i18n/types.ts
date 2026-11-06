export type SupportedLanguage = "ar" | "en";

export interface TranslationDictionary {
  nav: {
    plan: string;
    courses: string;
    schedule: string;
    gpa: string;
    semesterPlanning: string;
    registration: string;
    calendar: string;
    login: string;
    tools: string;
  };
  common: {
    save: string;
    cancel: string;
    confirm: string;
    delete: string;
    edit: string;
    loading: string;
    error: string;
    success: string;
    search: string;
    filter: string;
    export: string;
    share: string;
    close: string;
    retry: string;
    all: string;
    credits: string;
    hours: string;
    gpa: string;
    major: string;
    status: string;
    offline: string;
  };
  academic: {
    criticalPath: string;
    bottleneck: string;
    prerequisites: string;
    coPrerequisites: string;
    degreeAudit: string;
    completed: string;
    remaining: string;
    planned: string;
    exempted: string;
    registered: string;
  };
  solver: {
    title: string;
    generate: string;
    conflicts: string;
    freeDays: string;
    timePreference: string;
    morning: string;
    late: string;
    compact: string;
  };
  registration: {
    title: string;
    prewarm: string;
    seatSniper: string;
    cascadingFallback: string;
    planA: string;
    planB: string;
    planC: string;
    availableSeats: string;
    fullSection: string;
  };
}
