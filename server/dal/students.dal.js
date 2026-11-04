/**
 * Data Access Layer for Student Records & Cohort Plans
 */
export function createStudentsDal(getState, persistState) {
  return {
    saveStudentRecord(studentId, data) {
      const state = getState();
      state.students[studentId] = {
        ...data,
        updatedAt: new Date().toISOString(),
      };
      persistState();
      return state.students[studentId];
    },

    getStudentRecord(studentId) {
      const state = getState();
      return state.students[studentId] || null;
    },

    saveMajorCohortPlan(majorId, cohortYear, planData) {
      const state = getState();
      if (!state.cohortPlans) state.cohortPlans = {};
      const key = `${String(majorId).toLowerCase()}_${String(cohortYear)}`;
      state.cohortPlans[key] = {
        ...planData,
        majorId,
        cohortYear,
        updatedAt: new Date().toISOString(),
      };
      persistState();
      return state.cohortPlans[key];
    },

    getMajorCohortPlan(majorId, cohortYear) {
      const state = getState();
      if (!state.cohortPlans) return null;
      const key = `${String(majorId).toLowerCase()}_${String(cohortYear)}`;
      return state.cohortPlans[key] || null;
    },
  };
}
