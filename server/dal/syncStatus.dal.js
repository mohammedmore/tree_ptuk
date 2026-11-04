/**
 * Data Access Layer for Sync Status
 */
export function createSyncStatusDal(getState, persistState, lastSyncFile) {
  return {
    getSyncStatus() {
      return { ...getState().syncStatus };
    },

    updateSyncStatus(update) {
      const state = getState();
      state.syncStatus = {
        ...state.syncStatus,
        ...update,
      };
      persistState();
      return state.syncStatus;
    },
  };
}
