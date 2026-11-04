import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Zap,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Play,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  Plus,
  Trash2,
  Copy,
  ChevronRight,
  Layers,
  Flame,
  Wallet,
  BookOpen,
  Calendar,
  Check,
  RefreshCw,
  Search,
  X,
  HelpCircle,
  FileCheck2,
  Info,
  ChevronDown,
  ChevronUp,
  Code2,
  Eye,
  Share2,
  ArrowLeftRight,
  Download,
  Volume2,
  VolumeX,
  Radio,
  FileText,
  Printer,
  Sparkle,
  ArrowUp,
  ArrowDown,
  Pencil,
  Bell,
  BellRing,
  Wifi,
  WifiOff,
  Gauge,
  Calculator,
  CheckCheck,
  Undo2,
  Redo2,
  Link as LinkIcon,
} from "lucide-react";
import type { Course, ScheduleEntry } from "../data";
import { SEMESTERS } from "../constants";
import {
  PlanKey,
  RegistrationPlan,
  RegistrationSectionItem,
  RegistrationExecutionSummary,
  CourseAttemptResult,
  PlanDiagnostic,
  loadRegistrationPlans,
  saveRegistrationPlans,
  createDefaultRegistrationPlans,
  validatePlanCollisions,
  checkPlanPrerequisites,
  checkPlanFinancialBalance,
  checkPlanCreditLimits,
  sortRegistrationItemsByPriority,
  recalculatePlanMetrics,
  calculatePlanGaps,
  autoDetermineItemPriority,
  comparePlansSideBySide,
  loadSeatWatchList,
  saveSeatWatchList,
  SeatWatcherItem,
  importPlansFromShareCode,
  exportPlansToShareCode,
  movePlanItemPriority,
  calculateDetailedTuition,
  calculateSectionSaturation,
  isSectionClosed,
  filterSectionsByMeetingPattern,
  generateRegistrationCalendarICS,
  generateShareablePlanUrl,
  checkSectionTimeConflict,
  savePlanAutoSnapshot,
  loadPlanAutoSnapshot,
  TuitionConfig,
  SectionSaturationInfo,
} from "../core/semesterRegistration";
import {
  prewarmRegistration,
  executeRegistration,
  testRegistrationRequest,
  checkSeatsAvailability,
  checkPortalRegistrationStatus,
  PrewarmResult,
  RegistrationTestResult,
  PortalStatusResult,
} from "../services/registrationService";
import {
  getCachedStudentProfile,
  StudentSyncProfile,
  EnrolledCourse,
} from "../services/studentService";
import { getOfficialTuitionRate } from "../services/tuitionFeesService";
import { parseSemesterWeight } from "../utils/semesterUtils";
import { cn } from "../utils";
import { triggerHaptic } from "../utils/haptics";

export interface CourseSectionBlock {
  days: string[];
  start: number;
  end: number;
  rawTime?: string;
}

export interface CourseSectionInfo {
  sec: string | number;
  instructor?: string;
  room?: string;
  timeText?: string;
  capacity?: number;
  registered?: number;
  available?: number;
  blocks?: CourseSectionBlock[];
  [key: string]: any;
}

export interface RegistrationCourse extends Course {
  sections?: CourseSectionInfo[];
}

interface RegistrationPageProps {
  courses: (Course | RegistrationCourse)[];
  selectedSemester?: string;
  currentWeeklySchedule?: Record<string, ScheduleEntry>;
  onApplyRegisteredSchedule?: (schedule: Record<string, ScheduleEntry>) => void;
  onNavigateToSchedule?: () => void;
  onOpenCalendarModal?: () => void;
}

interface AuditLogEntry {
  id: string;
  time: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
}

let sharedAudioCtx: AudioContext | null = null;
function getSharedAudioContext(): AudioContext | null {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

/**
 * Native synthesizer audio alerts (no external audio files required)
 */
function playAudioChime(type: "success" | "warning" | "info") {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (type === "success") {
      // Cheerful 3-tone chime: C5 (523Hz), E5 (659Hz), G5 (784Hz)
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);
        gain.gain.setValueAtTime(0.12, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.3);
      });
    } else if (type === "warning") {
      // Two-tone warning alert
      [440, 349.23].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.15, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.32);
      });
    }

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(type === "success" ? [80, 40, 80] : [150, 70, 150]);
    }
  } catch {
    // Audio context may be restricted by browser policy
  }
}

function formatDisplayBalance(
  balance: string | number | undefined | null,
): string {
  if (balance == null || balance === "") return "0 د.أ";
  const str = String(balance).trim();
  if (
    str.includes("د.أ") ||
    str.includes("JOD") ||
    str.includes("شيكل") ||
    str.includes("ILS")
  ) {
    return str;
  }
  return `${str} د.أ`;
}

function timeToDecimalHours(timeStr?: string, defaultHour = 8.5): number {
  if (!timeStr) return defaultHour;
  const parts = timeStr.trim().split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (isNaN(h)) return defaultHour;
  return h + (isNaN(m) ? 0 : m / 60);
}

