export const EDUGATE_PLAN_SOURCE: "edugate_major_plan";

export interface NormalizedEdugateCourse {
  id: string;
  code: string;
  name: string;
  credits: number;
  category: string;
  prerequisites: string[];
  semester: string;
  recommendedSemester: string;
}

export interface NormalizedEdugateMajorPlan {
  source: typeof EDUGATE_PLAN_SOURCE;
  courses: NormalizedEdugateCourse[];
  categoryRequirements: Record<string, number>;
  totalDegreeCredits: number;
}

export function normalizeEdugateMajorPlan(
  result: unknown,
): NormalizedEdugateMajorPlan;
