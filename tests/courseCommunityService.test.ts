import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import {
  getCourseDriveLink,
  setCourseDriveLink,
  getAllCourseDriveLinks,
  addVerifiedCourseReview,
  getCourseReviews,
  getCourseRatingSummary,
  deleteCourseReview,
} from "../src/services/courseCommunityService";

beforeEach(() => {
  // Mock localStorage for Node test environment
  const store: Record<string, string> = {};
  (globalThis as any).window = {
    localStorage: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => {
        store[key] = val;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
    },
  };
});

test("courseCommunityService manages Google Drive links per course", () => {
  // Test reading default or custom link
  setCourseDriveLink(
    "12140101",
    "https://drive.google.com/drive/folders/custom_cs1",
  );
  assert.equal(
    getCourseDriveLink("12140101"),
    "https://drive.google.com/drive/folders/custom_cs1",
  );

  // Setting empty removes custom link
  setCourseDriveLink("12140101", "");
  // Falls back or removes
  assert.ok(getCourseDriveLink("99999999") === null);
});

test("courseCommunityService strictly prevents guest from adding course reviews", () => {
  // Guest with empty student ID
  const guestResult = addVerifiedCourseReview({
    courseId: "12140101",
    studentId: "",
    comment: "مساق ممتاز وسهل",
    rating: 5,
    difficulty: "easy",
  });

  assert.equal(guestResult.success, false);
  assert.ok(guestResult.message.includes("الرقم الجامعي"));
  assert.equal(getCourseReviews("12140101").length, 0);
});

test("courseCommunityService allows verified student to add reviews and computes statistics", () => {
  const studentResult = addVerifiedCourseReview({
    courseId: "12140101",
    studentId: "202110123",
    studentName: "أحمد",
    comment: "المساق يحتاج متابعة أولاً بأول وحل أسئلة السنوات",
    rating: 4,
    difficulty: "medium",
  });

  assert.equal(studentResult.success, true);
  assert.ok(studentResult.review?.id);

  const reviews = getCourseReviews("12140101");
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].studentId, "202110123");
  assert.equal(reviews[0].rating, 4);

  const summary = getCourseRatingSummary("12140101");
  assert.equal(summary.averageRating, 4);
  assert.equal(summary.totalReviews, 1);
  assert.equal(summary.difficultyCounts.medium, 1);

  // Student updates their review
  addVerifiedCourseReview({
    courseId: "12140101",
    studentId: "202110123",
    studentName: "أحمد",
    comment: "تحديث: ركزوا على الميدتيرم",
    rating: 5,
    difficulty: "easy",
  });

  const updatedReviews = getCourseReviews("12140101");
  assert.equal(updatedReviews.length, 1); // Deduplicated per student
  assert.equal(updatedReviews[0].rating, 5);
  assert.equal(getCourseRatingSummary("12140101").averageRating, 5);

  // Deleting review
  const deleted = deleteCourseReview(updatedReviews[0].id, "202110123");
  assert.equal(deleted, true);
  assert.equal(getCourseReviews("12140101").length, 0);
});
