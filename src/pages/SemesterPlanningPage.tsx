import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useDeferredValue,
  useCallback,
} from "react";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Columns,
  Calendar,
  AlertTriangle,
  AlertCircle,
  Trash2,
  Plus,
  Sparkles,
  CheckCircle2,
  RotateCcw,
  Check,
  ChevronLeft,
  ChevronRight,
  Sun,
  Snowflake,
  Layers,
  GraduationCap,
  ExternalLink,
  ShieldCheck,
  FileText,
  Lock,
  Unlock,
  Printer,
  GitFork,
  Clock,
} from "lucide-react";
import type { Course } from "../data";
import { categoryRequirements as defaultCategoryRequirements } from "../data";
import {
  SEMESTERS,
  REGULAR_SEMESTERS,
  getRecommendedSemesterOfCourse,
} from "../constants";
import {
  getNextPlanningSemester,
  autoPopulateUpcomingSemester,
  resolveAcademicSemester,
  determineUpcomingSemester,
  extractCohortYear,
  parseSemesterWeight,
} from "../utils/semesterUtils";
import {
  computeMultipleCriticalTracks,
  classifyCourseReadiness,
  autoPlanToGraduation,
  checkSemesterScheduleFeasibility,
  type BottleneckInfo,
} from "../utils/planningEnhancements";
import {
  getStoredScenarios,
  saveScenario,
  type PlanScenario,
} from "../core/planScenarios";
import type {
  StudentSyncProfile,
  StudentSemesterCourse,
} from "../services/studentService";
import {
  isCourseAvailable as defaultIsCourseAvailable,
  calculateDegreeCredits,
  calculateCategoryCredits,
} from "../core/courseProgress";
import { calculateDetailedTuition } from "../core/semesterRegistration";
import { getOfficialTuitionRate } from "../services/tuitionFeesService";
import { cn } from "../utils";
import { triggerHaptic } from "../utils/haptics";
import { hasStudentAcademicWarning } from "../core/academicPolicy";
import {
  MultiColumnRoadmapView,
  ScenarioSaveModal,
} from "../components/planner";

function fitPlanWithinSemesterCreditLimit(
  courses: Course[],
  currentPlan: Record<string, string>,
  proposedPlan: Record<string, string>,
  semesterName: string,
  creditLimit: number,
): { plannedCourses: Record<string, string>; omittedCourses: number } {
  const retainedCourseIds = new Set(
    courses
      .filter((course) => currentPlan[course.id] === semesterName)
      .map((course) => course.id),
  );
  let retainedCredits = courses.reduce(
    (sum, course) =>
      retainedCourseIds.has(course.id) ? sum + course.credits : sum,
    0,
  );
  let omittedCourses = 0;

  courses.forEach((course) => {
    if (
      proposedPlan[course.id] !== semesterName ||
      retainedCourseIds.has(course.id)
    ) {
      return;
    }

    if (retainedCredits + course.credits > creditLimit) {
      omittedCourses += 1;
      return;
    }

    retainedCourseIds.add(course.id);
    retainedCredits += course.credits;
  });

  return {
    plannedCourses: Object.fromEntries(
      Object.entries(proposedPlan).filter(
        ([courseId, plannedSemester]) =>
          plannedSemester !== semesterName || retainedCourseIds.has(courseId),
      ),
    ),
    omittedCourses,
  };
}

interface SemesterPlanningPageProps {
  courses: Course[];
  completedCourses: Set<string>;
  plannedCourses: Record<string, string>;
  setPlannedCourses: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  currentPlanningSemester: string | null;
  setCurrentPlanningSemester: (semester: string | null) => void;
  onNavigateBackToPlan: () => void;
  hasHighGpa?: boolean;
  completedCreditsPerCategory?: Record<string, number>;
  categoryRequirements?: Record<string, number>;
  currentStudent?: StudentSyncProfile | null;
  onOpenRecordsModal?: () => void;
  onOpenCalendarModal?: () => void;
  courseGrades?: Record<string, number>;
}

