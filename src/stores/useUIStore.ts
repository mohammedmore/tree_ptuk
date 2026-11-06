import { create } from "zustand";
import type { SharedScheduleSnapshot } from "../core/sharedSchedules";

export interface LoadedScheduleState {
  schedule: SharedScheduleSnapshot;
  code: string;
}

export interface UIState {
  // Modal visibility
  isExportModalOpen: boolean;
  isWeeklyScheduleModalOpen: boolean;
  isAddCourseModalOpen: boolean;
  isRecordsModalOpen: boolean;
  isCalendarModalOpen: boolean;
  isCommandPaletteOpen: boolean;
  isSystemHealthModalOpen: boolean;
  isAdvisorModalOpen: boolean;
  showResetConfirm: boolean;
  showMajorSelector: boolean;
  showSupportModal: boolean;
  isShareScheduleOpen: boolean;
  isLoadScheduleOpen: boolean;
  loadedSchedule: LoadedScheduleState | null;

  // Comparison drawer state
  isComparisonOpen: boolean;
  comparisonCourseId: string | null;

  // Tools menu & mobile drawer
  isToolsMenuOpen: boolean;

  // Actions
  setExportModalOpen: (open: boolean) => void;
  setWeeklyScheduleModalOpen: (open: boolean) => void;
  setAddCourseModalOpen: (open: boolean) => void;
  setRecordsModalOpen: (open: boolean) => void;
  setCalendarModalOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setSystemHealthModalOpen: (open: boolean) => void;
  setAdvisorModalOpen: (open: boolean) => void;
  setShowResetConfirm: (open: boolean) => void;
  setShowMajorSelector: (open: boolean) => void;
  setShowSupportModal: (open: boolean) => void;
  setShareScheduleOpen: (open: boolean) => void;
  setLoadScheduleOpen: (open: boolean) => void;
  setLoadedSchedule: (loaded: LoadedScheduleState | null) => void;
  setComparisonOpen: (open: boolean, courseId?: string | null) => void;
  setToolsMenuOpen: (open: boolean) => void;
  closeAllModals: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isExportModalOpen: false,
  isWeeklyScheduleModalOpen: false,
  isAddCourseModalOpen: false,
  isRecordsModalOpen: false,
  isCalendarModalOpen: false,
  isCommandPaletteOpen: false,
  isSystemHealthModalOpen: false,
  isAdvisorModalOpen: false,
  showResetConfirm: false,
  showMajorSelector: false,
  showSupportModal: false,
  isShareScheduleOpen: false,
  isLoadScheduleOpen: false,
  loadedSchedule: null,
  isComparisonOpen: false,
  comparisonCourseId: null,
  isToolsMenuOpen: false,

  setExportModalOpen: (open) => set({ isExportModalOpen: open }),
  setWeeklyScheduleModalOpen: (open) =>
    set({ isWeeklyScheduleModalOpen: open }),
  setAddCourseModalOpen: (open) => set({ isAddCourseModalOpen: open }),
  setRecordsModalOpen: (open) => set({ isRecordsModalOpen: open }),
  setCalendarModalOpen: (open) => set({ isCalendarModalOpen: open }),
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  setSystemHealthModalOpen: (open) => set({ isSystemHealthModalOpen: open }),
  setAdvisorModalOpen: (open) => set({ isAdvisorModalOpen: open }),
  setShowResetConfirm: (open) => set({ showResetConfirm: open }),
  setShowMajorSelector: (open) => set({ showMajorSelector: open }),
  setShowSupportModal: (open) => set({ showSupportModal: open }),
  setShareScheduleOpen: (open) => set({ isShareScheduleOpen: open }),
  setLoadScheduleOpen: (open) => set({ isLoadScheduleOpen: open }),
  setLoadedSchedule: (loaded) => set({ loadedSchedule: loaded }),
  setComparisonOpen: (open, courseId = null) =>
    set({ isComparisonOpen: open, comparisonCourseId: courseId }),
  setToolsMenuOpen: (open) => set({ isToolsMenuOpen: open }),
  closeAllModals: () =>
    set({
      isExportModalOpen: false,
      isWeeklyScheduleModalOpen: false,
      isAddCourseModalOpen: false,
      isRecordsModalOpen: false,
      isCalendarModalOpen: false,
      isCommandPaletteOpen: false,
      isSystemHealthModalOpen: false,
      isAdvisorModalOpen: false,
      showResetConfirm: false,
      showMajorSelector: false,
      showSupportModal: false,
      isShareScheduleOpen: false,
      isLoadScheduleOpen: false,
      loadedSchedule: null,
      isComparisonOpen: false,
      isToolsMenuOpen: false,
    }),
}));
