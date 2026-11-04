import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  X,
  Pin,
  FolderOpen,
  ExternalLink,
  Star,
  MessageSquare,
  Edit2,
  Check,
  Lock,
  ChevronDown,
  ChevronUp,
  Flame,
  Share2,
} from "lucide-react";
import type { Course } from "../../data";
import { cn, getCourseDeliveryType } from "../../utils";
import { getCachedStudentProfile } from "../../services/studentService";
import {
  getCourseDriveLink,
  setCourseDriveLink,
  getCourseReviews,
  getCourseRatingSummary,
  addVerifiedCourseReview,
  deleteCourseReview,
  type CourseReview,
} from "../../services/courseCommunityService";

interface CourseSidebarProps {
  course: Course | null;
  isOpen: boolean;
  onClose: () => void;
  isCompleted: boolean;
  isPlanned: boolean;
  isAvailable: boolean;
  isPinned?: boolean;
  onTogglePin?: (courseId: string) => void;
  onToggleComplete: (courseId: string) => void;
  onPlanCourse: (courseId: string) => void;
  onSelectCourse: (courseId: string) => void;
  onViewSections?: (courseId: string) => void;
  allCoursesMap: Map<string, Course>;
  unlockedCourses: string[]; // courses that depend directly on this course
  matchingCriticalPaths?: Array<{ id: string; name: string; length: number }>;
}

