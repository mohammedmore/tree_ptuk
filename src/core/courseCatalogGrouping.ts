import { getRecommendedSemesterOfCourse } from "../constants";
import type { Course } from "../data";

export interface CourseSemesterGroup {
  id: string;
  title: string;
  courses: Course[];
  totalCredits: number;
  completedCredits: number;
}

export interface CourseYearGroup {
  id: string;
  title: string;
  courses: Course[];
  totalCredits: number;
  completedCredits: number;
  semesterGroups: CourseSemesterGroup[];
}

const YEAR_GROUPS = [
  { id: "year-1", title: "السنة الأولى" },
  { id: "year-2", title: "السنة الثانية" },
  { id: "year-3", title: "السنة الثالثة" },
  { id: "year-4", title: "السنة الرابعة" },
  { id: "year-5", title: "السنة الخامسة ومشاريع التخرج" },
  { id: "remedial", title: "المتطلبات الاستدراكية" },
  { id: "electives", title: "المواد الاختيارية" },
] as const;

function getYearGroupIndex(semester: string): number {
  if (semester.includes("السنة الأولى")) return 0;
  if (semester.includes("السنة الثانية")) return 1;
  if (semester.includes("السنة الثالثة")) return 2;
  if (semester.includes("السنة الرابعة")) return 3;
  if (semester.includes("السنة الخامسة")) return 4;
  return 4;
}

export function buildCourseYearGroups(
  filteredCourses: readonly Course[],
  allCourses: readonly Course[],
  completedCourseIds: ReadonlySet<string>,
  categoryRequirements: Readonly<Record<string, number>>,
): CourseYearGroup[] {
  const groups: CourseYearGroup[] = YEAR_GROUPS.map(({ id, title }) => ({
    id,
    title,
    courses: [],
    totalCredits: 0,
    completedCredits: 0,
    semesterGroups: [],
  }));
  const remedialGroup = groups[groups.length - 2];
  const electivesGroup = groups[groups.length - 1];

  for (const course of filteredCourses) {
    const isElective = course.category.includes("اختياري");
    const isRemedial = course.category.includes("استدراكي");
    const semester = getRecommendedSemesterOfCourse(course);
    const group =
      groups[
        isElective
          ? groups.length - 1
          : isRemedial
            ? groups.length - 2
            : getYearGroupIndex(semester)
      ];

    group.courses.push(course);
    if (isElective || isRemedial) continue;

    group.totalCredits += course.credits;
    if (completedCourseIds.has(course.id)) {
      group.completedCredits += course.credits;
    }

    let semesterGroup = group.semesterGroups.find(
      (item) => item.title === semester,
    );
    if (!semesterGroup) {
      semesterGroup = {
        id: `${group.id}-${group.semesterGroups.length}`,
        title: semester,
        courses: [],
        totalCredits: 0,
        completedCredits: 0,
      };
      group.semesterGroups.push(semesterGroup);
    }

    semesterGroup.courses.push(course);
    semesterGroup.totalCredits += course.credits;
    if (completedCourseIds.has(course.id)) {
      semesterGroup.completedCredits += course.credits;
    }
  }

  for (const requirementGroup of [remedialGroup, electivesGroup]) {
    const categories = new Set(
      requirementGroup.courses.map((course) => course.category),
    );
    for (const category of categories) {
      const requiredCredits = Math.max(0, categoryRequirements[category] ?? 0);
      const completedCredits = allCourses
        .filter(
          (course) =>
            course.category === category && completedCourseIds.has(course.id),
        )
        .reduce((total, course) => total + course.credits, 0);

      requirementGroup.totalCredits += requiredCredits;
      requirementGroup.completedCredits += Math.min(
        requiredCredits,
        completedCredits,
      );
    }
  }

  return groups.filter((group) => group.courses.length > 0);
}
