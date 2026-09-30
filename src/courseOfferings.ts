import { SEMESTERS } from "./constants";
import { courses } from "./data";

/**
 * بيانات فترات طرح المسافات (الفصول المتاحة لكل مادة)
 * الأنواع المتاحة: 'first' (الفصل الأول)، 'second' (الفصل الثاني)، 'summer' (الصيفي)
 */
export type SemesterType = "first" | "second" | "summer";

const SEMESTER_TYPES: readonly SemesterType[] = ["first", "second", "summer"];

function isSemesterType(value: string): value is SemesterType {
  return SEMESTER_TYPES.some((type) => type === value);
}

export const courseOfferingsByID: Record<string, SemesterType[]> = Object.fromEntries(
  courses.flatMap((course): [string, SemesterType[]][] => (
    course.availableSemesters ? [[course.id, course.availableSemesters]] : []
  )),
);

/**
 * دالة للحصول على فترات الطرح لمادة معينة
 * @param courseId معرّف المادة
 * @returns مصفوفة الفترات المتاحة أو undefined إذا لم تُحدد فترات محددة
 */
export const getAvailableSemesters = (
  courseId: string
): SemesterType[] | undefined => {
  return Object.hasOwn(courseOfferingsByID, courseId)
    ? courseOfferingsByID[courseId]
    : undefined;
};

/**
 * دالة للتحقق من توفر مادة في فصل معين
 * @param courseId معرّف المادة
 * @param semesterType نوع الفصل: 'first' أو 'second' أو 'summer'
 * @returns true إذا كانت المادة متاحة في هذا الفصل
 */
export const isCourseAvailableInSemester = (
  courseId: string,
  semesterType: string
): boolean => {
  if (!isSemesterType(semesterType)) return false;
  const available = getAvailableSemesters(courseId);
  // إذا لم تُحدد فترات محددة، افترض أن المادة متاحة في جميع الفصول
  if (!available) return true;
  return available.includes(semesterType);
};

/**
 * دالة للحصول على نوع الفصل من اسم الفصل الكامل
 * @param semesterName اسم الفصل الكامل (مثل "السنة الأولى - الفصل الأول")
 * @returns نوع الفصل أو null إذا لم يكن الاسم معروفاً
 */
export const getSemesterType = (semesterName: string): SemesterType | null => {
  const semesterIndex = SEMESTERS.indexOf(semesterName);
  if (semesterIndex < 0) return null;
  return SEMESTER_TYPES[semesterIndex % SEMESTER_TYPES.length];
};

/**
 * دالة لترجمة نوع الفصل إلى نص عربي
 * @param semesterType نوع الفصل
 * @returns النص العربي
 */
export const translateSemesterType = (
  semesterType: SemesterType
): string => {
  switch (semesterType) {
    case 'first':
      return 'الفصل الأول';
    case 'second':
      return 'الفصل الثاني';
    case 'summer':
      return 'الصيفي';
    default:
      return 'غير محدد';
  }
};

/**
 * دالة لترجمة فترات الطرح إلى نص عربي
 * @param offerings مصفوفة فترات الطرح
 * @returns نص عربي يصف فترات الطرح
 */
export const formatOfferings = (offerings?: readonly SemesterType[]): string => {
  if (!offerings) return 'جميع الفصول';
  if (offerings.length === 0) return 'لم تُحدد فترات';

  const translated = offerings.map((s) => translateSemesterType(s));
  if (translated.length === 3) return 'جميع الفصول';
  if (translated.length === 2) {
    return `${translated[0]} و${translated[1]}`;
  }
  return translated[0];
};
