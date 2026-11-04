/**
 * Data Access Layer for Majors & Cohorts
 */
export function createMajorsDal(getState, persistState) {
  return {
    getMajors() {
      const state = getState();
      return Object.values(state.majors)
        .filter(
          (m) =>
            m &&
            m.cohortYear &&
            !["cse", "swe", "cs", "ee"].includes(m.id?.toLowerCase()),
        )
        .map((m) => ({
          id: m.id,
          code: m.code || m.id,
          name: m.name,
          cohortYear: m.cohortYear,
          displayName:
            m.displayName ||
            (m.cohortYear ? `${m.name} - دفعة ${m.cohortYear}` : m.name),
          college: m.college || "كلية الهندسة والتكنولوجيا",
          degree: m.degree || "بكالوريوس",
          totalCredits: m.totalCredits || 0,
          categoryRequirements: m.categoryRequirements || {},
          description: m.description,
          coursesCount: Array.isArray(m.courses) ? m.courses.length : 0,
        }));
    },

    getMajorById(id) {
      const state = getState();
      if (!id) return null;
      const key = String(id).toLowerCase().trim();
      return state.majors[key] || null;
    },

    upsertMajor(major) {
      if (!major || !major.id) throw new Error("Major must have an id.");
      const state = getState();
      const id = String(major.id).toLowerCase().trim();
      state.majors[id] = {
        ...state.majors[id],
        ...major,
        id,
      };
      persistState();
      return state.majors[id];
    },
  };
}
