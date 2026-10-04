import type { CatalogCourse } from "./scheduleSolver";

export function fetchCourses(): Promise<CatalogCourse[]>;
export function searchCourses(query: string): Promise<CatalogCourse[]>;
export function fetchCoursesByCodes(codes: string[]): Promise<CatalogCourse[]>;