export const CourseSidebar: React.FC<CourseSidebarProps> = ({
  course,
  isOpen,
  onClose,
  isCompleted,
  isPlanned,
  isAvailable,
  isPinned,
  onTogglePin,
  onToggleComplete,
  onPlanCourse,
  onSelectCourse,
  onViewSections,
  allCoursesMap,
  unlockedCourses,
  matchingCriticalPaths = [],
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Community state
  const [driveUrl, setDriveUrl] = useState<string | null>(null);
  const [isEditingDrive, setIsEditingDrive] = useState(false);
  const [customDriveInput, setCustomDriveInput] = useState("");
  const [driveError, setDriveError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<CourseReview[]>([]);
  const [ratingSummary, setRatingSummary] = useState({
    averageRating: 0,
    totalReviews: 0,
    difficultyCounts: { easy: 0, medium: 0, hard: 0 },
  });

  // New review form state
  const [newRating, setNewRating] = useState(5);
  const [newDifficulty, setNewDifficulty] = useState<
    "easy" | "medium" | "hard"
  >("medium");
  const [newComment, setNewComment] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  // Cached verified student
  const cachedStudent = useMemo(() => getCachedStudentProfile(), [isOpen]);
  const isVerifiedStudent = Boolean(cachedStudent?.studentId);

  // Delivery type badge (Theory vs Lab vs Project vs Training)
  const deliveryBadge = useMemo(
    () => (course ? getCourseDeliveryType(course.name) : null),
    [course?.name],
  );

  // Load course community data when course changes
  useEffect(() => {
    if (!course) return;
    const link = getCourseDriveLink(course.id);
    setDriveUrl(link);
    setCustomDriveInput(link || "");
    setIsEditingDrive(false);
    setReviews(getCourseReviews(course.id));
    setRatingSummary(getCourseRatingSummary(course.id));
    setReviewError(null);
    setReviewSuccess(null);
    setDriveError(null);
  }, [course?.id, isOpen]);

  const handleSaveDriveLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!course) return;
    setDriveError(null);
    const result = setCourseDriveLink(course.id, customDriveInput);
    if (!result.success) {
      setDriveError(result.message || "الرابط غير صالح.");
      return;
    }
    setDriveUrl(customDriveInput.trim() || null);
    setIsEditingDrive(false);
  };

  const handleAddReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!course) return;
    if (!cachedStudent?.studentId) {
      setReviewError(
        "عذراً، كتابة التقييمات مقتصرة على الطلبة المسجلين بالرقم الجامعي.",
      );
      return;
    }

    setIsSubmittingReview(true);
    setReviewError(null);
    setReviewSuccess(null);

    const result = addVerifiedCourseReview({
      courseId: course.id,
      studentId: cachedStudent.studentId,
      studentName: cachedStudent.studentName,
      rating: newRating,
      difficulty: newDifficulty,
      comment: newComment,
    });

    setIsSubmittingReview(false);
    if (result.success) {
      setReviewSuccess(result.message);
      setNewComment("");
      setReviews(getCourseReviews(course.id));
      setRatingSummary(getCourseRatingSummary(course.id));
      setTimeout(() => setReviewSuccess(null), 3500);
    } else {
      setReviewError(result.message);
    }
  };

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Scroll to top when viewing another course
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [course?.id]);

  if (!isOpen || !course) return null;

  return (
    <>
      {/* Mobile Backdrop Scrim */}
      <div
        className="fixed inset-0 z-40 bg-[var(--scrim)]/60 backdrop-blur-2xs md:hidden animate-in fade-in duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-label={`تفاصيل مادة ${course.name}`}
        className={cn(
          "bg-[var(--surface)] border-r border-[var(--line)] flex flex-col z-50 transition-all duration-[var(--dur-2)]",
          // Desktop: 360px width, static sidebar inside flex layout
          "md:w-[360px] md:h-full md:overflow-y-auto md:static",
          // Mobile bottom sheet
          "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[85vh] max-md:rounded-t-3xl max-md:border-t max-md:border-r-0 max-md:shadow-2xl max-md:overflow-hidden animate-in slide-in-from-bottom duration-200",
        )}
      >
        {/* Mobile Drag Handle */}
        <div className="w-10 h-1 bg-[var(--line-control)] rounded-full mx-auto mt-2.5 mb-0.5 md:hidden" />

        {/* Header */}
        <div className="p-4 border-b border-[var(--line)] flex items-start justify-between gap-3">
          <h2 className="text-[20px] font-semibold text-[var(--text)] leading-snug">
            {course.name}
          </h2>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  const shareUrl = `${window.location.origin}${window.location.pathname}#/plan?course=${encodeURIComponent(course.id)}`;
                  navigator.clipboard?.writeText(shareUrl);
                  setCopiedShare(true);
                  setTimeout(() => setCopiedShare(false), 2000);
                }
              }}
              aria-label="مشاركة رابط المساق"
              title={copiedShare ? "تم نسخ الرابط!" : "مشاركة رابط المساق"}
              className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-[var(--r-control)] text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--sunken)] transition-colors cursor-pointer"
            >
              {copiedShare ? (
                <Check
                  size={16}
                  className="text-emerald-600 dark:text-emerald-400"
                />
              ) : (
                <Share2 size={16} />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق التفاصيل"
              className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-[var(--r-control)] text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--sunken)] transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Metadata section */}
        <div className="p-4 space-y-3 text-[15px] border-b border-[var(--line)]">
          <div className="flex justify-between items-center">
            <span className="text-[13px] text-[var(--text-2)]">الرمز</span>
            <span className="tabular-nums font-medium text-[var(--text)]">
              {course.id}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[13px] text-[var(--text-2)]">الساعات</span>
            <span className="tabular-nums font-medium text-[var(--text)]">
              {course.credits} ساعات
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[13px] text-[var(--text-2)]">التصنيف</span>
            <span className="text-[var(--text)]">
              {course.category || "متطلب تخصص"}
            </span>
          </div>
          {deliveryBadge && (
            <div className="flex justify-between items-center">
              <span className="text-[13px] text-[var(--text-2)]">
                طبيعة المساق
              </span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-md text-xs font-bold border",
                  deliveryBadge.badgeClass,
                )}
              >
                {deliveryBadge.label}
              </span>
            </div>
          )}
          {course.seasonal && (
            <div className="flex justify-between items-center">
              <span className="text-[13px] text-[var(--text-2)]">
                موسم الطرح
              </span>
              <span className="text-[13px] font-medium text-[var(--accent)]">
                {course.seasonal === "first"
                  ? "الفصل الأول (خريف)"
                  : course.seasonal === "second"
                    ? "الفصل الثاني (ربيع)"
                    : course.seasonal === "summer"
                      ? "الفصل الصيفي"
                      : "كلا الفصلين الأول والثاني"}
              </span>
            </div>
          )}
          {course.minCredits && course.minCredits > 0 ? (
            <div className="flex justify-between items-center">
              <span className="text-[13px] text-[var(--text-2)]">
                الحد الأدنى للساعات
              </span>
              <span className="tabular-nums font-medium text-amber-600 dark:text-amber-400">
                {course.minCredits} ساعة منجزة
              </span>
            </div>
          ) : null}
        </div>

        {/* Prerequisites & Dependents */}
        <div ref={scrollRef} className="p-4 space-y-4 flex-1 overflow-y-auto">
          {/* Multiple Critical Paths Warning Callout */}
          {matchingCriticalPaths.length > 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-[var(--r-control)] space-y-1.5 text-[12px]">
              <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                <Flame
                  size={15}
                  className="fill-current text-amber-600 dark:text-amber-400 shrink-0"
                />
                <span>مساق يقع في المسار الحرج للتخرج</span>
              </div>
              <p className="text-[11.5px] text-amber-900/90 dark:text-amber-200/90 leading-relaxed m-0">
                يقع هذا المساق ضمن {matchingCriticalPaths.length} مسار(ات) تخرج
                رئيسية:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-950 dark:text-amber-200">
                {matchingCriticalPaths.map((p) => (
                  <li key={p.id}>
                    <strong>{p.name}</strong> (سلسلة من {p.length} فصول متتالية)
                  </li>
                ))}
              </ul>
              <p className="text-[10.5px] text-amber-700 dark:text-amber-400 font-semibold m-0 pt-0.5">
                ⚠️ الرسوب أو التأخر في تسجيل هذا المساق يؤخر موعد التخرج بمقدار
                فصل دراسي كامل على الأقل.
              </p>
            </div>
          )}

          {/* Prerequisites */}
          <div>
            <h3 className="text-[13px] font-medium text-[var(--text-2)] mb-2">
              المتطلبات السابقة
            </h3>
            {course.prerequisites && course.prerequisites.length > 0 ? (
              <ul className="space-y-1.5 p-0 m-0 list-none">
                {course.prerequisites.map((prereqId) => {
                  const prereq = allCoursesMap.get(prereqId);
                  return (
                    <li key={prereqId}>
                      <button
                        type="button"
                        onClick={() => onSelectCourse(prereqId)}
                        className="text-right text-[15px] text-[var(--text)] hover:text-[var(--accent)] hover:underline transition-colors cursor-pointer"
                      >
                        {prereq ? prereq.name : prereqId}{" "}
                        <span className="text-[13px] text-[var(--text-3)] tabular-nums">
                          ({prereqId})
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[13px] text-[var(--text-3)] m-0">
                لا متطلب سابق لهذه المادة.
              </p>
            )}
          </div>

          {/* Unlocks / Dependent courses */}
          <div>
            <h3 className="text-[13px] font-medium text-[var(--text-2)] mb-2">
              تفتح المواد التالية
            </h3>
            {unlockedCourses.length > 0 ? (
              <ul className="space-y-1.5 p-0 m-0 list-none">
                {unlockedCourses.map((depId) => {
                  const dep = allCoursesMap.get(depId);
                  return (
                    <li key={depId}>
                      <button
                        type="button"
                        onClick={() => onSelectCourse(depId)}
                        className="text-right text-[15px] text-[var(--text)] hover:text-[var(--accent)] hover:underline transition-colors cursor-pointer"
                      >
                        {dep ? dep.name : depId}{" "}
                        <span className="text-[13px] text-[var(--text-3)] tabular-nums">
                          ({depId})
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[13px] text-[var(--text-3)] m-0">
                لا توجد مواد تعتمد عليها مباشرة.
              </p>
            )}
          </div>

          {/* Google Drive Study Materials & Summaries */}
          <div className="p-3 bg-[var(--sunken)] border border-[var(--line-control)] rounded-[var(--r-control)] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[13.5px] font-semibold text-[var(--text)]">
                <FolderOpen size={16} className="text-amber-500 shrink-0" />
                <span>ملخصات وأسئلة المادة (Google Drive)</span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingDrive((prev) => !prev)}
                className="text-[11px] text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer font-medium"
                title="تعديل رابط مجلد درايف"
              >
                <Edit2 size={11} />
                <span>{driveUrl ? "تعديل" : "إضافة رابط"}</span>
              </button>
            </div>

            {isEditingDrive ? (
              <form onSubmit={handleSaveDriveLink} className="space-y-2">
                <input
                  type="url"
                  maxLength={256}
                  value={customDriveInput}
                  onChange={(e) => {
                    setCustomDriveInput(e.target.value);
                    if (driveError) setDriveError(null);
                  }}
                  placeholder="ألصق رابط مجلد Google Drive الخاص بالمادة..."
                  className="w-full h-8 px-2.5 text-[12px] bg-[var(--surface)] border border-[var(--line-control)] rounded-[var(--r-control)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
                {driveError && (
                  <div className="text-[11px] text-rose-600 font-medium">
                    {driveError}
                  </div>
                )}
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingDrive(false)}
                    className="px-2.5 py-1 text-[11px] text-[var(--text-3)] hover:text-[var(--text)] cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 text-[11px] font-semibold bg-[var(--accent)] text-[var(--text-on-accent)] rounded-[var(--r-control)] hover:opacity-90 cursor-pointer"
                  >
                    حفظ الرابط
                  </button>
                </div>
              </form>
            ) : driveUrl ? (
              <a
                href={driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between w-full p-2 bg-[var(--surface)] hover:bg-[var(--line-control)]/30 border border-[var(--line-control)] rounded-[var(--r-control)] text-[12px] text-[var(--text)] font-medium transition-colors no-underline group"
              >
                <span className="truncate">فتح مستودع الملخصات والسنوات</span>
                <ExternalLink
                  size={13}
                  className="text-[var(--text-3)] group-hover:text-[var(--accent)] shrink-0"
                />
              </a>
            ) : (
              <p className="text-[11.5px] text-[var(--text-3)] m-0 leading-relaxed">
                لم تتم إضافة رابط درايف بعد. يمكنك لصق رابط مجلدك الخاص
                لمشاركته.
              </p>
            )}
          </div>

          {/* Verified Student Reviews & Ratings */}
          <div className="space-y-3 pt-1 border-t border-[var(--line)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <MessageSquare size={15} className="text-[var(--accent)]" />
                <h3 className="text-[13.5px] font-semibold text-[var(--text)]">
                  مراجعات وتقييمات الطلبة
                </h3>
              </div>
              {ratingSummary.totalReviews > 0 && (
                <div className="flex items-center gap-1 text-[12px] font-bold text-[var(--text)]">
                  <Star size={13} className="text-amber-500 fill-amber-500" />
                  <span>{ratingSummary.averageRating}</span>
                  <span className="text-[10px] text-[var(--text-3)] font-normal">
                    ({ratingSummary.totalReviews})
                  </span>
                </div>
              )}
            </div>

            {/* Student Status Indicator & Review Form */}
            {isVerifiedStudent ? (
              <form
                onSubmit={handleAddReview}
                className="p-3 bg-[var(--surface)] border border-[var(--line-control)] rounded-[var(--r-control)] space-y-2.5"
              >
                <div className="flex items-center justify-between text-[11.5px]">
                  <span className="text-[var(--text-2)] font-medium">
                    مرحباً،{" "}
                    <strong className="privacy-sensitive">
                      {cachedStudent?.studentName || cachedStudent?.studentId}
                    </strong>{" "}
                    (طالب مؤكد ✔)
                  </span>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setNewRating(star)}
                        className="cursor-pointer p-0.5"
                      >
                        <Star
                          size={14}
                          className={
                            star <= newRating
                              ? "text-amber-500 fill-amber-500"
                              : "text-slate-300 dark:text-slate-600"
                          }
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[var(--text-3)]">
                    صعوبة المساق:
                  </span>
                  {(["easy", "medium", "hard"] as const).map((diff) => (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => setNewDifficulty(diff)}
                      className={cn(
                        "px-2 py-0.5 text-[10.5px] font-semibold rounded cursor-pointer transition-colors border",
                        newDifficulty === diff
                          ? diff === "easy"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                            : diff === "medium"
                              ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                              : "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                          : "bg-transparent text-[var(--text-3)] border-transparent hover:bg-[var(--sunken)]",
                      )}
                    >
                      {diff === "easy"
                        ? "سهل"
                        : diff === "medium"
                          ? "متوسط"
                          : "صعب"}
                    </button>
                  ))}
                </div>

                <textarea
                  maxLength={500}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="اكتب نصيحتك للطلبة المقبلين على المادة..."
                  rows={2}
                  className="w-full p-2 text-[12px] bg-[var(--sunken)] border border-[var(--line-control)] rounded-[var(--r-control)] text-[var(--text)] outline-none focus:border-[var(--accent)] resize-none"
                />

                {reviewError && (
                  <div className="text-[11px] text-rose-600 font-medium">
                    {reviewError}
                  </div>
                )}
                {reviewSuccess && (
                  <div className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                    <Check size={12} />
                    <span>{reviewSuccess}</span>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmittingReview || !newComment.trim()}
                    className="px-3 py-1.5 text-[11px] font-semibold bg-[var(--accent)] text-[var(--text-on-accent)] rounded-[var(--r-control)] hover:opacity-90 disabled:opacity-40 cursor-pointer"
                  >
                    نشر التقييم
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-2.5 bg-[var(--sunken)] border border-[var(--line-control)] rounded-[var(--r-control)] flex items-center gap-2 text-[11.5px] text-[var(--text-3)]">
                <Lock size={13} className="shrink-0 text-amber-500" />
                <span>
                  التقييم وكتابة المراجعات مقتصرة على الطلبة المسجلين بالرقم
                  الجامعي لمنع التضليل.
                </span>
              </div>
            )}

            {/* Reviews list */}
            {reviews.length > 0 ? (
              <div className="space-y-2 max-h-[180px] overflow-y-auto">
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-2.5 bg-[var(--surface)] border border-[var(--line-control)] rounded-[var(--r-control)] space-y-1 text-[12px]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[var(--text)]">
                        {rev.studentName ||
                          `طالب #${Math.abs((rev.studentId.split("").reduce((acc, c) => (acc << 5) - acc + c.charCodeAt(0), 0) % 9000) + 1000)}`}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="flex text-amber-500">
                          {"★".repeat(rev.rating)}
                          {"☆".repeat(5 - rev.rating)}
                        </span>
                        <span
                          className={cn(
                            "text-[9px] px-1 py-0.2 rounded font-bold",
                            rev.difficulty === "easy"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : rev.difficulty === "medium"
                                ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
                          )}
                        >
                          {rev.difficulty === "easy"
                            ? "سهل"
                            : rev.difficulty === "medium"
                              ? "متوسط"
                              : "صعب"}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11.5px] text-[var(--text-2)] m-0 leading-relaxed">
                      {rev.comment}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11.5px] text-[var(--text-3)] text-center py-1">
                لا توجد مراجعات مسجلة لهذه المادة حتى الآن.
              </p>
            )}
          </div>
        </div>

        {/* Actions section */}
        <div className="p-4 max-md:pb-12 border-t border-[var(--line)] space-y-2 shrink-0 bg-[var(--surface)]">
          {/* Single Primary Action */}
          <button
            type="button"
            onClick={() => onToggleComplete(course.id)}
            className="w-full min-h-[var(--control-h)] px-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-on-accent)] font-medium text-[15px] rounded-[var(--r-control)] transition-colors cursor-pointer flex items-center justify-center active:scale-[0.99]"
          >
            {isCompleted ? "إلغاء الإنجاز" : "تمت دراستها"}
          </button>

          {/* Secondary Calm Action: إضافة للفصل */}
          {!isCompleted && (
            <button
              type="button"
              onClick={() => onPlanCourse(course.id)}
              className="w-full min-h-[var(--control-h)] px-4 text-[var(--text-2)] hover:text-[var(--text)] hover:underline text-[15px] transition-colors cursor-pointer flex items-center justify-center"
            >
              {isPlanned ? "إزالة من مواد الفصل" : "إضافة للفصل"}
            </button>
          )}

          {/* Pin Path Action */}
          {onTogglePin && (
            <button
              type="button"
              onClick={() => onTogglePin(course.id)}
              className="w-full min-h-[var(--control-h)] px-4 text-[var(--text-2)] hover:text-[var(--text)] text-[14px] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Pin
                size={15}
                className={isPinned ? "text-[var(--accent)] fill-current" : ""}
              />
              <span>
                {isPinned ? "إلغاء تثبيت المسار" : "تثبيت كامل المسار"}
              </span>
            </button>
          )}

          {/* Optional Section View */}
          {onViewSections && (
            <button
              type="button"
              onClick={() => onViewSections(course.id)}
              className="w-full min-h-[var(--control-h)] px-4 text-[var(--text-3)] hover:text-[var(--text)] text-[13px] transition-colors cursor-pointer flex items-center justify-center"
            >
              عرض الشعب والمواعيد
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
