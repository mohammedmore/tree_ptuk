export function toggleCompletedCourse(
  completedCourses: ReadonlySet<string>,
  courseId: string,
): Set<string> {
  const next = new Set(completedCourses);
  if (next.has(courseId)) {
    next.delete(courseId);
  } else {
    next.add(courseId);
  }
  return next;
}

export function markCoursesCompleted(
  completedCourses: ReadonlySet<string>,
  courseIds: readonly string[],
): Set<string> {
  return new Set([...completedCourses, ...courseIds]);
}