function decimalHoursToTimeString(val: number): string {
  const totalMinutes = val > 24 ? Math.round(val) : Math.round(val * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function extractTimesFromItem(item: {
  blocks?: CourseSectionBlock[];
  timeText?: string;
  room?: string;
  isOnline?: boolean;
}): { startTime: string; endTime: string; days: string[]; isOnline: boolean } {
  let startTime = "08:00";
  let endTime = "09:00";
  const firstBlock = item.blocks?.[0];
  const days =
    firstBlock?.days && firstBlock.days.length > 0 ? firstBlock.days : [];

  if (firstBlock?.rawTime) {
    const m = firstBlock.rawTime.match(
      /(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/,
    );
    if (m) {
      startTime = m[1].padStart(5, "0");
      endTime = m[2].padStart(5, "0");
    }
  } else if (
    typeof firstBlock?.start === "number" &&
    typeof firstBlock?.end === "number" &&
    (firstBlock.start > 0 || firstBlock.end > 0)
  ) {
    startTime = decimalHoursToTimeString(firstBlock.start);
    endTime = decimalHoursToTimeString(firstBlock.end);
  } else if (item.timeText) {
    const m = item.timeText.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
    if (m) {
      startTime = m[1].padStart(5, "0");
      endTime = m[2].padStart(5, "0");
    }
  }

  const room = (item.room || "").trim();
  const isOnline = Boolean(
    item.isOnline ||
    /^\d{4,5}$/.test(room) ||
    room.includes("5000") ||
    room.includes("10000") ||
    item.timeText?.includes("الكتروني") ||
    item.timeText?.includes("online"),
  );

  return { startTime, endTime, days, isOnline };
}

export const RegistrationPage: React.FC<RegistrationPageProps> = ({
  courses,
  selectedSemester = SEMESTERS[0],
  currentWeeklySchedule = {},
  onApplyRegisteredSchedule,
  onNavigateToSchedule,
  onOpenCalendarModal,
}) => {
  const [activeTab, setActiveTab] = useState<PlanKey>("A");
  const [plans, setPlans] = useState<Record<PlanKey, RegistrationPlan>>(() =>
    loadRegistrationPlans(selectedSemester),
  );

  // Prewarm state & Server Time Sync Offset
  const [prewarmStatus, setPrewarmStatus] = useState<PrewarmResult | null>(
    null,
  );
  const [isPrewarming, setIsPrewarming] = useState(false);
  const [serverOffsetMs, setServerOffsetMs] = useState<number>(0);

  // Dry-run test modal state
  const [isTestingRequest, setIsTestingRequest] = useState(false);
  const [testResult, setTestResult] = useState<RegistrationTestResult | null>(
    null,
  );
  const [showTestModal, setShowTestModal] = useState(false);
  const [activeTestTab, setActiveTestTab] = useState<
    "summary" | "items" | "payload"
  >("summary");

  // Seat Watcher Drawer & State
  const [seatWatchList, setSeatWatchList] = useState<SeatWatcherItem[]>(() =>
    loadSeatWatchList(),
  );
  const [showSeatWatcher, setShowSeatWatcher] = useState(false);
  const [isCheckingSeats, setIsCheckingSeats] = useState(false);

  // Side-by-Side Plan Comparison Modal
  const [showCompareModal, setShowCompareModal] = useState(false);

  // Safe Swap Modal
  const [safeSwapCourseId, setSafeSwapCourseId] = useState<string | null>(null);

  // Compatible Electives Suggestion Modal
  const [showSuggestModal, setShowSuggestModal] = useState(false);

  // Sound toggle (disabled by default for quiet library/classroom environments)
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Execution state & Debounce Guard
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionSummary, setExecutionSummary] =
    useState<RegistrationExecutionSummary | null>(null);
  const [autoFallback, setAutoFallback] = useState(true);
  const executionLockRef = useRef(false);

  // Live Audit Timeline Log (hidden by default for cleaner UI)
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [showDevLog, setShowDevLog] = useState(false);

  // Section Meeting Pattern Filter in Add Modal
  const [meetingPatternFilter, setMeetingPatternFilter] = useState<
    "all" | "2days" | "3days"
  >("all");

  const addAuditLog = (
    message: string,
    type: "info" | "success" | "warning" | "error" = "info",
  ) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}.${String(Math.floor(now.getMilliseconds() / 100))}`;
    setAuditLog((prev) => [
      {
        id: Math.random().toString(36).slice(2, 9),
        time: timeStr,
        message,
        type,
      },
      ...prev.slice(0, 49),
    ]);
  };

  // Add course modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState("");
  const [customSectionNumber, setCustomSectionNumber] = useState("1");

  // Notification toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Scheduled submission & countdown
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledTime, setScheduledTime] = useState("08:00:00");
  const [countdownText, setCountdownText] = useState("");
  const timerRef = useRef<any>(null);

  // Share modal state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareCodeCopied, setShareCodeCopied] = useState(false);
  const [importCodeInput, setImportCodeInput] = useState("");
  // Mobile touch swipe tabs (Item 14)
  const touchStartXRef = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartXRef.current;
    if (Math.abs(diff) > 45) {
      const tabs: PlanKey[] = ["A", "B", "C"];
      const currentIdx = tabs.indexOf(activeTab);
      if (diff < 0 && currentIdx < tabs.length - 1) {
        setActiveTab(tabs[currentIdx + 1]);
      } else if (diff > 0 && currentIdx > 0) {
        setActiveTab(tabs[currentIdx - 1]);
      }
    }
    touchStartXRef.current = null;
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Student Profile
  const cachedProfile = useMemo(() => getCachedStudentProfile(), []);
  const studentId = cachedProfile?.studentId || "";
  const passedCourseIds = useMemo(
    () => new Set(cachedProfile?.passedCourseIds || []),
    [cachedProfile],
  );

  // Course map for fast lookup
  const courseMap = useMemo(
    () =>
      new Map<string, RegistrationCourse>(
        courses.map((c) => [c.id, c as RegistrationCourse]),
      ),
    [courses],
  );

  // Offline Local Draft & Connection state (Point 16)
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [lastSavedTime, setLastSavedTime] = useState<string>(() =>
    new Date().toLocaleTimeString("ar-EG"),
  );

  // Real Online Registration state (https://edugate.ptuk.edu.ps/student/onlineRegistration)
  const [isLiveMode, setIsLiveMode] = useState<boolean>(false);
  const [livePassword, setLivePassword] = useState<string>("");
  const [showLiveAuthModal, setShowLiveAuthModal] = useState<boolean>(false);
  const [portalStatus, setPortalStatus] = useState<PortalStatusResult | null>(
    null,
  );
  const [isCheckingPortal, setIsCheckingPortal] = useState<boolean>(false);

  // Reset Modal state (Point 19)
  const [showResetModal, setShowResetModal] = useState(false);

  // Automatic Low-Bandwidth / Lite Mode state (auto-detected when network is weak or slow)
  const [isLiteMode, setIsLiteMode] = useState<boolean>(() => {
    if (typeof navigator === "undefined") return false;
    const conn = (navigator as any).connection;
    if (conn) {
      if (
        conn.saveData ||
        conn.effectiveType === "slow-2g" ||
        conn.effectiveType === "2g" ||
        conn.effectiveType === "3g"
      ) {
        return true;
      }
    }
    return !navigator.onLine;
  });

  // Tools Dropdown State for uncluttered action bar
  const [showToolsDropdown, setShowToolsDropdown] = useState(false);
  const toolsDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        toolsDropdownRef.current &&
        !toolsDropdownRef.current.contains(e.target as Node)
      ) {
        setShowToolsDropdown(false);
      }
    };
    if (showToolsDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showToolsDropdown]);

  // Tuition Calculator Modal state (Point 21)
  const [showTuitionModal, setShowTuitionModal] = useState(false);
  const officialRate = cachedProfile?.majorName
    ? getOfficialTuitionRate(cachedProfile.majorName).hourlyRateJOD
    : 24;
  const [tuitionConfig, setTuitionConfig] = useState<TuitionConfig>({
    hourlyRate: officialRate,
    fixedFees: 25,
    currency: "JOD",
    exchangeRate: 5.2,
  });

  useEffect(() => {
    if (cachedProfile?.majorName) {
      const rate = getOfficialTuitionRate(
        cachedProfile.majorName,
      ).hourlyRateJOD;
      setTuitionConfig((prev) => ({
        ...prev,
        hourlyRate: rate,
      }));
    }
  }, [cachedProfile?.majorName]);

  // Custom Plan Title state (Point 27)
  const [editingPlanTitle, setEditingPlanTitle] = useState(false);
  const [tempPlanTitle, setTempPlanTitle] = useState("");

  // Portal Enrolled Courses Map (Point 30)
  const [isSyncingEnrolled, setIsSyncingEnrolled] = useState(false);
  const enrolledCoursesMap = useMemo(() => {
    const map = new Map<string, EnrolledCourse>();
    (cachedProfile?.enrolledCourses || []).forEach((c) => {
      map.set(c.code, c);
    });
    return map;
  }, [cachedProfile]);

  // Online / Offline listeners (Point 16)
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      addAuditLog("تم استعادة الاتصال بالإنترنت", "success");
      showToast("تم استعادة الاتصال بالإنترنت");
    };
    const handleOffline = () => {
      setIsOnline(false);
      addAuditLog(
        "انقطع الاتصال بالإنترنت! النظام يعمل في وضع الحفظ غير المتصل بأمان.",
        "warning",
      );
      showToast("تنبيه: انقطع الإنترنت - الخطة مؤمّنة ومحفوظة محلياً.");
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Automatic network quality check (Point 20 - fully automatic, no manual button required)
  useEffect(() => {
    const checkNetworkSpeed = () => {
      if (typeof navigator === "undefined") return;
      const conn = (navigator as any).connection;
      let shouldEnableLite = false;
      let reason = "";

      if (!navigator.onLine) {
        shouldEnableLite = true;
      } else if (conn) {
        if (conn.saveData) {
          shouldEnableLite = true;
        } else if (
          conn.effectiveType === "slow-2g" ||
          conn.effectiveType === "2g" ||
          conn.effectiveType === "3g"
        ) {
          shouldEnableLite = true;
        }
      }

      if (!shouldEnableLite && prewarmStatus && prewarmStatus.pingMs > 450) {
        shouldEnableLite = true;
      }

      if (shouldEnableLite) {
        setIsLiteMode(true);
      } else {
        setIsLiteMode(false);
      }
    };

    checkNetworkSpeed();

    const conn =
      typeof navigator !== "undefined" ? (navigator as any).connection : null;
    if (conn && conn.addEventListener) {
      conn.addEventListener("change", checkNetworkSpeed);
      return () => conn.removeEventListener("change", checkNetworkSpeed);
    }
  }, [prewarmStatus, isOnline]);

  // Reload plans when semester changes
  useEffect(() => {
    const loaded = loadRegistrationPlans(selectedSemester);
    setPlans(loaded);
    handlePrewarm();
  }, [selectedSemester]);

  // Periodic heartbeat every 90 seconds to keep registration session warm
  useEffect(() => {
    const interval = setInterval(() => {
      prewarmRegistration(
        studentId,
        isLiveMode ? livePassword : undefined,
        !isLiveMode,
      ).catch(() => {});
    }, 90000);
    return () => clearInterval(interval);
  }, [studentId, isLiveMode, livePassword]);

  // Undo / Redo history state (Point 8)
  const historyRef = useRef<Array<Record<PlanKey, RegistrationPlan>>>([plans]);
  const historyIndexRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncHistoryState = () => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  };

  // Persist whenever plans change with Undo/Redo tracking
  const updatePlans = (
    updater: (
      prev: Record<PlanKey, RegistrationPlan>,
    ) => Record<PlanKey, RegistrationPlan>,
    isUndoRedoAction = false,
  ) => {
    setPlans((prev) => {
      const next = updater(prev);
      saveRegistrationPlans(selectedSemester, next);
      savePlanAutoSnapshot(selectedSemester, next);
      setLastSavedTime(new Date().toLocaleTimeString("ar-EG"));

      if (!isUndoRedoAction) {
        const newHistory = historyRef.current.slice(
          0,
          historyIndexRef.current + 1,
        );
        newHistory.push(next);
        if (newHistory.length > 30) newHistory.shift();
        historyRef.current = newHistory;
        historyIndexRef.current = newHistory.length - 1;
        syncHistoryState();
      }
      return next;
    });
  };

  const handleUndo = () => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const targetState = historyRef.current[historyIndexRef.current];
      setPlans(targetState);
      saveRegistrationPlans(selectedSemester, targetState);
      syncHistoryState();
      showToast("تم التراجع خطوة إلى الوراء");
      addAuditLog("تراجع عن آخر تعديل في الخطة", "info");
    }
  };

  const handleRedo = () => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      const targetState = historyRef.current[historyIndexRef.current];
      setPlans(targetState);
      saveRegistrationPlans(selectedSemester, targetState);
      syncHistoryState();
      showToast("تم إعادة تطبيق التعديل");
      addAuditLog("إعادة تطبيق التعديل في الخطة", "info");
    }
  };

  // Keyboard shortcut Ctrl+Z / Ctrl+Y (Point 8)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "z" &&
        !e.shiftKey
      ) {
        e.preventDefault();
        handleUndo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === "y" ||
          (e.shiftKey && e.key.toLowerCase() === "z"))
      ) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Cross-Tab Plan Synchronization (Point 24 & 34)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && e.key.includes("ptuk_registration_plans")) {
        const loaded = loadRegistrationPlans(selectedSemester);
        setPlans(loaded);
        addAuditLog("مزامنة فورية لتحديثات الخطة من نافذة أخرى", "info");
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [selectedSemester]);

  // URL shareCode auto-import (Point 15 & 36)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const urlParams = new URLSearchParams(
        window.location.search || window.location.hash.split("?")[1] || "",
      );
      const shareCode = urlParams.get("shareCode");
      if (shareCode) {
        const imported = importPlansFromShareCode(shareCode);
        if (imported) {
          setPlans(imported);
          saveRegistrationPlans(selectedSemester, imported);
          showToast("تم استيراد الخطة بنجاح من الرابط المشترك!");
          addAuditLog("استيراد خطة من رابط خارجي مشترك", "success");
        }
      }
    } catch {}
  }, [selectedSemester]);

  const currentPlan = plans[activeTab];

  // Plan metrics & gaps
  const currentPlanGaps = useMemo(
    () => calculatePlanGaps(currentPlan.items),
    [currentPlan.items],
  );

  // Pre-flight diagnostics
  const collisionDiags = useMemo(
    () => validatePlanCollisions(currentPlan.items),
    [currentPlan.items],
  );

  const prereqDiags = useMemo(
    () => checkPlanPrerequisites(currentPlan.items, passedCourseIds, courses),
    [currentPlan.items, passedCourseIds, courses],
  );

  const isSummerSemester = selectedSemester.includes("الصيفي");
  const hasAcademicWarning = Boolean(
    (cachedProfile?.academicWarning &&
      cachedProfile.academicWarning !== "لا يوجد") ||
    cachedProfile?.academicStatus?.includes("إنذار") ||
    cachedProfile?.academicStatus?.includes("ملاحظة") ||
    (typeof cachedProfile?.gpa === "number" &&
      cachedProfile.gpa > 0 &&
      cachedProfile.gpa < 60),
  );

  const financialCheck = useMemo(
    () =>
      checkPlanFinancialBalance(
        currentPlan.totalCredits,
        cachedProfile?.financialBalance,
        tuitionConfig.hourlyRate,
      ),
    [
      currentPlan.totalCredits,
      cachedProfile?.financialBalance,
      tuitionConfig.hourlyRate,
    ],
  );

  const creditLimitDiags = useMemo(
    () =>
      checkPlanCreditLimits(currentPlan.totalCredits, selectedSemester, {
        hasAcademicWarning,
        gpa: cachedProfile?.gpa,
      }),
    [
      currentPlan.totalCredits,
      selectedSemester,
      hasAcademicWarning,
      cachedProfile?.gpa,
    ],
  );

  const allDiagnostics = useMemo(() => {
    const list: PlanDiagnostic[] = [
      ...collisionDiags,
      ...prereqDiags,
      ...creditLimitDiags,
    ];
    if (financialCheck.diagnostic) {
      list.push(financialCheck.diagnostic);
    }
    return list;
  }, [collisionDiags, prereqDiags, creditLimitDiags, financialCheck]);

  // Prewarm Gateway & Calibrate Clock with Server Time
  const handlePrewarm = async () => {
    setIsPrewarming(true);
    try {
      const clientSentAt = Date.now();
      const res = await prewarmRegistration(
        studentId,
        isLiveMode ? livePassword : undefined,
        !isLiveMode,
      );
      setPrewarmStatus(res);

      if (res.serverTimestamp) {
        // Adjust for latency estimation: serverTimestamp ~ clientSentAt + (pingMs / 2)
        const estimatedOffset =
          res.serverTimestamp - (clientSentAt + Math.floor(res.pingMs / 2));
        setServerOffsetMs(estimatedOffset);
      }
      addAuditLog(
        `تم فحص الاتصال بالبوابة (زمن الاستجابة: ${res.pingMs}ms)`,
        "info",
      );
    } catch (err: any) {
      addAuditLog(`فشل فحص الاتصال بالبوابة: ${err.message}`, "error");
      showToast(`تعذر الاتصال ببوابة الجامعة: ${err.message}`);
    } finally {
      setIsPrewarming(false);
    }
  };

  // Dry-run test request handler
  const handleTestRequest = async () => {
    if (currentPlan.items.length === 0) {
      showToast("يرجى إضافة مساقات إلى الخطة أولاً لإجراء الفحص التجريبي.");
      return;
    }

    setIsTestingRequest(true);
    addAuditLog(
      "بدء تشغيل فحص تجريبي للطلب ومطابقة الشعب مع جدول الجامعة...",
      "info",
    );

    try {
      // Resolve authentic Edugate semester code (e.g. 20252 for Spring 2026)
      const now = new Date();
      const calYear = now.getFullYear();
      const month = now.getMonth() + 1;
      let termDigit = "1";
      if (
        selectedSemester.includes("صيفي") ||
        selectedSemester.includes("الصيفي")
      ) {
        termDigit = "3";
      } else if (
        selectedSemester.includes("ثاني") ||
        selectedSemester.includes("الثاني")
      ) {
        termDigit = "2";
      } else {
        termDigit = "1";
      }
      const weight = parseSemesterWeight(selectedSemester);
      const yearFromWeight = weight > 20000 ? Math.floor(weight / 10) : null;
      const academicYear =
        yearFromWeight ||
        (month < 9 && (termDigit === "2" || termDigit === "3")
          ? calYear - 1
          : calYear);
      const semCode = `${academicYear}${termDigit}`;

      const res = await testRegistrationRequest(
        studentId,
        isLiveMode ? livePassword : undefined,
        currentPlan,
        semCode,
        !isLiveMode,
      );
      setTestResult(res);
      setShowTestModal(true);

      if (res.statusCategory === "ready") {
        addAuditLog("اكتمل الفحص التجريبي: الطلب سليم ومطابق 100%", "success");
        if (soundEnabled) playAudioChime("success");
      } else {
        addAuditLog(
          `اكتمل الفحص التجريبي مع تنبيهات: ${res.statusTitle}`,
          "warning",
        );
        if (soundEnabled) playAudioChime("warning");
      }
    } catch (err: any) {
      showToast(`فشل الفحص التجريبي: ${err.message}`);
      addAuditLog(`فشل الفحص التجريبي: ${err.message}`, "error");
    } finally {
      setIsTestingRequest(false);
    }
  };

  // Import from current Weekly Schedule into active plan
  const handleImportFromWeeklySchedule = () => {
    const scheduleEntries = Object.entries(currentWeeklySchedule);
    if (scheduleEntries.length === 0) {
      showToast("لا يوجد مساقات مسجلة حالياً في جدول الفصل لاستيرادها.");
      return;
    }

    const importedItems: RegistrationSectionItem[] = [];

    for (const [courseId, entry] of scheduleEntries) {
      const course = courseMap.get(courseId);
      const courseName = course?.name || courseId;
      const credits = course?.credits || 3;
      const section = entry.section || "1";
      const autoPri = autoDetermineItemPriority({
        credits,
        category: course?.category,
        courseName,
      });

      importedItems.push({
        courseId,
        courseName,
        section,
        credits,
        instructor: entry.instructor,
        room: entry.room,
        timeText: `${entry.startTime}-${entry.endTime} ${entry.day}`,
        priority: autoPri,
        category: course?.category,
        blocks: [
          {
            days: entry.days || (entry.day ? [entry.day] : []),
            start: timeToDecimalHours(entry.startTime, 8.5),
            end: timeToDecimalHours(entry.endTime, 9.5),
            rawTime: `${entry.startTime || "08:30"}-${entry.endTime || "09:30"}`,
          },
        ],
      });
    }

    updatePlans((prev) => ({
      ...prev,
      [activeTab]: recalculatePlanMetrics({
        ...prev[activeTab],
        items: importedItems,
      }),
    }));

    addAuditLog(
      `تم استيراد ${importedItems.length} مساقات من الجدول الأسبوعي إلى الخطة ${activeTab}`,
      "info",
    );
    showToast(`تم استيراد ${importedItems.length} مساقات بنجاح`);
  };

  // Copy Plan A to B or C
  const handleCopyPlan = (from: PlanKey, to: PlanKey) => {
    updatePlans((prev) => ({
      ...prev,
      [to]: recalculatePlanMetrics({
        ...prev[to],
        items: prev[from].items.map((item) => {
          const course = courseMap.get(item.courseId);
          const sections = course?.sections || [];
          // find next available section if possible
          let nextSec = String(parseInt(item.section, 10) + 1 || "2");
          if (sections.length > 1) {
            const currentIdx = sections.findIndex(
              (s: CourseSectionInfo) =>
                String(s.sec).trim() === String(item.section).trim(),
            );
            if (currentIdx >= 0 && currentIdx + 1 < sections.length) {
              nextSec = String(sections[currentIdx + 1].sec);
            }
          }
          return {
            ...item,
            section: nextSec,
          };
        }),
      }),
    }));
    addAuditLog(`تم نسخ المساقات من الخطة (${from}) إلى الخطة (${to})`, "info");
    showToast(`تم نسخ المواد إلى الخطة ${to}`);
  };

  // Remove Item
  const handleRemoveItem = (courseId: string) => {
    updatePlans((prev) => ({
      ...prev,
      [activeTab]: recalculatePlanMetrics({
        ...prev[activeTab],
        items: prev[activeTab].items.filter((i) => i.courseId !== courseId),
      }),
    }));
  };

  // Detailed Tuition calculation (Point 21)
  const detailedTuition = useMemo(
    () => calculateDetailedTuition(currentPlan.totalCredits, tuitionConfig),
    [currentPlan.totalCredits, tuitionConfig],
  );

  // Request Notification permission on demand (Point 11 - only when user monitors seats)
  const ensureNotificationPermissionOnDemand = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      try {
        const res = await Notification.requestPermission();
        if (res === "granted") {
          showToast("تم تفعيل إشعارات المقاعد لتنبيهك فوراً عند شغر مقعد.");
          addAuditLog(
            "تفعيل إشعارات المتصفح التلقائية لمراقبة المقاعد",
            "success",
          );
        }
      } catch (err) {
        console.error("Notification permission error", err);
      }
    }
  };

  // Move priority up or down (Point 26)
  const handleMovePriority = (courseId: string, direction: "up" | "down") => {
    updatePlans((prev) => ({
      ...prev,
      [activeTab]: recalculatePlanMetrics({
        ...prev[activeTab],
        items: movePlanItemPriority(prev[activeTab].items, courseId, direction),
      }),
    }));
    addAuditLog(`تم تعديل تسلسل إرسال وأولوية المساق (${courseId})`, "info");
  };

  // Set Reserve Section fallback (Point 10)
  const handleSetReserveSection = (
    courseId: string,
    reserveSection: string,
  ) => {
    updatePlans((prev) => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        items: prev[activeTab].items.map((i) =>
          i.courseId === courseId
            ? {
                ...i,
                reserveSection: reserveSection
                  ? reserveSection.trim()
                  : undefined,
              }
            : i,
        ),
      },
    }));
    if (reserveSection) {
      addAuditLog(
        `تعيين شعبة احتياطية (${reserveSection}) للمساق (${courseId})`,
        "info",
      );
      showToast(
        `تم تعيين شعبة ${reserveSection} كشعبة بديلة في حال امتلاء الأساسية.`,
      );
    } else {
      addAuditLog(`إلغاء الشعبة الاحتياطية للمساق (${courseId})`, "info");
      showToast("تم إلغاء الشعبة الاحتياطية.");
    }
  };

  // Export Plan to Phone / Desktop Calendar (.ics) (Point 14)
  const handleExportICS = () => {
    if (currentPlan.items.length === 0) {
      showToast("الخطة فارغة، يرجى إضافة مواد أولاً لتصدير جدولها.");
      return;
    }
    const icsContent = generateRegistrationCalendarICS(
      currentPlan.items,
      currentPlan.title,
    );
    const blob = new Blob([icsContent], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `جدول_${currentPlan.title.replace(/\s+/g, "_")}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(
      "تم تنزيل ملف التقويم (.ics) لتثبيته في تقويم هاتفك مع تنبيهات مسبقة.",
    );
    addAuditLog(`تصدير جدول ${currentPlan.title} بصيغة تقويم .ics`, "success");
  };

  // Copy Direct Shareable Link (Point 15 & 36)
  const handleCopyShareLink = () => {
    const url = generateShareablePlanUrl(plans);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        showToast("تم نسخ رابط الخطة المباشر إلى الحافظة بنجاح!");
        addAuditLog("تم نسخ رابط مشاركة الخطة للزملاء", "info");
      });
    } else {
      showToast(url);
    }
  };

  // Custom Plan Title (Point 27)
  const handleStartEditPlanTitle = () => {
    setTempPlanTitle(currentPlan.title);
    setEditingPlanTitle(true);
  };

  const handleSaveCustomPlanTitle = () => {
    const trimmed = tempPlanTitle.trim();
    if (!trimmed) return;
    updatePlans((prev) => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        title: trimmed,
      },
    }));
    setEditingPlanTitle(false);
    addAuditLog(`تحديث مسمى الخطة ${activeTab} إلى "${trimmed}"`, "info");
    showToast(`تم حفظ اسم الخطة: ${trimmed}`);
  };

  // Apply Registered Plan to Weekly Schedule (Point 28)
  const handleApplyToWeeklySchedule = () => {
    if (currentPlan.items.length === 0) {
      showToast("الخطة فارغة، لا توجد مواد لنقلها.");
      return;
    }
    if (onApplyRegisteredSchedule) {
      const newSched: Record<string, ScheduleEntry> = {};
      for (const item of currentPlan.items) {
        const extracted = extractTimesFromItem(item);
        newSched[item.courseId] = {
          day: extracted.days[0] || "الأحد",
          startTime: extracted.startTime,
          endTime: extracted.endTime,
          section: item.section,
          instructor: item.instructor,
          room: item.room,
          days: extracted.days,
          isOnline: extracted.isOnline,
        };
      }
      onApplyRegisteredSchedule(newSched);
      addAuditLog(
        `تم نقل وتثبيت جميع مواد ${currentPlan.title} في الجدول الأسبوعي بنجاح`,
        "success",
      );
      showToast(`تم نقل مواد ${currentPlan.title} إلى الجدول الأسبوعي`);
      if (onNavigateToSchedule) {
        onNavigateToSchedule();
      }
    } else {
      showToast("تم نقل مواد الخطة إلى الجدول الأسبوعي.");
    }
  };

  // One-Click Reset handlers (Point 19)
  const handleClearPlanItems = () => {
    updatePlans((prev) => ({
      ...prev,
      [activeTab]: recalculatePlanMetrics({
        ...prev[activeTab],
        items: [],
      }),
    }));
    setShowResetModal(false);
    addAuditLog(`تم تفريغ كافة مواد ${currentPlan.title}`, "info");
    showToast(`تم تفريغ مواد ${currentPlan.title}`);
  };

  const handleRestoreAutoSnapshot = () => {
    const snap = loadPlanAutoSnapshot(selectedSemester);
    if (!snap || !snap.plans) {
      showToast("لا توجد نسخة احتياطية محفوظة حالياً لهذا الفصل.");
      return;
    }
    setPlans(snap.plans);
    saveRegistrationPlans(selectedSemester, snap.plans);
    setShowResetModal(false);
    showToast("تمت استعادة آخر نسخة احتياطية بنجاح!");
    addAuditLog("استعادة النسخة الاحتياطية التلقائية للخطة", "success");
  };

  const handleRestoreRecommendedSemesterPlan = () => {
    const targetSemesterKey = selectedSemester.includes("ثاني")
      ? "second"
      : "first";
    const recommended = courses
      .map((c) => c as RegistrationCourse)
      .filter((c) => {
        if (passedCourseIds.has(c.id)) return false;
        if (
          c.seasonal &&
          c.seasonal !== "both" &&
          c.seasonal !== targetSemesterKey
        )
          return false;
        return true;
      })
      .slice(0, 5);

    const newItems: RegistrationSectionItem[] = recommended.map((c, idx) => {
      const firstSec =
        c.sections && c.sections.length > 0 ? c.sections[0] : undefined;
      return {
        courseId: c.id,
        courseName: c.name,
        section: firstSec ? String(firstSec.sec) : "1",
        credits: c.credits || 3,
        priority: idx + 1,
        category: c.category,
        instructor: firstSec?.instructor,
        timeText: firstSec?.timeText || "حسب جدول الشعبة",
        room: firstSec?.room,
        blocks: firstSec?.blocks?.map((b) => ({
          days: b.days,
          start: Number(b.start) || 0,
          end: Number(b.end) || 0,
          rawTime: b.rawTime,
        })),
      };
    });

    updatePlans((prev) => ({
      ...prev,
      [activeTab]: recalculatePlanMetrics({
        ...prev[activeTab],
        items: newItems,
      }),
    }));
    setShowResetModal(false);
    addAuditLog(
      `تمت استعادة الخطة النموذجية لفصل (${selectedSemester}) في ${currentPlan.title}`,
      "success",
    );
    showToast("تم إدراج الخطة النموذجية لهذا الفصل بنجاح");
  };

  // Sync actual enrolled courses from portal (Point 30)
  const handleSyncEnrolledCourses = () => {
    setIsSyncingEnrolled(true);
    setTimeout(() => {
      setIsSyncingEnrolled(false);
      const enrolledCount = currentPlan.items.filter((i) =>
        enrolledCoursesMap.has(i.courseId),
      ).length;
      addAuditLog(
        `مزامنة المواد المسجلة بالبوابة: تم مطابقة ${enrolledCount} من أصل ${currentPlan.items.length} مساقاً في خطتك`,
        "info",
      );
      showToast(
        `تمت المطابقة مع البوابة: (${enrolledCount} مساقات مسجلة فعلياً)`,
      );
    }, 600);
  };

  // Add course to active plan
  const handleAddCourseToPlan = (
    rawCourse: Course | RegistrationCourse,
    sectionOverride?: string,
  ) => {
    const course = rawCourse as RegistrationCourse;
    // Prevent duplicates (Point 8)
    if (currentPlan.items.some((i) => i.courseId === course.id)) {
      showToast("المساق مضاف بالفعل إلى هذه الخطة.");
      return;
    }

    const sections = course.sections || [];
    const chosenSec =
      sectionOverride ||
      (sections.length > 0
        ? String(sections[0].sec)
        : customSectionNumber.trim() || "1");
    const secObj = sections.find(
      (s: CourseSectionInfo) => String(s.sec).trim() === chosenSec,
    );
    const autoPri = autoDetermineItemPriority({
      credits: course.credits || 3,
      category: course.category,
      courseName: course.name,
    });

    const newItem: RegistrationSectionItem = {
      courseId: course.id,
      courseName: course.name,
      section: chosenSec,
      credits: course.credits || 3,
      priority: autoPri,
      category: course.category,
      instructor: secObj?.instructor,
      timeText: secObj?.timeText || "حسب جدول الشعبة",
      room: secObj?.room,
      blocks: secObj?.blocks?.map((b: CourseSectionBlock) => ({
        days: b.days,
        start: Number(b.start) || 0,
        end: Number(b.end) || 0,
        rawTime: b.rawTime,
      })),
    };

    updatePlans((prev) => ({
      ...prev,
      [activeTab]: recalculatePlanMetrics({
        ...prev[activeTab],
        items: [...prev[activeTab].items, newItem],
      }),
    }));

    setIsAddModalOpen(false);
    setAddSearchQuery("");
    addAuditLog(
      `إضافة مساق "${course.name}" (شعبة ${chosenSec}) إلى الخطة ${activeTab}`,
      "info",
    );
    showToast(`تمت إضافة ${course.name} بنجاح`);
  };

  // Change Item Section (Point 1 Dropdown)
  const handleUpdateSection = (courseId: string, newSec: string) => {
    const course = courseMap.get(courseId);
    const secObj = course?.sections?.find(
      (s: CourseSectionInfo) => String(s.sec).trim() === String(newSec).trim(),
    );

    updatePlans((prev) => ({
      ...prev,
      [activeTab]: recalculatePlanMetrics({
        ...prev[activeTab],
        items: prev[activeTab].items.map((i) => {
          if (i.courseId !== courseId) return i;
          return {
            ...i,
            section: newSec,
            instructor: secObj?.instructor || i.instructor,
            timeText: secObj?.timeText || i.timeText,
            room: secObj?.room || i.room,
            blocks: secObj?.blocks
              ? secObj.blocks.map((b: CourseSectionBlock) => ({
                  days: b.days,
                  start: Number(b.start) || 0,
                  end: Number(b.end) || 0,
                  rawTime: b.rawTime,
                }))
              : i.blocks,
          };
        }),
      }),
    }));
  };

  const handleCheckPortalStatus = async () => {
    if (!livePassword) {
      setShowLiveAuthModal(true);
      return;
    }
    setIsCheckingPortal(true);
    addAuditLog(
      "جاري فحص حالة نافذة التسجيل الإلكتروني في بوابة خضوري Edugate...",
      "info",
    );
    try {
      const res = await checkPortalRegistrationStatus(studentId, livePassword);
      setPortalStatus(res);
      if (res.isOpen) {
        addAuditLog(
          "نافذة التسجيل الإلكتروني في خضوري مفتوحة ومتاحة الآن!",
          "success",
        );
        showToast("نافذة التسجيل الإلكتروني مفتوحة ومتاحة في الجامعة!");
      } else {
        addAuditLog(`تنبيه البوابة: ${res.message}`, "warning");
        showToast(res.message);
      }
    } catch (err: any) {
      addAuditLog(`فشل فحص البوابة: ${err.message}`, "error");
      showToast(err.message || "تعذر الاتصال بالبوابة.");
    } finally {
      setIsCheckingPortal(false);
    }
  };

  // Execute Registration with Debounce Lock (Point 16)
  const handleExecuteNow = async () => {
    if (executionLockRef.current || isExecuting) return;
    if (currentPlan.items.length === 0) {
      showToast("يرجى إضافة مساقات إلى الخطة أولاً قبل بدء التسجيل.");
      return;
    }

    if (isLiveMode && !livePassword) {
      setShowLiveAuthModal(true);
      return;
    }

    executionLockRef.current = true;
    setIsExecuting(true);
    setIsScheduled(false);

    if (isLiveMode) {
      addAuditLog(
        `بدء الاتصال المباشر برابط التسجيل الإلكتروني (https://edugate.ptuk.edu.ps/student/onlineRegistration)...`,
        "info",
      );
    } else {
      addAuditLog(
        `بدء محاكاة اعتماد الخطة (${activeTab}) وتجهيزها للجدول...`,
        "info",
      );
    }

    try {
      const idempotencyKey = `reg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const summary = await executeRegistration(
        studentId,
        isLiveMode ? livePassword : undefined,
        plans,
        {
          demoMode: !isLiveMode,
          targetPlan: activeTab,
          autoFallbackOnFull: autoFallback,
          maxRetries: 3,
          idempotencyKey,
        },
      );

      setExecutionSummary(summary);

      if (summary.status === "portal_closed") {
        addAuditLog(
          "تنبيه رسمي: نافذة التسجيل الإلكتروني مغلقة في بوابة خضوري حالياً حسب التقويم الأكاديمي.",
          "warning",
        );
        showToast("نافذة التسجيل مغلقة في Edugate حالياً.");
        if (soundEnabled) playAudioChime("warning");
      } else if (summary.status === "financial_hold") {
        addAuditLog(
          "تنبيه مالي: يلزم تسديد الرسوم وبراءة الذمة من الدائرة المالية قبل التمكن من التسجيل.",
          "warning",
        );
        showToast("يوجد قيد مالي على حسابك الجامعي.");
        if (soundEnabled) playAudioChime("warning");
      } else if (
        summary.diagnostics?.some(
          (d: any) => d.code === "UNVERIFIED_PORTAL_STRUCTURE",
        )
      ) {
        addAuditLog(
          "أمان الحساب (Fail-Closed): لم يتم العثور على أزرار التثبيت المعتمدة بالصفحة. تم إيقاف العملية بأمان دون تعديل حسابك.",
          "error",
        );
        showToast("هيكل صفحة التسجيل بحاجة لتوثيق رسمي (Fail-Closed).");
        if (soundEnabled) playAudioChime("warning");
      } else if (summary.registeredCount > 0) {
        addAuditLog(
          isLiveMode
            ? `تم تسجيل ${summary.registeredCount} مساقات رسمياً في بوابة خضوري (Edugate)!`
            : `تم بنجاح اعتماد وتثبيت ${summary.registeredCount} مساقات في جدولك الأسبوعي المحلي (زمن المحاكاة: ${summary.durationMs}ms)`,
          "success",
        );
        showToast(
          isLiveMode
            ? `تم تسجيل ${summary.registeredCount} مساقات رسمياً في Edugate!`
            : "تم اعتماد وتثبيت الخطة في الجدول الأسبوعي بنجاح!",
        );
        if (soundEnabled) playAudioChime("success");
      }

      if (summary.failedCount > 0 && summary.status !== "portal_closed") {
        addAuditLog(
          `تعذر تسجيل ${summary.failedCount} مساقات بسبب امتلاء الشعب أو نقص الرصيد`,
          "warning",
        );
        if (soundEnabled) playAudioChime("warning");
      }

      // Apply to weekly schedule if successful
      if (onApplyRegisteredSchedule && summary.registeredCount > 0) {
        const newSched: Record<string, ScheduleEntry> = {};
        for (const item of summary.items) {
          if (item.status === "registered") {
            const planItem =
              plans[item.effectivePlan]?.items.find(
                (i) => i.courseId === item.courseId,
              ) || currentPlan.items.find((i) => i.courseId === item.courseId);

            const extracted = extractTimesFromItem(planItem || {});
            newSched[item.courseId] = {
              day: extracted.days[0] || "الأحد",
              startTime: extracted.startTime,
              endTime: extracted.endTime,
              section: item.effectiveSection,
              instructor: planItem?.instructor,
              room: planItem?.room,
              days: extracted.days,
              isOnline: extracted.isOnline,
            };
          }
        }
        onApplyRegisteredSchedule(newSched);
      }
    } catch (err: any) {
      addAuditLog(`حدث خطأ أثناء معالجة الإرسال: ${err.message}`, "error");
      showToast(`فشل الإرسال: ${err.message}`);
    } finally {
      setIsExecuting(false);
      setTimeout(() => {
        executionLockRef.current = false;
      }, 1000);
    }
  };

  // Synchronized countdown timer with Server Clock Offset (Point 15)
  useEffect(() => {
    if (!isScheduled) {
      if (timerRef.current) clearInterval(timerRef.current);
      setCountdownText("");
      return;
    }

    const interval = setInterval(() => {
      // Use synchronized server time
      const now = new Date(Date.now() + serverOffsetMs);
      const cleanTime = scheduledTime.replace(/[٠-٩]/g, (d) =>
        String("٠١٢٣٤٥٦٧٨٩".indexOf(d)),
      );
      const parts = cleanTime.split(":").map(Number);
      const h = Number.isFinite(parts[0]) ? parts[0] : 8;
      const m = Number.isFinite(parts[1]) ? parts[1] : 0;
      const s = Number.isFinite(parts[2]) ? parts[2] : 0;
      const target = new Date(now);
      target.setHours(h, m, s, 0);

      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
      }

      const diffMs = target.getTime() - now.getTime();
      if (diffMs <= 1000) {
        clearInterval(interval);
        setIsScheduled(false);
        addAuditLog(
          "حان موعد فتح البوابة الرسمي! بدء الإرسال الفوري للطلب...",
          "success",
        );
        handleExecuteNow();
      } else {
        const diffSec = Math.floor(diffMs / 1000);
        const hours = Math.floor(diffSec / 3600);
        const minutes = Math.floor((diffSec % 3600) / 60);
        const seconds = diffSec % 60;
        setCountdownText(
          `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
        );
      }
    }, 1000);

    timerRef.current = interval;
    return () => clearInterval(interval);
  }, [
    isScheduled,
    scheduledTime,
    plans,
    activeTab,
    autoFallback,
    serverOffsetMs,
  ]);

  // Seat Watcher Check Handler (Point 21)
  const handleCheckWatchedSeats = async () => {
    if (seatWatchList.length === 0) return;
    ensureNotificationPermissionOnDemand();
    setIsCheckingSeats(true);
    try {
      const courseCodes = Array.from(
        new Set(seatWatchList.map((i) => i.courseId)),
      );
      const results = await checkSeatsAvailability(courseCodes);
      const resultMap = new Map(results.map((r) => [r.code, r]));

      let seatOpened = false;

      const updated = seatWatchList.map((item) => {
        const course = resultMap.get(item.courseId);
        const sec = course?.sections.find(
          (s) => String(s.sec).trim() === String(item.section).trim(),
        );
        if (sec) {
          const avail = sec.available || 0;
          if (avail > 0 && (!item.available || item.available === 0)) {
            seatOpened = true;
          }
          return {
            ...item,
            capacity: sec.capacity,
            registered: sec.registered,
            available: avail,
            isAvailable: avail > 0,
            lastChecked: new Date().toLocaleTimeString("ar-EG"),
          };
        }
        return item;
      });

      setSeatWatchList(updated);
      saveSeatWatchList(updated);

      if (seatOpened) {
        addAuditLog(
          "تنبيه: تم شغر مقعد جديد في إحدى الشعب المراقبة!",
          "success",
        );
        if (soundEnabled) playAudioChime("success");
        showToast("تنبيه: شغر مقعد في إحدى الشعب المراقبة!");

        // Native System Notification (Point 11)
        if (
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          try {
            new Notification("جامعة فلسطين التقنية - خضوري", {
              body: "تنبيه مقاعد: شغر مقعد جديد في إحدى الشعب المراقبة! يمكنك التسجيل الآن.",
              icon: "/vite.svg",
            });
          } catch {}
        }
      } else {
        addAuditLog("اكتمل فحص مقاعد المراقبة", "info");
      }
    } finally {
      setIsCheckingSeats(false);
    }
  };

  // Add Section to Seat Watcher
  const handleAddWatchedSection = (courseId: string, section: string) => {
    ensureNotificationPermissionOnDemand();
    const course = courseMap.get(courseId);
    if (!course) return;

    const secObj = course.sections?.find(
      (s: CourseSectionInfo) => String(s.sec).trim() === String(section).trim(),
    );
    const existingIndex = seatWatchList.findIndex(
      (i) => i.courseId === courseId && i.section === section,
    );

    if (existingIndex >= 0) {
      const updatedList = [...seatWatchList];
      const current = updatedList[existingIndex];
      const cap = secObj?.capacity || current.capacity || 40;
      const reg = secObj?.registered || current.registered || 0;
      const avail = Math.max(0, cap - reg);
      updatedList[existingIndex] = {
        ...current,
        capacity: cap,
        registered: reg,
        available: avail,
        isAvailable: avail > 0,
        lastChecked: new Date().toLocaleTimeString("ar-EG"),
      };
      setSeatWatchList(updatedList);
      saveSeatWatchList(updatedList);
      showToast("تم تحديث بيانات الشعبة في قائمة المراقبة.");
      return;
    }

    const newItem: SeatWatcherItem = {
      courseId,
      courseName: course.name,
      section,
      instructor: secObj?.instructor,
      timeText: secObj?.timeText,
      capacity: secObj?.capacity || 40,
      registered: secObj?.registered || 0,
      available: Math.max(
        0,
        (secObj?.capacity || 40) - (secObj?.registered || 0),
      ),
      isAvailable: (secObj?.registered || 0) < (secObj?.capacity || 40),
      lastChecked: new Date().toLocaleTimeString("ar-EG"),
    };

    const nextList = [newItem, ...seatWatchList];
    setSeatWatchList(nextList);
    saveSeatWatchList(nextList);
    showToast(`تمت إضافة شعبة ${section} لمساق ${course.name} إلى المراقبة`);
  };

  // Remove watched section
  const handleRemoveWatchedSection = (courseId: string, section: string) => {
    const nextList = seatWatchList.filter(
      (i) => !(i.courseId === courseId && i.section === section),
    );
    setSeatWatchList(nextList);
    saveSeatWatchList(nextList);
  };

  // Safe Swap Handler (Point 22)
  const handlePerformSafeSwap = (courseId: string, targetSection: string) => {
    handleUpdateSection(courseId, targetSection);
    setSafeSwapCourseId(null);
    addAuditLog(
      `تم تبديل الشعبة لمساق (${courseId}) بأمان إلى شعبة ${targetSection}`,
      "info",
    );
    showToast(`تم تبديل الشعبة إلى ${targetSection}`);
  };

  // Share Code Export Handler (Point 23)
  const handleExportShare = () => {
    const code = exportPlansToShareCode(plans);
    if (code) {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(code);
        setShareCodeCopied(true);
        setTimeout(() => setShareCodeCopied(false), 2500);
      }
    }
  };

  // Import Plan From Code Handler
  const handleImportShareCode = () => {
    if (!importCodeInput.trim()) return;
    const imported = importPlansFromShareCode(importCodeInput.trim());
    if (imported) {
      updatePlans(() => imported);
      setShowShareModal(false);
      setImportCodeInput("");
      showToast("تم استيراد الخطط الثلاث بنجاح من الرمز المشفر");
      addAuditLog(
        "تم استيراد وتحديث الخطط الثلاث من رمز مشاركة خارجي",
        "success",
      );
    } else {
      showToast("رمز المشاركة غير صالح أو تالف.");
    }
  };

  // Compatible Electives Suggestions (Point 29)
  const compatibleElectives = useMemo(() => {
    if (!showSuggestModal) return [];
    const currentPlannedIds = new Set(currentPlan.items.map((i) => i.courseId));
    const currentBlocks = currentPlan.items.flatMap((i) => i.blocks || []);

    const candidates = courses
      .map((c) => c as RegistrationCourse)
      .filter((c) => {
        if (passedCourseIds.has(c.id) || currentPlannedIds.has(c.id))
          return false;
        const cat = c.category || "";
        if (!cat.includes("اختياري") && !cat.includes("حرة")) return false;
        if (c.prerequisites && c.prerequisites.length > 0) {
          const hasAllPrereqs = c.prerequisites.every((prereqId) =>
            passedCourseIds.has(prereqId),
          );
          if (!hasAllPrereqs) return false;
        }
        return true;
      });

    const results: Array<{
      course: RegistrationCourse;
      compatibleSection: string;
      timeText: string;
    }> = [];

    for (const c of candidates) {
      for (const s of c.sections || []) {
        let hasConflict = false;
        for (const b of s.blocks || []) {
          // Online blocks do not conflict with scheduled courses
          const isCandOnline = Boolean(
            (s.room && /^\d{4,5}$/.test(String(s.room).trim())) ||
            String(s.room).includes("5000") ||
            String(s.room).includes("10000") ||
            s.timeText?.includes("الكتروني") ||
            s.timeText?.includes("online"),
          );
          if (isCandOnline) continue;

          for (const cb of currentBlocks) {
            const isCbOnline = Boolean(
              cb.days?.length === 0 ||
              (cb.start === 0 && cb.end === 0) ||
              cb.rawTime?.includes("الكتروني") ||
              cb.rawTime?.includes("online"),
            );
            if (isCbOnline) continue;

            const dayOverlap = b.days.some((d: string) =>
              cb.days.some((cd: string) => cd === d),
            );
            if (dayOverlap) {
              const bStart = Number(b.start);
              const bEnd = Number(b.end);
              const cbStart = Number(cb.start);
              const cbEnd = Number(cb.end);
              const timeOverlap = bStart < cbEnd && bEnd > cbStart;
              if (timeOverlap) {
                hasConflict = true;
                break;
              }
            }
          }
          if (hasConflict) break;
        }

        if (!hasConflict) {
          results.push({
            course: c,
            compatibleSection: String(s.sec),
            timeText: s.timeText || "حسب الشعبة",
          });
          break;
        }
      }
      if (results.length >= 6) break;
    }

    return results;
  }, [showSuggestModal, currentPlan.items, courses, passedCourseIds]);

  // Filtered courses for add modal
  const filteredCourses = useMemo(() => {
    if (!addSearchQuery.trim()) return courses.slice(0, 30);
    const q = addSearchQuery.toLowerCase().trim();
    return courses
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [courses, addSearchQuery]);

  // Side-by-side comparison matrix (Point 30)
  const planComparison = useMemo(() => {
    if (!showCompareModal) return null;
    return comparePlansSideBySide(plans);
  }, [showCompareModal, plans]);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={cn(
        "flex-1 flex flex-col w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6",
        isLiteMode &&
          "lite-mode select-none [&_*]:transition-none [&_*]:shadow-none [&_*]:backdrop-blur-none",
      )}
      dir="rtl"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[var(--surface)] text-[var(--text)] border border-[var(--accent)] px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 text-sm font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Sparkles size={16} className="text-[var(--accent)] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--line)]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text)]">
            تسجيل المواد
          </h1>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            محاكي ذكي لترتيب المواد والشعب وفحص التعارضات وتجهيز الخطط البديلة
            (أ، ب، ج).
          </p>
        </div>

        {/* Top Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Connection / Offline indicator */}
          {!isOnline && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/25">
              <WifiOff size={13} className="text-rose-500" />
              <span>غير متصل (الخطة محفوظة محلياً)</span>
            </div>
          )}

          {/* Academic Calendar / Registration Deadlines */}
          {onOpenCalendarModal && (
            <button
              type="button"
              onClick={onOpenCalendarModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50/90 dark:bg-indigo-950/40 hover:bg-indigo-100/90 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800/60 text-xs text-indigo-700 dark:text-indigo-300 font-medium transition-colors cursor-pointer shadow-2xs"
              title="مواعيد التسجيل والسحب والإضافة والتقويم الأكاديمي"
            >
              <Calendar
                size={14}
                className="text-indigo-600 dark:text-indigo-400 shrink-0"
              />
              <span>مواعيد التسجيل والتقويم</span>
            </button>
          )}

          {/* Student Balance */}
          <button
            type="button"
            onClick={() => setShowTuitionModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--sunken)] border border-[var(--line-control)] text-xs text-[var(--text-2)] hover:text-[var(--text)] transition-colors cursor-pointer shadow-2xs"
            title="عرض تفاصيل الرسوم والساعات"
          >
            <Wallet size={14} className="text-emerald-500 shrink-0" />
            <span>الرصيد:</span>
            <span className="font-bold text-[var(--text)] font-mono privacy-sensitive">
              {formatDisplayBalance(cachedProfile?.financialBalance)}
            </span>
          </button>

          {/* Undo / Redo */}
          <div className="flex items-center bg-[var(--surface)] p-0.5 rounded-xl border border-[var(--line-control)] shadow-2xs">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              className="p-1.5 rounded-lg hover:bg-[var(--sunken)] disabled:opacity-25 disabled:cursor-not-allowed transition-colors text-[var(--text-2)] cursor-pointer"
              title="تراجع (Ctrl+Z)"
            >
              <Undo2 size={13} />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={!canRedo}
              className="p-1.5 rounded-lg hover:bg-[var(--sunken)] disabled:opacity-25 disabled:cursor-not-allowed transition-colors text-[var(--text-2)] cursor-pointer"
              title="إعادة (Ctrl+Y)"
            >
              <Redo2 size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Registration Mode Selector Card */}
      <div className="p-4 rounded-3xl bg-[var(--surface)] border border-[var(--line)] shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--text-3)] uppercase tracking-wider">
              نمط التشغيل:
            </span>
            <div className="flex items-center bg-[var(--sunken)] p-1 rounded-2xl border border-[var(--line)]">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  setIsLiveMode(false);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                  !isLiveMode
                    ? "bg-[var(--surface)] text-[var(--accent)] shadow-2xs border border-[var(--line-control)]"
                    : "text-[var(--text-2)] hover:text-[var(--text)]",
                )}
              >
                <Sparkles size={13} />
                <span>محاكاة وتخطيط أسبوعي</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  setIsLiveMode(true);
                  if (!livePassword) {
                    setShowLiveAuthModal(true);
                  }
                }}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                  isLiveMode
                    ? "bg-rose-500 text-white shadow-2xs"
                    : "text-[var(--text-2)] hover:text-[var(--text)]",
                )}
              >
                <Zap
                  size={13}
                  className={isLiveMode ? "text-amber-300" : "text-rose-500"}
                />
                <span>تسجيل إلكتروني حقيقي (Edugate Live)</span>
              </button>
            </div>
          </div>

          <a
            href="https://edugate.ptuk.edu.ps/student/onlineRegistration"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--accent)] hover:underline inline-flex items-center gap-1 font-semibold"
          >
            <span>رابط البوابة: onlineRegistration</span>
            <ArrowRight size={12} className="rotate-180" />
          </a>
        </div>

        {/* Dynamic Mode Details */}
        {!isLiveMode ? (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-[var(--text-2)] flex items-start gap-2.5">
            <ShieldAlert size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5 leading-relaxed">
              <span className="font-bold text-amber-700 dark:text-amber-300 block">
                وضع المحاكاة والتخطيط الأسبوعي (Local Simulation)
              </span>
              <span>
                يقوم بحساب التعارضات واعتماد الخطة محلياً في جدولك داخل التطبيق.
                للانتقال للتسجيل الرسمي الفعلي في سيرفرات خضوري، فعّل وضع{" "}
                <strong>(Edugate Live)</strong> أعلاه.
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-xs text-[var(--text)] space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                <span className="font-bold text-rose-700 dark:text-rose-300">
                  متصل بمسار البوابة الرسمي:
                  https://edugate.ptuk.edu.ps/student/onlineRegistration
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCheckPortalStatus}
                  disabled={isCheckingPortal}
                  className="px-3 py-1.5 rounded-xl font-bold text-xs bg-[var(--surface)] hover:bg-[var(--sunken)] border border-[var(--line-control)] text-[var(--text)] shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isCheckingPortal ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <Gauge size={13} className="text-indigo-500" />
                  )}
                  <span>فحص جاهزية نافذة التسجيل الآن</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowLiveAuthModal(true)}
                  className="px-3 py-1.5 rounded-xl font-bold text-xs bg-[var(--surface)] hover:bg-[var(--sunken)] border border-[var(--line-control)] text-[var(--text-2)] shadow-2xs cursor-pointer"
                >
                  {livePassword ? "تعديل كلمة المرور" : "إدخال كلمة المرور"}
                </button>
              </div>
            </div>

            {portalStatus && (
              <div
                className={cn(
                  "p-2.5 rounded-xl border text-xs flex items-start gap-2",
                  portalStatus.isOpen
                    ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-300",
                )}
              >
                {portalStatus.isOpen ? (
                  <CheckCircle2
                    size={16}
                    className="shrink-0 mt-0.5 text-emerald-500"
                  />
                ) : (
                  <AlertTriangle
                    size={16}
                    className="shrink-0 mt-0.5 text-amber-500"
                  />
                )}
                <div className="space-y-0.5">
                  <span className="font-bold block">
                    {portalStatus.isOpen
                      ? "نافذة التسجيل مفتوحة رسمياً ومتاحة للإرسال"
                      : "نافذة التسجيل غير متاحة حالياً"}
                  </span>
                  <p className="text-[11px] opacity-90">
                    {portalStatus.message}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Clean 1-Row Plan Selection Tabs */}
      <div className="flex items-center gap-2 p-1 bg-[var(--sunken)] rounded-2xl border border-[var(--line)] text-xs">
        {(["A", "B", "C"] as PlanKey[]).map((key) => {
          const plan = plans[key];
          const isSelected = activeTab === key;
          const label =
            key === "A"
              ? "الخطة الأساسية"
              : key === "B"
                ? "الخطة البديلة 1"
                : "الخطة البديلة 2";
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={cn(
                "flex-1 py-2 px-3 rounded-xl transition-all font-semibold flex items-center justify-between cursor-pointer",
                isSelected
                  ? "bg-[var(--surface)] text-[var(--accent)] font-bold shadow-2xs border border-[var(--line-control)]"
                  : "text-[var(--text-3)] hover:text-[var(--text)]",
              )}
            >
              <span>{label}</span>
              <span className="text-[11px] font-mono opacity-80">
                {plan.items.length} مواد • {plan.totalCredits} س
              </span>
            </button>
          );
        })}
      </div>

      {/* Unified Action Bar (Point 6 & 23, 29, 30) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-3xl bg-[var(--surface)] border border-[var(--line)] shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm sm:text-base text-[var(--text)]">
              {currentPlan.title}
            </span>
            <button
              type="button"
              onClick={handleStartEditPlanTitle}
              className="p-1 rounded-lg text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--sunken)] transition-colors cursor-pointer"
              title="تعديل وتخصيص اسم الخطة (مثلاً: خطة الدوام الخفيف)"
            >
              <Pencil size={13} />
            </button>
            <span className="text-xs text-[var(--text-3)]">
              ({currentPlan.totalCredits} ساعة معتمدة •{" "}
              {currentPlanGaps.totalGapHours} ساعات انتظار أسبوعياً)
            </span>
          </div>

          {/* Linear Progress Bar for Plan Credits (Point 18) */}
          {(() => {
            const minAllowedCredits = isSummerSemester ? 0 : 12;
            const maxAllowedCredits = isSummerSemester
              ? hasAcademicWarning
                ? 6
                : 10
              : hasAcademicWarning
                ? 14
                : 19;
            const isExceeded = currentPlan.totalCredits > maxAllowedCredits;
            const isOptimal =
              currentPlan.totalCredits >= minAllowedCredits && !isExceeded;
            return (
              <div className="flex items-center gap-2">
                <div className="w-28 h-1.5 rounded-full bg-[var(--sunken)] overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      isOptimal
                        ? "bg-emerald-500"
                        : isExceeded
                          ? "bg-rose-500"
                          : "bg-amber-500",
                    )}
                    style={{
                      width: `${Math.min(100, Math.round((currentPlan.totalCredits / maxAllowedCredits) * 100))}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] text-[var(--text-3)] font-mono">
                  {currentPlan.totalCredits} / {maxAllowedCredits} ساعة
                </span>
              </div>
            );
          })()}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Add Course */}
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-2 rounded-2xl text-xs font-bold bg-[var(--accent)] text-white hover:opacity-95 shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>إضافة مادة</span>
          </button>

          {/* Import Schedule */}
          {activeTab === "A" ? (
            <button
              type="button"
              onClick={handleImportFromWeeklySchedule}
              className="px-3 py-2 rounded-2xl text-xs font-semibold bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text)] border border-[var(--line-control)] transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <Calendar size={14} />
              <span>استيراد جدول الفصل</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleCopyPlan("A", activeTab)}
              className="px-3 py-2 rounded-2xl text-xs font-semibold bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text)] border border-[var(--line-control)] transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <Copy size={14} />
              <span>نسخ من الخطة 1</span>
            </button>
          )}

          {/* Seat Watcher Toggle (Point 21) */}
          <button
            type="button"
            onClick={() => setShowSeatWatcher(true)}
            className={cn(
              "px-3 py-2 rounded-2xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs",
              seatWatchList.some((i) => i.isAvailable)
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-bold animate-pulse"
                : "bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text)] border-[var(--line-control)]",
            )}
            title="مراقبة المقاعد الشاغرة في الشعب الممتلئة"
          >
            <Radio
              size={14}
              className={seatWatchList.length > 0 ? "text-amber-500" : ""}
            />
            <span>مراقبة المقاعد</span>
            {seatWatchList.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">
                {seatWatchList.length}
              </span>
            )}
          </button>

          {/* Grouped Secondary Tools Dropdown */}
          <div className="relative" ref={toolsDropdownRef}>
            <button
              type="button"
              onClick={() => setShowToolsDropdown((prev) => !prev)}
              className={cn(
                "px-3.5 py-2 rounded-2xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs",
                showToolsDropdown
                  ? "bg-[var(--sunken)] text-[var(--text)] border-[var(--line-control)] ring-2 ring-indigo-500/20"
                  : "bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text)] border-[var(--line-control)]",
              )}
              title="أدوات وخيارات إضافية لتخصيص الخطة والرسوم والمزامنة"
            >
              <span>أدوات إضافية</span>
              <ChevronDown
                size={14}
                className={cn(
                  "transition-transform duration-200",
                  showToolsDropdown && "rotate-180",
                )}
              />
            </button>

            {showToolsDropdown && (
              <div className="absolute left-0 top-full mt-2 w-64 rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-xl p-1.5 z-40 animate-in fade-in zoom-in-95 duration-150 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    handleExportICS();
                    setShowToolsDropdown(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--sunken)] transition-colors cursor-pointer text-right"
                  title="تصدير جدول الخطة إلى تقويم الهاتف الشخصي"
                >
                  <Calendar size={14} className="text-indigo-500 shrink-0" />
                  <span>تصدير إلى تقويم الهاتف</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleCopyShareLink();
                    setShowToolsDropdown(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--sunken)] transition-colors cursor-pointer text-right"
                  title="نسخ رابط لمشاركة هذه الخطة"
                >
                  <LinkIcon size={14} className="text-sky-500 shrink-0" />
                  <span>نسخ رابط الخطة</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowCompareModal(true);
                    setShowToolsDropdown(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--sunken)] transition-colors cursor-pointer text-right"
                >
                  <Eye size={14} className="text-indigo-500 shrink-0" />
                  <span>مقارنة الخطط الثلاث</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleSyncEnrolledCourses();
                    setShowToolsDropdown(false);
                  }}
                  disabled={isSyncingEnrolled}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--sunken)] transition-colors cursor-pointer text-right"
                >
                  <CheckCheck
                    size={14}
                    className={
                      isSyncingEnrolled
                        ? "animate-spin text-emerald-500 shrink-0"
                        : "text-emerald-500 shrink-0"
                    }
                  />
                  <span>
                    {isSyncingEnrolled
                      ? "جاري المطابقة..."
                      : "مطابقة المواد المسجلة بالبوابة"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowSuggestModal(true);
                    setShowToolsDropdown(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--sunken)] transition-colors cursor-pointer text-right"
                >
                  <Sparkle size={14} className="text-amber-500 shrink-0" />
                  <span>اقتراح مواد اختيارية</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowDevLog((prev) => !prev);
                    setShowToolsDropdown(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--sunken)] transition-colors cursor-pointer text-right"
                >
                  <Code2 size={14} className="text-violet-500 shrink-0" />
                  <span>
                    {showDevLog ? "إخفاء سجل العمليات" : "عرض سجل العمليات"}
                  </span>
                </button>

                <div className="my-1 border-t border-[var(--line)]" />

                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(true);
                    setShowToolsDropdown(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer text-right"
                >
                  <RotateCcw size={14} className="text-rose-500 shrink-0" />
                  <span>إعادة ضبط الخطة</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pre-Flight Diagnostics Alerts */}
      {allDiagnostics.length > 0 && (
        <div className="space-y-2">
          {allDiagnostics.map((diag, idx) => (
            <div
              key={idx}
              className={cn(
                "p-3.5 rounded-3xl border flex items-start gap-3 text-xs leading-relaxed shadow-2xs",
                diag.type === "error"
                  ? "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300"
                  : diag.type === "warning"
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
                    : "bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300",
              )}
            >
              {diag.type === "error" ? (
                <ShieldAlert
                  size={18}
                  className="shrink-0 mt-0.5 text-red-500"
                />
              ) : (
                <AlertTriangle
                  size={18}
                  className="shrink-0 mt-0.5 text-amber-500"
                />
              )}
              <div className="space-y-0.5 flex-1">
                <p className="font-bold text-sm">{diag.title}</p>
                <p className="opacity-95">{diag.detail}</p>
                {diag.suggestedAction && (
                  <p className="font-semibold text-[11px] underline opacity-90 pt-1">
                    الحل المقترح: {diag.suggestedAction}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Course Items List (Unified View - Point 4) */}
      {currentPlan.items.length === 0 ? (
        <div className="py-16 text-center space-y-4 px-4 border-2 border-dashed border-[var(--line-control)] rounded-3xl bg-[var(--surface)]/50">
          <div className="w-14 h-14 rounded-3xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto">
            <BookOpen size={28} />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="font-bold text-base text-[var(--text)]">
              هذه الخطة فارغة حالياً
            </h3>
            <p className="text-xs text-[var(--text-3)] leading-relaxed">
              يمكنك استيراد مواد جدولك الأسبوعي بضغطة زر، أو إضافة مساقات وشعب
              مخصصة يدوياً لتجهيزها للإرسال الفوري عند فتح التسجيل.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 rounded-2xl text-xs font-bold bg-[var(--accent)] text-white shadow-sm hover:opacity-90 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>إضافة مادة</span>
            </button>
            {activeTab === "A" &&
              Object.keys(currentWeeklySchedule).length > 0 && (
                <button
                  type="button"
                  onClick={handleImportFromWeeklySchedule}
                  className="px-4 py-2 rounded-2xl text-xs font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Calendar size={14} />
                  <span>استيراد جدولك الأسبوعي الحالي</span>
                </button>
              )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-[var(--text-3)] px-1">
            <span>
              المساقات المجهزة في هذه الخطة ({currentPlan.items.length})
            </span>
            <span>الأولوية تُحسب تلقائياً (المختبرات والشعب الحرجة أولاً)</span>
          </div>

          <div className="divide-y divide-[var(--line)] border border-[var(--line)] rounded-3xl overflow-hidden bg-[var(--surface)] shadow-2xs">
            {sortRegistrationItemsByPriority(currentPlan.items).map(
              (item, idx) => {
                const catalogCourse = courseMap.get(item.courseId);
                const availableSections = catalogCourse?.sections || [];
                const secObj = availableSections.find(
                  (s) => String(s.sec).trim() === String(item.section).trim(),
                );
                const secSat = calculateSectionSaturation(
                  secObj?.registered,
                  secObj?.capacity,
                );
                const isEnrolledInPortal = enrolledCoursesMap.has(
                  item.courseId,
                );
                const enrolledSec = enrolledCoursesMap.get(item.courseId)?.sec;

                return (
                  <div
                    key={item.courseId}
                    className="p-4 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[var(--sunken)]/30 transition-colors"
                  >
                    <div className="flex items-start gap-3 flex-1">
                      {/* Priority Reordering Buttons (Point 26) */}
                      <div className="flex flex-col gap-0.5 shrink-0 pt-0.5">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() =>
                            handleMovePriority(item.courseId, "up")
                          }
                          title="تقديم أولوية الإرسال"
                          className="p-1 rounded-md text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--sunken)] disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === currentPlan.items.length - 1}
                          onClick={() =>
                            handleMovePriority(item.courseId, "down")
                          }
                          title="تأخير أولوية الإرسال"
                          className="p-1 rounded-md text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--sunken)] disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <ArrowDown size={13} />
                        </button>
                      </div>

                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm sm:text-base text-[var(--text)]">
                            {item.courseName}
                          </span>
                          <span className="font-mono text-xs text-[var(--text-3)]">
                            ({item.courseId})
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                            {item.credits} ساعات
                          </span>
                          {item.priority === 1 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/25">
                              أولوية أولى (إرسال فوري)
                            </span>
                          )}
                          {/* Enrolled in Portal Badge (Point 30) */}
                          {isEnrolledInPortal && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                              <CheckCheck size={12} />
                              <span>
                                مسجل فعلياً بالبوابة (شعبة {enrolledSec})
                              </span>
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-3)]">
                          <span>المدرس: {item.instructor || "غير محدد"}</span>
                          <span>•</span>
                          <span>
                            الموعد: {item.timeText || "حسب جدول الشعبة"}
                          </span>
                          {item.room && (
                            <>
                              <span>•</span>
                              <span>القاعة: {item.room}</span>
                            </>
                          )}
                        </div>

                        {/* Section Saturation Indicator (Point 15) */}
                        {secObj && (
                          <div className="flex items-center gap-2 pt-0.5">
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                                secSat.status === "full"
                                  ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25"
                                  : secSat.status === "critical"
                                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25"
                                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
                              )}
                            >
                              {secSat.badgeText} ({secSat.registered}/
                              {secSat.capacity})
                            </span>
                            <div className="w-16 bg-[var(--sunken)] rounded-full h-1.5 overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  secSat.status === "full"
                                    ? "bg-rose-500"
                                    : secSat.status === "critical"
                                      ? "bg-amber-500"
                                      : "bg-emerald-500",
                                )}
                                style={{ width: `${secSat.percent}%` }}
                              />
                            </div>
                            {secSat.status === "full" &&
                              !seatWatchList.some(
                                (w) =>
                                  w.courseId === item.courseId &&
                                  String(w.section) === String(item.section),
                              ) && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAddWatchedSection(
                                      item.courseId,
                                      item.section,
                                    )
                                  }
                                  className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500 hover:text-white transition-all cursor-pointer flex items-center gap-1"
                                  title="الشعبة مغلقة - اضغط لمراقبتها وتنبيهك عند شغر مقعد فوراً"
                                >
                                  <Radio size={10} />
                                  <span>مراقبة المقعد</span>
                                </button>
                              )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 self-end sm:self-auto shrink-0">
                      {/* Primary Section Selector */}
                      <div className="flex items-center gap-1.5 text-xs">
                        <label className="text-[var(--text-3)] font-semibold">
                          الشعبة:
                        </label>
                        {availableSections.length > 0 ? (
                          <select
                            value={item.section}
                            onChange={(e) =>
                              handleUpdateSection(item.courseId, e.target.value)
                            }
                            className={cn(
                              "h-8 px-2 text-xs rounded-xl bg-[var(--sunken)] border text-[var(--text)] focus:outline-none focus:border-[var(--accent)] font-bold",
                              isSectionClosed(
                                secSat?.registered,
                                secSat?.capacity,
                              )
                                ? "border-rose-500/50 text-rose-600 dark:text-rose-400"
                                : "border-[var(--line-control)]",
                            )}
                          >
                            {availableSections.map((s: CourseSectionInfo) => {
                              const isFull = isSectionClosed(
                                s.registered,
                                s.capacity,
                              );
                              const avail = Math.max(
                                0,
                                (s.capacity || 40) - (s.registered || 0),
                              );
                              return (
                                <option key={s.sec} value={s.sec}>
                                  شعبة {s.sec} - {s.instructor || "مدرس"} (
                                  {isFull
                                    ? "مغلقة (ممتلئة)"
                                    : `${avail} مقعد شاغر`}
                                  )
                                </option>
                              );
                            })}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={item.section}
                            onChange={(e) =>
                              handleUpdateSection(item.courseId, e.target.value)
                            }
                            className="w-14 h-8 text-center font-bold text-xs rounded-xl bg-[var(--sunken)] border border-[var(--line-control)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                          />
                        )}
                      </div>

                      {/* Reserve Section Fallback Selector (Point 10) */}
                      {availableSections.length > 1 && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <label
                            className="text-[var(--text-3)] font-semibold"
                            title="شعبة بديلة للتسجيل فوراً في حال امتلاء الشعبة الأساسية"
                          >
                            الاحتياطية:
                          </label>
                          <select
                            value={item.reserveSection || ""}
                            onChange={(e) =>
                              handleSetReserveSection(
                                item.courseId,
                                e.target.value,
                              )
                            }
                            className={cn(
                              "h-8 px-2 text-xs rounded-xl bg-[var(--sunken)] border transition-colors focus:outline-none font-semibold",
                              item.reserveSection
                                ? "border-amber-500/50 text-amber-700 dark:text-amber-300 font-bold"
                                : "border-[var(--line-control)] text-[var(--text-3)]",
                            )}
                            title="شعبة احتياطية للتسجيل فوراً في جزء من الثانية إذا أغلقت الشعبة الأساسية"
                          >
                            <option value="">(بدون احتياط)</option>
                            {availableSections
                              .filter(
                                (s) =>
                                  String(s.sec).trim() !==
                                  String(item.section).trim(),
                              )
                              .map((s: CourseSectionInfo) => {
                                const isFull = isSectionClosed(
                                  s.registered,
                                  s.capacity,
                                );
                                const avail = Math.max(
                                  0,
                                  (s.capacity || 40) - (s.registered || 0),
                                );
                                return (
                                  <option key={s.sec} value={s.sec}>
                                    شعبة {s.sec} - {s.instructor || "مدرس"} (
                                    {isFull
                                      ? "مغلقة (ممتلئة)"
                                      : `${avail} مقعد شاغر`}
                                    )
                                  </option>
                                );
                              })}
                          </select>
                        </div>
                      )}

                      {/* Safe Swap Action (Point 22) */}
                      {availableSections.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setSafeSwapCourseId(item.courseId)}
                          className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[var(--surface)] hover:bg-[var(--sunken)] text-[var(--text-2)] hover:text-[var(--text)] border border-[var(--line-control)] transition-all cursor-pointer flex items-center gap-1"
                          title="التبديل الآمن إلى شعبة بديلة أخرى دون تعارض"
                        >
                          <ArrowLeftRight
                            size={13}
                            className="text-indigo-500"
                          />
                          <span>تبديل</span>
                        </button>
                      )}

                      {/* Add to Seat Watcher (Point 21) */}
                      <button
                        type="button"
                        onClick={() =>
                          handleAddWatchedSection(item.courseId, item.section)
                        }
                        className="p-1.5 rounded-xl text-[var(--text-3)] hover:text-amber-500 hover:bg-amber-500/10 transition-colors cursor-pointer"
                        title="مراقبة المقاعد الشاغرة لهذه الشعبة"
                      >
                        <Radio size={15} />
                      </button>

                      {/* Delete Item */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.courseId)}
                        className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
                        title="إزالة المساق من هذه الخطة"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              },
            )}
          </div>
        </div>
      )}

      {/* Direct Registration Dispatcher */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-[var(--line)] space-y-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-bold text-base sm:text-lg text-[var(--text)]">
              تسجيل المواد في البوابة
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-3)] leading-relaxed">
              تسجيل مواد خطتك مباشرة وحجز مقاعدها في البوابة الجامعية فور فتح
              التسجيل.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
            {/* Validation / Dry-Run Button */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                handleTestRequest();
              }}
              disabled={isTestingRequest || currentPlan.items.length === 0}
              className="w-full sm:w-auto justify-center px-4 py-2.5 min-h-[44px] rounded-2xl font-bold text-xs bg-[var(--surface)] hover:bg-[var(--sunken)] active:scale-95 text-[var(--text)] border border-[var(--line-control)] transition-all cursor-pointer flex items-center gap-2 shadow-2xs disabled:opacity-50"
            >
              {isTestingRequest ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <FileCheck2 size={14} className="text-emerald-500" />
              )}
              <span>فحص المواد والشعب</span>
            </button>

            {/* Schedule Auto-Registration Trigger */}
            {!isScheduled ? (
              <div className="flex items-center gap-1.5 bg-[var(--surface)] border border-[var(--line-control)] rounded-2xl p-1 shadow-2xs">
                <input
                  type="time"
                  step="1"
                  value={scheduledTime.slice(0, 5)}
                  onChange={(e) => setScheduledTime(`${e.target.value}:00`)}
                  className="bg-transparent text-xs font-mono px-2 py-1 text-[var(--text)] focus:outline-none"
                  title="وقت فتح بوابة التسجيل"
                />
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("selection");
                    setIsScheduled(true);
                    addAuditLog(
                      `تم تفعيل مؤقت الإرسال التلقائي للخطة عند الساعة ${scheduledTime}`,
                      "info",
                    );
                    showToast(`تم تفعيل الجدولة عند ${scheduledTime}`);
                  }}
                  disabled={currentPlan.items.length === 0}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  title="بدء العد التنازلي للإرسال التلقائي فور فتح البوابة"
                >
                  <Clock size={13} />
                  <span>جدولة</span>
                </button>
              </div>
            ) : null}

            {/* Submit Registration Button */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                handleExecuteNow();
              }}
              disabled={isExecuting || currentPlan.items.length === 0}
              className={cn(
                "w-full sm:w-auto justify-center px-5 py-2.5 min-h-[44px] rounded-2xl font-bold text-xs sm:text-sm shadow-md hover:opacity-95 active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2",
                isLiveMode
                  ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/25 ring-2 ring-rose-500/50"
                  : "bg-[var(--accent)] text-white",
              )}
            >
              {isExecuting ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>
                    {isLiveMode
                      ? "جاري الاتصال والتسجيل في Edugate..."
                      : "جاري اعتماد وتثبيت الخطة..."}
                  </span>
                </>
              ) : (
                <>
                  {isLiveMode ? (
                    <Zap size={15} className="text-amber-300" />
                  ) : (
                    <Play size={15} />
                  )}
                  <span>
                    {isLiveMode
                      ? "إرسال وتسجيل المواد رسمياً في Edugate"
                      : "اعتماد وتثبيت الخطة في الجدول"}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Active Scheduled Countdown Banner */}
        {isScheduled && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold">
              <Clock
                size={16}
                className="animate-spin text-amber-500 shrink-0"
              />
              <span>
                مؤقت الإرسال التلقائي نشط: سيتم إرسال الخطة تلقائياً عند الساعة{" "}
                {scheduledTime}
              </span>
              <span className="font-mono text-sm px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-200">
                متبقي {countdownText || "--:--:--"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsScheduled(false);
                addAuditLog("تم إلغاء مؤقت الإرسال المجدول", "info");
                showToast("تم إلغاء الجدولة التلقائية");
              }}
              className="px-3 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 font-bold cursor-pointer transition-colors"
            >
              إلغاء المؤقت
            </button>
          </div>
        )}

        {/* Fallback Option */}
        <div className="pt-3 border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-3 text-xs">
          <label className="flex items-center gap-2 cursor-pointer font-medium text-[var(--text)]">
            <input
              type="checkbox"
              checked={autoFallback}
              onChange={(e) => setAutoFallback(e.target.checked)}
              className="rounded w-4 h-4 accent-indigo-600"
            />
            <span>
              التسجيل في الشعبة الاحتياطية أو البديلة تلقائياً في حال امتلاء
              الشعبة الأساسية
            </span>
          </label>
        </div>
      </div>

      {/* Execution Results Summary (Point 27 Confirmation Export) */}
      {executionSummary && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="font-bold text-[var(--text)]">
              تقرير محاولة التسجيل الأخيرة:
            </span>
            <span className="text-[var(--text-3)] font-mono">
              زمن المعالجة الإجمالي: {executionSummary.durationMs}ms
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
            <div className="p-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/25">
              <span className="text-xs text-emerald-700 dark:text-emerald-300 block font-semibold">
                تم حجز المقاعد وتثبيتها
              </span>
              <span className="font-bold text-2xl text-emerald-600 dark:text-emerald-400 font-mono mt-1 block">
                {executionSummary.registeredCount}
              </span>
            </div>

            <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/25">
              <span className="text-xs text-amber-700 dark:text-amber-300 block font-semibold">
                شعب ممتلئة وتم تفعيل بدائلها
              </span>
              <span className="font-bold text-2xl text-amber-600 dark:text-amber-400 font-mono mt-1 block">
                {
                  executionSummary.items.filter(
                    (i) => i.fallbackUsed && i.status === "registered",
                  ).length
                }
              </span>
            </div>

            <div className="p-4 rounded-3xl bg-rose-500/10 border border-rose-500/25">
              <span className="text-xs text-rose-700 dark:text-rose-300 block font-semibold">
                مساقات تعذر تسجيلها
              </span>
              <span className="font-bold text-2xl text-rose-600 dark:text-rose-400 font-mono mt-1 block">
                {executionSummary.failedCount}
              </span>
            </div>
          </div>

          {/* Enrolled Items List */}
          <div className="border border-[var(--line)] rounded-3xl overflow-hidden bg-[var(--surface)] divide-y divide-[var(--line)]">
            {executionSummary.items.map((res, idx) => {
              const isSuccess = res.status === "registered";
              const isFallback = isSuccess && !!res.fallbackUsed;

              return (
                <div
                  key={idx}
                  className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    {isFallback ? (
                      <Sparkles size={16} className="text-amber-500 shrink-0" />
                    ) : isSuccess ? (
                      <CheckCircle2
                        size={16}
                        className="text-emerald-500 shrink-0"
                      />
                    ) : (
                      <AlertCircle
                        size={16}
                        className="text-rose-500 shrink-0"
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[var(--text)]">
                          {res.courseName}
                        </span>
                        <span className="font-mono text-[var(--text-3)] text-[11px]">
                          ({res.courseId})
                        </span>
                        <span className="font-semibold text-[var(--text-2)]">
                          شعبة {res.effectiveSection}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-3)] mt-0.5">
                        {res.message}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <span
                      className={cn(
                        "px-2.5 py-1 rounded-full text-[11px] font-bold border",
                        isFallback
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25"
                          : isSuccess
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
                            : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25",
                      )}
                    >
                      {isFallback
                        ? `تم تسجيل البديل (خطة ${res.effectivePlan})`
                        : isSuccess
                          ? "مسجلة بنجاح"
                          : "تعذر التسجيل"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-2xl bg-[var(--surface)] hover:bg-[var(--sunken)] border border-[var(--line-control)] text-xs font-semibold text-[var(--text-2)] flex items-center gap-1.5 cursor-pointer"
            >
              <Printer size={14} />
              <span>طباعة إشعار التسجيل المعتمد</span>
            </button>

            {executionSummary.registeredCount > 0 && onNavigateToSchedule && (
              <button
                type="button"
                onClick={onNavigateToSchedule}
                className="px-4 py-2.5 rounded-2xl bg-[var(--accent)] text-white font-bold text-xs flex items-center gap-2 hover:opacity-90 shadow-md transition-all cursor-pointer"
              >
                <span>معاينة جدولك المسجل في صفحة الجدول الأسبوعي</span>
                <ArrowRight size={14} className="rotate-180" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Live Timeline Audit Log (Point 21: hidden by default for student, toggleable in Tools) */}
      {auditLog.length > 0 && showDevLog && (
        <div className="p-4 rounded-3xl bg-[var(--surface)] border border-[var(--line)] space-y-2 text-xs animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-[var(--text-3)] font-semibold pb-1 border-b border-[var(--line)]">
            <span>سجل الأحداث والتدقيق الفني:</span>
            <button
              type="button"
              onClick={() => setAuditLog([])}
              className="text-[11px] text-[var(--text-3)] hover:text-rose-500 cursor-pointer"
            >
              مسح السجل
            </button>
          </div>
          <div className="space-y-1.5 max-h-36 overflow-y-auto font-mono text-[11px]">
            {auditLog.map((log) => (
              <div key={log.id} className="flex items-center gap-2">
                <span className="text-[var(--text-3)] opacity-70">
                  [{log.time}]
                </span>
                <span
                  className={cn(
                    log.type === "success"
                      ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                      : log.type === "warning"
                        ? "text-amber-600 dark:text-amber-400"
                        : log.type === "error"
                          ? "text-rose-600 dark:text-rose-400 font-semibold"
                          : "text-[var(--text)]",
                  )}
                >
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dry Run Test Inspection Modal */}
      {showTestModal && testResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          dir="rtl"
        >
          <div
            className="w-full max-w-3xl bg-[var(--surface)] border border-[var(--line)] rounded-3xl text-[var(--text)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[var(--line)] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                  <FileCheck2 size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base sm:text-lg text-[var(--text)]">
                      فحص المواد والشعب
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                      فحص مسبق
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-3)] mt-0.5">
                    التحقق من توفر الشعب وعدم وجود تعارضات قبل إرسال التسجيل.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                className="p-1.5 rounded-2xl text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--sunken)] transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Test Navigation Tabs */}
            <div className="px-4 py-2 border-b border-[var(--line)] bg-[var(--sunken)]/60 flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTestTab("summary")}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  activeTestTab === "summary"
                    ? "bg-[var(--surface)] text-[var(--text)] border border-[var(--line)] shadow-2xs"
                    : "text-[var(--text-3)] hover:text-[var(--text)]",
                )}
              >
                ملخص الفحص
              </button>
              <button
                type="button"
                onClick={() => setActiveTestTab("items")}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  activeTestTab === "items"
                    ? "bg-[var(--surface)] text-[var(--text)] border border-[var(--line)] shadow-2xs"
                    : "text-[var(--text-3)] hover:text-[var(--text)]",
                )}
              >
                حالة الشعب ({testResult.validatedItems.length})
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {activeTestTab === "summary" && (
                <div className="space-y-4">
                  <div
                    className={cn(
                      "p-4 rounded-3xl border flex items-start gap-3",
                      testResult.statusCategory === "ready"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200"
                        : testResult.statusCategory === "warning"
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200"
                          : "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200",
                    )}
                  >
                    {testResult.statusCategory === "ready" ? (
                      <CheckCircle2
                        size={22}
                        className="text-emerald-500 shrink-0 mt-0.5"
                      />
                    ) : testResult.statusCategory === "warning" ? (
                      <AlertTriangle
                        size={22}
                        className="text-amber-500 shrink-0 mt-0.5"
                      />
                    ) : (
                      <AlertCircle
                        size={22}
                        className="text-rose-500 shrink-0 mt-0.5"
                      />
                    )}
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm sm:text-base">
                          {testResult.statusTitle}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed opacity-90">
                        {testResult.statusDescription}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
                    <div className="p-3 bg-[var(--sunken)]/60 rounded-2xl border border-[var(--line)]">
                      <span className="text-[var(--text-3)] block">
                        زمن الاتصال
                      </span>
                      <span className="font-bold text-[var(--text)] font-mono mt-0.5 block">
                        {testResult.pingMs} ms
                      </span>
                    </div>
                    <div className="p-3 bg-[var(--sunken)]/60 rounded-2xl border border-[var(--line)]">
                      <span className="text-[var(--text-3)] block">
                        المواد المفحوصة
                      </span>
                      <span className="font-bold text-[var(--text)] font-mono mt-0.5 block">
                        {testResult.validatedItems.length} مواد
                      </span>
                    </div>
                    <div className="p-3 bg-[var(--sunken)]/60 rounded-2xl border border-[var(--line)]">
                      <span className="text-[var(--text-3)] block">
                        الشعب المتاحة
                      </span>
                      <span
                        className={cn(
                          "font-bold mt-0.5 block",
                          testResult.validatedItems.every((i) => i.isValid)
                            ? "text-emerald-600"
                            : "text-amber-600",
                        )}
                      >
                        {
                          testResult.validatedItems.filter((i) => i.isValid)
                            .length
                        }{" "}
                        / {testResult.validatedItems.length}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {activeTestTab === "items" && (
                <div className="space-y-3">
                  <div className="text-xs text-[var(--text-3)]">
                    مطابقة الشعب المحددة في خطتك مع جدول الجامعة:
                  </div>

                  <div className="divide-y divide-[var(--line)] border border-[var(--line)] rounded-3xl overflow-hidden bg-[var(--surface)]">
                    {testResult.validatedItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          {item.isValid ? (
                            <CheckCircle2
                              size={16}
                              className="text-emerald-500 shrink-0"
                            />
                          ) : (
                            <AlertCircle
                              size={16}
                              className="text-amber-500 shrink-0"
                            />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[var(--text)]">
                                {item.courseName}
                              </span>
                              <span className="font-mono text-[var(--text-3)] text-[11px]">
                                ({item.courseId})
                              </span>
                              <span className="font-semibold text-[var(--text-2)]">
                                شعبة {item.section}
                              </span>
                            </div>
                            <p className="text-[11px] text-[var(--text-3)] mt-0.5">
                              {item.message}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <span
                            className={cn(
                              "px-2.5 py-0.5 rounded-full text-[11px] font-bold border",
                              item.isValid
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
                                : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25",
                            )}
                          >
                            {item.isValid ? "متاحة" : "غير متاحة"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[var(--line)] bg-[var(--sunken)]/40 flex items-center justify-between">
              <span className="text-xs text-[var(--text-3)]">
                تم الفحص في:{" "}
                {new Date(testResult.timestamp).toLocaleTimeString("ar-EG")}
              </span>
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                className="px-4 py-2 rounded-2xl text-xs font-bold bg-[var(--surface)] hover:bg-[var(--sunken)] text-[var(--text)] border border-[var(--line-control)] cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Side-by-Side Comparison Modal (Point 30) */}
      {showCompareModal && planComparison && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          dir="rtl"
        >
          <div
            className="w-full max-w-4xl bg-[var(--surface)] border border-[var(--line)] rounded-3xl text-[var(--text)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            role="dialog"
            aria-modal="true"
          >
            <div className="p-4 sm:p-5 border-b border-[var(--line)] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Eye size={20} className="text-indigo-500" />
                <h3 className="font-bold text-base sm:text-lg text-[var(--text)]">
                  مقارنة الخطط الثلاث جنباً إلى جنب
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCompareModal(false)}
                className="p-1.5 rounded-2xl text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--sunken)] transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div className="p-3 bg-[var(--sunken)]/60 rounded-2xl border border-[var(--line)]">
                  <span className="font-bold text-sm text-[var(--text)] block">
                    الخطة 1 (الأساسية)
                  </span>
                  <span className="text-[var(--text-3)] block mt-1">
                    {planComparison.metrics.A.totalCredits} ساعة •{" "}
                    {planComparison.metrics.A.totalCourses} مواد
                  </span>
                  <span className="text-[11px] text-[var(--text-3)] block">
                    فراغ: {planComparison.metrics.A.totalGaps} س
                  </span>
                </div>

                <div className="p-3 bg-[var(--sunken)]/60 rounded-2xl border border-[var(--line)]">
                  <span className="font-bold text-sm text-[var(--text)] block">
                    الخطة 2 (بديلة)
                  </span>
                  <span className="text-[var(--text-3)] block mt-1">
                    {planComparison.metrics.B.totalCredits} ساعة •{" "}
                    {planComparison.metrics.B.totalCourses} مواد
                  </span>
                  <span className="text-[11px] text-[var(--text-3)] block">
                    فراغ: {planComparison.metrics.B.totalGaps} س
                  </span>
                </div>

                <div className="p-3 bg-[var(--sunken)]/60 rounded-2xl border border-[var(--line)]">
                  <span className="font-bold text-sm text-[var(--text)] block">
                    الخطة 3 (احتياط)
                  </span>
                  <span className="text-[var(--text-3)] block mt-1">
                    {planComparison.metrics.C.totalCredits} ساعة •{" "}
                    {planComparison.metrics.C.totalCourses} مواد
                  </span>
                  <span className="text-[11px] text-[var(--text-3)] block">
                    فراغ: {planComparison.metrics.C.totalGaps} س
                  </span>
                </div>
              </div>

              {/* Comparison Table */}
              <div className="border border-[var(--line)] rounded-3xl overflow-hidden bg-[var(--surface)] text-xs">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-[var(--sunken)]/60 border-b border-[var(--line)] text-[var(--text-2)] font-semibold">
                      <th className="p-3">المساق</th>
                      <th className="p-3 text-center">الساعات</th>
                      <th className="p-3 text-center">شعبة خطة 1</th>
                      <th className="p-3 text-center">شعبة خطة 2</th>
                      <th className="p-3 text-center">شعبة خطة 3</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {planComparison.courses.map((c) => (
                      <tr
                        key={c.courseId}
                        className="hover:bg-[var(--sunken)]/30 transition-colors"
                      >
                        <td className="p-3">
                          <span className="font-bold text-[var(--text)] block">
                            {c.courseName}
                          </span>
                          <span className="font-mono text-[11px] text-[var(--text-3)]">
                            ({c.courseId})
                          </span>
                        </td>
                        <td className="p-3 text-center font-bold">
                          {c.credits}
                        </td>
                        <td className="p-3 text-center">
                          {c.sectionA ? (
                            <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold font-mono">
                              شعبة {c.sectionA}
                            </span>
                          ) : (
                            <span className="text-[var(--text-3)]">-</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {c.sectionB ? (
                            <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold font-mono">
                              شعبة {c.sectionB}
                            </span>
                          ) : (
                            <span className="text-[var(--text-3)]">-</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {c.sectionC ? (
                            <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold font-mono">
                              شعبة {c.sectionC}
                            </span>
                          ) : (
                            <span className="text-[var(--text-3)]">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Seat Watcher Modal / Drawer (Point 21) */}
      {showSeatWatcher && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          dir="rtl"
        >
          <div
            className="w-full max-w-2xl bg-[var(--surface)] border border-[var(--line)] rounded-3xl text-[var(--text)] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            role="dialog"
            aria-modal="true"
          >
            <div className="p-4 sm:p-5 border-b border-[var(--line)] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Radio size={20} className="text-amber-500 animate-pulse" />
                <div>
                  <h3 className="font-bold text-base text-[var(--text)]">
                    مراقبة المقاعد الشاغرة (Seat Watcher)
                  </h3>
                  <p className="text-xs text-[var(--text-3)]">
                    متابعة الشعب الممتلئة والتنبيه فور قيام طالب آخر بسحبها
                    (Drop) لحجزها فوراً
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSeatWatcher(false)}
                className="p-1.5 rounded-2xl text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--sunken)] transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-3)]">
                  قائمة الشعب قيد المراقبة ({seatWatchList.length}):
                </span>
                <button
                  type="button"
                  onClick={handleCheckWatchedSeats}
                  disabled={isCheckingSeats || seatWatchList.length === 0}
                  className="px-3 py-1.5 rounded-xl bg-[var(--accent)] text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw
                    size={13}
                    className={isCheckingSeats ? "animate-spin" : ""}
                  />
                  <span>تحديث السعة الآن</span>
                </button>
              </div>

              {seatWatchList.length === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--text-3)] border-2 border-dashed border-[var(--line)] rounded-3xl">
                  لم تقم بإضافة أي شعبة للمراقبة بعد. اضغط أيقونة الرادار بجانب
                  أي شعبة في خطتك لإدراجها هنا.
                </div>
              ) : (
                <div className="divide-y divide-[var(--line)] border border-[var(--line)] rounded-3xl overflow-hidden bg-[var(--surface)]">
                  {seatWatchList.map((item) => (
                    <div
                      key={`${item.courseId}-${item.section}`}
                      className="p-3.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[var(--text)]">
                            {item.courseName}
                          </span>
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400 font-mono">
                            شعبة {item.section}
                          </span>
                        </div>
                        <div className="text-[11px] text-[var(--text-3)]">
                          {item.instructor && `المدرس: ${item.instructor} • `}
                          {item.lastChecked && `آخر فحص: ${item.lastChecked}`}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "px-2.5 py-0.5 rounded-full text-[11px] font-bold border",
                            item.isAvailable
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 animate-bounce"
                              : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25",
                          )}
                        >
                          {item.isAvailable
                            ? `شاغر (${item.available} مقعد!)`
                            : `ممتلئة (${item.registered}/${item.capacity})`}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            handleRemoveWatchedSection(
                              item.courseId,
                              item.section,
                            )
                          }
                          className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
                          title="حذف من المراقبة"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Safe Swap Modal (Point 22) */}
      {safeSwapCourseId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          dir="rtl"
        >
          <div
            className="w-full max-w-lg bg-[var(--surface)] border border-[var(--line)] rounded-3xl text-[var(--text)] shadow-2xl overflow-hidden flex flex-col"
            role="dialog"
            aria-modal="true"
          >
            <div className="p-4 sm:p-5 border-b border-[var(--line)] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ArrowLeftRight size={18} className="text-indigo-500" />
                <h3 className="font-bold text-base text-[var(--text)]">
                  التبديل الآمن للشعبة ({courseMap.get(safeSwapCourseId)?.name})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSafeSwapCourseId(null)}
                className="p-1.5 rounded-2xl text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--sunken)] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3 overflow-y-auto max-h-80 text-xs">
              <p className="text-[var(--text-3)]">
                اختر الشعبة البديلة التي ترغب بالتبديل إليها بأمان:
              </p>
              <div className="divide-y divide-[var(--line)] border border-[var(--line)] rounded-2xl overflow-hidden bg-[var(--surface)]">
                {(
                  (courseMap.get(safeSwapCourseId)?.sections ||
                    []) as CourseSectionInfo[]
                ).map((sec: CourseSectionInfo) => (
                  <div
                    key={sec.sec}
                    className="p-3 flex items-center justify-between gap-2 hover:bg-[var(--sunken)]/40 transition-colors"
                  >
                    <div>
                      <span className="font-bold text-[var(--text)] block">
                        شعبة {sec.sec}
                      </span>
                      <span className="text-[11px] text-[var(--text-3)]">
                        {sec.instructor || "مدرس"} •{" "}
                        {sec.timeText || "حسب الموعد"}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handlePerformSafeSwap(safeSwapCourseId, String(sec.sec))
                      }
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[var(--accent)] text-white hover:opacity-90 shadow-2xs cursor-pointer"
                    >
                      اختيار وتثبيت
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share / Portable Link Modal (Point 23) */}
      {showShareModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          dir="rtl"
        >
          <div
            className="w-full max-w-lg bg-[var(--surface)] border border-[var(--line)] rounded-3xl text-[var(--text)] shadow-2xl overflow-hidden flex flex-col"
            role="dialog"
            aria-modal="true"
          >
            <div className="p-4 sm:p-5 border-b border-[var(--line)] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Share2 size={18} className="text-indigo-500" />
                <h3 className="font-bold text-base text-[var(--text)]">
                  مشاركة ونقل الخطط بين الأجهزة
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="p-1.5 rounded-2xl text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--sunken)] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 text-xs">
              <div className="p-3.5 bg-[var(--sunken)]/60 rounded-2xl border border-[var(--line)] space-y-2">
                <span className="font-bold text-[var(--text)] block">
                  1. تصدير الخطط الثلاث إلى جهاز آخر:
                </span>
                <p className="text-[var(--text-3)] leading-relaxed">
                  انسخ رمز المشاركة لنقل جميع الخطط الثلاث وشعبها فوراً إلى
                  هاتفك أو لابتوب زميلك:
                </p>
                <button
                  type="button"
                  onClick={handleExportShare}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {shareCodeCopied ? <Check size={14} /> : <Copy size={14} />}
                  <span>
                    {shareCodeCopied
                      ? "تم نسخ الرمز للحافظة!"
                      : "نسخ رمز المشاركة"}
                  </span>
                </button>
              </div>

              <div className="p-3.5 bg-[var(--sunken)]/60 rounded-2xl border border-[var(--line)] space-y-2">
                <span className="font-bold text-[var(--text)] block">
                  2. استيراد خطط من رمز تم نسخه:
                </span>
                <textarea
                  rows={2}
                  value={importCodeInput}
                  onChange={(e) => setImportCodeInput(e.target.value)}
                  placeholder="الصق رمز المشاركة هنا..."
                  className="w-full p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--line-control)] text-xs font-mono text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                />
                <button
                  type="button"
                  onClick={handleImportShareCode}
                  disabled={!importCodeInput.trim()}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-[var(--accent)] text-white shadow-2xs hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  استيراد وتحديث الخطط
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suggest Compatible Electives Modal (Point 29) */}
      {showSuggestModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          dir="rtl"
        >
          <div
            className="w-full max-w-lg bg-[var(--surface)] border border-[var(--line)] rounded-3xl text-[var(--text)] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            role="dialog"
            aria-modal="true"
          >
            <div className="p-4 sm:p-5 border-b border-[var(--line)] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Sparkle size={18} className="text-amber-500" />
                <h3 className="font-bold text-base text-[var(--text)]">
                  مواد حرة واختيارية متوافقة دون تعارض
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSuggestModal(false)}
                className="p-1.5 rounded-2xl text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--sunken)] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1 text-xs">
              <p className="text-[var(--text-3)] leading-relaxed">
                هذه المواد لم تدرسها بعد ولديها شعب متوافقة تماماً مع أوقات فراغ
                خطتك الحالية ({activeTab}):
              </p>

              {compatibleElectives.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--text-3)]">
                  لم يتم العثور على مواد اختيارية تطابق أوقات فراغ هذا الجدول
                  حالياً.
                </div>
              ) : (
                <div className="divide-y divide-[var(--line)] border border-[var(--line)] rounded-2xl overflow-hidden bg-[var(--surface)]">
                  {compatibleElectives.map((item) => (
                    <div
                      key={item.course.id}
                      className="p-3.5 flex items-center justify-between gap-3 hover:bg-[var(--sunken)]/30 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <span className="font-bold text-[var(--text)] block">
                          {item.course.name}
                        </span>
                        <div className="text-[11px] text-[var(--text-3)]">
                          شعبة {item.compatibleSection} • {item.timeText} •{" "}
                          {item.course.credits} ساعات
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          handleAddCourseToPlan(item.course);
                          setShowSuggestModal(false);
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[var(--accent)] text-white hover:opacity-90 shadow-2xs cursor-pointer flex items-center gap-1"
                      >
                        <Plus size={13} />
                        <span>إضافة للخطة</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Course Modal */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          dir="rtl"
        >
          <div
            className="w-full max-w-lg bg-[var(--surface)] border border-[var(--line)] rounded-3xl text-[var(--text)] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            role="dialog"
            aria-modal="true"
          >
            <div className="p-4 sm:p-5 border-b border-[var(--line)] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <BookOpen size={18} className="text-[var(--accent)]" />
                <h3 className="font-bold text-base text-[var(--text)]">
                  إضافة مساق إلى الخطة ({activeTab})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-2xl text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--sunken)] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              {/* Search Field */}
              <div className="relative">
                <Search
                  size={16}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-3)]"
                />
                <input
                  type="text"
                  placeholder="ابحث باسم المساق أو رقمه..."
                  value={addSearchQuery}
                  onChange={(e) => setAddSearchQuery(e.target.value)}
                  className="w-full h-10 pr-10 pl-4 rounded-2xl bg-[var(--sunken)] border border-[var(--line-control)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  autoFocus
                />
              </div>

              {/* Day Pattern Filter Tabs (Point 6) */}
              <div className="flex items-center gap-1.5 p-1 bg-[var(--sunken)] rounded-2xl text-[11px] font-semibold border border-[var(--line)]">
                <span className="text-[var(--text-3)] px-2">أيام الدوام:</span>
                <button
                  type="button"
                  onClick={() => setMeetingPatternFilter("all")}
                  className={cn(
                    "flex-1 py-1 rounded-xl transition-all cursor-pointer text-center",
                    meetingPatternFilter === "all"
                      ? "bg-[var(--surface)] text-[var(--accent)] font-bold shadow-2xs"
                      : "text-[var(--text-3)] hover:text-[var(--text)]",
                  )}
                >
                  جميع الأيام
                </button>
                <button
                  type="button"
                  onClick={() => setMeetingPatternFilter("2days")}
                  className={cn(
                    "flex-1 py-1 rounded-xl transition-all cursor-pointer text-center",
                    meetingPatternFilter === "2days"
                      ? "bg-[var(--surface)] text-[var(--accent)] font-bold shadow-2xs"
                      : "text-[var(--text-3)] hover:text-[var(--text)]",
                  )}
                >
                  يومان (اثنين / أربعاء)
                </button>
                <button
                  type="button"
                  onClick={() => setMeetingPatternFilter("3days")}
                  className={cn(
                    "flex-1 py-1 rounded-xl transition-all cursor-pointer text-center",
                    meetingPatternFilter === "3days"
                      ? "bg-[var(--surface)] text-[var(--accent)] font-bold shadow-2xs"
                      : "text-[var(--text-3)] hover:text-[var(--text)]",
                  )}
                >
                  3 أيام (أحد / ثلاثاء / خميس)
                </button>
              </div>

              {/* Filtered Courses List */}
              <div className="divide-y divide-[var(--line)] border border-[var(--line)] rounded-2xl overflow-hidden max-h-80 overflow-y-auto">
                {filteredCourses.map((c) => {
                  const alreadyInPlan = currentPlan.items.some(
                    (i) => i.courseId === c.id,
                  );
                  const regCourse = c as RegistrationCourse;
                  const allSections = regCourse.sections || [];
                  const patternSections = filterSectionsByMeetingPattern(
                    allSections,
                    meetingPatternFilter,
                  );
                  const hasSections = allSections.length > 0;

                  return (
                    <div
                      key={c.id}
                      className="p-3.5 space-y-2.5 hover:bg-[var(--sunken)]/40 transition-colors text-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[var(--text)] text-sm">
                              {c.name}
                            </span>
                            <span className="font-mono text-[var(--text-3)] text-xs">
                              ({c.id})
                            </span>
                          </div>
                          <div className="text-[11px] text-[var(--text-3)]">
                            {c.credits} ساعات معتمدة •{" "}
                            {c.category || "متطلب تخصص"} • {allSections.length}{" "}
                            شعبة متوفرة
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddCourseToPlan(c)}
                          disabled={alreadyInPlan}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1",
                            alreadyInPlan
                              ? "bg-[var(--sunken)] text-[var(--text-3)] cursor-not-allowed"
                              : "bg-[var(--accent)] text-white hover:opacity-90 shadow-2xs",
                          )}
                        >
                          {alreadyInPlan ? (
                            <>
                              <Check size={13} />
                              <span>مضاف للخطة</span>
                            </>
                          ) : (
                            <>
                              <Plus size={13} />
                              <span>إضافة مباشرة</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Sections breakdown with Point 4 (Closed Badge & 1-Click Seat Watch) & Point 6 */}
                      {hasSections && !alreadyInPlan && (
                        <div className="space-y-1.5 pt-1">
                          <div className="text-[11px] font-semibold text-[var(--text-3)] flex items-center justify-between">
                            <span>الشعب المتاحة:</span>
                            {meetingPatternFilter !== "all" && (
                              <span className="text-[10px] text-[var(--accent)]">
                                ({patternSections.length} شعبة تطابق الفلتر)
                              </span>
                            )}
                          </div>

                          {patternSections.length === 0 ? (
                            <p className="text-[11px] text-[var(--text-3)] italic py-1">
                              لا توجد شعب لهذا المساق تطابق نمط الدوام المختار (
                              {meetingPatternFilter === "2days"
                                ? "ن/ر"
                                : "ح/ث/خ"}
                              ).
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {patternSections.map((sec) => {
                                const closed = isSectionClosed(
                                  sec.registered,
                                  sec.capacity,
                                );
                                const avail = Math.max(
                                  0,
                                  (sec.capacity || 40) - (sec.registered || 0),
                                );
                                const isWatching = seatWatchList.some(
                                  (w) =>
                                    w.courseId === c.id &&
                                    String(w.section) === String(sec.sec),
                                );
                                const conflict = checkSectionTimeConflict(
                                  sec.blocks,
                                  currentPlan.items,
                                  c.id,
                                );

                                return (
                                  <div
                                    key={sec.sec}
                                    className={cn(
                                      "p-2 rounded-xl border text-[11px] flex items-center justify-between gap-2 transition-all",
                                      closed
                                        ? "bg-rose-500/5 border-rose-500/25 dark:bg-rose-950/20"
                                        : conflict.hasConflict
                                          ? "bg-amber-500/5 border-amber-500/25 dark:bg-amber-950/20"
                                          : "bg-[var(--surface)] border-[var(--line-control)] hover:border-[var(--accent)]",
                                    )}
                                  >
                                    <div className="space-y-0.5 truncate">
                                      <div className="flex items-center gap-1.5 font-bold">
                                        <span>شعبة {sec.sec}</span>
                                        {closed ? (
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500 text-white">
                                            مغلقة
                                          </span>
                                        ) : (
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                            {avail} مقعد شاغر
                                          </span>
                                        )}
                                        {conflict.hasConflict && (
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                                            تعارض وقت
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-[var(--text-3)] truncate">
                                        {sec.instructor || "مدرس المساق"}{" "}
                                        {sec.timeText
                                          ? `• ${sec.timeText}`
                                          : ""}
                                      </div>
                                      {conflict.hasConflict && (
                                        <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold truncate">
                                          ⚠️ يتعارض مع:{" "}
                                          {conflict.conflictingCourseName}
                                        </div>
                                      )}
                                    </div>

                                    {/* Action Button: Add if open, 1-Click Watch if closed */}
                                    {closed ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleAddWatchedSection(
                                            c.id,
                                            String(sec.sec),
                                          )
                                        }
                                        disabled={isWatching}
                                        className={cn(
                                          "px-2 py-1 rounded-lg text-[10px] font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1",
                                          isWatching
                                            ? "bg-[var(--sunken)] text-[var(--text-3)] cursor-not-allowed"
                                            : "bg-amber-500 text-white hover:bg-amber-600 shadow-2xs",
                                        )}
                                        title={
                                          isWatching
                                            ? "قيد المراقبة حالياً"
                                            : "إضافة للمراقبة لتنبيهك فور شغر مقعد"
                                        }
                                      >
                                        <Radio size={11} />
                                        <span>
                                          {isWatching
                                            ? "مُراقبة"
                                            : "مراقبة المقعد"}
                                        </span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleAddCourseToPlan(
                                            c,
                                            String(sec.sec),
                                          )
                                        }
                                        className="px-2 py-1 rounded-lg text-[10px] font-bold shrink-0 bg-[var(--sunken)] hover:bg-[var(--accent)] text-[var(--text)] hover:text-white transition-all cursor-pointer"
                                        title={`إضافة مساق ${c.name} بشعبة ${sec.sec} مباشرة للخطة`}
                                      >
                                        اختيار
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* One-Click Reset Modal (Point 19) */}
      {showResetModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          dir="rtl"
        >
          <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--line)] rounded-3xl text-[var(--text)] shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2">
                <RotateCcw size={18} className="text-amber-500" />
                <h3 className="font-bold text-base text-[var(--text)]">
                  إعادة ضبط {currentPlan.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="p-1.5 rounded-2xl text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--sunken)] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-[var(--text-3)] leading-relaxed">
              اختر نوع إعادة الضبط الذي ترغب بتطبيقه على هذه الخطة:
            </p>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleRestoreRecommendedSemesterPlan}
                className="w-full p-3.5 rounded-2xl border border-[var(--line)] hover:border-indigo-500 bg-[var(--surface)] hover:bg-indigo-500/5 text-right transition-all cursor-pointer flex items-start gap-3"
              >
                <Sparkle
                  size={18}
                  className="text-indigo-500 shrink-0 mt-0.5"
                />
                <div>
                  <span className="font-bold text-xs sm:text-sm text-[var(--text)] block">
                    استعادة الخطة النموذجية لهذا الفصل
                  </span>
                  <span className="text-[11px] text-[var(--text-3)]">
                    إدراج مواد الخطة النموذجية المطروحة لفصل ({selectedSemester}
                    ) تلقائياً.
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={handleRestoreAutoSnapshot}
                className="w-full p-3.5 rounded-2xl border border-[var(--line)] hover:border-emerald-500 bg-[var(--surface)] hover:bg-emerald-500/5 text-right transition-all cursor-pointer flex items-start gap-3"
              >
                <CheckCircle2
                  size={18}
                  className="text-emerald-500 shrink-0 mt-0.5"
                />
                <div>
                  <span className="font-bold text-xs sm:text-sm text-[var(--text)] block">
                    استعادة آخر نسخة احتياطية محفوظة
                  </span>
                  <span className="text-[11px] text-[var(--text-3)]">
                    استرجاع حالة الخطط من آخر نسخة محفوظة محلياً قبل التعديل أو
                    الحذف.
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={handleClearPlanItems}
                className="w-full p-3.5 rounded-2xl border border-[var(--line)] hover:border-rose-500 bg-[var(--surface)] hover:bg-rose-500/5 text-right transition-all cursor-pointer flex items-start gap-3"
              >
                <Trash2 size={18} className="text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-xs sm:text-sm text-[var(--text)] block">
                    تفريغ كافة المواد (0 مواد)
                  </span>
                  <span className="text-[11px] text-[var(--text-3)]">
                    مسح جميع المساقات في هذه الخطة للبدء من جديد.
                  </span>
                </div>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--sunken)] text-[var(--text-2)] hover:text-[var(--text)] cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tuition Financial Calculator Modal (Point 21) */}
      {showTuitionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          dir="rtl"
        >
          <div className="w-full max-w-lg bg-[var(--surface)] border border-[var(--line)] rounded-3xl text-[var(--text)] shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2">
                <Calculator size={18} className="text-emerald-500" />
                <h3 className="font-bold text-base text-[var(--text)]">
                  حاسبة الرسوم المتوقعة للفصل
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTuitionModal(false)}
                className="p-1.5 rounded-2xl text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--sunken)] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-[var(--sunken)]/50 border border-[var(--line)] space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-3)]">
                  الساعات المعتمدة في {currentPlan.title}:
                </span>
                <span className="font-bold text-sm text-[var(--text)]">
                  {currentPlan.totalCredits} ساعة
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-3)]">
                  تكلفة الساعات ({currentPlan.totalCredits} ×{" "}
                  {detailedTuition.hourlyRate} د.أ):
                </span>
                <span className="font-bold text-sm text-[var(--text)]">
                  {detailedTuition.creditsCostJOD} دينار (~
                  {detailedTuition.creditsCostILS} شيكل)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-3)]">
                  رسوم التسجيل والخدمات الثابتة:
                </span>
                <span className="font-bold text-sm text-[var(--text)]">
                  {detailedTuition.fixedFees} دينار (~
                  {Math.round(
                    detailedTuition.fixedFees * tuitionConfig.exchangeRate,
                  )}{" "}
                  شيكل)
                </span>
              </div>
              <div className="border-t border-[var(--line)] pt-2 flex justify-between items-center text-sm">
                <span className="font-bold text-[var(--text)]">
                  إجمالي الرسوم المقدرة:
                </span>
                <span className="font-bold text-base text-emerald-600 dark:text-emerald-400">
                  {detailedTuition.totalJOD} دينار أردني (
                  {detailedTuition.totalILS} شيكل)
                </span>
              </div>
            </div>

            {/* Comparison with student balance */}
            <div className="p-3 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-[var(--text-3)]">
                  رصيدك المالي المتاح في حسابك الجامعي:
                </span>
                <span className="font-mono font-bold text-[var(--text)] privacy-sensitive">
                  {formatDisplayBalance(cachedProfile?.financialBalance)}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-3)] leading-relaxed">
                يُنصح بسداد الرسوم عبر القنوات المعتمدة قبل موعد فتح التسجيل
                بوقت كافٍ لضمان تغطية الرصيد وتفادي رفض المواد.
              </p>
            </div>

            {/* Config Inputs */}
            <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
              <div className="space-y-1">
                <label className="text-[var(--text-3)] font-semibold">
                  سعر الساعة المعتمدة (دينار):
                </label>
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={tuitionConfig.hourlyRate}
                  onChange={(e) =>
                    setTuitionConfig((p) => ({
                      ...p,
                      hourlyRate: Number(e.target.value) || 25,
                    }))
                  }
                  className="w-full h-9 px-3 rounded-xl bg-[var(--sunken)] border border-[var(--line-control)] text-[var(--text)] font-mono text-xs focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[var(--text-3)] font-semibold">
                  الرسوم الثابتة للفصل (دينار):
                </label>
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={tuitionConfig.fixedFees}
                  onChange={(e) =>
                    setTuitionConfig((p) => ({
                      ...p,
                      fixedFees: Number(e.target.value) || 25,
                    }))
                  }
                  className="w-full h-9 px-3 rounded-xl bg-[var(--sunken)] border border-[var(--line-control)] text-[var(--text)] font-mono text-xs focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowTuitionModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--accent)] text-white hover:opacity-90 shadow-2xs cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Plan Title Modal (Point 27) */}
      {editingPlanTitle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          dir="rtl"
        >
          <div className="w-full max-w-sm bg-[var(--surface)] border border-[var(--line)] rounded-3xl text-[var(--text)] shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2">
                <Pencil size={18} className="text-indigo-500" />
                <h3 className="font-bold text-base text-[var(--text)]">
                  تخصيص اسم {currentPlan.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingPlanTitle(false)}
                className="p-1.5 rounded-2xl text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--sunken)] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-[var(--text-3)] font-semibold">
                اكتب اسماً مخصصاً للخطة:
              </label>
              <input
                type="text"
                value={tempPlanTitle}
                onChange={(e) => setTempPlanTitle(e.target.value)}
                placeholder="مثال: خطة الدوام الخفيف أو خطة تجنب الخميس"
                className="w-full h-10 px-3 rounded-xl bg-[var(--sunken)] border border-[var(--line-control)] text-[var(--text)] text-xs focus:outline-none focus:border-[var(--accent)] font-semibold"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingPlanTitle(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--sunken)] text-[var(--text-2)] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveCustomPlanTitle}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--accent)] text-white hover:opacity-90 shadow-2xs cursor-pointer"
              >
                حفظ التسمية
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Registration Credentials Modal */}
      {showLiveAuthModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          dir="rtl"
        >
          <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--line)] rounded-3xl text-[var(--text)] shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-rose-500" />
                <h3 className="font-bold text-base text-[var(--text)]">
                  مصادقة التسجيل الإلكتروني الرسمي
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLiveAuthModal(false)}
                className="p-1.5 rounded-2xl text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--sunken)] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-xs text-[var(--text-2)] leading-relaxed space-y-1">
              <span className="font-bold text-rose-700 dark:text-rose-300 block">
                تأكيد الاتصال برابط بوابة خضوري:
                https://edugate.ptuk.edu.ps/student/onlineRegistration
              </span>
              <p>
                سيتم استخدام كلمة المرور في جلسة مشفرة ومؤقتة لإرسال طلبات إضافة
                الشُعب مباشرة إلى بوابة Edugate. لا يتم تخزين كلمة المرور في أي
                قاعدة بيانات.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[var(--text-3)] font-semibold">
                  الرقم الجامعي:
                </label>
                <input
                  type="text"
                  value={studentId}
                  disabled
                  className="w-full h-10 px-3 rounded-xl bg-[var(--sunken)] border border-[var(--line-control)] text-[var(--text)] font-mono text-xs opacity-75 cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[var(--text-3)] font-semibold">
                  كلمة مرور بوابة Edugate:
                </label>
                <input
                  type="password"
                  value={livePassword}
                  onChange={(e) => setLivePassword(e.target.value)}
                  placeholder="أدخل كلمة المرور الخاصة ببوابة الجامعة"
                  className="w-full h-10 px-3 rounded-xl bg-[var(--sunken)] border border-[var(--line-control)] text-[var(--text)] text-xs focus:outline-none focus:border-rose-500 font-mono"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setShowLiveAuthModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--sunken)] text-[var(--text-2)] hover:text-[var(--text)] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!livePassword.trim()) {
                    showToast("يرجى إدخال كلمة المرور للمتابعة.");
                    return;
                  }
                  setShowLiveAuthModal(false);
                  showToast("تم حفظ الجلسة المؤقتة للتسجيل المباشر.");
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <Check size={14} />
                <span>تأكيد واعتماد الجلسة</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Point 46: Floating Tuition Mini-Bar */}
      {currentPlan.totalCredits > 0 && (
        <div
          dir="rtl"
          className="fixed bottom-4 left-4 z-40 hidden sm:flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-[var(--surface)]/95 backdrop-blur-md border border-[var(--line-control)] shadow-lg text-xs animate-in fade-in"
        >
          <div className="flex items-center gap-1.5 text-[var(--text)] font-semibold">
            <Wallet size={14} className="text-[var(--accent)]" />
            <span>الساعات: {currentPlan.totalCredits}</span>
          </div>
          <span className="w-px h-3.5 bg-[var(--line)]" />
          <div className="text-[var(--text-2)] font-mono">
            {detailedTuition.totalJOD} دينار{" "}
            <span className="text-[10px] text-[var(--text-3)]">
              ({detailedTuition.totalILS} ₪)
            </span>
          </div>
          <button
            onClick={() => setShowTuitionModal(true)}
            className="text-[11px] font-bold text-[var(--accent)] hover:underline cursor-pointer"
          >
            تعديل الرسوم
          </button>
        </div>
      )}
    </div>
  );
};

export default RegistrationPage;
