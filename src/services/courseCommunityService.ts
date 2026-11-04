/**
 * Course Community Service
 * Manages verified course reviews (logged-in students with University ID only)
 * and Google Drive study materials/summaries per course.
 */

export interface CourseReview {
  id: string;
  courseId: string;
  studentId: string;
  studentName?: string;
  rating: number; // 1 to 5
  difficulty: "easy" | "medium" | "hard";
  comment: string;
  createdAt: string;
}

const STORAGE_DRIVE_LINKS_KEY = "ptuk_course_drive_links_v1";
const STORAGE_REVIEWS_KEY = "ptuk_course_reviews_v1";

// Curated Drive Links repository (community-verified links only)
const DEFAULT_DRIVE_LINKS: Record<string, string> = {};

/**
 * Whitelist and validation for safe study resource URLs.
 * Strictly prevents javascript:, data:, and malicious redirects (Stored DOM XSS protection).
 */
export function isValidSafeDriveUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const trimmed = url.trim();
    if (trimmed.length > 500) return false;
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
      return false;
    const allowedHosts = [
      "drive.google.com",
      "docs.google.com",
      "ptuk.edu.ps",
      "onedrive.live.com",
      "1drv.ms",
      "dropbox.com",
      "www.dropbox.com",
    ];
    return allowedHosts.some(
      (host) =>
        parsed.hostname === host || parsed.hostname.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}

/**
 * Read all stored drive links with safe fallback and protocol sanitization
 */
export function getAllCourseDriveLinks(): Record<string, string> {
  if (typeof window === "undefined" || !window.localStorage) {
    return { ...DEFAULT_DRIVE_LINKS };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_DRIVE_LINKS_KEY);
    if (!raw) return { ...DEFAULT_DRIVE_LINKS };
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null)
      return { ...DEFAULT_DRIVE_LINKS };

    // Sanitize any stored links against XSS vectors and purge legacy placeholder links
    const safeLinks: Record<string, string> = { ...DEFAULT_DRIVE_LINKS };
    for (const [id, url] of Object.entries(parsed)) {
      if (
        typeof url === "string" &&
        isValidSafeDriveUrl(url) &&
        !url.includes("folders/ptuk_")
      ) {
        safeLinks[id] = url;
      }
    }
    return safeLinks;
  } catch {
    return { ...DEFAULT_DRIVE_LINKS };
  }
}

/**
 * Get Google Drive folder URL for a specific course (XSS safe)
 */
export function getCourseDriveLink(courseId: string): string | null {
  if (!courseId) return null;
  const links = getAllCourseDriveLinks();
  const link = links[courseId];
  return link && isValidSafeDriveUrl(link) ? link : null;
}

/**
 * Save/update Google Drive folder URL for a course with validation
 */
export function setCourseDriveLink(
  courseId: string,
  url: string,
): { success: boolean; message?: string } {
  if (!courseId || typeof window === "undefined" || !window.localStorage) {
    return { success: false, message: "بيئة التخزين غير متوفرة" };
  }
  try {
    const cleanUrl = (url || "").trim();
    if (cleanUrl) {
      if (!isValidSafeDriveUrl(cleanUrl)) {
        return {
          success: false,
          message:
            "رابط غير آمن. يرجى إدخال رابط معتمد يبدأ بـ https://drive.google.com أو مستودع رسمي.",
        };
      }
    }

    const links = getAllCourseDriveLinks();
    if (cleanUrl) {
      links[courseId] = cleanUrl;
    } else {
      delete links[courseId];
    }
    window.localStorage.setItem(STORAGE_DRIVE_LINKS_KEY, JSON.stringify(links));
    return { success: true };
  } catch {
    return { success: false, message: "فشل الحفظ في الذاكرة المحلية" };
  }
}

/**
 * Read all course reviews from storage
 */
export function getAllReviews(): CourseReview[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_REVIEWS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Get reviews for a specific course
 */
export function getCourseReviews(courseId: string): CourseReview[] {
  if (!courseId) return [];
  const all = getAllReviews();
  return all
    .filter((r) => r.courseId === courseId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}

/**
 * Calculate course average rating & difficulty distribution
 */
export function getCourseRatingSummary(courseId: string): {
  averageRating: number;
  totalReviews: number;
  difficultyCounts: Record<"easy" | "medium" | "hard", number>;
} {
  const reviews = getCourseReviews(courseId);
  if (reviews.length === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      difficultyCounts: { easy: 0, medium: 0, hard: 0 },
    };
  }

  const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
  const diffCounts: Record<"easy" | "medium" | "hard", number> = {
    easy: 0,
    medium: 0,
    hard: 0,
  };
  for (const r of reviews) {
    if (r.difficulty in diffCounts) {
      diffCounts[r.difficulty]++;
    }
  }

  return {
    averageRating: Math.round((sum / reviews.length) * 10) / 10,
    totalReviews: reviews.length,
    difficultyCounts: diffCounts,
  };
}

/**
 * Add a verified student review.
 * Strictly prevents guests from adding reviews.
 */
export function addVerifiedCourseReview(params: {
  courseId: string;
  studentId: string;
  studentName?: string;
  rating: number;
  difficulty: "easy" | "medium" | "hard";
  comment: string;
}): { success: boolean; message: string; review?: CourseReview } {
  const cleanStudentId = (params.studentId || "").trim();
  if (!cleanStudentId) {
    return {
      success: false,
      message:
        "التعليق والتقييم متاح فقط للطلبة المسجلين بالرقم الجامعي. يرجى تسجيل الدخول أولاً.",
    };
  }

  const cleanComment = (params.comment || "").trim();
  if (cleanComment.length < 3) {
    return {
      success: false,
      message: "يرجى كتابة نص المراجعة أو نصيحة دراسية لا تقل عن 3 أحرف.",
    };
  }

  // Sanitize comment to prevent any HTML/script injection
  const sanitizedComment = cleanComment.replace(/[<>]/g, "").slice(0, 500);

  const safeRating = Math.max(1, Math.min(5, Math.round(params.rating || 5)));
  const newReview: CourseReview = {
    id: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    courseId: params.courseId,
    studentId: cleanStudentId,
    studentName: (params.studentName || `طالب (${cleanStudentId.slice(-4)})`)
      .trim()
      .slice(0, 60),
    rating: safeRating,
    difficulty: params.difficulty || "medium",
    comment: sanitizedComment,
    createdAt: new Date().toISOString(),
  };

  try {
    const current = getAllReviews();
    // Replace any previous review from this student for this course
    const filtered = current.filter(
      (r) =>
        !(r.courseId === params.courseId && r.studentId === cleanStudentId),
    );
    filtered.unshift(newReview);
    window.localStorage.setItem(STORAGE_REVIEWS_KEY, JSON.stringify(filtered));
    return {
      success: true,
      message: "تم حفظ تقييمك للمساق بنجاح ومشاركته مع زملائك.",
      review: newReview,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: "تعذر حفظ التقييم محلياً.",
    };
  }
}

/**
 * Delete a review (only by its owner)
 */
export function deleteCourseReview(
  reviewId: string,
  studentId: string,
): boolean {
  if (
    !reviewId ||
    !studentId ||
    typeof window === "undefined" ||
    !window.localStorage
  )
    return false;
  try {
    const current = getAllReviews();
    const updated = current.filter(
      (r) => !(r.id === reviewId && r.studentId === studentId),
    );
    window.localStorage.setItem(STORAGE_REVIEWS_KEY, JSON.stringify(updated));
    return true;
  } catch {
    return false;
  }
}
