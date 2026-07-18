/**
 * بيانات فترات طرح المسافات (الفصول المتاحة لكل مادة)
 * الأنواع المتاحة: 'first' (الفصل الأول)، 'second' (الفصل الثاني)، 'summer' (الصيفي)
 */
export const courseOfferingsByID: Record<string, ('first' | 'second' | 'summer')[]> = {
  // مسافات تخصص إجباري - قسم علوم الحاسوب
  '12140102': ['second', 'summer'], // البرمجة الكينونية (جافا) - الفصل الثاني، وأحياناً الصيفي
  '12140203': ['first', 'summer'], // تركيب البيانات (داتا ستركتشر) - الفصل الأول، والصيفي
  '12140204': ['first', 'summer'], // تراكيب الحوسبة المتقطعة (دسكريت) - الفصل الأول، ونادراً في الصيفي
  '12140205': ['second'], // تحليل وتصميم الخوارزميات (خوارزميات) - الفصل الثاني فقط
  '12140308': ['first', 'summer'], // نظم تشغيل (OS) - الفصل الأول، والصيفي
  '12140309': ['first'], // أنظمة قواعد البيانات ومختبرها (داتا بيس) - الفصل الأول فقط
  '12140312': ['second'], // شبكات الحاسوب ومختبرها (شبكات) - الفصل الثاني فقط
  '12140313': ['second'], // مختبر شبكات حاسوب - الفصل الثاني فقط
  '12140314': ['first'], // مختبر انظمة قواعد بيانات - الفصل الأول فقط
  '12140418': ['second'], // هندسة البرمجيات (سوفتوير) - الفصل الثاني فقط
  '12140413': ['first'], // معمارية الحاسوب (معمارية) - الفصل الأول فقط
  '12140412': ['second'], // تحليل وتصميم أنظمة المعلومات (آيساد) - الفصل الثاني فقط
  '12140420': ['second'], // التصميم المنطقي عالي المستوى (فهدل) - الفصل الثاني فقط
  '12140435': ['first'], // تقنيات الويب المتطورة (الويب المتطورة) - الفصل الأول فقط
  '12140533': ['first'], // تعلم الآلة (الماشين) - الفصل الأول فقط
  '12140527': ['second', 'summer'], // التشفير وأمن الشبكات (التشفير) - الفصل الثاني، وممكن في الصيفي
  '12140523': ['second'], // تقنيات الإنترنت وتطبيقات الويب (ويب) - الفصل الثاني فقط
  '12140414': ['second'], // المعالجات الدقيقة ولغة الأسمبلي - النظري (اسمبلي) - الفصل الثاني فقط
  '12140415': ['first'], // مختبر المعالجات الدقيقة ولغة اسمبلي - الفصل الأول فقط
  '12140210': ['second', 'summer'], // مختبر لينوكس - الفصل الثاني، والصيفي
  '12140101': ['first', 'second', 'summer'], // لغة البرمجة سي++ (سي++) - جميع الفصول
  '12140532': ['first', 'second', 'summer'], // الذكاء الاصطناعي (ذكاء) - جميع الفصول
};

/**
 * دالة للحصول على فترات الطرح لمادة معينة
 * @param courseId معرّف المادة
 * @returns مصفوفة الفترات المتاحة أو undefined إذا لم تُحدد فترات محددة
 */
export const getAvailableSemesters = (
  courseId: string
): ('first' | 'second' | 'summer')[] | undefined => {
  return courseOfferingsByID[courseId];
};

/**
 * دالة للتحقق من توفر مادة في فصل معين
 * @param courseId معرّف المادة
 * @param semesterType نوع الفصل: 'first' أو 'second' أو 'summer'
 * @returns true إذا كانت المادة متاحة في هذا الفصل
 */
export const isCourseAvailableInSemester = (
  courseId: string,
  semesterType: 'first' | 'second' | 'summer'
): boolean => {
  const available = courseOfferingsByID[courseId];
  // إذا لم تُحدد فترات محددة، افترض أن المادة متاحة في جميع الفصول
  if (!available) return true;
  return available.includes(semesterType);
};

/**
 * دالة للحصول على نوع الفصل من اسم الفصل الكامل
 * @param semesterName اسم الفصل الكامل (مثل "السنة الأولى - الفصل الأول")
 * @returns 'first' أو 'second' أو 'summer'
 */
export const getSemesterType = (semesterName: string): 'first' | 'second' | 'summer' => {
  if (semesterName.includes('الفصل الأول')) return 'first';
  if (semesterName.includes('الفصل الثاني')) return 'second';
  if (semesterName.includes('الصيفي')) return 'summer';
  return 'first'; // القيمة الافتراضية
};

/**
 * دالة لترجمة نوع الفصل إلى نص عربي
 * @param semesterType نوع الفصل
 * @returns النص العربي
 */
export const translateSemesterType = (
  semesterType: 'first' | 'second' | 'summer'
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
export const formatOfferings = (offerings?: ('first' | 'second' | 'summer')[]): string => {
  if (!offerings) return 'جميع الفصول';
  if (offerings.length === 0) return 'لم تُحدد فترات';

  const translated = offerings.map((s) => translateSemesterType(s));
  if (translated.length === 3) return 'جميع الفصول';
  if (translated.length === 2) {
    return `${translated[0]} و${translated[1]}`;
  }
  return translated[0];
};
