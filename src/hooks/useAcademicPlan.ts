import { useState, useEffect, useRef, useCallback } from "react";
import type { ScheduleEntry, Course } from "../data";
import { readAppStorageValue, serializeAppStorageValue } from "../appStorage";

interface UseAcademicPlanOptions {
  reportStorageIssue?: (msg: string) => void;
}

export function useAcademicPlan(options: UseAcademicPlanOptions = {}) {
  const reportStorageIssue =
    options.reportStorageIssue ??
    ((msg: string) => console.warn("Storage warning:", msg));

  const [completedCourses, setCompletedCourses] = useState<Set<string>>(() => {
    return readAppStorageValue<Set<string>>(
      "completed_courses",
      new Set(),
      reportStorageIssue,
    );
  });

  const [plannedCourses, setPlannedCourses] = useState<Record<string, string>>(
    () => {
      return readAppStorageValue<Record<string, string>>(
        "planned_courses",
        {},
        reportStorageIssue,
      );
    },
  );

  const [weeklySchedule, setWeeklySchedule] = useState<
    Record<string, Record<string, ScheduleEntry>>
  >(() => {
    return readAppStorageValue<Record<string, Record<string, ScheduleEntry>>>(
      "weekly_schedule",
      {},
      reportStorageIssue,
    );
  });

  const [courseGrades, setCourseGrades] = useState<Record<string, number>>(
    () => {
      return readAppStorageValue<Record<string, number>>(
        "course_grades",
        {},
        reportStorageIssue,
      );
    },
  );

  const [failedCourseIds, setFailedCourseIds] = useState<string[]>(() => {
    return readAppStorageValue<string[]>(
      "failed_course_ids",
      [],
      reportStorageIssue,
    );
  });

  const [selectedElectives, setSelectedElectives] = useState<
    Record<string, string>
  >(() => {
    return readAppStorageValue<Record<string, string>>(
      "selected_electives_map",
      {
        univ_1: "13020001",
        univ_2: "13020009",
        univ_3: "13020026",
        spec_1: "12140416",
        spec_2: "12140549",
        spec_3: "12140505",
        spec_4: "12140510",
        spec_5: "12140526",
      },
      reportStorageIssue,
    );
  });

  const [currentPlanningSemester, setCurrentPlanningSemester] = useState<
    string | null
  >(() => {
    return readAppStorageValue<string | null>(
      "selected_planning_semester",
      null,
      reportStorageIssue,
    );
  });

  const handleSetCurrentPlanningSemester = useCallback(
    (semester: string | null) => {
      setCurrentPlanningSemester(semester);
      try {
        if (typeof window !== "undefined") {
          if (semester) {
            localStorage.setItem("selected_planning_semester", semester);
          } else {
            localStorage.removeItem("selected_planning_semester");
          }
        }
      } catch {
        // storage unavailable
      }
    },
    [],
  );

  // Refs for dirty-checking storage saves
  const prevSavedRef = useRef<{
    completedCourses?: Set<string>;
    plannedCourses?: Record<string, string>;
    weeklySchedule?: Record<string, Record<string, ScheduleEntry>>;
    courseGrades?: Record<string, number>;
    failedCourseIds?: string[];
    selectedElectives?: Record<string, string>;
  }>({});

  // Debounced batch save with dirty checking
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        if (prevSavedRef.current.completedCourses !== completedCourses) {
          localStorage.setItem(
            "completed_courses",
            serializeAppStorageValue(completedCourses),
          );
          prevSavedRef.current.completedCourses = completedCourses;
        }
        if (prevSavedRef.current.plannedCourses !== plannedCourses) {
          localStorage.setItem(
            "planned_courses",
            serializeAppStorageValue(plannedCourses),
          );
          prevSavedRef.current.plannedCourses = plannedCourses;
        }
        if (prevSavedRef.current.weeklySchedule !== weeklySchedule) {
          localStorage.setItem(
            "weekly_schedule",
            serializeAppStorageValue(weeklySchedule),
          );
          prevSavedRef.current.weeklySchedule = weeklySchedule;
        }
        if (prevSavedRef.current.courseGrades !== courseGrades) {
          localStorage.setItem(
            "course_grades",
            serializeAppStorageValue(courseGrades),
          );
          prevSavedRef.current.courseGrades = courseGrades;
        }
        if (prevSavedRef.current.failedCourseIds !== failedCourseIds) {
          localStorage.setItem(
            "failed_course_ids",
            serializeAppStorageValue(failedCourseIds),
          );
          prevSavedRef.current.failedCourseIds = failedCourseIds;
        }
        if (prevSavedRef.current.selectedElectives !== selectedElectives) {
          localStorage.setItem(
            "selected_electives_map",
            serializeAppStorageValue(selectedElectives),
          );
          prevSavedRef.current.selectedElectives = selectedElectives;
        }
      } catch (e: any) {
        reportStorageIssue(e?.message || "Storage quota exceeded");
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [
    completedCourses,
    plannedCourses,
    weeklySchedule,
    courseGrades,
    failedCourseIds,
    selectedElectives,
    reportStorageIssue,
  ]);

  const resetAllPlanData = useCallback(() => {
    setCompletedCourses(new Set());
    setPlannedCourses({});
    setWeeklySchedule({});
    setCourseGrades({});
    setFailedCourseIds([]);
    setCurrentPlanningSemester(null);
    try {
      localStorage.removeItem("completed_courses");
      localStorage.removeItem("planned_courses");
      localStorage.removeItem("weekly_schedule");
      localStorage.removeItem("course_grades");
      localStorage.removeItem("failed_course_ids");
      localStorage.removeItem("selected_planning_semester");
    } catch {}
  }, []);

  return {
    completedCourses,
    setCompletedCourses,
    plannedCourses,
    setPlannedCourses,
    weeklySchedule,
    setWeeklySchedule,
    courseGrades,
    setCourseGrades,
    failedCourseIds,
    setFailedCourseIds,
    selectedElectives,
    setSelectedElectives,
    currentPlanningSemester,
    setCurrentPlanningSemester: handleSetCurrentPlanningSemester,
    resetAllPlanData,
  };
}
