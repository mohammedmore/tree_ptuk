import React, { Suspense } from "react";
import { useUIStore } from "../../stores/useUIStore";
import { useAcademicStore } from "../../stores/useAcademicStore";
import { useScheduleStore } from "../../stores/useScheduleStore";
import { lazyWithRetry } from "../../utils/lazyWithRetry";
import { AppRoute } from "../../router";
import { Course, ScheduleEntry } from "../../data";
import { SharedScheduleSnapshot } from "../../core/sharedSchedules";
import { StudentSyncProfile } from "../../services/studentService";

// Lazy-loaded Modal Components
const ResetConfirmationModal = lazyWithRetry(() =>
  import("./ResetConfirmationModal").then((m) => ({
    default: m.ResetConfirmationModal,
  })),
);
const MajorSelectorModal = lazyWithRetry(() =>
  import("./MajorSelectorModal").then((m) => ({
    default: m.MajorSelectorModal,
  })),
);
const SupportModal = lazyWithRetry(() => import("./SupportModal"));
const ExportModal = lazyWithRetry(() => import("./ExportModal"));
const WeeklyScheduleModal = lazyWithRetry(() =>
  import("./WeeklyScheduleModal").then((m) => ({
    default: m.WeeklyScheduleModal,
  })),
);
const AddCourseModal = lazyWithRetry(() =>
  import("./AddCourseModal").then((m) => ({
    default: m.AddCourseModal,
  })),
);
const StudentRecordsModal = lazyWithRetry(() =>
  import("./StudentRecordsModal").then((m) => ({
    default: m.StudentRecordsModal,
  })),
);
const AcademicCalendarModal = lazyWithRetry(() =>
  import("./AcademicCalendarModal").then((m) => ({
    default: m.AcademicCalendarModal,
  })),
);
const SystemHealthModal = lazyWithRetry(() =>
  import("./SystemHealthModal").then((m) => ({
    default: m.SystemHealthModal,
  })),
);
const AcademicAdvisorModal = lazyWithRetry(() =>
  import("./AcademicAdvisorModal").then((m) => ({
    default: m.AcademicAdvisorModal,
  })),
);
import {
  ShareScheduleModal,
  LoadScheduleModal,
  SharedSchedulePreviewModal,
} from "./SharedScheduleModals";
import { CommandPaletteModal } from "./CommandPaletteModal";
import { CourseComparisonDrawer } from "./CourseComparisonDrawer";

export interface GlobalModalsContainerProps {
  currentRoute: AppRoute;
  navigateTo: (route: AppRoute) => void;
  isAdmin: boolean;
  isDarkMode: boolean;
  earnedCredits: number;
  selectedElectives: Record<string, string>;
  failedCourseIds: string[];
  planStartSemester: string;
  planEndSemester: string;
  hidePastSemesters: boolean;
  degreeTotalCredits: number;

  // Optional overrides / bridges for domain state
  courses?: Course[];
  completedCourses?: Set<string>;
  plannedCourses?: Record<string, string>;
  courseGrades?: Record<string, number>;
  categoryRequirements?: Record<string, number>;
  weeklySchedule?: Record<string, Record<string, ScheduleEntry>>;
  setWeeklySchedule?: React.Dispatch<
    React.SetStateAction<Record<string, Record<string, ScheduleEntry>>>
  >;
  currentStudent?: StudentSyncProfile | null;
  activeMajorId?: string;
  activeMajorName?: string;
  onToggleComplete?: (courseId: string) => void;
  onPlanCourse?: (courseId: string) => void;

  // Schedule sharing props
  shareCode: string | null;
  isSharing: boolean;
  shareError: string | null;
  isLoadScheduleLoading: boolean;
  loadScheduleError: string | null;