export const SemesterPlanningPage: React.FC<SemesterPlanningPageProps> = ({
  courses,
  completedCourses,
  plannedCourses,
  setPlannedCourses,
  currentPlanningSemester,
  setCurrentPlanningSemester,
  onNavigateBackToPlan,
  hasHighGpa = false,
  completedCreditsPerCategory = {},
  categoryRequirements: categoryRequirementsProp,
  currentStudent = null,
  onOpenRecordsModal,
  onOpenCalendarModal,
  courseGrades = {},
}) => {
  const effectiveCategoryRequirements = useMemo(() => {
    if (
      categoryRequirementsProp &&
      Object.keys(categoryRequirementsProp).length > 0
    ) {
      return categoryRequirementsProp;
    }
    if (
      currentStudent?.categoryRequirements &&
      Object.keys(currentStudent.categoryRequirements).length > 0
    ) {
      return currentStudent.categoryRequirements;
    }
    return defaultCategoryRequirements;
  }, [categoryRequirementsProp, currentStudent?.categoryRequirements]);
  const [layoutView, setLayoutView] = useState<"single" | "multi">("single");
  const [localHighGpa, setLocalHighGpa] = useState(hasHighGpa);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [hourFilter, setHourFilter] = useState<number | null>(null);
  const [draggedCourseId, setDraggedCourseId] = useState<string | null>(null);
  const [dragOverSemester, setDragOverSemester] = useState<string | null>(null);
  const [lockedSemesters, setLockedSemesters] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("ptuk_locked_semesters");
      if (!stored) return new Set();
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return new Set(
          parsed.filter(
            (s): s is string => typeof s === "string" && SEMESTERS.includes(s),
          ),
        );
      }
      return new Set();
    } catch {
      return new Set();
    }
  });
  const [scenarios, setScenarios] = useState<PlanScenario[]>(() =>
    getStoredScenarios(),
  );
  const [activeScenarioId, setActiveScenarioId] = useState<string>(
    () => "default-standard",
  );
  const [showScenarioDropdown, setShowScenarioDropdown] = useState(false);
  const [showAutoPlanDropdown, setShowAutoPlanDropdown] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const scenarioMenuRef = useRef<HTMLDivElement>(null);
  const autoPlanMenuRef = useRef<HTMLDivElement>(null);
  const moreActionsRef = useRef<HTMLDivElement>(null);

  // In-app Accessible Dialog States (replacing blocking window.prompt / window.confirm)
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [saveScenarioModalOpen, setSaveScenarioModalOpen] = useState(false);
  const [newScenarioName, setNewScenarioName] = useState("");

  // Safeguards against runaway auto-population loops
  const manuallyClearedSemesters = useRef<Set<string>>(new Set());
  const initialAutoSuggestAttempted = useRef<Set<string>>(new Set());

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        scenarioMenuRef.current &&
        !scenarioMenuRef.current.contains(event.target as Node)
      ) {
        setShowScenarioDropdown(false);
      }
      if (
        autoPlanMenuRef.current &&
        !autoPlanMenuRef.current.contains(event.target as Node)
      ) {
        setShowAutoPlanDropdown(false);
      }
      if (
        moreActionsRef.current &&
        !moreActionsRef.current.contains(event.target as Node)
      ) {
        setShowMoreActions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const [collapsedCategories, setCollapsedCategories] = useState<
    Record<string, boolean>
  >({});
  const [showMobilePlannedSheet, setShowMobilePlannedSheet] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up any pending toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // Sync high GPA prop when it changes or when student eligibility is detected
  useEffect(() => {
    if (hasHighGpa) {
      setLocalHighGpa(true);
    }
  }, [hasHighGpa]);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
      toastTimeoutRef.current = null;
    }, 2800);
  };

  const coursesById = useMemo(
    () => new Map(courses.map((c) => [c.id, c])),
    [courses],
  );

  const upcomingPlanningSemester = useMemo(() => {
    return determineUpcomingSemester(currentStudent, completedCourses, courses);
  }, [currentStudent, completedCourses, courses]);

  // Active semester: provided semester or defaults cleanly to student's upcoming standing semester
  const activeSemester = useMemo(() => {
    if (
      currentPlanningSemester &&
      SEMESTERS.includes(currentPlanningSemester)
    ) {
      return currentPlanningSemester;
    }
    return upcomingPlanningSemester || REGULAR_SEMESTERS[0];
  }, [currentPlanningSemester, upcomingPlanningSemester]);

  const cohortYear = useMemo(() => {
    return extractCohortYear(currentStudent);
  }, [currentStudent]);

  // Map student's official Edugate transcript records by semester,
  // strictly matching the chronological order from the student's records modal.
  const transcriptSemestersMap = useMemo(() => {
    const map = new Map<
      string,
      {
        originalTitle: string;
        courses: StudentSemesterCourse[];
        totalCredits: number;
        passedCredits: number;
        registeredCredits: number;
        isCurrentOrInProgress: boolean;
        gpa: number | null;
      }
    >();

    // 1. Primary: Load official semester records from student profile (scraped from Edugate)
    if (currentStudent?.semesters && currentStudent.semesters.length > 0) {
      // Sort strictly chronologically (oldest to newest)
      const chronologicalSemesters = [...currentStudent.semesters].sort(
        (a, b) => parseSemesterWeight(a.title) - parseSemesterWeight(b.title),
      );

      let regularSemIndex = 0;

      chronologicalSemesters.forEach((sem) => {
        const isSummer =
          sem.title.includes("صيفي") ||
          sem.title.includes("الصيفية") ||
          sem.title.toLowerCase().includes("summer");

        const resolved = resolveAcademicSemester(
          sem.title,
          cohortYear,
          isSummer ? undefined : regularSemIndex,
        );

        if (!isSummer) {
          regularSemIndex++;
        }

        const totalCredits = sem.courses.reduce(
          (sum, c) => sum + (c.credits || 0),
          0,
        );
        const passedCredits = sem.courses
          .filter((c) => c.isPassed)
          .reduce((sum, c) => sum + (c.credits || 0), 0);
        const registeredCredits = sem.courses
          .filter(
            (c) =>
              c.isRegistered ||
              c.status === "مسجل" ||
              (c.grade === null && !c.isPassed && !c.isFailed),
          )
          .reduce((sum, c) => sum + (c.credits || 0), 0);

        const graded = sem.courses.filter(
          (c) =>
            typeof c.grade === "number" &&
            !isNaN(c.grade) &&
            c.credits > 0 &&
            c.grade >= 0,
        );
        const gpa =
          graded.length > 0
            ? graded.reduce(
                (sum, c) => sum + (c.grade as number) * c.credits,
                0,
              ) / graded.reduce((sum, c) => sum + c.credits, 0)
            : null;

        const isCurrentOrInProgress =
          registeredCredits > 0 ||
          (passedCredits === 0 && totalCredits > 0 && graded.length === 0);

        if (map.has(resolved)) {
          const existing = map.get(resolved)!;
          existing.courses.push(...sem.courses);
          existing.totalCredits += totalCredits;
          existing.passedCredits += passedCredits;
          existing.registeredCredits += registeredCredits;
          existing.isCurrentOrInProgress =
            existing.isCurrentOrInProgress || isCurrentOrInProgress;
          existing.originalTitle = `${existing.originalTitle} + ${sem.title}`;
        } else {
          map.set(resolved, {
            originalTitle: sem.title,
            courses: [...sem.courses],
            totalCredits,
            passedCredits,
            registeredCredits,
            isCurrentOrInProgress,
            gpa,
          });
        }
      });
    } else if (completedCourses.size > 0) {
      // 2. Fallback ONLY if student has no official semester records:
      // Group completedCourses into recommended study plan semesters
      completedCourses.forEach((courseId) => {
        const c = coursesById.get(courseId);
        if (!c) return;

        const recSem =
          getRecommendedSemesterOfCourse(c) || REGULAR_SEMESTERS[0];
        const recIdx = SEMESTERS.indexOf(recSem);
        const upcomingIdx = SEMESTERS.indexOf(upcomingPlanningSemester);
        if (upcomingIdx >= 0 && recIdx >= upcomingIdx) {
          return;
        }

        const grade =
          courseGrades[c.id] ?? currentStudent?.courseGrades?.[c.id] ?? null;

        const semCourse: StudentSemesterCourse = {
          code: c.id,
          name: c.name,
          credits: c.credits,
          grade,
          status: "ناجح",
          isPassed: true,
          isRegistered: false,
          isFailed: false,
        };

        if (map.has(recSem)) {
          const existing = map.get(recSem)!;
          existing.courses.push(semCourse);
          existing.totalCredits += c.credits;
          existing.passedCredits += c.credits;
          const graded = existing.courses.filter(
            (cr) =>
              typeof cr.grade === "number" &&
              !isNaN(cr.grade) &&
              cr.credits > 0 &&
              cr.grade >= 0,
          );
          existing.gpa =
            graded.length > 0
              ? graded.reduce(
                  (sum, cr) => sum + (cr.grade as number) * cr.credits,
                  0,
                ) / graded.reduce((sum, cr) => sum + cr.credits, 0)
              : null;
        } else {
          map.set(recSem, {
            originalTitle: recSem,
            courses: [semCourse],
            totalCredits: c.credits,
            passedCredits: c.credits,
            registeredCredits: 0,
            isCurrentOrInProgress: false,
            gpa: typeof grade === "number" && grade >= 0 ? grade : null,
          });
        }
      });
    }

    return map;
  }, [
    currentStudent?.semesters,
    currentStudent?.courseGrades,
    cohortYear,
    completedCourses,
    coursesById,
    courseGrades,
    upcomingPlanningSemester,
  ]);

  const activeTranscriptRecord = transcriptSemestersMap.get(activeSemester);
  const isTranscriptSemester = Boolean(activeTranscriptRecord);

  const currentSemesterIndex = SEMESTERS.indexOf(activeSemester);
  const isSummer = activeSemester.includes("صيفي");

  const hasAcademicWarning = useMemo(
    () => hasStudentAcademicWarning(currentStudent),
    [currentStudent],
  );

  const previousCompletedSemester = useMemo(() => {
    const activeSemesterWeight = parseSemesterWeight(activeSemester);
    const previousSemesters = Array.from(transcriptSemestersMap.values())
      .filter(
        (semester) =>
          !semester.isCurrentOrInProgress &&
          parseSemesterWeight(semester.originalTitle) < activeSemesterWeight,
      )
      .sort(
        (first, second) =>
          parseSemesterWeight(first.originalTitle) -
          parseSemesterWeight(second.originalTitle),
      );
    return previousSemesters[previousSemesters.length - 1] || null;
  }, [activeSemester, transcriptSemestersMap]);

  const qualifiesByPreviousSemester = Boolean(
    previousCompletedSemester &&
    previousCompletedSemester.passedCredits >= 12 &&
    (previousCompletedSemester.gpa ?? 0) >= 80,
  );

  // Official PTUK Regulations check for 21-credit High GPA / Graduating allowance:
  // 1. Cumulative GPA >= 80% (معدل تراكمي 80% فأعلى)
  // 2. Or graduating standing (remaining credits <= 21)
  // 3. Must not have academic warning (إنذار / ملاحظة / معدل < 60%)
  const isAutoHighGpaEligible = useMemo(() => {
    if (hasAcademicWarning) return false;
    if (
      (typeof currentStudent?.gpa === "number" && currentStudent.gpa >= 80) ||
      qualifiesByPreviousSemester
    )
      return true;
    const totalRequired =
      typeof currentStudent?.totalCredits === "number" &&
      currentStudent.totalCredits > 60
        ? currentStudent.totalCredits
        : 132;
    const completedCredits = Object.values(completedCreditsPerCategory).reduce(
      (a, b) => a + b,
      0,
    );
    const remainingCredits = Math.max(0, totalRequired - completedCredits);
    if (remainingCredits > 0 && remainingCredits <= 21) return true;
    return false;
  }, [
    hasAcademicWarning,
    currentStudent?.gpa,
    currentStudent?.totalCredits,
    completedCreditsPerCategory,
    qualifiesByPreviousSemester,
  ]);

  // Automatically enable 21-credit high GPA ceiling if student is eligible
  useEffect(() => {
    setLocalHighGpa(isAutoHighGpaEligible);
  }, [isAutoHighGpaEligible]);

  const getSemesterCreditLimit = useCallback(
    (semName: string, isHighGpa: boolean) => {
      const semSummer = semName.includes("صيفي");
      if (hasAcademicWarning) {
        return semSummer ? 6 : 14;
      }
      if (semSummer) {
        return isHighGpa ? 12 : 10;
      }
      return isHighGpa ? 21 : 19;
    },
    [hasAcademicWarning],
  );

  const creditLimit = getSemesterCreditLimit(activeSemester, localHighGpa);

  // Check seasonal compatibility with a given semester
  const checkCourseSeasonality = (course: Course, semesterName: string) => {
    const semSummer = semesterName.includes("صيفي");
    const semFirst = semesterName.includes("الأول");
    const semSecond = semesterName.includes("الثاني");

    let isMismatch = false;
    let label = "";

    if (course.availableSemesters && course.availableSemesters.length > 0) {
      if (semSummer && !course.availableSemesters.includes("summer")) {
        isMismatch = true;
        label = "لا يطرح بالصيفي";
      } else if (semFirst && !course.availableSemesters.includes("first")) {
        isMismatch = true;
        label = "يطرح بالفصل الثاني فقط";
      } else if (semSecond && !course.availableSemesters.includes("second")) {
        isMismatch = true;
        label = "يطرح بالفصل الأول فقط";
      }
    } else if (course.seasonal) {
      if (course.seasonal === "first") {
        label = "فصل أول فقط";
        if (semSecond || semSummer) isMismatch = true;
      } else if (course.seasonal === "second") {
        label = "فصل ثاني فقط";
        if (semFirst || semSummer) isMismatch = true;
      } else if (course.seasonal === "both") {
        label = "كلا الفصلين";
        if (semSummer) isMismatch = true;
      }
    }

    return {
      isMismatch,
      label,
      isSeasonal: Boolean(course.seasonal || course.availableSemesters?.length),
    };
  };

  // Base completed degree credits (excluding remedial)
  const baseCompletedCredits = useMemo(() => {
    return calculateDegreeCredits(courses, completedCourses);
  }, [courses, completedCourses]);

  // Pre-computed lookup table for cumulative credits available before each semester: O(S) instead of O(N * C)
  const creditsBeforeSemesterMap = useMemo(() => {
    const map = new Map<string, number>();
    const plannedCreditsPerSem: Record<string, number> = {};
    for (const [id, sem] of Object.entries(plannedCourses)) {
      if (completedCourses.has(id)) continue;
      const c = coursesById.get(id);
      if (c && c.credits) {
        plannedCreditsPerSem[sem] =
          (plannedCreditsPerSem[sem] || 0) + c.credits;
      }
    }

    let runningTotal = baseCompletedCredits;
    for (let i = 0; i < SEMESTERS.length; i++) {
      const sem = SEMESTERS[i];
      map.set(sem, runningTotal);
      runningTotal += plannedCreditsPerSem[sem] || 0;
    }
    return map;
  }, [baseCompletedCredits, plannedCourses, coursesById, completedCourses]);

  // Check course prerequisites and minimum credit hours relative to the target semester
  const checkCoursePrerequisites = (course: Course, semesterName: string) => {
    const semIdx = SEMESTERS.indexOf(semesterName);
    const missingPrereqs: string[] = [];
    let creditThresholdViolated = false;

    // Validate minimum standing credits if course requires them (e.g. capstone/training)
    if (course.minCredits && course.minCredits > 0) {
      const creditsBeforeThisSem =
        creditsBeforeSemesterMap.get(semesterName) ?? baseCompletedCredits;
      if (creditsBeforeThisSem < course.minCredits) {
        creditThresholdViolated = true;
      }
    }

    if (course.prerequisites && course.prerequisites.length > 0) {
      for (const prereqId of course.prerequisites) {
        if (completedCourses.has(prereqId)) continue;
        const plannedSem = plannedCourses[prereqId];
        if (!plannedSem) {
          missingPrereqs.push(prereqId);
          continue;
        }
        const plannedSemIdx = SEMESTERS.indexOf(plannedSem);
        if (plannedSemIdx >= semIdx) {
          missingPrereqs.push(prereqId);
        }
      }
    }

    const missingPrereqNames = missingPrereqs.map(
      (id) => coursesById.get(id)?.name || id,
    );

    return {
      ok: missingPrereqs.length === 0 && !creditThresholdViolated,
      missingPrereqs,
      missingPrereqNames,
      creditThresholdViolated,
      minCreditsRequired: course.minCredits,
    };
  };

  // Handle moving a planned course directly to a target semester
  const handleMoveCourseToSemester = (
    courseId: string,
    targetSemester: string,
  ) => {
    if (!SEMESTERS.includes(targetSemester)) return;
    if (transcriptSemestersMap.has(targetSemester)) {
      showToast(
        `لا يمكن النقل إلى (${targetSemester}) لأنها فصل سابق معتمد بالسجل`,
      );
      return;
    }
    if (lockedSemesters.has(targetSemester)) {
      showToast(`الفصل (${targetSemester}) مقفل حالياً؛ يرجى فتح القفل أولاً`);
      return;
    }

    const c = coursesById.get(courseId);
    if (!c) return;

    const targetSemesterCredits = courses.reduce(
      (sum, course) =>
        course.id !== courseId && plannedCourses[course.id] === targetSemester
          ? sum + course.credits
          : sum,
      0,
    );
    const targetSemesterLimit = getSemesterCreditLimit(
      targetSemester,
      localHighGpa,
    );
    if (
      plannedCourses[courseId] !== targetSemester &&
      targetSemesterCredits + c.credits > targetSemesterLimit
    ) {
      showToast(
        `لا يمكن إضافة "${c.name}"؛ الحد الأقصى لهذا الفصل ${targetSemesterLimit} ساعة.`,
      );
      return;
    }

    // Prerequisites validation check on drop / move
    const prereqStatus = checkCoursePrerequisites(c, targetSemester);
    if (!prereqStatus.ok) {
      showToast(
        `تنبيه: نقل "${c.name}" إلى ${targetSemester} قد يخل بمتطلب: ${prereqStatus.missingPrereqNames.join("، ")}`,
      );
    } else {
      showToast(`تم نقل "${c.name}" إلى ${targetSemester}`);
    }

    setPlannedCourses((prev) => ({
      ...prev,
      [courseId]: targetSemester,
    }));
    triggerHaptic("selection");
  };

  // Handle moving a planned course delta semesters
  const handleMoveCourseSemester = (courseId: string, delta: number) => {
    const currentSem = plannedCourses[courseId];
    if (!currentSem) return;
    const currentIdx = SEMESTERS.indexOf(currentSem);
    const nextIdx = currentIdx + delta;
    if (nextIdx >= 0 && nextIdx < SEMESTERS.length) {
      handleMoveCourseToSemester(courseId, SEMESTERS[nextIdx]);
    }
  };

  // Pre-calculate multiple critical bottleneck tracks across curriculum
  const bottleneckMap = useMemo(() => {
    return computeMultipleCriticalTracks(courses);
  }, [courses]);

  // Set of courses currently registered or in-progress in transcript
  const registeredCourseCodes = useMemo(() => {
    const set = new Set<string>(currentStudent?.registeredCourseIds || []);
    transcriptSemestersMap.forEach((rec) => {
      if (rec.isCurrentOrInProgress) {
        rec.courses.forEach((c) => set.add(c.code));
      } else {
        rec.courses.forEach((c) => {
          if (
            c.isRegistered ||
            c.status === "مسجل" ||
            (c.grade === null && !c.isPassed && !c.isFailed)
          ) {
            set.add(c.code);
          }
        });
      }
    });
    return set;
  }, [currentStudent?.registeredCourseIds, transcriptSemestersMap]);

  // Compute all previously completed + earlier planned courses + in-progress registered courses
  const allPrev = useMemo(() => {
    const prev = new Set(completedCourses);
    registeredCourseCodes.forEach((code) => prev.add(code));
    if (currentSemesterIndex >= 0) {
      Object.entries(plannedCourses).forEach(([id, semester]) => {
        const plannedIndex = SEMESTERS.indexOf(semester);
        if (plannedIndex >= 0 && plannedIndex < currentSemesterIndex) {
          prev.add(id);
        }
      });
    }
    return prev;
  }, [
    completedCourses,
    registeredCourseCodes,
    plannedCourses,
    currentSemesterIndex,
  ]);

  // Current semester planned course IDs
  const currentSemesterPlannedIds = useMemo(() => {
    return Object.entries(plannedCourses)
      .filter(([, s]) => s === activeSemester)
      .map(([id]) => id);
  }, [plannedCourses, activeSemester]);

  const currentPlannedCredits = useMemo(() => {
    return currentSemesterPlannedIds.reduce(
      (sum, id) => sum + (coursesById.get(id)?.credits ?? 0),
      0,
    );
  }, [currentSemesterPlannedIds, coursesById]);

  // Pre-registration schedule feasibility check for current planned semester
  const scheduleFeasibility = useMemo(() => {
    return checkSemesterScheduleFeasibility(
      currentSemesterPlannedIds,
      coursesById,
    );
  }, [currentSemesterPlannedIds, coursesById]);

  // Estimated Tuition calculation for planned credits
  const estimatedTuition = useMemo(() => {
    let rate = 25;
    try {
      const saved = localStorage.getItem("ptuk_hourly_rate");
      if (saved) {
        rate = Number(saved);
      } else if (currentStudent?.majorName) {
        rate = getOfficialTuitionRate(currentStudent.majorName).hourlyRateJOD;
      }
    } catch {}
    return calculateDetailedTuition(currentPlannedCredits, {
      hourlyRate: rate,
    });
  }, [currentPlannedCredits, currentStudent?.majorName]);

  const handleToggleLockSemester = (sem: string) => {
    setLockedSemesters((prev) => {
      const next = new Set(prev);
      if (next.has(sem)) {
        next.delete(sem);
        showToast(`تم فتح قفل (${sem})`);
      } else {
        next.add(sem);
        showToast(`تم قفل (${sem}) وحمايته من التعديل`);
      }
      try {
        localStorage.setItem(
          "ptuk_locked_semesters",
          JSON.stringify(Array.from(next)),
        );
      } catch {}
      return next;
    });
    triggerHaptic("selection");
  };

  const handleAutoPlanToGraduation = (includeSummer = false) => {
    const allPassedCodes = new Set<string>(completedCourses);
    transcriptSemestersMap.forEach((rec) => {
      rec.courses.forEach((c) => {
        if (c.isPassed) allPassedCodes.add(c.code);
      });
    });

    const targetCreditLimit = hasAcademicWarning
      ? isSummer
        ? 6
        : 14
      : localHighGpa
        ? isSummer
          ? 12
          : 21
        : isSummer
          ? 10
          : 19;

    const updated = autoPlanToGraduation(
      courses,
      upcomingPlanningSemester,
      allPassedCodes,
      plannedCourses,
      lockedSemesters,
      targetCreditLimit,
      includeSummer,
      effectiveCategoryRequirements,
      registeredCourseCodes,
    );

    setPlannedCourses(updated);
    showToast(
      includeSummer
        ? "تم توزيع المساقات المتبقية بتوازن ذكي حتى التخرج مع استغلال الفصول الصيفية"
        : "تم توزيع المساقات المتبقية بتوازن ذكي حتى التخرج وفق مواسم الطرح",
    );
    triggerHaptic("success");
  };

  const handleSwitchScenario = (scenarioId: string) => {
    setActiveScenarioId(scenarioId);
    const target = scenarios.find((s) => s.id === scenarioId);
    if (target && target.plannedCourses) {
      setPlannedCourses(target.plannedCourses);
      showToast(`تم التبديل إلى سيناريو "${target.name}"`);
    }
  };

  const handleSaveNewScenario = () => {
    setNewScenarioName(`خطة مخصصة ${scenarios.length + 1}`);
    setSaveScenarioModalOpen(true);
  };

  const handleConfirmSaveScenario = () => {
    const trimmed = newScenarioName.trim();
    if (!trimmed) return;
    const newSc: PlanScenario = {
      id: `custom_${Date.now()}`,
      name: trimmed,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      plannedCourses: { ...plannedCourses },
    };
    const updatedScenarios = [...scenarios, newSc];
    setScenarios(updatedScenarios);
    saveScenario(newSc);
    setActiveScenarioId(newSc.id);
    setSaveScenarioModalOpen(false);
    setNewScenarioName("");
    showToast(`تم حفظ السيناريو "${newSc.name}" بنجاح`);
    triggerHaptic("success");
  };

  const isOverLimit = currentPlannedCredits > creditLimit;
  const excessCredits = currentPlannedCredits - creditLimit;

  // Cumulative earned credits for prerequisite checks
  const cumulativeEarnedCredits = useMemo(() => {
    return calculateDegreeCredits(courses, allPrev);
  }, [courses, allPrev]);

  // Available courses calculation:
  // Uses 'permissive' coreqMode to avoid mutual deadlocks (e.g. physics lecture + lab)
  const availableCourses = useMemo(() => {
    return courses.filter((c) => {
      // Completed or currently registered courses cannot be planned
      if (completedCourses.has(c.id) || registeredCourseCodes.has(c.id))
        return false;

      // If planned in an earlier semester, already counted in allPrev
      const plannedSemester = plannedCourses[c.id];
      const plannedIndex = plannedSemester
        ? SEMESTERS.indexOf(plannedSemester)
        : -1;
      if (plannedIndex >= 0 && plannedIndex < currentSemesterIndex)
        return false;

      // Available if prerequisites are met (permissive coreq mode allows concurrent co-requisites)
      return defaultIsCourseAvailable(c, allPrev, courses, {
        currentPlannedCourses: new Set(currentSemesterPlannedIds),
        cumulativeEarnedCredits,
        coreqMode: "permissive",
      });
    });
  }, [
    courses,
    completedCourses,
    registeredCourseCodes,
    plannedCourses,
    currentSemesterIndex,
    allPrev,
    currentSemesterPlannedIds,
    cumulativeEarnedCredits,
  ]);

  // Filtered available courses based on deferred search (120fps input response), hour filter, and academic readiness
  const filteredAvailable = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    return availableCourses.filter((c) => {
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (typeof hourFilter === "number" && c.credits !== hourFilter) {
        return false;
      }

      return true;
    });
  }, [availableCourses, deferredSearchQuery, hourFilter]);

  // Group by category
  const groupedAvailable = useMemo(() => {
    const map: Record<string, Course[]> = {};
    filteredAvailable.forEach((c) => {
      const cat = c.category || "متطلب تخصص";
      if (!map[cat]) map[cat] = [];
      map[cat].push(c);
    });
    return map;
  }, [filteredAvailable]);

  // Category progress calculation (including past completed credits + planned credits)
  const categoryProgress = useMemo(() => {
    const base: Record<string, number> =
      Object.keys(completedCreditsPerCategory).length > 0
        ? { ...completedCreditsPerCategory }
        : calculateCategoryCredits(courses, completedCourses);

    Object.entries(plannedCourses).forEach(([courseId, semester]) => {
      const plannedIdx = SEMESTERS.indexOf(semester);
      if (
        completedCourses.has(courseId) ||
        plannedIdx < 0 ||
        plannedIdx > currentSemesterIndex
      ) {
        return;
      }
      const c = coursesById.get(courseId);
      if (c && c.category) {
        base[c.category] = (base[c.category] || 0) + c.credits;
      }
    });
    return base;
  }, [
    completedCreditsPerCategory,
    courses,
    completedCourses,
    plannedCourses,
    currentSemesterIndex,
    coursesById,
  ]);

  // Add course to current semester
  const handleAddCourse = (courseId: string) => {
    const c = coursesById.get(courseId);
    if (!c) return;
    if (currentPlannedCredits + c.credits > creditLimit) {
      showToast(
        `لا يمكن إضافة "${c.name}"؛ الحد الأقصى لـ ${activeSemester} هو ${creditLimit} ساعة.`,
      );
      return;
    }
    setPlannedCourses((prev) => ({
      ...prev,
      [courseId]: activeSemester,
    }));
    showToast(`تمت إضافة "${c.name}" إلى ${activeSemester}`);
  };

  // Remove course from plan
  const handleRemoveCourse = (courseId: string) => {
    const c = coursesById.get(courseId);
    setPlannedCourses((prev) => {
      const updated = { ...prev };
      delete updated[courseId];
      return updated;
    });
    showToast(`تمت إزالة "${c?.name || courseId}" من الخطة`);
  };

  // Auto-suggest recommended courses for the active semester
  const handleAutoSuggestForActiveSemester = () => {
    manuallyClearedSemesters.current.delete(activeSemester);
    const allPassedCodes = new Set<string>(completedCourses);
    transcriptSemestersMap.forEach((rec) => {
      rec.courses.forEach((c) => {
        if (c.isPassed) allPassedCodes.add(c.code);
      });
    });

    const updated = autoPopulateUpcomingSemester(
      courses,
      activeSemester,
      allPassedCodes,
      plannedCourses,
      Array.from(registeredCourseCodes),
    );
    const cappedPlan = fitPlanWithinSemesterCreditLimit(
      courses,
      plannedCourses,
      updated,
      activeSemester,
      creditLimit,
    );
    setPlannedCourses(cappedPlan.plannedCourses);
    showToast(
      cappedPlan.omittedCourses > 0
        ? `تمت إضافة المساقات ضمن سقف ${creditLimit} ساعة، وتعذر إضافة ${cappedPlan.omittedCourses} مساق لتجاوز الحد.`
        : `تمت إضافة المساقات الموصى بها لـ (${activeSemester})`,
    );
  };

  // Auto-apply recommended courses for the active planning semester if it is currently empty and not explicitly cleared by student
  useEffect(() => {
    if (!isTranscriptSemester && activeSemester === upcomingPlanningSemester) {
      if (manuallyClearedSemesters.current.has(activeSemester)) return;
      if (initialAutoSuggestAttempted.current.has(activeSemester)) return;

      const plannedInActive = Object.values(plannedCourses).filter(
        (s) => s === activeSemester,
      ).length;
      if (plannedInActive === 0 && courses.length > 0) {
        initialAutoSuggestAttempted.current.add(activeSemester);
        const allPassedCodes = new Set<string>(completedCourses);
        transcriptSemestersMap.forEach((rec) => {
          rec.courses.forEach((c) => {
            if (c.isPassed) allPassedCodes.add(c.code);
          });
        });

        const updated = autoPopulateUpcomingSemester(
          courses,
          activeSemester,
          allPassedCodes,
          plannedCourses,
          Array.from(registeredCourseCodes),
        );
        const cappedPlan = fitPlanWithinSemesterCreditLimit(
          courses,
          plannedCourses,
          updated,
          activeSemester,
          creditLimit,
        );
        if (
          Object.keys(cappedPlan.plannedCourses).length >
          Object.keys(plannedCourses).length
        ) {
          setPlannedCourses(cappedPlan.plannedCourses);
        }
      }
    }
  }, [
    activeSemester,
    upcomingPlanningSemester,
    isTranscriptSemester,
    courses,
    creditLimit,
    completedCourses,
    registeredCourseCodes,
    transcriptSemestersMap,
  ]);

  // Permanently maintain past semesters from transcript and ensure completed or currently registered courses
  // are never in plannedCourses so the student only plans for upcoming semesters.
  useEffect(() => {
    const allPassedCodes = new Set<string>(completedCourses);
    transcriptSemestersMap.forEach((rec) => {
      rec.courses.forEach((c) => {
        if (c.isPassed) allPassedCodes.add(c.code);
      });
    });

    setPlannedCourses((prev) => {
      let hasErronousPlanned = false;
      const cleanPlanned: Record<string, string> = {};
      Object.entries(prev).forEach(([cId, sem]) => {
        if (
          allPassedCodes.has(cId) ||
          registeredCourseCodes.has(cId) ||
          transcriptSemestersMap.has(sem)
        ) {
          hasErronousPlanned = true;
        } else {
          cleanPlanned[cId] = sem;
        }
      });

      return hasErronousPlanned ? cleanPlanned : prev;
    });
  }, [completedCourses, registeredCourseCodes, transcriptSemestersMap]);

  // Trigger confirmation modal for clearing semester
  const handleClearSemester = () => {
    if (currentSemesterPlannedIds.length === 0) return;
    setConfirmClearOpen(true);
  };

  // Confirmed execution of clearing all courses in current semester
  const executeClearSemester = () => {
    manuallyClearedSemesters.current.add(activeSemester);
    setPlannedCourses((prev) => {
      const next = { ...prev };
      currentSemesterPlannedIds.forEach((id) => {
        delete next[id];
      });
      return next;
    });
    setConfirmClearOpen(false);
    showToast(`تم تفريغ مواد ${activeSemester}`);
    triggerHaptic("warning");
  };

  // Toggle open/collapse all categories
  const areAllOpen = Object.values(collapsedCategories).every((val) => !val);
  const handleToggleAllCategories = () => {
    const newState: Record<string, boolean> = {};
    Object.keys(groupedAvailable).forEach((cat) => {
      newState[cat] = areAllOpen;
    });
    setCollapsedCategories(newState);
  };

  // Finalize / Commit semester
  const handleCommitSemester = () => {
    const nextSem = getNextPlanningSemester(activeSemester);
    if (nextSem && nextSem !== activeSemester) {
      setCurrentPlanningSemester(nextSem);
      showToast(`تم تثبيت الفصل والانتقال إلى ${nextSem}`);
    } else {
      showToast("تم الانتهاء من تخطيط جميع الفصول بنجاح!");
      setTimeout(() => {
        onNavigateBackToPlan();
      }, 1500);
    }
  };

  // Multi-view horizontal semester scroll container
  const multiScrollRef = useRef<HTMLDivElement>(null);

  return (
    <div
      dir="rtl"
      className="w-full min-h-[calc(100dvh-52px)] md:h-[calc(100dvh-52px)] md:overflow-hidden bg-[var(--bg)] flex flex-col text-[var(--text)]"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-20 md:bottom-6 right-6 z-[var(--z-toast)] px-4 py-3 bg-[var(--surface)] border border-[var(--accent)] text-[var(--text)] rounded-[var(--r-control)] shadow-[var(--shadow-pop)] text-[14px] font-medium flex items-center gap-2 animate-in fade-in duration-150"
        >
          <Sparkles size={16} className="text-[var(--accent)] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Screen Header */}
      <header className="px-3 sm:px-6 py-2.5 sm:py-3 border-b border-[var(--line)] bg-[var(--bg)] shrink-0 shadow-xs">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          {/* Top Line: Back + Title & Status */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onNavigateBackToPlan}
              aria-label="رجوع إلى الخريطة"
              className="p-1.5 -mr-1 text-[var(--text-2)] hover:text-[var(--text)] rounded-[var(--r-control)] hover:bg-[var(--sunken)] transition-colors cursor-pointer flex items-center gap-1 text-[13px] sm:text-[14px] shrink-0"
            >
              <ArrowRight size={17} />
              <span>الخريطة</span>
            </button>
            <span className="text-[var(--line)]">/</span>
            <h1 className="text-[16px] sm:text-[19px] font-bold text-[var(--text)] font-['Noto_Naskh_Arabic',serif] flex items-center gap-2 min-w-0">
              <span>تخطيط الفصول</span>
              {isTranscriptSemester ? (
                <span
                  className={cn(
                    "text-[11px] font-bold px-2.5 py-0.5 rounded-full border hidden sm:inline-flex items-center gap-1 shrink-0 whitespace-nowrap",
                    activeTranscriptRecord?.isCurrentOrInProgress
                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                  )}
                >
                  {activeTranscriptRecord?.isCurrentOrInProgress ? (
                    <Clock size={11} />
                  ) : (
                    <CheckCircle2 size={11} />
                  )}
                  <span>
                    {activeTranscriptRecord?.isCurrentOrInProgress
                      ? "الفصل الحالي (قيد الدراسة)"
                      : "معتمد بالسجل الأكاديمي"}
                  </span>
                </span>
              ) : hasAcademicWarning ? (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25 inline-flex items-center gap-1 shrink-0 whitespace-nowrap">
                  <AlertTriangle
                    size={11}
                    className="shrink-0 text-amber-500"
                  />
                  <span>تحت الملاحظة ({creditLimit}س)</span>
                </span>
              ) : isAutoHighGpaEligible && localHighGpa ? (
                <span
                  className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25 inline-flex items-center gap-1 shrink-0 whitespace-nowrap"
                  title="سقف 21س مفعّل تلقائياً وفق أنظمة خضوري (المعدل التراكمي ≥ 80% أو متوقع تخرجه)"
                >
                  <Sparkles size={11} className="shrink-0 text-emerald-500" />
                  <span>سقف المتفوقين ({creditLimit}س)</span>
                </span>
              ) : null}
            </h1>
          </div>

          {/* Action Toolbar: Clean, Focused, Single Row */}
          <div className="flex items-center gap-2 justify-between sm:justify-end flex-wrap sm:flex-nowrap">
            {/* 1. Semester Selector */}
            <div className="flex items-center gap-1.5 shrink-0">
              <label
                htmlFor="semester-select"
                className="text-[12px] text-[var(--text-3)] hidden lg:inline"
              >
                الفصل:
              </label>
              <select
                id="semester-select"
                value={activeSemester}
                onChange={(e) => setCurrentPlanningSemester(e.target.value)}
                className="h-[34px] sm:h-[var(--control-h)] px-2.5 text-[12px] sm:text-[13px] font-medium bg-[var(--surface)] border border-[var(--line-control)] rounded-[var(--r-control)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] cursor-pointer max-w-[190px] sm:max-w-[260px]"
              >
                {/* 1. Official Completed Transcript Semesters */}
                {Array.from(transcriptSemestersMap.keys()).length > 0 && (
                  <optgroup label="── الفصول السابقة والمعتمدة بالسجل ──">
                    {SEMESTERS.filter((s) => transcriptSemestersMap.has(s)).map(
                      (s) => {
                        const transRecord = transcriptSemestersMap.get(s)!;
                        const icon = transRecord.isCurrentOrInProgress
                          ? "⏳"
                          : "✓";
                        const statusSuffix = transRecord.isCurrentOrInProgress
                          ? " (قيد الدراسة)"
                          : "";
                        return (
                          <option key={s} value={s}>
                            {icon} {s} ({transRecord.originalTitle})
                            {statusSuffix}
                          </option>
                        );
                      },
                    )}
                  </optgroup>
                )}

                {/* 2. Upcoming & Future Planning Semesters */}
                <optgroup label="── فصول التخطيط القادمة ──">
                  {SEMESTERS.filter((s) => !transcriptSemestersMap.has(s)).map(
                    (s) => {
                      const isUp = s === upcomingPlanningSemester;
                      return (
                        <option key={s} value={s}>
                          {isUp ? `★ ${s} (فصل التخطيط القادم)` : s}
                        </option>
                      );
                    },
                  )}
                </optgroup>
              </select>
            </div>

            {/* 2. View Mode Switcher */}
            <div className="flex items-center border border-[var(--line-control)] rounded-[var(--r-control)] bg-[var(--surface)] overflow-hidden text-[11px] sm:text-[12px] h-[34px] sm:h-[var(--control-h)] shrink-0">
              <button
                type="button"
                onClick={() => setLayoutView("single")}
                className={cn(
                  "px-2.5 sm:px-3 h-full transition-colors cursor-pointer flex items-center gap-1",
                  layoutView === "single"
                    ? "bg-[var(--accent)] text-[var(--text-on-accent)] font-semibold"
                    : "text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--sunken)]",
                )}
              >
                <span>فصل محدد</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutView("multi")}
                className={cn(
                  "px-2.5 sm:px-3 h-full transition-colors cursor-pointer flex items-center gap-1",
                  layoutView === "multi"
                    ? "bg-[var(--accent)] text-[var(--text-on-accent)] font-semibold"
                    : "text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--sunken)]",
                )}
              >
                <Columns size={13} />
                <span>المخطط الشامل</span>
              </button>
            </div>

            {/* 3. Auto-Plan To Graduation with Summer Dropdown */}
            <div
              className="relative flex items-center shrink-0"
              ref={autoPlanMenuRef}
            >
              <div className="flex items-center bg-[var(--surface)] text-[var(--accent)] border border-[var(--accent)]/40 rounded-[var(--r-control)] overflow-hidden h-[34px] sm:h-[var(--control-h)]">
                <button
                  type="button"
                  onClick={() => handleAutoPlanToGraduation(false)}
                  className="h-full px-2.5 text-[11px] sm:text-[12px] font-medium hover:bg-[var(--accent-soft)] transition-colors cursor-pointer flex items-center gap-1.5"
                  title="توزيع المساقات المتبقية بتوازن ذكي حتى التخرج وفق مواسم الطرح والمتطلبات"
                >
                  <Sparkles size={13} className="text-[var(--accent)]" />
                  <span className="hidden sm:inline">توزيع ذكي</span>
                  <span className="sm:hidden">توزيع</span>
                </button>
                <div className="w-[1px] h-4 bg-[var(--accent)]/30" />
                <button
                  type="button"
                  onClick={() => setShowAutoPlanDropdown((prev) => !prev)}
                  className="h-full px-1.5 hover:bg-[var(--accent-soft)] transition-colors cursor-pointer flex items-center justify-center text-[var(--accent)]"
                  title="خيارات التوزيع (مع/بدون صيفي)"
                  aria-label="خيارات التوزيع التلقائي"
                >
                  <ChevronDown
                    size={12}
                    className={cn(
                      "transition-transform",
                      showAutoPlanDropdown && "rotate-180",
                    )}
                  />
                </button>
              </div>

              {/* Themed Auto-Plan Options Dropdown */}
              {showAutoPlanDropdown && (
                <div
                  dir="rtl"
                  className="absolute top-full mt-1.5 right-0 min-w-[240px] sm:min-w-[270px] bg-[var(--surface)] border border-[var(--line-control)] rounded-[var(--r-menu)] shadow-xl z-50 py-1 text-right animate-in fade-in zoom-in-95 duration-100"
                >
                  <div className="px-3 py-1.5 text-[10px] font-bold text-[var(--text-3)] border-b border-[var(--line-control)] mb-1 flex items-center justify-between">
                    <span>خيارات التوزيع الذكي</span>
                    <Sparkles size={12} className="text-[var(--accent)]" />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAutoPlanDropdown(false);
                      handleAutoPlanToGraduation(false);
                    }}
                    className="w-full px-3 py-2 text-[12px] text-right hover:bg-[var(--sunken)] transition-colors cursor-pointer flex flex-col gap-0.5"
                  >
                    <span className="font-semibold text-[var(--text)] flex items-center gap-1.5">
                      <span>توزيع حتى التخرج (فصول عادية)</span>
                    </span>
                    <span className="text-[10px] text-[var(--text-3)]">
                      توزيع المساقات على الفصول الأولى والثانية فقط (بدون صيفي)
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAutoPlanDropdown(false);
                      handleAutoPlanToGraduation(true);
                    }}
                    className="w-full px-3 py-2 text-[12px] text-right hover:bg-[var(--sunken)] transition-colors cursor-pointer flex flex-col gap-0.5 border-t border-[var(--line-control)]"
                  >
                    <span className="font-semibold text-[var(--accent)] flex items-center gap-1.5">
                      <Sun size={13} className="text-amber-500 shrink-0" />
                      <span>توزيع حتى التخرج مع الصيفي</span>
                    </span>
                    <span className="text-[10px] text-[var(--text-3)]">
                      استغلال الفصول الصيفية (بحد أقصى 9-10 ساعات) لتسريع التخرج
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* 4. Consolidated Plan Options Dropdown (⋯ خيارات) */}
            <div className="relative shrink-0" ref={moreActionsRef}>
              <button
                type="button"
                onClick={() => setShowMoreActions((prev) => !prev)}
                className={cn(
                  "h-[34px] sm:h-[var(--control-h)] px-2.5 text-[11px] sm:text-[12px] font-medium rounded-[var(--r-control)] bg-[var(--surface)] border border-[var(--line-control)] text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--sunken)] transition-colors cursor-pointer flex items-center gap-1.5",
                  showMoreActions &&
                    "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-soft)]",
                )}
                title="خيارات إضافية: سيناريوهات الخطط، الطباعة، ورفع السقف"
              >
                <Layers size={13} className="text-[var(--text-3)]" />
                <span className="hidden sm:inline">خيارات الخطة</span>
                <ChevronDown
                  size={11}
                  className={cn(
                    "text-[var(--text-3)] transition-transform",
                    showMoreActions && "rotate-180",
                  )}
                />
              </button>

              {showMoreActions && (
                <div
                  dir="rtl"
                  className="absolute top-full mt-1.5 left-0 min-w-[240px] max-w-[280px] bg-[var(--surface)] border border-[var(--line-control)] rounded-[var(--r-menu)] shadow-xl z-50 py-1.5 text-right animate-in fade-in zoom-in-95 duration-100"
                >
                  <div className="px-3 py-1.5 text-[10px] font-bold text-[var(--text-3)] border-b border-[var(--line-control)] mb-1 flex items-center justify-between">
                    <span>الخطط البديلة والسيناريوهات</span>
                    <GitFork size={12} />
                  </div>
                  <div className="max-h-[140px] overflow-y-auto custom-scrollbar px-1">
                    {scenarios.map((sc) => {
                      const isSelected = sc.id === activeScenarioId;
                      return (
                        <button
                          key={sc.id}
                          type="button"
                          onClick={() => {
                            handleSwitchScenario(sc.id);
                            setShowMoreActions(false);
                          }}
                          className={cn(
                            "w-full px-2.5 py-1.5 text-[11.5px] rounded-[var(--r-control)] text-right flex items-center justify-between gap-2 transition-colors cursor-pointer",
                            isSelected
                              ? "bg-[var(--accent-soft)] text-[var(--accent)] font-semibold"
                              : "text-[var(--text)] hover:bg-[var(--sunken)]",
                          )}
                        >
                          <span className="truncate">{sc.name}</span>
                          {isSelected && (
                            <Check
                              size={12}
                              className="text-[var(--accent)] shrink-0"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="px-1.5 pt-1 border-t border-[var(--line-control)] mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreActions(false);
                        handleSaveNewScenario();
                      }}
                      className="w-full px-2 py-1.5 text-[11px] font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)] rounded-[var(--r-control)] flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus size={12} />
                      <span>حفظ كسيناريو جديد...</span>
                    </button>
                  </div>

                  {/* Print / PDF Option */}
                  <div className="border-t border-[var(--line-control)] mt-1 pt-1 px-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreActions(false);
                        window.print();
                      }}
                      className="w-full px-2 py-1.5 text-[11.5px] text-[var(--text)] hover:bg-[var(--sunken)] rounded-[var(--r-control)] flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Printer size={13} className="text-[var(--text-3)]" />
                      <span>طباعة الخطة / تصدير PDF</span>
                    </button>
                  </div>

                  {/* High GPA Limit Option */}
                  <div className="border-t border-[var(--line-control)] mt-1 pt-1 px-1.5">
                    {!hasAcademicWarning && isAutoHighGpaEligible && (
                      <button
                        type="button"
                        onClick={() => {
                          setLocalHighGpa((prev) => !prev);
                          triggerHaptic("selection");
                        }}
                        className={cn(
                          "w-full px-2 py-1.5 text-[11.5px] rounded-[var(--r-control)] flex items-center justify-between gap-2 transition-colors cursor-pointer",
                          localHighGpa
                            ? "bg-[var(--accent-soft)] text-[var(--accent)] font-semibold"
                            : "text-[var(--text)] hover:bg-[var(--sunken)]",
                        )}
                        title="سقف المتفوقين متاح وفق شروط تعليمات خضوري"
                      >
                        <div className="flex items-center gap-2">
                          <Sparkles
                            size={13}
                            className={
                              localHighGpa
                                ? "text-[var(--accent)]"
                                : "text-[var(--text-3)]"
                            }
                          />
                          <div className="flex flex-col text-right">
                            <span>سقف 21س للمتفوقين</span>
                            <span className="text-[9.5px] opacity-75 font-normal">
                              مفعّل وفق شروط تعليمات خضوري
                            </span>
                          </div>
                        </div>
                        {localHighGpa && (
                          <Check
                            size={12}
                            className="text-[var(--accent)] shrink-0"
                          />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Multi-Column Roadmap View */}
      {layoutView === "multi" ? (
        <MultiColumnRoadmapView
          multiScrollRef={multiScrollRef}
          semesters={SEMESTERS}
          transcriptSemestersMap={transcriptSemestersMap}
          lockedSemesters={lockedSemesters}
          plannedCourses={plannedCourses}
          coursesById={coursesById}
          activeSemester={activeSemester}
          localHighGpa={localHighGpa}
          dragOverSemester={dragOverSemester}
          draggedCourseId={draggedCourseId}
          bottleneckMap={bottleneckMap}
          getSemesterCreditLimit={getSemesterCreditLimit}
          checkCoursePrerequisites={checkCoursePrerequisites}
          checkCourseSeasonality={checkCourseSeasonality}
          setDragOverSemester={setDragOverSemester}
          setDraggedCourseId={setDraggedCourseId}
          handleMoveCourseToSemester={handleMoveCourseToSemester}
          handleToggleLockSemester={handleToggleLockSemester}
          handleRemoveCourse={handleRemoveCourse}
          onSelectSemester={(sem) => {
            setCurrentPlanningSemester(sem);
            setLayoutView("single");
          }}
        />
      ) : (
        /* Single-Semester Two-Column Layout (Desktop Side-by-Side, Mobile Stacked) */
        <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-[var(--line)] overflow-hidden min-h-0">
          {isTranscriptSemester && activeTranscriptRecord ? (
            /* Transcript Official Record: Column 1 Overview */
            <section className="flex-1 md:w-[50%] flex flex-col bg-[var(--bg)] p-4 sm:p-6 overflow-y-auto custom-scrollbar">
              <div className="max-w-lg mx-auto w-full space-y-5 my-auto py-2">
                <div
                  className={cn(
                    "p-6 rounded-2xl bg-[var(--surface)] shadow-sm relative overflow-hidden border",
                    activeTranscriptRecord.isCurrentOrInProgress
                      ? "border-blue-500/30"
                      : "border-emerald-500/30",
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r",
                      activeTranscriptRecord.isCurrentOrInProgress
                        ? "from-blue-500 to-cyan-400"
                        : "from-emerald-500 to-teal-400",
                    )}
                  />

                  <div className="flex items-start gap-3.5">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border",
                        activeTranscriptRecord.isCurrentOrInProgress
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                      )}
                    >
                      {activeTranscriptRecord.isCurrentOrInProgress ? (
                        <Clock size={24} />
                      ) : (
                        <CheckCircle2 size={24} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            "text-[12px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 whitespace-nowrap inline-flex items-center gap-1.5",
                            activeTranscriptRecord.isCurrentOrInProgress
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                          )}
                        >
                          {activeTranscriptRecord.isCurrentOrInProgress ? (
                            <Clock size={12} className="shrink-0" />
                          ) : (
                            <CheckCircle2 size={12} className="shrink-0" />
                          )}
                          <span>
                            {activeTranscriptRecord.isCurrentOrInProgress
                              ? "الفصل الحالي (قيد الدراسة)"
                              : "معتمد بالسجل الأكاديمي"}
                          </span>
                        </span>
                        <span className="text-[12px] text-[var(--text-3)]">
                          بوابة خضوري Edugate
                        </span>
                      </div>
                      <h2 className="text-[19px] font-bold text-[var(--text)] mt-1.5 font-['Noto_Naskh_Arabic',serif]">
                        {activeTranscriptRecord.originalTitle}
                      </h2>
                      <p className="text-[13px] text-[var(--text-3)] mt-1 leading-relaxed">
                        {activeTranscriptRecord.isCurrentOrInProgress
                          ? "هذا الفصل مسجل حالياً في جدولك وقيد الدراسة. المساقات مستخرجة مباشرة من بوابتك وساعاته معتمدة بانتظار رصد الدرجات النهائية لاحتسابها في المعدل التراكمي."
                          : "هذا الفصل مسجل ومعتمد رسمياً في سجلك الجامعي. المساقات والعلامات المعروضة مستخرجة مباشرة من كشف العلامات الإلكتروني."}
                      </p>
                    </div>
                  </div>

                  {/* Summary Stats Grid */}
                  <div className="grid grid-cols-3 gap-2.5 mt-5 pt-5 border-t border-[var(--line)] text-center">
                    <div className="p-2.5 rounded-xl bg-[var(--sunken)]/60">
                      <div className="text-[11px] text-[var(--text-3)] mb-0.5">
                        المساقات
                      </div>
                      <div className="text-[16px] font-bold text-[var(--text)] tabular-nums">
                        {activeTranscriptRecord.courses.length}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[var(--sunken)]/60">
                      <div className="text-[11px] text-[var(--text-3)] mb-0.5">
                        {activeTranscriptRecord.isCurrentOrInProgress
                          ? "الساعات المسجلة"
                          : "الساعات المحتسبة"}
                      </div>
                      <div
                        className={cn(
                          "text-[16px] font-bold tabular-nums",
                          activeTranscriptRecord.isCurrentOrInProgress
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {activeTranscriptRecord.isCurrentOrInProgress
                          ? `${activeTranscriptRecord.registeredCredits || activeTranscriptRecord.totalCredits} س`
                          : `${activeTranscriptRecord.passedCredits} س`}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[var(--sunken)]/60">
                      <div className="text-[11px] text-[var(--text-3)] mb-0.5">
                        {activeTranscriptRecord.isCurrentOrInProgress
                          ? "حالة الرصد"
                          : "معدل الفصل"}
                      </div>
                      <div className="text-[15px] font-bold text-[var(--text)] tabular-nums">
                        {activeTranscriptRecord.isCurrentOrInProgress
                          ? "قيد الدراسة"
                          : activeTranscriptRecord.gpa !== null
                            ? `${activeTranscriptRecord.gpa.toFixed(1)}%`
                            : "محتسب"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Navigation and Transcript Shortcuts */}
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      const targetSem =
                        upcomingPlanningSemester !== activeSemester
                          ? upcomingPlanningSemester
                          : getNextPlanningSemester(activeSemester);
                      setCurrentPlanningSemester(targetSem);
                      showToast(`تم الانتقال إلى فصل التخطيط (${targetSem})`);
                    }}
                    className="w-full py-3 px-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-on-accent)] rounded-[var(--r-control)] font-semibold text-[14px] flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-[0.99]"
                  >
                    <Sparkles size={16} />
                    <span>
                      الانتقال للتخطيط:{" "}
                      {upcomingPlanningSemester !== activeSemester
                        ? upcomingPlanningSemester
                        : getNextPlanningSemester(activeSemester)}
                    </span>
                  </button>

                  {onOpenRecordsModal && (
                    <button
                      type="button"
                      onClick={onOpenRecordsModal}
                      className="w-full py-2.5 px-4 bg-[var(--surface)] hover:bg-[var(--sunken)] border border-[var(--line-control)] text-[var(--text)] rounded-[var(--r-control)] font-medium text-[13px] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <GraduationCap
                        size={16}
                        className="text-[var(--accent)]"
                      />
                      <span>عرض السجل الأكاديمي والمالي الشامل</span>
                    </button>
                  )}
                </div>
              </div>
            </section>
          ) : (
            /* Column 1: Available Courses (60%) */
            <section className="flex-1 md:w-[60%] flex flex-col bg-[var(--bg)] min-h-0 overflow-hidden">
              {/* Search & Filter Toolbar */}
              <div className="p-3 sm:p-4 border-b border-[var(--line)] space-y-2.5 bg-[var(--bg)] shrink-0">
                {/* Single Search Field with Clear Button */}
                <div className="relative">
                  <Search
                    size={15}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] pointer-events-none"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث باسم المادة أو رقم المساق..."
                    className="w-full h-[36px] sm:h-[var(--control-h)] pr-9 pl-9 text-[13px] bg-[var(--surface)] border border-[var(--line-control)] rounded-[var(--r-control)] text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text)] p-0.5"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Filter Tabs & Toggle All */}
                <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5">
                  <div className="flex items-center gap-3 text-[12px] sm:text-[13px] font-medium shrink-0">
                    <button
                      type="button"
                      onClick={() => setHourFilter(null)}
                      className={cn(
                        "pb-1 border-b-2 transition-colors cursor-pointer whitespace-nowrap",
                        hourFilter === null
                          ? "border-[var(--accent)] text-[var(--text)] font-semibold"
                          : "border-transparent text-[var(--text-2)] hover:text-[var(--text)]",
                      )}
                    >
                      الكل ({availableCourses.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setHourFilter(3)}
                      className={cn(
                        "pb-1 border-b-2 transition-colors cursor-pointer whitespace-nowrap",
                        hourFilter === 3
                          ? "border-[var(--accent)] text-[var(--text)] font-semibold"
                          : "border-transparent text-[var(--text-2)] hover:text-[var(--text)]",
                      )}
                    >
                      3 ساعات
                    </button>
                    <button
                      type="button"
                      onClick={() => setHourFilter(1)}
                      className={cn(
                        "pb-1 border-b-2 transition-colors cursor-pointer whitespace-nowrap",
                        hourFilter === 1
                          ? "border-[var(--accent)] text-[var(--text)] font-semibold"
                          : "border-transparent text-[var(--text-2)] hover:text-[var(--text)]",
                      )}
                    >
                      مختبرات (1 س)
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleAllCategories}
                    className="text-[12px] text-[var(--text-2)] hover:text-[var(--text)] hover:underline cursor-pointer shrink-0"
                  >
                    {areAllOpen ? "طي الكل" : "فتح الكل"}
                  </button>
                </div>
              </div>

              {/* Accordion List of Categories */}
              <div className="flex-1 overflow-y-auto divide-y divide-[var(--line)] custom-scrollbar pb-36 md:pb-6 min-h-0">
                {Object.keys(groupedAvailable).length === 0 ? (
                  <div className="p-8 text-center text-[14px] text-[var(--text-2)]">
                    لم يتم العثور على مواد متاحة تطابق خيارات البحث الحالية.
                  </div>
                ) : (
                  Object.entries(groupedAvailable).map(
                    ([category, catCourses]) => {
                      const isCollapsed = Boolean(
                        collapsedCategories[category],
                      );
                      const requiredCredits =
                        effectiveCategoryRequirements[category] || 0;
                      const earnedInCat = categoryProgress[category] || 0;
                      const catPercent =
                        requiredCredits > 0
                          ? Math.min(
                              100,
                              Math.round((earnedInCat / requiredCredits) * 100),
                            )
                          : 0;

                      return (
                        <div key={category} className="bg-[var(--bg)]">
                          {/* Category Header */}
                          <button
                            type="button"
                            onClick={() =>
                              setCollapsedCategories((prev) => ({
                                ...prev,
                                [category]: !prev[category],
                              }))
                            }
                            className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between text-right bg-[var(--surface)] hover:bg-[var(--sunken)] transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isCollapsed ? (
                                <ChevronDown
                                  size={16}
                                  className="text-[var(--text-3)] shrink-0"
                                />
                              ) : (
                                <ChevronUp
                                  size={16}
                                  className="text-[var(--text-3)] shrink-0"
                                />
                              )}
                              <span className="text-[14px] sm:text-[15px] font-semibold text-[var(--text)] truncate">
                                {category} ({catCourses.length})
                              </span>
                            </div>
                            <span className="text-[12px] sm:text-[13px] text-[var(--text-3)] tabular-nums shrink-0">
                              {earnedInCat} من {requiredCredits} س ({catPercent}
                              %)
                            </span>
                          </button>

                          {/* Category Progress Bar */}
                          <div className="w-full h-[2px] bg-[var(--line)]">
                            <div
                              className="h-full bg-[var(--accent)] transition-all duration-300"
                              style={{ width: `${catPercent}%` }}
                            />
                          </div>

                          {/* Courses in Category */}
                          {!isCollapsed && (
                            <div className="divide-y divide-[var(--line)] bg-[var(--bg)]">
                              {catCourses.map((c) => {
                                const isAlreadyPlannedInThisSem =
                                  currentSemesterPlannedIds.includes(c.id);
                                const plannedElsewhereSem =
                                  plannedCourses[c.id];
                                const isPlannedElsewhere =
                                  plannedElsewhereSem &&
                                  plannedElsewhereSem !== activeSemester;

                                const seasonInfo = checkCourseSeasonality(
                                  c,
                                  activeSemester,
                                );
                                const prereqStatus = checkCoursePrerequisites(
                                  c,
                                  activeSemester,
                                );
                                const bInfo = bottleneckMap.get(c.id);
                                const rStatus = classifyCourseReadiness(
                                  c,
                                  completedCourses,
                                  allPrev,
                                );

                                return (
                                  <div
                                    key={c.id}
                                    className={cn(
                                      "min-h-[52px] px-3.5 sm:px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-[var(--sunken)] transition-colors",
                                      isAlreadyPlannedInThisSem &&
                                        "bg-[var(--accent-soft)]/20",
                                    )}
                                  >
                                    <div className="flex flex-col justify-center min-w-0 pr-1 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[14px] sm:text-[15px] font-medium text-[var(--text)] truncate">
                                          {c.name}
                                        </span>
                                        {bInfo && bInfo.isBottleneck && (
                                          <span
                                            className={cn(
                                              "text-[9px] font-bold px-1.5 py-0.2 rounded inline-flex items-center gap-0.5",
                                              bInfo.trackColor === "indigo"
                                                ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                                                : bInfo.trackColor === "cyan"
                                                  ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20"
                                                  : bInfo.trackColor === "amber"
                                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                                    : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
                                            )}
                                            title={`مسار ${bInfo.trackName}: متطلب لـ ${bInfo.dependentCount} مساقات لاحقة (عمق ${bInfo.depth})`}
                                          >
                                            ⚡ {bInfo.badgeLabel}
                                          </span>
                                        )}
                                        {rStatus === "in_progress_prereq" && (
                                          <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                                            قيد المتطلب
                                          </span>
                                        )}
                                        {rStatus === "locked" && (
                                          <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                                            مقفلة
                                          </span>
                                        )}
                                        {isAlreadyPlannedInThisSem && (
                                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-0.5">
                                            <Check size={10} />
                                            مضاف للفصل
                                          </span>
                                        )}
                                        {isPlannedElsewhere && (
                                          <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                                            مخطط في {plannedElsewhereSem}
                                          </span>
                                        )}
                                      </div>

                                      <div className="text-[11px] sm:text-[12px] text-[var(--text-3)] tabular-nums flex items-center flex-wrap gap-2 mt-0.5">
                                        <span dir="ltr" className="font-mono">
                                          {c.id}
                                        </span>
                                        <span>•</span>
                                        <span>{c.credits} س</span>

                                        {seasonInfo.label && (
                                          <>
                                            <span>•</span>
                                            <span
                                              className={cn(
                                                "inline-flex items-center gap-1",
                                                seasonInfo.isMismatch
                                                  ? "text-amber-600 dark:text-amber-400 font-semibold"
                                                  : "text-[var(--text-3)]",
                                              )}
                                            >
                                              {seasonInfo.label.includes(
                                                "أول",
                                              ) ? (
                                                <Snowflake size={11} />
                                              ) : (
                                                <Sun size={11} />
                                              )}
                                              {seasonInfo.label}
                                            </span>
                                          </>
                                        )}

                                        {!prereqStatus.ok && (
                                          <span className="text-rose-500 inline-flex items-center gap-0.5 font-medium">
                                            <AlertTriangle size={11} />
                                            {prereqStatus.creditThresholdViolated
                                              ? `يشترط ${prereqStatus.minCreditsRequired} س`
                                              : `متطلب: ${prereqStatus.missingPrereqNames.join("، ")}`}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Action Button */}
                                    <div className="shrink-0 flex items-center gap-1">
                                      {isAlreadyPlannedInThisSem ? (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleRemoveCourse(c.id)
                                          }
                                          className="text-[12px] sm:text-[13px] font-medium text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 rounded-[var(--r-control)] px-2.5 py-1 transition-colors flex items-center gap-1 cursor-pointer"
                                        >
                                          <Trash2 size={13} />
                                          <span>إزالة</span>
                                        </button>
                                      ) : isPlannedElsewhere ? (
                                        <button
                                          type="button"
                                          onClick={() => handleAddCourse(c.id)}
                                          className="text-[12px] sm:text-[13px] font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)] border border-[var(--accent)]/30 rounded-[var(--r-control)] px-2.5 py-1 transition-colors flex items-center gap-1 cursor-pointer"
                                        >
                                          <span>نقل هنا</span>
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleAddCourse(c.id)}
                                          className="text-[12px] sm:text-[13px] font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)] border border-[var(--accent)]/30 rounded-[var(--r-control)] px-2.5 py-1 transition-colors flex items-center gap-1 cursor-pointer"
                                        >
                                          <Plus size={13} />
                                          <span>إضافة</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    },
                  )
                )}
              </div>
            </section>
          )}

          {isTranscriptSemester && activeTranscriptRecord ? (
            /* Transcript Official Record: Column 2 List */
            <section className="flex-1 md:w-[50%] flex flex-col bg-[var(--surface)] min-h-0 overflow-hidden">
              <div className="p-4 border-b border-[var(--line)] flex items-center justify-between shrink-0 bg-[var(--sunken)]/40">
                <div className="flex items-center gap-2">
                  <h2 className="text-[16px] font-bold text-[var(--text)]">
                    مساقات السجل الأكاديمي
                  </h2>
                  <span
                    className={cn(
                      "text-[11px] font-semibold px-2 py-0.5 rounded-full border",
                      activeTranscriptRecord.isCurrentOrInProgress
                        ? "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20"
                        : "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                    )}
                  >
                    {activeTranscriptRecord.courses.length}{" "}
                    {activeTranscriptRecord.isCurrentOrInProgress
                      ? "مساقات مسجلة"
                      : "مساقات معتمدة"}
                  </span>
                </div>
                <span className="text-[12px] text-[var(--text-3)] tabular-nums">
                  إجمالي {activeTranscriptRecord.totalCredits} ساعة
                </span>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-[var(--line)] custom-scrollbar min-h-0">
                {activeTranscriptRecord.courses.map((sc) => (
                  <div
                    key={sc.code}
                    className="p-3.5 px-4 flex items-center justify-between hover:bg-[var(--sunken)]/40 transition-colors gap-3"
                  >
                    <div className="flex flex-col justify-center min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-semibold text-[var(--text)]">
                          {sc.name}
                        </span>
                        {sc.isPassed && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-0.5">
                            <Check size={10} />
                            {sc.status || "ناجح"}
                          </span>
                        )}
                        {sc.isFailed && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-600 border border-rose-500/20">
                            {sc.status || "راسب"}
                          </span>
                        )}
                        {sc.isRegistered && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 border border-blue-500/20">
                            {sc.status || "مسجل حالياً"}
                          </span>
                        )}
                      </div>

                      <div className="text-[12px] text-[var(--text-3)] tabular-nums flex items-center gap-2 mt-1">
                        <span dir="ltr" className="font-mono text-[11px]">
                          {sc.code}
                        </span>
                        <span>•</span>
                        <span>{sc.credits} س.م</span>
                        <span>•</span>
                        {activeTranscriptRecord.isCurrentOrInProgress ? (
                          <span className="text-blue-600 dark:text-blue-400 inline-flex items-center gap-0.5 text-[11px]">
                            <Clock size={11} />
                            قيد الدراسة حالياً
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-0.5 text-[11px]">
                            <CheckCircle2 size={11} />
                            معتمد في كشف العلامات
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 text-left">
                      {sc.grade !== null &&
                      typeof sc.grade === "number" &&
                      sc.grade >= 0 ? (
                        <div className="flex flex-col items-end">
                          <span
                            className={cn(
                              "text-[16px] font-black tabular-nums privacy-sensitive",
                              sc.grade >= 60
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-amber-600",
                            )}
                          >
                            {sc.grade}
                          </span>
                          <span className="text-[10px] text-[var(--text-3)]">
                            علامة رسمية
                          </span>
                        </div>
                      ) : (
                        <span
                          className={cn(
                            "text-[12px] font-bold px-2 py-1 rounded border",
                            activeTranscriptRecord.isCurrentOrInProgress
                              ? "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20"
                              : "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                          )}
                        >
                          {activeTranscriptRecord.isCurrentOrInProgress
                            ? "قيد الدراسة"
                            : sc.status || "محتسب"}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-[var(--line)] bg-[var(--sunken)]/60 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <div className="text-[12px] text-[var(--text-3)] flex items-center gap-1.5">
                  <CheckCircle2
                    size={13}
                    className="text-emerald-500 shrink-0"
                  />
                  <span>بيانات رسمية مستخرجة من بوابة خضوري الإلكترونية</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPlanningSemester(upcomingPlanningSemester);
                    showToast(
                      `تم الانتقال إلى فصل التخطيط (${upcomingPlanningSemester})`,
                    );
                  }}
                  className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-on-accent)] rounded-[var(--r-control)] font-semibold text-[13px] flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                >
                  <Sparkles size={14} />
                  <span>تخطيط {upcomingPlanningSemester}</span>
                </button>
              </div>
            </section>
          ) : (
            /* Column 2: Planned Courses (Desktop 40%) */
            <section className="hidden md:flex md:w-[40%] flex-col bg-[var(--surface)] min-h-0 overflow-hidden">
              {/* Header */}
              <div className="p-3 sm:p-4 border-b border-[var(--line)] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="text-[15px] sm:text-[16px] font-bold text-[var(--text)] truncate">
                    مواد الفصل
                  </h2>
                  <span className="text-[11px] font-semibold text-[var(--text-3)] tabular-nums bg-[var(--sunken)] px-2 py-0.5 rounded-full border border-[var(--line-control)] shrink-0">
                    {currentSemesterPlannedIds.length} مساقات
                  </span>
                  {scheduleFeasibility.hasConflict && (
                    <span
                      className="text-[10.5px] font-medium text-rose-700 dark:text-rose-300 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0"
                      title={scheduleFeasibility.conflicts.join(" | ")}
                    >
                      <AlertTriangle
                        size={11}
                        className="text-rose-500 shrink-0"
                      />
                      <span>تعارض في المواعيد</span>
                    </span>
                  )}
                  {!scheduleFeasibility.hasConflict &&
                    scheduleFeasibility.warnings.length > 0 && (
                      <span
                        className="text-[10.5px] font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0"
                        title={scheduleFeasibility.warnings.join(" | ")}
                      >
                        <AlertTriangle
                          size={11}
                          className="text-amber-500 shrink-0"
                        />
                        <span>
                          شعب غير متوفرة ({scheduleFeasibility.warnings.length})
                        </span>
                      </span>
                    )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleLockSemester(activeSemester)}
                    className={cn(
                      "p-1.5 rounded-lg border transition-colors cursor-pointer",
                      lockedSemesters.has(activeSemester)
                        ? "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400"
                        : "bg-[var(--surface)] border-[var(--line-control)] text-[var(--text-3)] hover:text-[var(--text)]",
                    )}
                    title={
                      lockedSemesters.has(activeSemester)
                        ? "الفصل مقفل (انقر لفتح القفل)"
                        : "قفل الفصل لمنع التعديل التلقائي"
                    }
                  >
                    {lockedSemesters.has(activeSemester) ? (
                      <Lock size={13} />
                    ) : (
                      <Unlock size={13} />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleAutoSuggestForActiveSemester}
                    className="text-[11px] font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)] px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 cursor-pointer border border-[var(--accent)]/30"
                    title="اقتراح وإضافة المساقات الموصى بها لهذا الفصل تلقائياً"
                  >
                    <Sparkles size={12} />
                    <span>اقتراح المواد</span>
                  </button>
                  {currentSemesterPlannedIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearSemester}
                      className="text-[11px] font-medium text-[var(--text-3)] hover:text-rose-500 hover:bg-rose-500/10 px-2 py-1 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                      title="تفريغ جميع مواد هذا الفصل"
                    >
                      <RotateCcw size={12} />
                      <span>تفريغ</span>
                    </button>
                  )}
                </div>
              </div>

              {/* List of Planned Courses */}
              <div className="flex-1 overflow-y-auto divide-y divide-[var(--line)] custom-scrollbar min-h-0">
                {currentSemesterPlannedIds.length === 0 ? (
                  <div className="p-8 text-center text-[14px] text-[var(--text-2)] flex flex-col items-center justify-center gap-3">
                    <Calendar
                      size={32}
                      className="text-[var(--text-3)] opacity-40 mb-1"
                    />
                    <p className="font-medium text-[var(--text)]">
                      لم تُضف مواد بعد لهذا الفصل
                    </p>
                    <p className="text-[12px] text-[var(--text-3)] max-w-[260px]">
                      اضغط على زر (إضافة) بجانب أي مساق من القائمة، أو أضف مواد
                      الخطة المقترحة بنقرة واحدة:
                    </p>
                    <button
                      type="button"
                      onClick={handleAutoSuggestForActiveSemester}
                      className="px-3.5 py-1.5 bg-[var(--accent)] text-[var(--text-on-accent)] rounded-[var(--r-control)] text-[12px] font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Sparkles size={13} />
                      <span>اقتراح مواد الخطة لهذا الفصل</span>
                    </button>
                  </div>
                ) : (
                  currentSemesterPlannedIds.map((id) => {
                    const c = coursesById.get(id);
                    if (!c) return null;

                    const prereqStatus = checkCoursePrerequisites(
                      c,
                      activeSemester,
                    );
                    const seasonInfo = checkCourseSeasonality(
                      c,
                      activeSemester,
                    );
                    const bInfo = bottleneckMap.get(c.id);

                    return (
                      <div
                        key={c.id}
                        className="p-3.5 px-4 flex items-center justify-between hover:bg-[var(--sunken)] transition-colors gap-2"
                      >
                        <div className="flex flex-col justify-center min-w-0 pr-1 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[14px] font-semibold text-[var(--text)] truncate">
                              {c.name}
                            </span>
                            {bInfo && bInfo.isBottleneck && (
                              <span
                                className={cn(
                                  "text-[9px] font-bold px-1.5 py-0.2 rounded inline-flex items-center gap-0.5",
                                  bInfo.trackColor === "indigo"
                                    ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                                    : bInfo.trackColor === "cyan"
                                      ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20"
                                      : bInfo.trackColor === "amber"
                                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                        : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
                                )}
                                title={`مسار ${bInfo.trackName}: متطلب لـ ${bInfo.dependentCount} مساقات لاحقة (عمق ${bInfo.depth})`}
                              >
                                ⚡ {bInfo.badgeLabel}
                              </span>
                            )}
                          </div>

                          <div className="text-[12px] text-[var(--text-3)] tabular-nums flex items-center flex-wrap gap-2 mt-0.5">
                            <span dir="ltr" className="font-mono">
                              {c.id}
                            </span>
                            <span>•</span>
                            <span>{c.credits} س</span>

                            {seasonInfo.isMismatch && (
                              <span className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded flex items-center gap-1 font-medium">
                                <AlertTriangle size={11} />
                                {seasonInfo.label}
                              </span>
                            )}

                            {!prereqStatus.ok && (
                              <span className="text-[11px] text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded flex items-center gap-1 font-medium">
                                <AlertCircle size={11} />
                                {prereqStatus.creditThresholdViolated
                                  ? `يتطلب ${prereqStatus.minCreditsRequired} س`
                                  : `متطلب: ${prereqStatus.missingPrereqNames.join("، ")}`}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Controls: Delete */}
                        <div className="flex items-center shrink-0">
                          <button
                            type="button"
                            disabled={lockedSemesters.has(activeSemester)}
                            onClick={() => {
                              triggerHaptic("warning");
                              handleRemoveCourse(c.id);
                            }}
                            className="w-7 h-7 flex items-center justify-center text-rose-500/80 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer active:scale-90 disabled:opacity-30"
                            title="إزالة المساق من الخطة"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Fixed Footer with Hours & Commit Action */}
              <div className="p-4 border-t border-[var(--line)] bg-[var(--surface)] space-y-3 shrink-0">
                {/* Hours and Limit warning */}
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-[18px] font-bold tabular-nums",
                      isOverLimit ? "text-rose-500" : "text-[var(--text)]",
                    )}
                  >
                    الساعات: {currentPlannedCredits} من {creditLimit}
                  </span>
                  {isOverLimit && (
                    <span className="text-[12px] text-rose-500 font-semibold tabular-nums bg-rose-500/10 px-2 py-0.5 rounded-md">
                      تتجاوز الحد بـ {excessCredits} ساعات
                    </span>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-[var(--line)] rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      isOverLimit ? "bg-rose-500" : "bg-[var(--accent)]",
                    )}
                    style={{
                      width: `${Math.min(100, Math.round((currentPlannedCredits / creditLimit) * 100))}%`,
                    }}
                  />
                </div>

                {/* Estimated Tuition Summary */}
                {currentPlannedCredits > 0 && (
                  <div className="flex items-center justify-between text-[12px] bg-[var(--sunken)]/60 px-3 py-1.5 rounded-lg border border-[var(--line-control)] text-[var(--text-2)]">
                    <span>الرسوم التقديرية للفصل:</span>
                    <span className="font-semibold text-[var(--text)] tabular-nums">
                      {estimatedTuition.totalJOD} د.أ{" "}
                      <span className="text-[11px] font-normal text-[var(--text-3)]">
                        (~{estimatedTuition.totalILS} ₪)
                      </span>
                    </span>
                  </div>
                )}

                {/* Single Primary Action: تثبيت الفصل */}
                <button
                  type="button"
                  onClick={handleCommitSemester}
                  className="w-full min-h-[var(--control-h)] px-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-on-accent)] font-semibold text-[14px] rounded-[var(--r-control)] transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99] shadow-sm"
                >
                  <span>تثبيت الفصل والانتقال للتالي</span>
                  <ChevronLeft size={16} />
                </button>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Mobile Floating Bar (< 768px): Positioned directly above App.tsx mobile nav at bottom-[58px] */}
      {layoutView === "single" && (
        <div className="md:hidden fixed bottom-[58px] inset-x-0 p-3 bg-[var(--surface)]/95 backdrop-blur-md border-t border-[var(--line)] flex items-center justify-between gap-3 z-[35] shadow-lg">
          {isTranscriptSemester && activeTranscriptRecord ? (
            <>
              <div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "text-[13px] font-bold flex items-center gap-1",
                      activeTranscriptRecord.isCurrentOrInProgress
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {activeTranscriptRecord.isCurrentOrInProgress ? (
                      <>
                        <Clock size={14} />
                        قيد الدراسة (
                        {activeTranscriptRecord.registeredCredits ||
                          activeTranscriptRecord.totalCredits}{" "}
                        س)
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} />
                        معتمد بالسجل ({activeTranscriptRecord.passedCredits} س)
                      </>
                    )}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMobilePlannedSheet(true)}
                  className="text-[12px] text-[var(--accent)] font-medium hover:underline cursor-pointer block mt-0.5"
                >
                  عرض مساقات الفصل ({activeTranscriptRecord.courses.length})
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  const targetSem =
                    upcomingPlanningSemester !== activeSemester
                      ? upcomingPlanningSemester
                      : getNextPlanningSemester(activeSemester);
                  setCurrentPlanningSemester(targetSem);
                  showToast(`تم الانتقال إلى فصل التخطيط (${targetSem})`);
                }}
                className="h-[38px] px-3.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-on-accent)] font-semibold text-[12px] rounded-[var(--r-control)] transition-all cursor-pointer flex items-center gap-1 shrink-0"
              >
                <span>الانتقال للتخطيط</span>
                <Sparkles size={14} />
              </button>
            </>
          ) : (
            <>
              <div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "text-[14px] font-bold tabular-nums",
                      isOverLimit ? "text-rose-500" : "text-[var(--text)]",
                    )}
                  >
                    {currentPlannedCredits} / {creditLimit} س
                  </span>
                  {isOverLimit && (
                    <span className="text-[10px] text-rose-500 font-bold bg-rose-500/10 px-1 py-0.2 rounded">
                      +{excessCredits}س
                    </span>
                  )}
                  {currentPlannedCredits > 0 && (
                    <span className="text-[11px] text-[var(--text-3)] tabular-nums">
                      ({estimatedTuition.totalJOD} د.أ)
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowMobilePlannedSheet(true)}
                  className="text-[12px] text-[var(--accent)] font-medium hover:underline cursor-pointer block mt-0.5"
                >
                  عرض المواد ({currentSemesterPlannedIds.length})
                </button>
              </div>

              <button
                type="button"
                onClick={handleCommitSemester}
                className="h-[38px] px-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-on-accent)] font-semibold text-[13px] rounded-[var(--r-control)] transition-all cursor-pointer flex items-center gap-1"
              >
                <span>تثبيت الفصل</span>
                <ChevronLeft size={15} />
              </button>
            </>
          )}
        </div>
      )}

      {/* Mobile Bottom Sheet for Planned Courses */}
      {showMobilePlannedSheet && (
        <div
          className="fixed inset-0 bg-black/60 z-[var(--z-modal)] flex flex-col justify-end animate-in fade-in duration-200"
          onClick={() => setShowMobilePlannedSheet(false)}
        >
          <div
            className="bg-[var(--surface)] rounded-t-2xl max-h-[80vh] flex flex-col border-t border-[var(--line)] shadow-2xl pb-20 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Handle */}
            <div className="w-12 h-1 bg-[var(--line-control)] rounded-full mx-auto my-2 shrink-0" />

            {/* Header */}
            <div className="px-4 py-3 border-b border-[var(--line)] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="text-[16px] font-bold text-[var(--text)]">
                  {isTranscriptSemester
                    ? `مساقات ${activeSemester}`
                    : `مواد ${activeSemester}`}
                </h3>
                <span
                  className={cn(
                    "text-[11px] px-2 py-0.5 rounded-full font-bold",
                    isTranscriptSemester
                      ? activeTranscriptRecord?.isCurrentOrInProgress
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : "bg-[var(--accent-soft)] text-[var(--accent)]",
                  )}
                >
                  {isTranscriptSemester
                    ? activeTranscriptRecord?.isCurrentOrInProgress
                      ? `${activeTranscriptRecord?.registeredCredits || activeTranscriptRecord?.totalCredits} س مسجلة`
                      : `${activeTranscriptRecord?.passedCredits} س محتسبة`
                    : `${currentPlannedCredits} / ${creditLimit} س`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {!isTranscriptSemester &&
                  currentSemesterPlannedIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearSemester}
                      className="text-[11px] text-rose-500 hover:bg-rose-500/10 px-2 py-1 rounded transition-colors"
                    >
                      تفريغ
                    </button>
                  )}
                <button
                  type="button"
                  onClick={() => setShowMobilePlannedSheet(false)}
                  className="p-1 text-[var(--text-3)] hover:text-[var(--text)]"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Courses List */}
            <div className="p-4 overflow-y-auto divide-y divide-[var(--line)] custom-scrollbar">
              {isTranscriptSemester && activeTranscriptRecord ? (
                activeTranscriptRecord.courses.map((tc) => (
                  <div
                    key={tc.code}
                    className="py-3 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-[14px] font-semibold text-[var(--text)] block truncate">
                        {tc.name}
                      </span>
                      <div className="text-[11px] text-[var(--text-3)] tabular-nums flex items-center gap-2 mt-0.5">
                        <span dir="ltr" className="font-mono">
                          {tc.code}
                        </span>
                        <span>•</span>
                        <span>{tc.credits} س</span>
                        <span>•</span>
                        {activeTranscriptRecord.isCurrentOrInProgress ? (
                          <span className="text-blue-600 dark:text-blue-400 font-medium inline-flex items-center gap-0.5">
                            <Clock size={11} />
                            قيد الدراسة
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-0.5">
                            <CheckCircle2 size={11} />
                            معتمد بالسجل
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-left">
                      {tc.grade !== null &&
                      typeof tc.grade === "number" &&
                      tc.grade >= 0 ? (
                        <span
                          className={cn(
                            "text-[14px] font-bold tabular-nums privacy-sensitive",
                            tc.grade >= 60
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-amber-600",
                          )}
                        >
                          {tc.grade}
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                          {tc.status || "ناجح"}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : currentSemesterPlannedIds.length === 0 ? (
                <div className="py-8 text-center text-[13px] text-[var(--text-3)]">
                  لم تُضف أي مواد لهذا الفصل بعد.
                </div>
              ) : (
                currentSemesterPlannedIds.map((id) => {
                  const c = coursesById.get(id);
                  if (!c) return null;

                  const prereqStatus = checkCoursePrerequisites(
                    c,
                    activeSemester,
                  );
                  const seasonInfo = checkCourseSeasonality(c, activeSemester);
                  const bInfo = bottleneckMap.get(c.id);

                  return (
                    <div
                      key={c.id}
                      className="py-3 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[14px] font-medium text-[var(--text)] truncate">
                            {c.name}
                          </span>
                          {bInfo && bInfo.isBottleneck && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                              ⚡ {bInfo.badgeLabel}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[var(--text-3)] tabular-nums flex items-center flex-wrap gap-2 mt-0.5">
                          <span dir="ltr" className="font-mono">
                            {c.id}
                          </span>
                          <span>•</span>
                          <span>{c.credits} س</span>

                          {seasonInfo.isMismatch && (
                            <span className="text-amber-500 font-medium">
                              ⚠️ {seasonInfo.label}
                            </span>
                          )}

                          {!prereqStatus.ok && (
                            <span className="text-rose-500 font-medium">
                              ⚠️{" "}
                              {prereqStatus.creditThresholdViolated
                                ? `يتطلب ${prereqStatus.minCreditsRequired} س`
                                : `متطلب: ${prereqStatus.missingPrereqNames.join("، ")}`}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={currentSemesterIndex === 0}
                          onClick={() => {
                            triggerHaptic("selection");
                            handleMoveCourseSemester(c.id, -1);
                          }}
                          className="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--sunken)]/60 text-[var(--text)] disabled:opacity-20 active:scale-90"
                          title="نقل للفصل السابق"
                        >
                          <ChevronRight size={16} />
                        </button>
                        <button
                          type="button"
                          disabled={
                            currentSemesterIndex === SEMESTERS.length - 1
                          }
                          onClick={() => {
                            triggerHaptic("selection");
                            handleMoveCourseSemester(c.id, 1);
                          }}
                          className="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--sunken)]/60 text-[var(--text)] disabled:opacity-20 active:scale-90"
                          title="نقل للفصل التالي"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic("warning");
                            handleRemoveCourse(c.id);
                          }}
                          className="w-9 h-9 flex items-center justify-center text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl active:scale-90"
                          title="إزالة"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Clear Semester Modal (Non-blocking Accessible Dialog) */}
      {confirmClearOpen && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setConfirmClearOpen(false)}
        >
          <div
            className="bg-[var(--surface)] border border-[var(--line-control)] rounded-[var(--r-modal)] max-w-sm w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center gap-2.5 text-rose-500">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 shrink-0">
                <Trash2 size={20} />
              </div>
              <h3 className="font-bold text-[16px] text-[var(--text)]">
                تفريغ مساقات الفصل
              </h3>
            </div>
            <p className="text-[13px] text-[var(--text-2)] leading-relaxed">
              هل أنت متأكد من رغبتك في تفريغ مواد فصل (
              <span className="font-semibold text-[var(--text)]">
                {activeSemester}
              </span>
              )؟ سيتم حذف جميع المساقات المخططة في هذا الفصل.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                className="px-3.5 py-2 text-[13px] font-medium rounded-[var(--r-control)] border border-[var(--line-control)] text-[var(--text-2)] hover:bg-[var(--sunken)] transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={executeClearSemester}
                className="px-4 py-2 text-[13px] font-semibold rounded-[var(--r-control)] bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer shadow-xs active:scale-[0.99]"
              >
                تأكيد التفريغ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Scenario Modal (Non-blocking Accessible Dialog) */}
      <ScenarioSaveModal
        isOpen={saveScenarioModalOpen}
        onClose={() => setSaveScenarioModalOpen(false)}
        scenarioName={newScenarioName}
        setScenarioName={setNewScenarioName}
        onConfirmSave={handleConfirmSaveScenario}
      />
    </div>
  );
};

export default SemesterPlanningPage;
