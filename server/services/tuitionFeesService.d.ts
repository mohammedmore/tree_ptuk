export interface MajorTuitionRate {
  hourlyRateJOD: number;
  faculty: string;
  notes?: string;
}

export const OFFICIAL_TUITION_RATES: Record<string, MajorTuitionRate>;

export const OFFICIAL_FIXED_FEES: {
  registrationFeeJOD: number;
  studentUnionFeeJOD: number;
  universityCardFeeJOD: number;
  levelExamFeeJOD: number;
  defaultExchangeRateILS: number;
};

export function getOfficialTuitionRate(majorName?: string): MajorTuitionRate;

export function calculateSemesterTuition(options: {
  majorName?: string;
  credits?: number;
  isFreshman?: boolean;
  customExchangeRate?: number | null;
}): {
  majorName: string;
  faculty: string;
  credits: number;
  hourlyRateJOD: number;
  creditsFeeJOD: number;
  fixedFees: {
    registrationFeeJOD: number;
    studentUnionFeeJOD: number;
    universityCardFeeJOD: number;
    levelExamFeeJOD: number;
    totalFixedFeesJOD: number;
  };
  totalJOD: number;
  totalILS: number;
  exchangeRate: number;
};