  // Optional direct modal visibility props
  showResetConfirm?: boolean;
  setShowResetConfirm?: (open: boolean) => void;
  showMajorSelector?: boolean;
  setShowMajorSelector?: (open: boolean) => void;
  showSupportModal?: boolean;
  setShowSupportModal?: (open: boolean) => void;
  isExportModalOpen?: boolean;
  setIsExportModalOpen?: (open: boolean) => void;
  isShareScheduleOpen?: boolean;
  setIsShareScheduleOpen?: (open: boolean) => void;
  isLoadScheduleOpen?: boolean;
  setIsLoadScheduleOpen?: (open: boolean) => void;
  loadedSchedule?: {
    schedule: SharedScheduleSnapshot;
    code: string;
    viewCountWarning?: string;
  } | null;
  setLoadedSchedule?: (loaded: any) => void;
  isWeeklyScheduleModalOpen?: boolean;
  setIsWeeklyScheduleModalOpen?: (open: boolean) => void;
  isAddCourseModalOpen?: boolean;
  setIsAddCourseModalOpen?: (open: boolean) => void;
  isRecordsModalOpen?: boolean;
  setIsRecordsModalOpen?: (open: boolean) => void;
  isCalendarModalOpen?: boolean;
  setIsCalendarModalOpen?: (open: boolean) => void;
  isSystemHealthModalOpen?: boolean;
  setIsSystemHealthModalOpen?: (open: boolean) => void;
  isAdvisorModalOpen?: boolean;
  setIsAdvisorModalOpen?: (open: boolean) => void;
  isCommandPaletteOpen?: boolean;
  setIsCommandPaletteOpen?: (open: boolean) => void;
  isComparisonOpen?: boolean;
  setIsComparisonOpen?: (open: boolean) => void;

  // Handlers
  onConfirmReset: () => void;
  onSelectMajor: (majorId: string) => void;
  onCreateSharedLink: () => Promise<void>;
  onLoadSharedSchedule: (code: string) => Promise<void>;
  onApplySharedSchedule: (
    schedule: SharedScheduleSnapshot,
    code: string,
  ) => void;
  onAddCustomCourse: (course: Course) => void;
  onApplyExemption: (courseCode: string, shouldExempt: boolean) => void;
  showAppToast: (message: string) => void;
}

