import type { CatalogCourse } from "./scheduleSolver";

export function fetchCourses(forceRefresh?: boolean): Promise<CatalogCourse[]>;
export function searchCourses(query: string): Promise<CatalogCourse[]>;
export function fetchCoursesByCodes(codes: string[]): Promise<CatalogCourse[]>;
export function isOfflineCatalog(): boolean;
export function clearCoursesCache(): void;
