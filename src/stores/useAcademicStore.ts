import { create } from "zustand";
import type { Course } from "../data";
import {
  courses as defaultCourses,
  categoryRequirements as defaultCategoryRequirements,
} from "../data";
import type { StudentSyncProfile } from "../services/studentService";
import { getCachedStudentProfile } from "../services/studentService";
import { getActiveMajorId, getActiveMajorName } from "../services/majorService";
import { triggerHaptic } from "../utils/haptics";
import { SEMESTERS } from "../constants";

export interface AcademicState {
  courses: Course[];
  activeMajorId: string;
  activeMajorName: string;
  categoryRequirements: Record<string, number>;
  completedCourses: Set<string>;
  plannedCourses: Record<string, string>;
  currentPlanningSemester: string;
  exemptedCourses: Set<string>;
  registeredCourses: Set<string>;
  courseGrades: Record<string, number>;
  courseMarks: Record<string, number>;
  currentStudent: StudentSyncProfile | null;

  // Actions
  setCourses: (courses: Course[]) => void;
  setActiveMajor: (
    id: string,
    name?: string,
    requirements?: Record<string, number>,
  ) => void;
  setCategoryRequirements: (reqs: Record<string, number>) => void;
  setCompletedCourses: (
    completed: Set<string> | ((prev: Set<string>) => Set<string>),
  ) => void;
  toggleCompleteCourse: (courseId: string) => void;
  setPlannedCourses: (
    planned:
      | Record<string, string>
      | ((prev: Record<string, string>) => Record<string, string>),
  ) => void;
  planCourse: (courseId: string, semester?: string) => void;
  unplanCourse: (courseId: string) => void;
  setCurrentPlanningSemester: (semester: string) => void;
  setCourseGrades: (
    grades:
      | Record<string, number>
      | ((prev: Record<string, number>) => Record<string, number>),
  ) => void;
  setCourseGrade: (courseId: string, grade: number) => void;
  setCourseMarks: (
    marks:
      | Record<string, number>
      | ((prev: Record<string, number>) => Record<string, number>),
  ) => void;
  setStudentProfile: (profile: StudentSyncProfile | null) => void;
  resetAcademicProgress: () => void;
}

const initialStudent = getCachedStudentProfile();

export const useAcademicStore = create<AcademicState>((set) => ({
  courses: initialStudent?.planCourses?.length
    ? initialStudent.planCourses
    : defaultCourses,
  activeMajorId:
    initialStudent?.majorId ||
    (initialStudent?.majorName
      ? initialStudent.majorName.trim().replace(/\s+/g, "-")
      : getActiveMajorId() || ""),
  activeMajorName: initialStudent?.majorName || getActiveMajorName() || "",
  categoryRequirements:
    initialStudent?.categoryRequirements &&
    Object.keys(initialStudent.categoryRequirements).length > 0
      ? initialStudent.categoryRequirements
      : defaultCategoryRequirements,
  completedCourses: new Set<string>(initialStudent?.passedCourseIds || []),
  plannedCourses: {},
  currentPlanningSemester: SEMESTERS[0] || "السنة الأولى - الفصل الأول",
  exemptedCourses: new Set<string>(),
  registeredCourses: new Set<string>(initialStudent?.registeredCourseIds || []),
  courseGrades: initialStudent?.courseGrades || {},
  courseMarks: {},
  currentStudent: initialStudent,

  setCourses: (courses) => set({ courses }),
  setActiveMajor: (id, name, requirements) =>
    set((state) => ({
      activeMajorId: id,
      activeMajorName: name ?? state.activeMajorName,
      categoryRequirements: requirements ?? state.categoryRequirements,
    })),
  setCategoryRequirements: (categoryRequirements) =>
    set({ categoryRequirements }),

  setCompletedCourses: (completed) =>
    set((state) => ({
      completedCourses:
        typeof completed === "function"
          ? completed(state.completedCourses)
          : completed,
    })),

  toggleCompleteCourse: (courseId) =>
    set((state) => {
      const nextCompleted = new Set(state.completedCourses);
      const nextPlanned = { ...state.plannedCourses };

      if (nextCompleted.has(courseId)) {
        nextCompleted.delete(courseId);
        triggerHaptic("light");
      } else {
        nextCompleted.add(courseId);
        triggerHaptic("success");
        if (nextPlanned[courseId]) {
          delete nextPlanned[courseId];
        }
      }

      return {
        completedCourses: nextCompleted,
        plannedCourses: nextPlanned,
      };
    }),

  setPlannedCourses: (planned) =>
    set((state) => ({
      plannedCourses:
        typeof planned === "function" ? planned(state.plannedCourses) : planned,
    })),

  planCourse: (courseId, semester) =>
    set((state) => {
      const nextPlanned = { ...state.plannedCourses };
      if (nextPlanned[courseId]) {
        delete nextPlanned[courseId];
        triggerHaptic("light");
      } else {
        nextPlanned[courseId] =
          semester || state.currentPlanningSemester || SEMESTERS[0];
        triggerHaptic("selection");
      }
      return { plannedCourses: nextPlanned };
    }),

  unplanCourse: (courseId) =>
    set((state) => {
      if (!state.plannedCourses[courseId]) return state;
      const next = { ...state.plannedCourses };
      delete next[courseId];
      return { plannedCourses: next };
    }),

  setCurrentPlanningSemester: (currentPlanningSemester) =>
    set({ currentPlanningSemester }),

  setCourseGrades: (grades) =>
    set((state) => ({
      courseGrades:
        typeof grades === "function" ? grades(state.courseGrades) : grades,
    })),

  setCourseGrade: (courseId, grade) =>
    set((state) => ({
      courseGrades: {
        ...state.courseGrades,
        [courseId]: grade,
      },
    })),

  setCourseMarks: (marks) =>
    set((state) => ({
      courseMarks:
        typeof marks === "function" ? marks(state.courseMarks) : marks,
    })),

  setStudentProfile: (currentStudent) =>
    set({
      currentStudent,
      ...(currentStudent?.majorId
        ? { activeMajorId: currentStudent.majorId }
        : {}),
      ...(currentStudent?.majorName
        ? { activeMajorName: currentStudent.majorName }
        : {}),
      ...(currentStudent?.planCourses?.length
        ? { courses: currentStudent.planCourses }
        : {}),
      ...(currentStudent?.categoryRequirements
        ? { categoryRequirements: currentStudent.categoryRequirements }
        : {}),
      ...(currentStudent?.courseGrades
        ? { courseGrades: currentStudent.courseGrades }
        : {}),
      completedCourses: new Set(currentStudent?.passedCourseIds || []),
      registeredCourses: new Set(currentStudent?.registeredCourseIds || []),
    }),

  resetAcademicProgress: () =>
    set({
      completedCourses: new Set(),
      plannedCourses: {},
      courseGrades: {},
      courseMarks: {},
    }),
}));