export const GlobalModalsContainer: React.FC<GlobalModalsContainerProps> = ({
  currentRoute,
  navigateTo,
  isAdmin,
  isDarkMode,
  earnedCredits,
  selectedElectives,
  failedCourseIds,
  planStartSemester,
  planEndSemester,
  hidePastSemesters,
  degreeTotalCredits,
  courses: propsCourses,
  completedCourses: propsCompleted,
  plannedCourses: propsPlanned,
  courseGrades: propsGrades,
  categoryRequirements: propsReqs,
  weeklySchedule: propsWeekly,
  setWeeklySchedule: propsSetWeekly,
  currentStudent: propsStudent,
  activeMajorId: propsMajorId,
  onToggleComplete,
  onPlanCourse,
  shareCode,
  isSharing,
  shareError,
  isLoadScheduleLoading,
  loadScheduleError,
  showResetConfirm: propsShowResetConfirm,
  setShowResetConfirm: propsSetShowResetConfirm,
  showMajorSelector: propsShowMajorSelector,
  setShowMajorSelector: propsSetShowMajorSelector,
  showSupportModal: propsShowSupportModal,
  setShowSupportModal: propsSetShowSupportModal,
  isExportModalOpen: propsIsExportModalOpen,
  setIsExportModalOpen: propsSetIsExportModalOpen,
  isShareScheduleOpen: propsIsShareScheduleOpen,
  setIsShareScheduleOpen: propsSetIsShareScheduleOpen,
  isLoadScheduleOpen: propsIsLoadScheduleOpen,
  setIsLoadScheduleOpen: propsSetIsLoadScheduleOpen,
  loadedSchedule: propsLoadedSchedule,
  setLoadedSchedule: propsSetLoadedSchedule,
  isWeeklyScheduleModalOpen: propsIsWeeklyScheduleModalOpen,
  setIsWeeklyScheduleModalOpen: propsSetIsWeeklyScheduleModalOpen,
  isAddCourseModalOpen: propsIsAddCourseModalOpen,
  setIsAddCourseModalOpen: propsSetIsAddCourseModalOpen,
  isRecordsModalOpen: propsIsRecordsModalOpen,
  setIsRecordsModalOpen: propsSetIsRecordsModalOpen,
  isCalendarModalOpen: propsIsCalendarModalOpen,
  setIsCalendarModalOpen: propsSetIsCalendarModalOpen,
  isSystemHealthModalOpen: propsIsSystemHealthModalOpen,
  setIsSystemHealthModalOpen: propsSetIsSystemHealthModalOpen,
  isAdvisorModalOpen: propsIsAdvisorModalOpen,
  setIsAdvisorModalOpen: propsSetIsAdvisorModalOpen,
  isCommandPaletteOpen: propsIsCommandPaletteOpen,
  setIsCommandPaletteOpen: propsSetIsCommandPaletteOpen,
  isComparisonOpen: propsIsComparisonOpen,
  setIsComparisonOpen: propsSetIsComparisonOpen,
  onConfirmReset,
  onSelectMajor,
  onCreateSharedLink,
  onLoadSharedSchedule,
  onApplySharedSchedule,
  onAddCustomCourse,
  onApplyExemption,
  showAppToast,
}) => {
  const ui = useUIStore();
  const academic = useAcademicStore();
  const schedule = useScheduleStore();

  // Resolved domain state
  const courses = propsCourses ?? academic.courses;
  const completedCourses = propsCompleted ?? academic.completedCourses;
  const plannedCourses = propsPlanned ?? academic.plannedCourses;
  const courseGrades = propsGrades ?? academic.courseGrades;
  const categoryRequirements = propsReqs ?? academic.categoryRequirements;
  const weeklySchedule = propsWeekly ?? schedule.weeklySchedule;
  const setWeeklySchedule = propsSetWeekly ?? schedule.setWeeklySchedule;
  const currentStudent =
    propsStudent !== undefined ? propsStudent : academic.currentStudent;
  const activeMajorId = propsMajorId ?? academic.activeMajorId;

  // Resolved modal visibility and close handlers
  const showReset = propsShowResetConfirm ?? ui.showResetConfirm;
  const closeReset = () => {
    propsSetShowResetConfirm?.(false);
    ui.setShowResetConfirm(false);
  };

  const showMajor = propsShowMajorSelector ?? ui.showMajorSelector;
  const closeMajor = () => {
    propsSetShowMajorSelector?.(false);
    ui.setShowMajorSelector(false);
  };

  const showSupport = propsShowSupportModal ?? ui.showSupportModal;
  const closeSupport = () => {
    propsSetShowSupportModal?.(false);
    ui.setShowSupportModal(false);
  };

  const showExport = propsIsExportModalOpen ?? ui.isExportModalOpen;
  const closeExport = () => {
    propsSetIsExportModalOpen?.(false);
    ui.setExportModalOpen(false);
  };

  const showShare = propsIsShareScheduleOpen ?? ui.isShareScheduleOpen;
  const closeShare = () => {
    propsSetIsShareScheduleOpen?.(false);
    ui.setShareScheduleOpen(false);
  };

  const showLoad = propsIsLoadScheduleOpen ?? ui.isLoadScheduleOpen;
  const closeLoad = () => {
    propsSetIsLoadScheduleOpen?.(false);
    ui.setLoadScheduleOpen(false);
  };

  const activeLoadedSchedule =
    propsLoadedSchedule !== undefined ? propsLoadedSchedule : ui.loadedSchedule;
  const closeLoadedSchedule = () => {
    propsSetLoadedSchedule?.(null);
    ui.setLoadedSchedule(null);
  };

  const showWeekly =
    propsIsWeeklyScheduleModalOpen ?? ui.isWeeklyScheduleModalOpen;
  const closeWeekly = () => {
    propsSetIsWeeklyScheduleModalOpen?.(false);
    ui.setWeeklyScheduleModalOpen(false);
  };

  const showAddCourse = propsIsAddCourseModalOpen ?? ui.isAddCourseModalOpen;
  const closeAddCourse = () => {
    propsSetIsAddCourseModalOpen?.(false);
    ui.setAddCourseModalOpen(false);
  };

  const showRecords = propsIsRecordsModalOpen ?? ui.isRecordsModalOpen;
  const closeRecords = () => {
    propsSetIsRecordsModalOpen?.(false);
    ui.setRecordsModalOpen(false);
  };

  const showCalendar =
    (propsIsCalendarModalOpen ?? ui.isCalendarModalOpen) ||
    currentRoute === "calendar";
  const closeCalendar = () => {
    propsSetIsCalendarModalOpen?.(false);
    ui.setCalendarModalOpen(false);
    if (currentRoute === "calendar") {
      navigateTo("plan");
    }
  };

  const showHealth = propsIsSystemHealthModalOpen ?? ui.isSystemHealthModalOpen;
  const closeHealth = () => {
    propsSetIsSystemHealthModalOpen?.(false);
    ui.setSystemHealthModalOpen(false);
  };

  const showAdvisor = propsIsAdvisorModalOpen ?? ui.isAdvisorModalOpen;
  const closeAdvisor = () => {
    propsSetIsAdvisorModalOpen?.(false);
    ui.setAdvisorModalOpen(false);
  };

  const showCommandPalette =
    propsIsCommandPaletteOpen ?? ui.isCommandPaletteOpen;
  const closeCommandPalette = () => {
    propsSetIsCommandPaletteOpen?.(false);
    ui.setCommandPaletteOpen(false);
  };

  const showComparison = propsIsComparisonOpen ?? ui.isComparisonOpen;
  const closeComparison = () => {
    propsSetIsComparisonOpen?.(false);
    ui.setComparisonOpen(false);
  };

  return (
    <Suspense fallback={null}>
      {/* Reset Confirmation Modal */}
      {showReset && (
        <ResetConfirmationModal
          showResetConfirm={showReset}
          onClose={closeReset}
          onConfirm={onConfirmReset}
        />
      )}

      {/* Major Selector Modal */}
      {showMajor && (
        <MajorSelectorModal
          isOpen={showMajor}
          onClose={closeMajor}
          onSelectMajor={onSelectMajor}
          currentMajorId={activeMajorId}
        />
      )}

      {/* Support / Feedback Modal */}
      {showSupport && (
        <SupportModal isSupportModalOpen={showSupport} onClose={closeSupport} />
      )}

      {/* Export Plan Modal */}
      {showExport && (
        <ExportModal
          isExportModalOpen={showExport}
          onClose={closeExport}
          completedCredits={earnedCredits}
          plannedCourses={plannedCourses}
          completedCourses={completedCourses}
          courses={courses}
          courseGrades={courseGrades}
          weeklySchedule={weeklySchedule}
          selectedElectives={selectedElectives}
          failedCourseIds={failedCourseIds}
          planStartSemester={planStartSemester}
          planEndSemester={planEndSemester}
          hidePastSemesters={hidePastSemesters}
          darkMode={isDarkMode}
          categoryRequirements={categoryRequirements}
          totalDegreeCredits={degreeTotalCredits}
        />
      )}

      {/* Share Schedule Modal */}
      {showShare && (
        <ShareScheduleModal
          isOpen={showShare}
          onClose={closeShare}
          code={shareCode}
          loading={isSharing}
          error={shareError}
          onCreate={onCreateSharedLink}
        />
      )}

      {/* Retrieve / Load Schedule Modal */}
      {showLoad && (
        <LoadScheduleModal
          isOpen={showLoad}
          onClose={closeLoad}
          loading={isLoadScheduleLoading}
          error={loadScheduleError}
          onLoad={onLoadSharedSchedule}
        />
      )}

      {/* Shared Schedule Preview Modal */}
      {activeLoadedSchedule && (
        <SharedSchedulePreviewModal
          schedule={activeLoadedSchedule.schedule}
          code={activeLoadedSchedule.code}
          warning={(activeLoadedSchedule as any).viewCountWarning}
          onClose={closeLoadedSchedule}
          onApply={() => {
            if (activeLoadedSchedule) {
              onApplySharedSchedule(
                activeLoadedSchedule.schedule,
                activeLoadedSchedule.code,
              );
              closeLoadedSchedule();
            }
          }}
        />
      )}

      {/* Smart Schedule Solver Modal */}
      {showWeekly && (
        <WeeklyScheduleModal
          isOpen={showWeekly}
          onClose={closeWeekly}
          plannedCourses={plannedCourses}
          courses={courses}
          weeklySchedule={weeklySchedule}
          setWeeklySchedule={setWeeklySchedule}
          completedCourses={completedCourses}
        />
      )}

      {/* Add Custom Course Modal */}
      {showAddCourse && (
        <AddCourseModal
          isOpen={showAddCourse}
          onClose={closeAddCourse}
          onAddCourse={onAddCustomCourse}
        />
      )}

      {/* Student Official Records Modal (Financial & Transcript) */}
      {showRecords && (
        <StudentRecordsModal
          isOpen={showRecords}
          onClose={closeRecords}
          profile={currentStudent}
          onOpenSyncModal={() => {
            closeRecords();
            navigateTo("login");
          }}
          completedCourseIds={completedCourses}
          onApplyExemption={onApplyExemption}
        />
      )}

      {/* PTUK Official Academic Calendar Modal */}
      {showCalendar && (
        <AcademicCalendarModal isOpen={true} onClose={closeCalendar} />
      )}

      {/* System Health & Live Observability Modal */}
      {showHealth && <SystemHealthModal isOpen={true} onClose={closeHealth} />}

      {/* AI Academic Advisor & Critical Path Modal */}
      {showAdvisor && (
        <AcademicAdvisorModal
          isOpen={true}
          onClose={closeAdvisor}
          courses={courses}
          completedCourses={completedCourses}
          studentGpa={
            typeof currentStudent?.gpa === "number" ? currentStudent.gpa : 75
          }
          hasAcademicWarning={Boolean(currentStudent?.academicWarning)}
          completedHours={earnedCredits}
          onApplyRecommendedPlan={(recCourses) => {
            showAppToast(
              `تمت مواءمة الخطة الأكاديمية بنجاح (${recCourses.length} مساقات مقترحة).`,
            );
          }}
        />
      )}

      {/* Command Palette Modal (Ctrl+K) */}
      <CommandPaletteModal
        isOpen={showCommandPalette}
        onClose={closeCommandPalette}
        courses={courses}
        completedCourses={completedCourses}
        onNavigate={(route) => {
          navigateTo(route);
          closeCommandPalette();
        }}
        onOpenExport={() => {
          closeCommandPalette();
          if (propsSetIsExportModalOpen) propsSetIsExportModalOpen(true);
          ui.setExportModalOpen(true);
        }}
        onOpenMajorSelector={() => {
          closeCommandPalette();
          if (propsSetShowMajorSelector) propsSetShowMajorSelector(true);
          ui.setShowMajorSelector(true);
        }}
        onSelectMajor={(majorId) => {
          onSelectMajor(majorId);
          closeCommandPalette();
        }}
        onOpenComparison={() => {
          closeCommandPalette();
          if (propsSetIsComparisonOpen) propsSetIsComparisonOpen(true);
          ui.setComparisonOpen(true);
        }}
        onOpenCalendar={() => {
          closeCommandPalette();
          if (propsSetIsCalendarModalOpen) propsSetIsCalendarModalOpen(true);
          ui.setCalendarModalOpen(true);
        }}
        onOpenSystemHealth={
          isAdmin
            ? () => {
                closeCommandPalette();
                if (propsSetIsSystemHealthModalOpen)
                  propsSetIsSystemHealthModalOpen(true);
                ui.setSystemHealthModalOpen(true);
              }
            : undefined
        }
        onOpenAdvisor={() => {
          closeCommandPalette();
          if (propsSetIsAdvisorModalOpen) propsSetIsAdvisorModalOpen(true);
          ui.setAdvisorModalOpen(true);
        }}
        onPrintTranscript={() => {
          closeCommandPalette();
          window.print();
        }}
        activeMajorId={activeMajorId}
      />

      {/* Side-by-Side Course Comparison Drawer */}
      <CourseComparisonDrawer
        isOpen={showComparison}
        onClose={closeComparison}
        courses={courses}
        completedCourses={completedCourses}
        plannedCourses={plannedCourses}
        onToggleComplete={onToggleComplete ?? academic.toggleCompleteCourse}
        onPlanCourse={
          onPlanCourse ?? ((courseId: string) => academic.planCourse(courseId))
        }
        initialCourseA={
          ui.comparisonCourseId
            ? courses.find((c) => c.id === ui.comparisonCourseId) || null
            : null
        }
      />
    </Suspense>
  );
};
