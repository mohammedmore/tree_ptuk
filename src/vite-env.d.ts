/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly NEXT_PUBLIC_SUPABASE_URL?: string;
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  readonly SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_API_BASE_URL?: string;
}

declare module "*app.js" {
  const content: any;
  export default content;
  export const startServer: any;
}

declare module "*db.js" {
  export const getCourses: any;
  export const getCourseByCode: any;
  export const upsertCatalogCourses: any;
  export const getMajors: any;
  export const getMajorById: any;
  export const upsertMajor: any;
  export const getSyncStatus: any;
  export const updateSyncStatus: any;
  export const saveStudentRecord: any;
  export const getStudentRecord: any;
  export const supabase: any;
}

declare module "*studentPortalService.js" {
  export const authenticateAndSyncStudent: any;
}
