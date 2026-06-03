import { Course } from "./data";
import { categoryRequirements } from "./data";
import { SEMESTERS } from "./constants";
import { getCourseDetails } from "./courseExplanations";

export interface SmartPlanParams {
  courses: Course[];
  completedCourses: Set<string>;
  plannedCourses: Record<string, string>; // Currently planned courses (used to import manually scheduled ones)
  pinnedCourses: Record<string, string>;  // Force courseId -> semesterName
  semesterCapacities: Record<string, number>; // semesterName -> maxCredits
  planStartSemester: string;
  planEndSemester: string;
  strategy: "balanced" | "fast" | "light" | "nosummer" | "custom";
}

export interface SmartPlanResult {
  success: boolean;
  plan?: Record<string, string>;
  error?: string;
  overloadedSemesters?: string[]; // Semesters that were overloaded to satisfy constraints
  warnings?: string[];
}

export function generateSmartPlan(params: SmartPlanParams): SmartPlanResult {
  const {
    courses,
    completedCourses,
    pinnedCourses,
    semesterCapacities,
    planStartSemester,
    planEndSemester,
    strategy,
  } = params;

  // 1. Get semesters timeline
  const planStartIdx = SEMESTERS.indexOf(planStartSemester);
  const planEndIdx = SEMESTERS.indexOf(planEndSemester);

  if (planStartIdx === -1 || planEndIdx === -1 || planStartIdx > planEndIdx) {
    return {
      success: false,
      error: "خطأ في تحديد الفترة الزمنية للتخطيط. يرجى مراجعة بداية ونهاية الخريطة الزمنية.",
    };
  }

  const activeSemesters = SEMESTERS.slice(planStartIdx, planEndIdx + 1);

  // 2. Identify remaining courses to schedule
  const remaining = courses.filter((c) => !completedCourses.has(c.id));
  const remainingMap = new Map<string, Course>(remaining.map((c) => [c.id, c]));

  // 3. Default capacities based on strategy
  const getCapacityLimit = (sem: string): number => {
    // If customized by user
    if (semesterCapacities[sem] !== undefined) {
      return semesterCapacities[sem];
    }

    const isSummer = sem.includes("صيفي");

    switch (strategy) {
      case "fast":
        return isSummer ? 9 : 18;
      case "light": // خطة المعدل (توزيع الجهد)
        return isSummer ? 3 : 13;
      case "nosummer":
        return isSummer ? 0 : 18;
      case "balanced":
      default:
        return isSummer ? 6 : 17;
    }
  };

  // 4. Calculate earliest and latest semesters for each remaining course (Constraint Propagation)
  const earliestIdx: Record<string, number> = {};
  const latestIdx: Record<string, number> = {};

  // Initialize bounds
  for (const c of remaining) {
    earliestIdx[c.id] = planStartIdx;
    latestIdx[c.id] = planEndIdx;
  }

  // Inject pinned constraints
  for (const [courseId, semName] of Object.entries(pinnedCourses)) {
    if (!remainingMap.has(courseId)) continue;
    const semIdx = SEMESTERS.indexOf(semName);
    if (semIdx === -1 || semIdx < planStartIdx || semIdx > planEndIdx) {
      return {
        success: false,
        error: `تعذر تثبيت المساق '${remainingMap.get(courseId)?.name}': الفصل الدراسي المختار '${semName}' خارج نطاق التخطيط المحدد.`,
      };
    }
    earliestIdx[courseId] = semIdx;
    latestIdx[courseId] = semIdx;
  }

  // Advanced Weighting: How many total credits are locked behind this course?
  const getLockWeight = (courseId: string, visited = new Set<string>()): number => {
    if (visited.has(courseId)) return 0;
    visited.add(courseId);
    let weight = 0;
    courses.forEach((c) => {
      if (c.prerequisites.includes(courseId)) {
        weight += c.credits + getLockWeight(c.id, visited);
      }
    });
    return weight;
  };

  const weights: Record<string, number> = {};
  courses.forEach((c) => {
    weights[c.id] = getLockWeight(c.id);
  });

  // Forward pass: propagate prerequisites (A -> B means earliestIdx[B] >= earliestIdx[A] + 1)
  let changed = true;
  let iterations = 0;
  const maxIterations = remaining.length * 2;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;
    for (const c of remaining) {
      let maxPrereqEarliest = planStartIdx - 1;
      for (const pId of c.prerequisites) {
        if (completedCourses.has(pId)) continue;
        const pEarliest = earliestIdx[pId] !== undefined ? earliestIdx[pId] : planStartIdx;
        if (pEarliest > maxPrereqEarliest) {
          maxPrereqEarliest = pEarliest;
        }
      }
      const newEarliest = Math.max(earliestIdx[c.id], maxPrereqEarliest + 1);
      if (newEarliest > earliestIdx[c.id]) {
        earliestIdx[c.id] = newEarliest;
        changed = true;
      }
    }
  }

  // Backward pass: propagate dependent deadlines (A -> B means latestIdx[A] <= latestIdx[B] - 1)
  changed = true;
  iterations = 0;
  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;
    for (const c of remaining) {
      // Find all remaining dependents of c
      let minDependentLatest = planEndIdx + 1;
      for (const dep of remaining) {
        if (dep.prerequisites.includes(c.id)) {
          const depLatest = latestIdx[dep.id];
          if (depLatest < minDependentLatest) {
            minDependentLatest = depLatest;
          }
        }
      }
      const newLatest = Math.min(latestIdx[c.id], minDependentLatest - 1);
      if (newLatest < latestIdx[c.id]) {
        latestIdx[c.id] = newLatest;
        changed = true;
      }
    }
  }

  // Validate bounds consistency
  for (const c of remaining) {
    if (earliestIdx[c.id] > latestIdx[c.id]) {
      const earliestSemName = SEMESTERS[earliestIdx[c.id]] || "خارج النطاق";
      const latestSemName = SEMESTERS[latestIdx[c.id]] || "خارج النطاق";
      return {
        success: false,
        error: `تعذر التخطيط بسبب تعارض شروط المساق '${c.name}':
متطلباته السابقة تفرض جدولة المساق في فصل '${earliestSemName}' أو بعده، بينما المساقات المعتمدة عليه أو التثبيت تفرض جدولته في فصل '${latestSemName}' أو قبله. 
يرجى إزالة التثبيت عن هذا المساق أو متطلباته، أو تمديد الخريطة الزمنية للفصول.`,
      };
    }
  }

  // 5. Schedule semester by semester (Greedy EDF)
  const assigned: Record<string, string> = {};
  const simCompleted = new Set<string>(completedCourses);
  const creditsSimulation: Record<string, number> = {};

  // Initialize credits simulation with completed courses
  courses.forEach((c) => {
    if (completedCourses.has(c.id)) {
      creditsSimulation[c.category] = (creditsSimulation[c.category] || 0) + c.credits;
    }
  });

  // Get difficulty scores for balancing
  const difficultyScores: Record<string, number> = {};
  courses.forEach(c => {
    const details = getCourseDetails(c, courses, completedCourses, {});
    difficultyScores[c.id] = details.difficulty;
  });

  const overloadedSemesters: string[] = [];
  const warnings: string[] = [];

  for (let idx = planStartIdx; idx <= planEndIdx; idx++) {
    const semName = SEMESTERS[idx];
    const maxCr = getCapacityLimit(semName);

    if (maxCr === 0) continue; // Skip summer if capacity is 0

    let currentCredits = 0;

    // 5.1. Handle pinned courses for this semester first
    const pinnedHere = remaining.filter((c) => pinnedCourses[c.id] === semName);
    for (const c of pinnedHere) {
      // Double check prerequisites
      const prereqsMet = c.prerequisites.every((pId) => simCompleted.has(pId));
      if (!prereqsMet) {
        const missing = c.prerequisites.filter((pId) => !simCompleted.has(pId)).map((pId) => {
          const course = courses.find((item) => item.id === pId);
          return course ? course.name : pId;
        }).join("، ");
        return {
          success: false,
          error: `تعذر التخطيط: المساق '${c.name}' مثبت في فصل '${semName}' ولكن متطلباته السابقة (${missing}) لم تُنجز ولم تُجدول في الفصول السابقة له.`,
        };
      }

      assigned[c.id] = semName;
      currentCredits += c.credits;
      simCompleted.add(c.id);
      creditsSimulation[c.category] = (creditsSimulation[c.category] || 0) + c.credits;
    }

    // Check if pinned courses alone overload the semester
    if (currentCredits > maxCr) {
      overloadedSemesters.push(semName);
      warnings.push(`تم تجاوز السعة المحددة لفصل '${semName}' بسبب وجود مواد مثبتة فيه (${currentCredits} ساعة).`);
    }

    // 5.2. Fill remaining capacity with eligible unpinned courses
    // Sorting Logic:
    // 1. Criticality (Weight) - Highest first
    // 2. Strategy specific sorting
    let eligible = remaining.filter((c) => {
      if (pinnedCourses[c.id]) return false; // Already handled
      if (assigned[c.id]) return false; // Already assigned

      // Prerequisites must be completed in previous semesters
      const prereqsMet = c.prerequisites.every((pId) => simCompleted.has(pId));
      if (!prereqsMet) return false;

      // Window check
      if (earliestIdx[c.id] > idx || latestIdx[c.id] < idx) return false;

      // Category requirement limit check
      const currentCatCr = creditsSimulation[c.category] || 0;
      const requiredCatCr = categoryRequirements[c.category] || 999;
      if (currentCatCr + c.credits > requiredCatCr) return false;

      return true;
    });

    // Sorting Logic based on Strategy
    eligible.sort((a, b) => {
      // Always prioritize critical path weight for all strategies to ensure graduation
      const weightA = weights[a.id];
      const weightB = weights[b.id];

      if (strategy === "fast") {
        // Priority 1: Critical Path, Priority 2: High Credits
        if (Math.abs(weightB - weightA) > 10) return weightB - weightA;
        return b.credits - a.credits;
      } else if (strategy === "light") {
        // Priority 1: Low Difficulty, Priority 2: Critical Path
        if (Math.abs(difficultyScores[a.id] - difficultyScores[b.id]) > 2) return difficultyScores[a.id] - difficultyScores[b.id];
        return weightB - weightA;
      }

      // Balanced / Default
      return weightB - weightA || difficultyScores[a.id] - difficultyScores[b.id];
    });

    for (const c of eligible) {
      const isUrgent = latestIdx[c.id] === idx;

      // Difficulty balancing for 'balanced' and 'light' strategy
      if (strategy === 'balanced' || strategy === 'light') {
        const currentSemCourses = Object.keys(assigned).filter(id => assigned[id] === semName);
        const currentSemDifficulty = currentSemCourses.reduce((sum, id) => sum + (difficultyScores[id] || 5), 0);

        // Limit total difficulty score per semester to keep it 'balanced'
        const difficultyCap = strategy === 'light' ? 22 : 32;
        if (currentSemDifficulty + difficultyScores[c.id] > difficultyCap && !isUrgent) {
          continue; // Skip this course for this semester unless it's urgent
        }
      }

      if (currentCredits + c.credits <= maxCr) {
        assigned[c.id] = semName;
        currentCredits += c.credits;
        simCompleted.add(c.id);
        creditsSimulation[c.category] = (creditsSimulation[c.category] || 0) + c.credits;
      } else if (isUrgent) {
        // This is urgent and MUST be scheduled now, otherwise deadline violated.
        // Overload the semester up to 21 hours for regular, or 10 hours for summer.
        const overloadLimit = semName.includes("صيفي") ? 10 : 21;
        if (currentCredits + c.credits <= overloadLimit) {
          assigned[c.id] = semName;
          currentCredits += c.credits;
          simCompleted.add(c.id);
          creditsSimulation[c.category] = (creditsSimulation[c.category] || 0) + c.credits;

          if (!overloadedSemesters.includes(semName)) {
            overloadedSemesters.push(semName);
            warnings.push(`تم زيادة حمولة فصل '${semName}' لتصل إلى ${currentCredits} ساعة لجدولة مواد حرجة للتخرج.`);
          }
        } else {
          return {
            success: false,
            error: `عجز في حمولة فصل '${semName}': المساق الإجباري '${c.name}' يجب تسجيله في هذا فصل لضمان التخرج في الوقت المحدد، ولكن حمولة الفصل تجاوزت الحد الأقصى المطلق (${currentCredits} ساعة). يرجى زيادة حمولة هذا الفصل أو تمديد الخريطة الزمنية للفصول.`,
          };
        }
      }
    }
  }

  // 6. Verify if all remaining courses are scheduled
  const unscheduled = remaining.filter((c) => !assigned[c.id]);
  if (unscheduled.length > 0) {
    const unscheduledNames = unscheduled.slice(0, 5).map((c) => c.name).join("، ");
    const dots = unscheduled.length > 5 ? "..." : "";
    return {
      success: false,
      error: `لم يتمكن المحرك من جدولة جميع المواد المتبقية (${unscheduledNames}${dots} - المجموع ${unscheduled.length} مواد) ضمن الخريطة الزمنية المحددة. يرجى زيادة سعة الفصول الدراسية أو تمديد فترة التخطيط لتسع المواد المتبقية.`,
    };
  }

  return {
    success: true,
    plan: assigned,
    overloadedSemesters,
    warnings,
  };
}
