import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
  Search,
  ChevronDown,
  ChevronUp,
  Check,
  Lock,
  Bell,
  BellRing,
  X,
  Circle,
  Trash2,
  Smartphone,
  CheckCircle2,
  ListFilter,
  CheckCheck,
  AlertCircle,
  AlertTriangle,
  Clock,
  Layers,
  Volume2,
  Calendar,
  Calculator,
  Download,
  Printer,
  TrendingUp,
  User,
  MapPin,
  Sparkles,
  Filter,
  FileText,
  LayoutGrid,
  List,
  Snowflake,
  Sun,
  Eye,
  Info,
  Percent,
  ArrowRight,
  ExternalLink,
  Users,
} from "lucide-react";
import type { Course, ScheduleEntry } from "../data";
import {
  isCourseAvailable as defaultIsCourseAvailable,
  calculateDegreeCredits,
  calculateGPA,
  isDegreeCreditBearing,
} from "../core/courseProgress";
import {
  getTrackedSeats,
  toggleTrackSection,
  removeTrackedSection,
  trackMultipleSections,
  getNotificationSettings,
  saveNotificationSettings,
  requestWebPushPermission,
  sendBrowserNotification,
  ensureNotificationPermission,
  isSectionClosed,
  getSectionCapacityDetails,
  type TrackedSeat,
  type NotificationSettings,
} from "../core/seatTracker";
import {
  fetchCourses,
  fetchCoursesByCodes,
  isOfflineCatalog,
} from "../services/courseService";
import type { CatalogCourse, CatalogSection } from "../services/scheduleSolver";
import { normalizeDayKey } from "../services/scheduleSolver";
import {
  courseRecommendedSemesters,
  getRecommendedSemesterOfCourse,
  SEMESTERS,
} from "../constants";
import { cn, normalizeArabicText, matchDoctorName, wordsMatch } from "../utils";
import type { AppRoute } from "../router";
import { DoctorScheduleModal } from "../components/modals";
import {
  analyzeSectionSwap,
  buildScheduleEntryFromSection,
} from "../core/sectionSwap";
import { useVirtualizer } from "../hooks/useVirtualizer";
import { triggerHaptic } from "../utils/haptics";

interface CoursesPageProps {
  courses: Course[];
  completedCourses: Set<string>;
  plannedCourses: Record<string, string>;
  courseGrades?: Record<string, number>;
  currentGpa?: number;
  currentPlanningSemester?: string | null;
  categoryRequirements?: Record<string, number>;
  onNavigate?: (route: AppRoute) => void;
  onToggleComplete: (courseId: string) => void;
  onPlanCourse: (courseId: string) => void;
  activeMajorName?: string;
  onSelectMajor?: () => void;
  syncTimeText?: string;
  weeklySchedule?: Record<string, Record<string, ScheduleEntry>>;
  setWeeklySchedule?: React.Dispatch<
    React.SetStateAction<Record<string, Record<string, ScheduleEntry>>>
  >;
}

const DAY_NAMES: Record<string, string> = {
  سب: "السبت",
  أح: "الأحد",
  اث: "الاثنين",
  ثلا: "الثلاثاء",
  ار: "الأربعاء",
  خمـ: "الخميس",
};

const renderHighlightedDoctorName = (doc: string, query: string) => {
  const qClean = query.trim();
  if (!qClean) return doc;
  const qTokens = normalizeArabicText(qClean)
    .split(" ")
    .filter((t) => t.length > 0);
  if (qTokens.length === 0) return doc;

  const words = doc.split(" ");
  return words.map((word, idx) => {
    const isMatch = qTokens.some((t) => wordsMatch(word, t));
    return (
      <React.Fragment key={idx}>
        {idx > 0 && " "}
        {isMatch ? (
          <span className="font-extrabold text-indigo-600 dark:text-indigo-400 underline decoration-indigo-400/40">
            {word}
          </span>
        ) : (
          <span>{word}</span>
        )}
      </React.Fragment>
    );
  });
};

export const CoursesPage: React.FC<CoursesPageProps> = ({
  courses,
  completedCourses,
  plannedCourses,
  courseGrades,
  currentGpa,
  currentPlanningSemester,
  categoryRequirements = {},
  onNavigate,
  onToggleComplete,
  onPlanCourse,
  activeMajorName = "الخطة الدراسية الجامعية",
  onSelectMajor,
  syncTimeText = "منذ قليل",
  weeklySchedule,
  setWeeklySchedule,
}) => {
  // Search & Basic filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "available" | "completed" | "remaining" | "tracked"
  >("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Feature 4: View Mode (Flat Table vs Grouped by Year & Semester)
  const [viewMode, setViewMode] = useState<"flat" | "grouped">("flat");
  const [collapsedYears, setCollapsedYears] = useState<Record<string, boolean>>(
    {},
  );

  // Feature 1: Inline Section Drawer
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);

  // Searchable Doctor Filter (Combobox)
  const [selectedInstructor, setSelectedInstructor] = useState<string>("all");
  const [isDoctorDropdownOpen, setIsDoctorDropdownOpen] =
    useState<boolean>(false);
  const [doctorSearchQuery, setDoctorSearchQuery] = useState<string>("");
  const doctorDropdownRef = useRef<HTMLDivElement>(null);

  // Feature: Doctor Schedule Modal
  const [doctorScheduleModalName, setDoctorScheduleModalName] = useState<
    string | null
  >(null);

  // Feature 9: Smart Section Swap Notice
  const [swapNotice, setSwapNotice] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Room filter
  const [selectedRoom, setSelectedRoom] = useState<string>("all");

  // Feature 7: Quick GPA Impact Modal
  const [gpaModalCourse, setGpaModalCourse] = useState<Course | null>(null);
  const [customGrade, setCustomGrade] = useState<number>(85);

  // Feature 10: Export Dropdown
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (gpaModalCourse) setGpaModalCourse(null);
        if (showExportMenu) setShowExportMenu(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gpaModalCourse, showExportMenu]);

  // Courses Map
  const coursesById = useMemo(
    () => new Map(courses.map((c) => [c.id, c])),
    [courses],
  );

  // Active Semester Schedule for Swap Analysis
  const activePlanningSem = currentPlanningSemester || SEMESTERS[0];
  const activeSemesterSchedule = useMemo(() => {
    return weeklySchedule?.[activePlanningSem] || {};
  }, [weeklySchedule, activePlanningSem]);

  // Handle Smart Section Swap
  const handleSwapSection = (
    courseId: string,
    courseName: string,
    targetSection: CatalogSection,
  ) => {
    if (!setWeeklySchedule) return;
    const newEntry = buildScheduleEntryFromSection(targetSection);

    setWeeklySchedule((prev) => ({
      ...prev,
      [activePlanningSem]: {
        ...(prev[activePlanningSem] || {}),
        [courseId]: newEntry,
      },
    }));

    // Auto untrack if this section was in tracked list
    if (isSpecificSectionTracked(courseId, String(targetSection.sec))) {
      toggleTrackSection(courseId, courseName, String(targetSection.sec));
      setTrackedList(getTrackedSeats());
    }

    triggerHaptic("swap");

    setSwapNotice({
      message: `تم التبديل بنجاح إلى شعبة ${targetSection.sec} لمساق «${courseName}» في جدول ${activePlanningSem}.`,
      type: "success",
    });
    setTimeout(() => setSwapNotice(null), 5000);
  };

  // Planned Course Toast Notice (explains where the course was added)
  const [plannedNotice, setPlannedNotice] = useState<{
    courseId: string;
    courseName: string;
    semester: string;
    isAdded: boolean;
  } | null>(null);

  // Tracking state
  const [trackedList, setTrackedList] = useState<TrackedSeat[]>(() =>
    getTrackedSeats(),
  );
  const [selectedCourseForTracking, setSelectedCourseForTracking] =
    useState<Course | null>(null);
  const [catalogCourseForTracking, setCatalogCourseForTracking] =
    useState<CatalogCourse | null>(null);
  const [isLoadingSections, setIsLoadingSections] = useState<boolean>(false);

  // Scroll progress indicator (Item 108)
  const [scrollProgress, setScrollProgress] = useState(0);
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight > 0) {
        setScrollProgress(
          Math.min(100, Math.max(0, (scrollY / scrollHeight) * 100)),
        );
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Browser notifications
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(() =>
    getNotificationSettings(),
  );
  const [webPushNotice, setWebPushNotice] = useState<string>("");
  const [permissionWarning, setPermissionWarning] = useState<string | null>(
    null,
  );

  // Catalog sections cache for inline drawer & instructor filtering
  const [catalogMap, setCatalogMap] = useState<Record<string, CatalogCourse>>(
    {},
  );
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(false);

  const isBrowserNotifActive =
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "granted";

  const trackedMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    trackedList.forEach((s) => {
      map[s.courseCode] = true;
    });
    return map;
  }, [trackedList]);

  // Close doctor dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        doctorDropdownRef.current &&
        !doctorDropdownRef.current.contains(event.target as Node)
      ) {
        setIsDoctorDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Load catalog in background to populate section counts, instructors, and rooms
  useEffect(() => {
    let cancelled = false;
    setIsLoadingCatalog(true);
    fetchCourses()
      .then((catalogCourses) => {
        if (cancelled) return;
        const map: Record<string, CatalogCourse> = {};
        for (const c of catalogCourses) {
          if (c && c.id) {
            map[c.id] = c;
          }
        }
        setCatalogMap(map);
      })
      .catch((err) => {
        console.warn("Could not load catalog courses:", err);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCatalog(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch sections on-demand if user expands a course not yet cached
  useEffect(() => {
    if (!expandedCourseId || catalogMap[expandedCourseId]) return;
    let cancelled = false;
    fetchCoursesByCodes([expandedCourseId])
      .then((res) => {
        if (!cancelled && res.length > 0) {
          setCatalogMap((prev) => ({
            ...prev,
            [expandedCourseId]: res[0],
          }));
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [expandedCourseId, catalogMap]);

  // Load sections when a specific course is selected for tracking modal
  useEffect(() => {
    if (!selectedCourseForTracking) {
      setCatalogCourseForTracking(null);
      return;
    }
    let cancelled = false;
    setIsLoadingSections(true);
    fetchCoursesByCodes([selectedCourseForTracking.id])
      .then((res) => {
        if (!cancelled && res.length > 0) {
          setCatalogCourseForTracking(res[0]);
        } else if (!cancelled) {
          setCatalogCourseForTracking(null);
        }
      })
      .catch((err) => {
        console.error("Failed to load sections for tracking:", err);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSections(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCourseForTracking]);

  // Feature 2: Reverse dependencies - What courses does course X unlock?
  const unlockedMap = useMemo(() => {
    const map: Record<string, Course[]> = {};
    for (const c of courses) {
      if (Array.isArray(c.prerequisites)) {
        for (const prereqId of c.prerequisites) {
          if (!map[prereqId]) map[prereqId] = [];
          map[prereqId].push(c);
        }
      }
    }
    return map;
  }, [courses]);

  // Feature 6: Unique instructors (الدكاترة) & rooms from loaded catalog
  const { allInstructors, allRooms } = useMemo(() => {
    const instructors = new Set<string>();
    const rooms = new Set<string>();
    for (const catCourse of Object.values(catalogMap)) {
      if (Array.isArray(catCourse.sections)) {
        for (const s of catCourse.sections) {
          const inst = s.instructor?.trim();
          if (inst && inst !== "غير محدد" && inst !== "TBA") {
            instructors.add(inst);
          }
          const room = s.room?.trim();
          if (room && room !== "غير محددة" && room !== "TBA") {
            rooms.add(room);
          }
        }
      }
    }
    return {
      allInstructors: Array.from(instructors).sort(),
      allRooms: Array.from(rooms).sort(),
    };
  }, [catalogMap]);

  // Course counts per doctor
  const doctorCourseCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const catCourse of Object.values(catalogMap)) {
      if (Array.isArray(catCourse.sections)) {
        const seenInCourse = new Set<string>();
        for (const s of catCourse.sections) {
          const inst = s.instructor?.trim();
          if (inst && inst !== "غير محدد" && inst !== "TBA") {
            seenInCourse.add(inst);
          }
        }
        seenInCourse.forEach((inst) => {
          map[inst] = (map[inst] || 0) + 1;
        });
      }
    }
    return map;
  }, [catalogMap]);

  // Filtered and smart-ranked list of doctors in combobox as user types (supports first+last name search)
  const filteredDoctors = useMemo(() => {
    const q = doctorSearchQuery.trim();
    if (!q) return allInstructors;
    return allInstructors
      .map((doc) => ({
        doc,
        ...matchDoctorName(doc, q),
      }))
      .filter((res) => res.matches)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.doc.localeCompare(b.doc, "ar");
      })
      .map((res) => res.doc);
  }, [allInstructors, doctorSearchQuery]);

  // Feature 7: GPA calculation values
  const currentDegreeCredits = useMemo(() => {
    return calculateDegreeCredits(courses, completedCourses);
  }, [courses, completedCourses]);

  const currentComputedGpa = useMemo(() => {
    if (typeof currentGpa === "number" && currentGpa > 0) return currentGpa;
    return calculateGPA(
      courses,
      courseGrades || {},
      completedCourses,
      new Set(),
      {},
      false,
    );
  }, [currentGpa, courses, courseGrades, completedCourses]);

  const calculateGpaImpact = (courseCredits: number, expectedGrade: number) => {
    if (currentDegreeCredits <= 0) {
      const diff =
        currentComputedGpa > 0
          ? Math.round((expectedGrade - currentComputedGpa) * 10) / 10
          : 0;
      return { newGpa: expectedGrade, diff };
    }
    const totalPoints = currentComputedGpa * currentDegreeCredits;
    const newCredits = currentDegreeCredits + courseCredits;
    const newTotalPoints = totalPoints + expectedGrade * courseCredits;
    const newGpa =
      newCredits > 0
        ? Math.round((newTotalPoints / newCredits) * 10) / 10
        : expectedGrade;
    const diff = Math.round((newGpa - currentComputedGpa) * 10) / 10;
    return { newGpa, diff };
  };

  const isAllSectionsTracked = (courseCode: string) => {
    return trackedList.some(
      (s) => s.courseCode === courseCode && s.sec === "all",
    );
  };

  const isSpecificSectionTracked = (
    courseCode: string,
    sec: string | number,
  ) => {
    return trackedList.some(
      (s) =>
        s.courseCode === courseCode &&
        (String(s.sec) === String(sec) || s.sec === "all"),
    );
  };

  const requestPermissionForTracking = async (
    courseName: string,
    secLabel: string,
  ): Promise<boolean> => {
    const perm = await ensureNotificationPermission();
    if (perm === "granted") {
      saveNotificationSettings({ webPushEnabled: true });
      setNotifSettings({ webPushEnabled: true });
      sendBrowserNotification(
        "🔔 تم تفعيل تتبع المقعد المغلق!",
        `ستصلك رسالة فورية على شاشتك فور فتح مقعد في ${secLabel} لمادة ${courseName}.`,
      );
      setPermissionWarning(null);
      return true;
    }
    if (perm === "denied") {
      setPermissionWarning(
        "⚠️ إشعارات المتصفح محظورة! لتصلك تنبيهات المقاعد المغلقة فور فتحها، يرجى النقر على أيقونة القفل 🔒 بجانب رابط الموقع في المتصفح وتغيير إعداد 'الإشعارات' إلى 'سماح'.",
      );
      return false;
    }
    setPermissionWarning("متصفحك الحالي لا يدعم إشعارات الويب المباشرة.");
    return false;
  };

  const handleToggleAllClosedSections = async (c: Course) => {
    const isCurrentlyTracked = isAllSectionsTracked(c.id);
    if (!isCurrentlyTracked) {
      const sections = catalogCourseForTracking?.sections || [];
      const closedSecs = sections.filter((s) => isSectionClosed(s.status));
      if (sections.length > 0 && closedSecs.length === 0) {
        setWebPushNotice(
          "جميع شعب هذا المساق مفتوحة حالياً (لا توجد شعب مغلقة بحاجة للمراقبة)!",
        );
        setTimeout(() => setWebPushNotice(""), 4000);
        return;
      }

      await requestPermissionForTracking(c.name, "الشعب المغلقة");
      toggleTrackSection(
        c.id,
        c.name,
        "all",
        "جميع الشعب المغلقة",
        undefined,
        true,
      );
    } else {
      removeTrackedSection(c.id, "all");
    }
    setTrackedList(getTrackedSeats());
  };

  const handleToggleSpecificSection = async (
    c: Course,
    section: CatalogSection,
  ) => {
    const isClosed = isSectionClosed(section.status);
    if (!isClosed) {
      setWebPushNotice(
        "هذه الشعبة مفتوحة ومتاحة للتسجيل بالفعل (لا تحتاج لمراقبة المقاعد).",
      );
      setTimeout(() => setWebPushNotice(""), 3500);
      return;
    }

    const isCurrentlyTracked = isSpecificSectionTracked(c.id, section.sec);
    if (!isCurrentlyTracked) {
      await requestPermissionForTracking(c.name, `شعبة ${section.sec}`);
    }

    const capInfo = getSectionCapacityDetails(section, c.id);
    toggleTrackSection(
      c.id,
      c.name,
      section.sec,
      section.instructor || "غير محدد",
      section.room || "غير محددة",
      true,
      capInfo.registered,
      capInfo.capacity,
    );
    setTrackedList(getTrackedSeats());
  };

  const handleRemoveTrack = (code: string, sec: string) => {
    removeTrackedSection(code, sec);
    setTrackedList(getTrackedSeats());
  };

  const handleEnableWebPush = async () => {
    const granted = await requestWebPushPermission();
    if (granted) {
      const updated: NotificationSettings = { webPushEnabled: true };
      saveNotificationSettings(updated);
      setNotifSettings(updated);
      sendBrowserNotification(
        "تم تفعيل تنبيهات المقاعد الفورية بنجاح!",
        "ستصلك إشعارات فورية على شاشتك عند فتح أي مقعد شاغر في الشعب المغلقة التي تتابعها.",
      );
      setWebPushNotice(
        "تم تفعيل إشعارات المتصفح بنجاح وتم إرسال إشعار تجريبي لشاشتك!",
      );
      setPermissionWarning(null);
    } else {
      setWebPushNotice(
        "تعذر تفعيل الإشعارات. يرجى السماح بالإشعارات من إعدادات المتصفح.",
      );
      setPermissionWarning(
        "⚠️ إشعارات المتصفح محظورة! يرجى النقر على أيقونة القفل 🔒 بجانب رابط الموقع في المتصفح وتغيير 'الإشعارات' إلى 'سماح'.",
      );
    }
    setTimeout(() => setWebPushNotice(""), 4500);
  };

  const handleTestBrowserNotification = async () => {
    const granted = await requestWebPushPermission();
    if (granted) {
      sendBrowserNotification(
        "🔔 تجربة إشعار المتصفح المباشر",
        "تنبيهات المتصفح تعمل بنجاح! هكذا سيصلك إشعار منبثق فوري عند توفر مقعد شاغر في أي شعبة مغلقة تتابعها.",
      );
      setWebPushNotice("تم إرسال إشعار تجريبي لشاشتك مع صوت التنبيه!");
      setPermissionWarning(null);
    } else {
      setPermissionWarning(
        "⚠️ يرجى السماح بالإشعارات في المتصفح لتتمكن من تلقي التنبيهات المنبثقة على شاشتك.",
      );
    }
    setTimeout(() => setWebPushNotice(""), 4500);
  };

  // Plan Course with Clear Instant Feedback Toast
  const handleTogglePlanWithNotice = (course: Course) => {
    const isCurrentlyPlanned = Boolean(plannedCourses[course.id]);
    onPlanCourse(course.id);
    const targetSemester =
      plannedCourses[course.id] || currentPlanningSemester || SEMESTERS[0];

    setPlannedNotice({
      courseId: course.id,
      courseName: course.name,
      semester: targetSemester,
      isAdded: !isCurrentlyPlanned,
    });

    setTimeout(() => {
      setPlannedNotice((prev) => (prev?.courseId === course.id ? null : prev));
    }, 7000);
  };

  // Feature 10: Export to CSV (Excel) & Print
  const handleExportCSV = () => {
    const headers = [
      "رمز المقرر",
      "اسم المقرر",
      "الساعات المعتمدة",
      "التصنيف",
      "المتطلب السابق",
      "الحالة الأكاديمية",
      "الموسمية",
      "عدد الشعب المطروحة",
    ];

    const rows = filteredCourses.map((c) => {
      const isCompleted = completedCourses.has(c.id);
      const isPlanned = Boolean(plannedCourses[c.id]);
      const isAvailable = availableCoursesSet.has(c.id);
      const status = isCompleted
        ? "منجزة"
        : isPlanned
          ? `مخططة (${plannedCourses[c.id] || ""})`
          : fulfilledCategoryCourseIds.has(c.id)
            ? "تم استيفاء ساعات التصنيف"
            : isAvailable
              ? "متاحة"
              : "مغلقة بانتظار متطلب";

      const seasonalText =
        c.seasonal === "first"
          ? "فصل أول فقط"
          : c.seasonal === "second"
            ? "فصل ثاني فقط"
            : "الفصلين";

      const secCount = catalogMap[c.id]?.sections?.length || 0;

      return [
        `"${c.id}"`,
        `"${c.name}"`,
        c.credits,
        `"${c.category || "متطلب تخصص"}"`,
        `"${(c.prerequisites || []).join(", ") || "لا يوجد"}"`,
        `"${status}"`,
        `"${seasonalText}"`,
        secCount,
      ];
    });

    const csvContent =
      "\uFEFF" +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `دليل_مواد_${(activeMajorName || "خضوري").replace(/\s+/g, "_")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handlePrint = () => {
    setShowExportMenu(false);
    window.print();
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    courses.forEach((c) => {
      if (c.category) set.add(c.category);
    });
    return Array.from(set);
  }, [courses]);

  const fulfilledCategoryCourseIds = useMemo(() => {
    const requiredCreditsByCategory = new Map(
      Object.entries(categoryRequirements).map(([category, credits]) => [
        normalizeArabicText(category),
        Number(credits),
      ]),
    );
    const completedCreditsByCategory = new Map<string, number>();

    courses.forEach((course) => {
      if (!completedCourses.has(course.id) || !course.category) return;
      const category = normalizeArabicText(course.category);
      completedCreditsByCategory.set(
        category,
        (completedCreditsByCategory.get(category) || 0) + course.credits,
      );
    });

    return new Set(
      courses
        .filter((course) => {
          if (!course.category) return false;
          const category = normalizeArabicText(course.category);
          const requiredCredits = requiredCreditsByCategory.get(category);
          return (
            typeof requiredCredits === "number" &&
            requiredCredits > 0 &&
            (completedCreditsByCategory.get(category) || 0) >= requiredCredits
          );
        })
        .map((course) => course.id),
    );
  }, [categoryRequirements, completedCourses, courses]);

  const remainingCoursesSet = useMemo(
    () =>
      new Set(
        courses
          .filter(
            (course) =>
              !completedCourses.has(course.id) &&
              !fulfilledCategoryCourseIds.has(course.id),
          )
          .map((course) => course.id),
      ),
    [completedCourses, courses, fulfilledCategoryCourseIds],
  );

  const availableCoursesSet = useMemo(() => {
    const set = new Set<string>();
    courses.forEach((c) => {
      if (
        !completedCourses.has(c.id) &&
        !fulfilledCategoryCourseIds.has(c.id) &&
        defaultIsCourseAvailable(c, completedCourses, courses)
      ) {
        set.add(c.id);
      }
    });
    return set;
  }, [courses, completedCourses, fulfilledCategoryCourseIds]);

  // Main Filter Logic (incorporating Search, Status, Category, Doctor, Room, Seasonal)
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const catCourse = catalogMap[c.id];

      // Feature 6: Doctor filter
      if (selectedInstructor !== "all") {
        const hasInst = catCourse?.sections?.some(
          (s) => s.instructor?.trim() === selectedInstructor,
        );
        if (!hasInst) return false;
      }

      // Feature 6: Room filter
      if (selectedRoom !== "all") {
        const hasRoom = catCourse?.sections?.some(
          (s) => s.room?.trim() === selectedRoom,
        );
        if (!hasRoom) return false;
      }

      // Text search (Matches code, name, doctor name, room code)
      if (q) {
        const matchesCode = c.id.toLowerCase().includes(q);
        const matchesName =
          c.name.toLowerCase().includes(q) ||
          normalizeArabicText(c.name).includes(normalizeArabicText(q));
        const matchesInstructorText = catCourse?.sections?.some((s) =>
          s.instructor ? matchDoctorName(s.instructor, q).matches : false,
        );
        const matchesRoomText = catCourse?.sections?.some((s) =>
          s.room?.toLowerCase().includes(q),
        );
        if (
          !matchesCode &&
          !matchesName &&
          !matchesInstructorText &&
          !matchesRoomText
        ) {
          return false;
        }
      }

      // Status filter
      if (statusFilter === "completed" && !completedCourses.has(c.id))
        return false;
      if (statusFilter === "remaining" && !remainingCoursesSet.has(c.id))
        return false;
      if (statusFilter === "available" && !availableCoursesSet.has(c.id))
        return false;
      if (statusFilter === "tracked" && !trackedMap[c.id]) return false;

      // Category filter
      if (categoryFilter !== "all" && c.category !== categoryFilter)
        return false;

      return true;
    });
  }, [
    courses,
    searchQuery,
    statusFilter,
    categoryFilter,
    selectedInstructor,
    selectedRoom,
    completedCourses,
    remainingCoursesSet,
    availableCoursesSet,
    trackedMap,
    catalogMap,
  ]);

  // Feature 4: Year & Semester Grouping Data Structure
  const yearGroups = useMemo(() => {
    const groups: Array<{
      id: string;
      title: string;
      courses: Course[];
      totalCredits: number;
      completedCredits: number;
    }> = [
      {
        id: "year-1",
        title: "السنة الأولى",
        courses: [],
        totalCredits: 0,
        completedCredits: 0,
      },
      {
        id: "year-2",
        title: "السنة الثانية",
        courses: [],
        totalCredits: 0,
        completedCredits: 0,
      },
      {
        id: "year-3",
        title: "السنة الثالثة",
        courses: [],
        totalCredits: 0,
        completedCredits: 0,
      },
      {
        id: "year-4",
        title: "السنة الرابعة",
        courses: [],
        totalCredits: 0,
        completedCredits: 0,
      },
      {
        id: "year-5",
        title: "السنة الخامسة ومشاريع التخرج",
        courses: [],
        totalCredits: 0,
        completedCredits: 0,
      },
      {
        id: "electives-remedial",
        title: "متطلبات اختيارية واستدراكية",
        courses: [],
        totalCredits: 0,
        completedCredits: 0,
      },
    ];

    filteredCourses.forEach((c) => {
      const sem =
        getRecommendedSemesterOfCourse(c) ||
        courseRecommendedSemesters[c.id] ||
        "";
      let targetIndex = 5;
      if (sem.includes("السنة الأولى")) targetIndex = 0;
      else if (sem.includes("السنة الثانية")) targetIndex = 1;
      else if (sem.includes("السنة الثالثة")) targetIndex = 2;
      else if (sem.includes("السنة الرابعة")) targetIndex = 3;
      else if (sem.includes("السنة الخامسة")) targetIndex = 4;
      else if (
        c.category?.includes("استدراكي") ||
        c.category?.includes("اختياري")
      )
        targetIndex = 5;

      groups[targetIndex].courses.push(c);
      groups[targetIndex].totalCredits += c.credits;
      if (completedCourses.has(c.id)) {
        groups[targetIndex].completedCredits += c.credits;
      }
    });

    return groups.filter((g) => g.courses.length > 0);
  }, [filteredCourses, completedCourses]);

  const toggleYearCollapse = (yearId: string) => {
    setCollapsedYears((prev) => ({
      ...prev,
      [yearId]: !prev[yearId],
    }));
  };

  // Virtual Scrolling for 60 FPS performance on large course lists & sections
  const catalogTableRef = useRef<HTMLDivElement>(null);
  const estimateRowHeight = useCallback(
    (index: number) => {
      const c = filteredCourses[index];
      if (!c) return 56;
      return c.id === expandedCourseId ? 420 : 56;
    },
    [filteredCourses, expandedCourseId],
  );

  const { virtualItems, paddingTop, paddingBottom } = useVirtualizer({
    count: filteredCourses.length,
    estimateSize: estimateRowHeight,
    overscan: 6,
    containerRef: catalogTableRef,
    useWindowScroll: true,
  });

  // Render individual course row and its expandable section drawer
  const renderCourseRow = (c: Course, idx: number) => {
    const isCompleted = completedCourses.has(c.id);
    const isPlanned = Boolean(plannedCourses[c.id]);
    const isAvailable = availableCoursesSet.has(c.id);
    const isLocked = !isCompleted && !isAvailable;
    const isExpanded = expandedCourseId === c.id;

    const courseTrackedItems = trackedList.filter((s) => s.courseCode === c.id);
    const hasAllTracked = courseTrackedItems.some((s) => s.sec === "all");

    const catCourse = catalogMap[c.id];
    const sections = catCourse?.sections || [];
    const unlockedCourses = unlockedMap[c.id] || [];

    let statusText = "متاحة";
    let barColor = "bg-[var(--line-control)]";
    if (isCompleted) {
      statusText = "منجزة";
      barColor = "bg-[var(--accent)]";
    } else if (isPlanned) {
      statusText = "مخطط لها";
      barColor = "bg-[var(--accent)]";
    } else if (isLocked) {
      statusText = "مقفلة";
      barColor = "bg-transparent";
    }

    return (
      <React.Fragment key={c.id}>
        <tr
          className={cn(
            "h-12 transition-colors relative hover:bg-[var(--sunken)] cv-auto",
            isCompleted && "bg-[var(--accent-soft)]",
            courseTrackedItems.length > 0 && "bg-amber-500/[0.02]",
            isExpanded && "bg-[var(--sunken)]/70",
          )}
        >
          {/* Checkbox / leading bar column */}
          <td className="py-2 px-3 text-center relative">
            <span
              className={cn(
                "absolute right-0 top-0 bottom-0 w-1 rounded-l-xs",
                barColor,
              )}
            />
            <button
              type="button"
              onClick={() => onToggleComplete(c.id)}
              className={cn(
                "w-4 h-4 rounded-[var(--r-control)] border flex items-center justify-center transition-colors cursor-pointer mx-auto",
                isCompleted
                  ? "bg-[var(--accent)] border-[var(--accent)] text-[var(--text-on-accent)]"
                  : "border-[var(--line-control)] bg-[var(--surface)] hover:border-[var(--text-2)]",
              )}
              title={isCompleted ? "تحديد كغير منجزة" : "تحديد كمنجزة"}
            >
              {isCompleted && <Check size={11} strokeWidth={3} />}
            </button>
          </td>

          {/* Code */}
          <td className="py-2 px-4 text-[13px] font-mono text-[var(--text-2)]">
            <span dir="ltr">{c.id}</span>
          </td>

          {/* Name & Quick Badges */}
          <td className="py-2.5 px-4 text-[14px] font-medium text-[var(--text)]">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setExpandedCourseId(isExpanded ? null : c.id)}
                className="font-bold hover:text-[var(--accent)] transition-colors text-right flex items-center gap-1.5 cursor-pointer"
                title="انقر لتوسيع تفاصيل الشعب والمساقات اللاحقة"
              >
                <span>{c.name}</span>
                {isExpanded ? (
                  <ChevronUp size={15} className="text-[var(--accent)]" />
                ) : (
                  <ChevronDown size={15} className="text-[var(--text-3)]" />
                )}
              </button>

              {/* Feature 3: Seasonal Badge */}
              {c.seasonal && (
                <span
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1",
                    c.seasonal === "first"
                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                      : c.seasonal === "second"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                        : "bg-[var(--sunken)] text-[var(--text-3)]",
                  )}
                  title={
                    c.seasonal === "first"
                      ? "يُطرح هذا المساق في الفصل الأول فقط"
                      : c.seasonal === "second"
                        ? "يُطرح هذا المساق في الفصل الثاني فقط"
                        : "يُطرح في الفصلين"
                  }
                >
                  {c.seasonal === "first" ? (
                    <>
                      <Snowflake size={10} />
                      <span>فصل أول فقط</span>
                    </>
                  ) : c.seasonal === "second" ? (
                    <>
                      <Sun size={10} />
                      <span>فصل ثاني فقط</span>
                    </>
                  ) : (
                    <span>كلا الفصلين</span>
                  )}
                </span>
              )}

              {/* Feature 2: Unlocks Future Courses Badge */}
              {unlockedCourses.length > 0 && (
                <button
                  type="button"
                  onClick={() => setExpandedCourseId(c.id)}
                  className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-semibold inline-flex items-center gap-1 hover:bg-purple-500/20 transition-colors cursor-pointer"
                  title={`هذه المادة تفتح ${unlockedCourses.length} مساقات لاحقة`}
                >
                  <Layers size={10} />
                  <span>تفتح ({unlockedCourses.length})</span>
                </button>
              )}
            </div>

            {/* Distinct Tracked Details */}
            {courseTrackedItems.length > 0 && (
              <div className="mt-1.5">
                {hasAllTracked ? (
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                    <Bell size={11} className="fill-blue-500 text-blue-500" />
                    <span>تتبع عام: جميع الشعب المغلقة للمادة</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-md">
                      <Bell
                        size={11}
                        className="fill-amber-500 text-amber-500"
                      />
                      <span>
                        تتبع شعب محددة ({courseTrackedItems.length} مغلقة):
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {courseTrackedItems.map((item) => (
                        <span
                          key={item.sec}
                          className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 font-mono"
                        >
                          <span>شعبة {item.sec}</span>
                          {item.room && item.room !== "غير محددة" && (
                            <span className="opacity-75">• {item.room}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </td>

          {/* Credits */}
          <td className="py-2 px-4 text-[13px] text-center tabular-nums text-[var(--text-2)] font-semibold">
            {c.credits}
          </td>

          {/* Category */}
          <td className="py-2 px-4 text-[13px] text-[var(--text-2)]">
            {c.category || "متطلب تخصص"}
          </td>

          {/* Prerequisites */}
          <td className="py-2 px-4 text-[13px] text-[var(--text-3)]">
            {c.prerequisites && c.prerequisites.length > 0 ? (
              <span dir="ltr" className="tabular-nums">
                {c.prerequisites.join(", ")}
              </span>
            ) : (
              "—"
            )}
          </td>

          {/* Status Column with Clear Semester Identification */}
          <td className="py-2 px-4 text-[13px]">
            {statusFilter === "tracked" && courseTrackedItems.length > 0 ? (
              <div className="space-y-0.5">
                <span className="font-bold text-amber-600 dark:text-amber-400 text-[12px] flex items-center gap-1">
                  <BellRing size={12} className="animate-pulse" />
                  {hasAllTracked
                    ? "مراقبة كل المغلقة"
                    : `مراقبة (${courseTrackedItems.length}) شعب`}
                </span>
                <div className="text-[11px] text-[var(--text-3)] font-medium">
                  {hasAllTracked
                    ? "أي مقعد يفتح"
                    : courseTrackedItems.map((s) => `شعبة ${s.sec}`).join("، ")}
                </div>
              </div>
            ) : isCompleted ? (
              <span className="font-bold text-emerald-700 dark:text-emerald-400 text-[12px] flex items-center gap-1">
                <Check size={12} strokeWidth={3} />
                <span>منجزة ✔</span>
              </span>
            ) : isPlanned ? (
              <div className="space-y-0.5">
                <span className="font-bold text-sky-700 dark:text-sky-300 text-[12px] flex items-center gap-1">
                  <Circle
                    size={10}
                    strokeWidth={2.5}
                    className="fill-current text-sky-500"
                  />
                  <span>مخطط لها ⭕</span>
                </span>
                <span
                  className="text-[10px] text-[var(--text-3)] block font-medium truncate max-w-[130px]"
                  title={plannedCourses[c.id]}
                >
                  {plannedCourses[c.id] || "في الخطة والجدول"}
                </span>
              </div>
            ) : isAvailable ? (
              <span className="font-medium text-[var(--text-2)] text-[12px] flex items-center gap-1">
                <X size={11} className="text-slate-400" />
                <span>متاحة ✖</span>
              </span>
            ) : (
              <span className="font-medium text-[var(--text-3)] text-[12px] flex items-center gap-1">
                <Lock size={11} className="text-slate-400" />
                <span>مقفلة ✖</span>
              </span>
            )}
          </td>

          {/* Action Column with Explicit Plan Buttons */}
          <td className="py-2 px-4 text-left">
            <div className="flex items-center justify-end gap-1.5">
              {/* Feature 7: Quick GPA Impact Calculator Button */}
              {!isCompleted && isDegreeCreditBearing(c) && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("selection");
                    setGpaModalCourse(c);
                  }}
                  className="min-w-[34px] min-h-[34px] flex items-center justify-center p-1.5 rounded-xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 active:scale-95 transition-all cursor-pointer"
                  title="حساب الأثر المباشر لهذه المادة على معدلك التراكمي"
                >
                  <Calculator size={15} />
                </button>
              )}

              {/* Track Bell Button */}
              <div className="relative inline-block">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("selection");
                    setSelectedCourseForTracking(c);
                  }}
                  className={cn(
                    "min-w-[34px] min-h-[34px] flex items-center justify-center p-1.5 rounded-xl active:scale-95 transition-all cursor-pointer",
                    trackedMap[c.id]
                      ? "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20"
                      : "text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--sunken)]",
                  )}
                  title={
                    trackedMap[c.id]
                      ? hasAllTracked
                        ? "تتابع جميع الشعب المغلقة للمادة (انقر للتعديل)"
                        : `تتابع (${courseTrackedItems.length}) شعب مغلقة`
                      : "تتبع الشعب المغلقة لهذه المادة"
                  }
                >
                  <Bell
                    size={15}
                    className={
                      trackedMap[c.id] ? "fill-amber-500 text-amber-500" : ""
                    }
                  />
                </button>
                {courseTrackedItems.length > 0 && !hasAllTracked && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 text-white rounded-full text-[9px] font-black flex items-center justify-center pointer-events-none">
                    {courseTrackedItems.length}
                  </span>
                )}
              </div>

              {/* Plan Toggle Button with Clear Badge Styling */}
              {!isCompleted && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("selection");
                    handleTogglePlanWithNotice(c);
                  }}
                  className={cn(
                    "min-h-[34px] px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95 flex items-center gap-1",
                    isPlanned
                      ? "bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border border-rose-500/20"
                      : "bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 border border-[var(--accent)]/30",
                  )}
                  title={
                    isPlanned
                      ? `إزالة المساق من خطتك (${plannedCourses[c.id] || "الخطة"})`
                      : "إضافة المساق إلى خطتك الأكاديمية والجدول الأسبوعي"
                  }
                >
                  {isPlanned ? "إزالة من الخطة" : "+ إضافة للخطة"}
                </button>
              )}
            </div>
          </td>
        </tr>

        {/* Feature 1: Inline Collapsible Section Drawer */}
        {isExpanded && (
          <tr className="bg-[var(--sunken)]/60 border-b border-[var(--line-control)]">
            <td colSpan={8} className="p-4 sm:p-5">
              <div className="space-y-4 max-w-5xl mx-auto animate-in fade-in duration-200">
                {/* Header & Seasonal Warning */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line-control)] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[var(--text)]">
                      تفاصيل مساق: {c.name} ({c.id})
                    </span>
                    <span className="text-xs text-[var(--text-3)]">
                      · {c.credits} ساعات معتمدة
                    </span>
                    {isPlanned && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
                        مضاف في خطة {plannedCourses[c.id] || "الفصل الحالي"}
                      </span>
                    )}
                  </div>

                  {c.seasonal && (
                    <div className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25 flex items-center gap-1.5">
                      <AlertCircle size={14} className="text-amber-500" />
                      <span>
                        تنبيه مساق موسمي: يطرح في{" "}
                        {c.seasonal === "first"
                          ? "الفصل الأول فقط"
                          : "الفصل الثاني فقط"}
                        ، تأجيله قد يؤخر خطة التخرج!
                      </span>
                    </div>
                  )}
                </div>

                {/* Section 1: Active Sections List */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <h4 className="text-xs font-bold text-[var(--text)] flex items-center gap-1.5">
                      <Clock size={14} className="text-[var(--accent)]" />
                      <span>
                        الشعب المطروحة للفصل الحالي ({sections.length} شعبة):
                      </span>
                    </h4>
                    {sections.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedCourseForTracking(c)}
                        className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Bell size={12} />
                        <span>تتبع المقاعد المغلقة</span>
                      </button>
                    )}
                  </div>

                  {sections.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {sections.map((sec) => {
                        const isClosed = isSectionClosed(sec.status);
                        const isTracked = isSpecificSectionTracked(
                          c.id,
                          sec.sec,
                        );
                        const capInfo = getSectionCapacityDetails(sec, c.id);
                        const daysText = sec.blocks
                          ?.map((b) => `${b.rawTime || ""}`)
                          .filter(Boolean)
                          .join(" | ");

                        return (
                          <div
                            key={sec.sec}
                            className={cn(
                              "p-3 rounded-xl border transition-all text-xs flex flex-col justify-between gap-2",
                              isTracked
                                ? "border-amber-500/40 bg-amber-500/10 dark:bg-amber-950/20"
                                : isClosed
                                  ? "border-[var(--line-control)] bg-[var(--surface)] opacity-90"
                                  : "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/15",
                            )}
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold text-[13px] text-[var(--text)] font-mono">
                                    شعبة {sec.sec}
                                  </span>
                                  <span
                                    className={cn(
                                      "text-[10px] px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1 border",
                                      isClosed
                                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                                    )}
                                    title={`العدد الحالي: ${capInfo.registered} / السعة: ${capInfo.capacity} طالب (${isClosed ? "ممتلئة بالكامل" : `متبقي ${capInfo.available} مقاعد`})`}
                                  >
                                    <Users size={10} />
                                    <span>
                                      {capInfo.registered}/{capInfo.capacity}{" "}
                                      طالب
                                    </span>
                                  </span>
                                </div>
                                {isClosed ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25 flex items-center gap-1">
                                    <Lock size={10} />
                                    <span>مغلقة</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                                    <CheckCircle2 size={10} />
                                    <span>مفتوحة</span>
                                  </span>
                                )}
                              </div>

                              <div className="space-y-1 text-[11px] text-[var(--text-2)]">
                                <div className="flex items-center justify-between gap-1.5">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <User
                                      size={13}
                                      className="text-[var(--text-3)] shrink-0"
                                    />
                                    <span className="truncate">
                                      الدكتور: {sec.instructor || "غير محدد"}
                                    </span>
                                  </div>
                                  {sec.instructor &&
                                    sec.instructor !== "غير محدد" && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setDoctorScheduleModalName(
                                            sec.instructor!,
                                          )
                                        }
                                        className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 shrink-0 px-1.5 py-0.5 rounded bg-indigo-500/10 cursor-pointer transition-colors"
                                        title={`عرض جدول د. ${sec.instructor} الأسبوعي`}
                                      >
                                        <Calendar size={10} />
                                        <span>جدوله</span>
                                      </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <MapPin
                                    size={13}
                                    className="text-[var(--text-3)] shrink-0"
                                  />
                                  <span className="truncate">
                                    القاعة: {sec.room || "غير محددة"}{" "}
                                    {sec.building ? `(${sec.building})` : ""}
                                  </span>
                                </div>
                                {daysText && (
                                  <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-3)] font-mono">
                                    <Clock size={12} className="shrink-0" />
                                    <span>{daysText}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Feature 9: Smart Section Swap / Tracking Action */}
                            <div className="pt-2 border-t border-[var(--line)] space-y-2">
                              {(() => {
                                const swapAnalysis = analyzeSectionSwap(
                                  c.id,
                                  sec,
                                  activeSemesterSchedule,
                                  coursesById,
                                );

                                if (swapAnalysis.isAlreadyEnrolledInCourse) {
                                  if (swapAnalysis.isSameSection) {
                                    return (
                                      <div className="w-full text-center py-1 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 font-bold text-[10px]">
                                        شعبتك المسجلة حالياً بالجدول ✓
                                      </div>
                                    );
                                  } else if (swapAnalysis.canSwap) {
                                    return (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleSwapSection(c.id, c.name, sec)
                                        }
                                        className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                                        title={`تبديل شعبتك الحالية (شعبة ${swapAnalysis.currentSectionNumber}) بهذه الشعبة دون أي تعارض`}
                                      >
                                        <Sparkles size={12} />
                                        <span>
                                          تبديل فوري متوافق (بدون تعارض)
                                        </span>
                                      </button>
                                    );
                                  } else {
                                    return (
                                      <div
                                        className="w-full px-2 py-1 rounded-md bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300 font-semibold text-[10px] flex items-center justify-center gap-1 text-center"
                                        title={`التبديل يتعارض مع: ${swapAnalysis.conflictingCourseName} (${swapAnalysis.conflictingTime})`}
                                      >
                                        <AlertTriangle
                                          size={11}
                                          className="text-rose-500 shrink-0"
                                        />
                                        <span className="truncate">
                                          يتعارض مع{" "}
                                          {swapAnalysis.conflictingCourseName}
                                        </span>
                                      </div>
                                    );
                                  }
                                }
                                return null;
                              })()}

                              <div className="flex items-center justify-between">
                                {isClosed ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleToggleSpecificSection(c, sec)
                                    }
                                    className={cn(
                                      "px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors flex items-center gap-1 cursor-pointer",
                                      isTracked
                                        ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40"
                                        : "bg-amber-600 hover:bg-amber-700 text-white",
                                    )}
                                  >
                                    <Bell
                                      size={11}
                                      className={
                                        isTracked ? "fill-amber-500" : ""
                                      }
                                    />
                                    <span>
                                      {isTracked
                                        ? "قيد المراقبة"
                                        : "تتبع الشعبة"}
                                    </span>
                                  </button>
                                ) : (
                                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                    جاهزة للتسجيل المباشر
                                  </span>
                                )}

                                {!isCompleted && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleTogglePlanWithNotice(c)
                                    }
                                    className={cn(
                                      "text-[11px] font-bold cursor-pointer hover:underline",
                                      isPlanned
                                        ? "text-rose-600"
                                        : "text-[var(--accent)]",
                                    )}
                                  >
                                    {isPlanned
                                      ? "إزالة من الخطة"
                                      : "+ إضافة للخطة"}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl border border-dashed border-[var(--line-control)] bg-[var(--surface)] text-center text-xs text-[var(--text-3)]">
                      لا تتوفر شعب معلنة لهذا المساق حالياً في جدول الكتالوج.
                    </div>
                  )}
                </div>

                {/* Section 2: Future Unlocked Courses */}
                {unlockedCourses.length > 0 && (
                  <div className="pt-2 border-t border-[var(--line-control)]">
                    <h4 className="text-xs font-bold text-[var(--text)] mb-2 flex items-center gap-1.5">
                      <Layers
                        size={14}
                        className="text-purple-600 dark:text-purple-400"
                      />
                      <span>
                        المساقات اللاحقة التي تعتمد على هذا المساق (
                        {unlockedCourses.length}):
                      </span>
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {unlockedCourses.map((u) => {
                        const uCompleted = completedCourses.has(u.id);
                        const uAvailable = availableCoursesSet.has(u.id);

                        return (
                          <div
                            key={u.id}
                            className={cn(
                              "px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-2",
                              uCompleted
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                                : uAvailable
                                  ? "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300"
                                  : "bg-[var(--surface)] border-[var(--line-control)] text-[var(--text-2)]",
                            )}
                          >
                            <span className="font-bold">{u.name}</span>
                            <span className="text-[10px] font-mono opacity-70">
                              ({u.id})
                            </span>
                            {uCompleted ? (
                              <span className="text-[10px] text-emerald-600 font-bold">
                                منجزة ✓
                              </span>
                            ) : uAvailable ? (
                              <span className="text-[10px] text-blue-600 font-bold">
                                متاحة للتسجيل
                              </span>
                            ) : (
                              <span className="text-[10px] text-[var(--text-3)]">
                                تنتظر متطلبات أخرى
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[var(--bg)]" dir="rtl">
      {/* Scroll Progress Bar (Item 108) */}
      <div
        className="fixed top-0 left-0 right-0 h-[2.5px] z-50 bg-transparent pointer-events-none"
        aria-hidden="true"
      >
        <div
          className="h-full bg-[var(--accent)] transition-all duration-75 ease-out"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Header */}
      <header className="px-4 sm:px-6 py-4 border-b border-[var(--line)] bg-[var(--bg)] shrink-0 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-semibold text-[var(--text)] font-['Noto_Naskh_Arabic',serif] leading-tight">
              دليل المواد
            </h1>
            <p className="text-[13px] text-[var(--text-3)] mt-0.5 flex items-center gap-2 flex-wrap">
              <span>آخر تحديث للشعب: {syncTimeText}</span>
              {isOfflineCatalog() && (
                <span
                  className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--sunken)] border border-[var(--line-control)] text-[var(--text-2)] font-semibold flex items-center gap-1.5"
                  title="البيانات معروضة من التخزين المحلي والذاكرة المؤقتة لعدم توفر اتصال مباشر بالخادم"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                  <span>نسخة محفوظة محلياً (Offline)</span>
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Feature 4: View Mode Switcher */}
            <div className="flex items-center p-0.5 rounded-xl border border-[var(--line-control)] bg-[var(--surface)] text-xs">
              <button
                type="button"
                onClick={() => setViewMode("flat")}
                className={cn(
                  "px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                  viewMode === "flat"
                    ? "bg-[var(--accent)] text-[var(--text-on-accent)] shadow-2xs"
                    : "text-[var(--text-2)] hover:text-[var(--text)]",
                )}
                title="عرض جميع المواد في جدول شامل"
              >
                <List size={13} />
                <span>جدول شامل</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grouped")}
                className={cn(
                  "px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                  viewMode === "grouped"
                    ? "bg-[var(--accent)] text-[var(--text-on-accent)] shadow-2xs"
                    : "text-[var(--text-2)] hover:text-[var(--text)]",
                )}
                title="تجميع المواد حسب السنوات والفصول الدراسية"
              >
                <LayoutGrid size={13} />
                <span>حسب السنوات</span>
              </button>
            </div>

            {/* Major selector */}
            {onSelectMajor && (
              <button
                type="button"
                onClick={onSelectMajor}
                className="min-h-[var(--control-h)] px-3 text-[13px] text-[var(--text-2)] hover:text-[var(--text)] border border-[var(--line-control)] rounded-[var(--r-control)] bg-[var(--surface)] hover:bg-[var(--sunken)] transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>التخصص: {activeMajorName}</span>
                <ChevronDown size={14} className="text-[var(--text-3)]" />
              </button>
            )}

            {/* Feature 10: Export Menu Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExportMenu((prev) => !prev)}
                className="min-h-[var(--control-h)] px-3 text-[13px] font-bold text-[var(--text)] border border-[var(--line-control)] rounded-[var(--r-control)] bg-[var(--surface)] hover:bg-[var(--sunken)] transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Download size={14} className="text-[var(--accent)]" />
                <span>تصدير</span>
                <ChevronDown size={13} />
              </button>

              {showExportMenu && (
                <div className="absolute left-0 mt-1 w-48 bg-[var(--surface)] border border-[var(--line-control)] rounded-xl shadow-xl z-30 py-1.5 text-xs animate-in fade-in duration-150">
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="w-full px-3.5 py-2 text-right hover:bg-[var(--sunken)] text-[var(--text)] font-semibold flex items-center gap-2 cursor-pointer"
                  >
                    <FileText size={14} className="text-emerald-500" />
                    <span>تصدير Excel (CSV)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="w-full px-3.5 py-2 text-right hover:bg-[var(--sunken)] text-[var(--text)] font-semibold flex items-center gap-2 cursor-pointer"
                  >
                    <Printer size={14} className="text-blue-500" />
                    <span>طباعة كشف المواد (PDF)</span>
                  </button>
                </div>
              )}
            </div>

            {/* Search */}
            <div className="relative">
              <Search
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالمادة، الرمز، الدكتور، القاعة..."
                className="w-48 sm:w-64 h-[var(--control-h)] pr-9 pl-3 text-[13px] bg-[var(--surface)] border border-[var(--line-control)] rounded-[var(--r-control)] text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--line)] mt-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-4 text-[13px] font-medium overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={cn(
                "pb-1 border-b-2 transition-colors cursor-pointer shrink-0",
                statusFilter === "all"
                  ? "border-[var(--accent)] text-[var(--text)] font-semibold"
                  : "border-transparent text-[var(--text-2)] hover:text-[var(--text)]",
              )}
            >
              الكل ({courses.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("available")}
              className={cn(
                "pb-1 border-b-2 transition-colors cursor-pointer shrink-0",
                statusFilter === "available"
                  ? "border-[var(--accent)] text-[var(--text)] font-semibold"
                  : "border-transparent text-[var(--text-2)] hover:text-[var(--text)]",
              )}
            >
              المتاحة ({availableCoursesSet.size})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("completed")}
              className={cn(
                "pb-1 border-b-2 transition-colors cursor-pointer shrink-0",
                statusFilter === "completed"
                  ? "border-[var(--accent)] text-[var(--text)] font-semibold"
                  : "border-transparent text-[var(--text-2)] hover:text-[var(--text)]",
              )}
            >
              المنجزة ({completedCourses.size})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("remaining")}
              className={cn(
                "pb-1 border-b-2 transition-colors cursor-pointer shrink-0",
                statusFilter === "remaining"
                  ? "border-[var(--accent)] text-[var(--text)] font-semibold"
                  : "border-transparent text-[var(--text-2)] hover:text-[var(--text)]",
              )}
            >
              المتبقية ({remainingCoursesSet.size})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("tracked")}
              className={cn(
                "pb-1 border-b-2 transition-colors cursor-pointer flex items-center gap-1 shrink-0",
                statusFilter === "tracked"
                  ? "border-amber-500 text-amber-600 dark:text-amber-400 font-semibold"
                  : "border-transparent text-[var(--text-2)] hover:text-[var(--text)]",
              )}
            >
              <Bell
                size={13}
                className={
                  trackedList.length > 0 ? "fill-amber-500 text-amber-500" : ""
                }
              />
              <span>المتتبعة ({trackedList.length})</span>
            </button>
          </div>

          {/* Secondary Filters: Seasonal, Searchable Doctors Combobox, Category */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Feature 3: Seasonal Toggle Filter */}
            {/* Feature 6: Searchable Doctors Combobox (فلتر الدكاترة مع ميزة البحث والتقليص أثناء الكتابة) */}
            {allInstructors.length > 0 && (
              <div className="relative" ref={doctorDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDoctorDropdownOpen((prev) => !prev)}
                  className={cn(
                    "h-[var(--control-h)] px-2.5 text-xs font-semibold rounded-[var(--r-control)] border transition-colors flex items-center gap-1.5 cursor-pointer max-w-[190px]",
                    selectedInstructor !== "all"
                      ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30"
                      : "bg-[var(--surface)] text-[var(--text-2)] border-[var(--line-control)] hover:text-[var(--text)]",
                  )}
                  title="فلترة المواد حسب اسم الدكتور (انقر للبحث بالاسم)"
                >
                  <User
                    size={13}
                    className={
                      selectedInstructor !== "all"
                        ? "text-indigo-600"
                        : "text-[var(--text-3)]"
                    }
                  />
                  <span className="truncate">
                    {selectedInstructor !== "all"
                      ? `د. ${selectedInstructor}`
                      : "جميع الدكاترة"}
                  </span>
                  {selectedInstructor !== "all" ? (
                    <div className="flex items-center gap-1 mr-1">
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setDoctorScheduleModalName(selectedInstructor);
                        }}
                        className="p-1 hover:bg-indigo-500/20 rounded-full cursor-pointer text-indigo-600"
                        title="عرض جدول هذا الدكتور الأسبوعي"
                      >
                        <Calendar size={12} />
                      </span>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedInstructor("all");
                          setDoctorSearchQuery("");
                        }}
                        className="p-0.5 hover:bg-indigo-500/20 rounded-full cursor-pointer text-indigo-600"
                        title="إلغاء تصفية الدكتور"
                      >
                        <X size={11} />
                      </span>
                    </div>
                  ) : (
                    <ChevronDown
                      size={12}
                      className="text-[var(--text-3)] shrink-0"
                    />
                  )}
                </button>

                {/* Dropdown with live search filtering */}
                {isDoctorDropdownOpen && (
                  <div className="absolute left-0 sm:right-0 sm:left-auto mt-1 w-64 bg-[var(--surface)] border border-[var(--line-control)] rounded-xl shadow-2xl z-40 p-2 text-xs animate-in fade-in zoom-in-95 duration-150">
                    <div className="relative mb-2">
                      <Search
                        size={14}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-3)] pointer-events-none"
                      />
                      <input
                        type="text"
                        autoFocus
                        value={doctorSearchQuery}
                        onChange={(e) => setDoctorSearchQuery(e.target.value)}
                        placeholder="ابحث باسم الدكتور (مثلاً: سامر سعيد)..."
                        className="w-full h-8 pr-8 pl-6 text-xs bg-[var(--sunken)] border border-[var(--line-control)] rounded-lg text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                      />
                      {doctorSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setDoctorSearchQuery("")}
                          className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text)]"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-0.5 custom-scrollbar">
                      {/* All Doctors option */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedInstructor("all");
                          setIsDoctorDropdownOpen(false);
                          setDoctorSearchQuery("");
                        }}
                        className={cn(
                          "w-full px-2.5 py-1.5 rounded-lg text-right font-medium flex items-center justify-between transition-colors cursor-pointer",
                          selectedInstructor === "all"
                            ? "bg-[var(--accent)]/15 text-[var(--accent)] font-bold"
                            : "hover:bg-[var(--sunken)] text-[var(--text)]",
                        )}
                      >
                        <span>جميع الدكاترة ({allInstructors.length})</span>
                        {selectedInstructor === "all" && <Check size={13} />}
                      </button>

                      {filteredDoctors.length === 0 ? (
                        <div className="py-4 px-2 text-center text-[11px] text-[var(--text-3)] leading-relaxed">
                          لا يوجد دكتور بهذا الاسم.
                          <br />
                          <span className="text-[10px] opacity-80">
                            نصيحة: جرب كتابة الاسم الأول واسم العائلة فقط
                            (مثلاً: سامر سعيد).
                          </span>
                        </div>
                      ) : (
                        filteredDoctors.map((doc) => {
                          const count = doctorCourseCountMap[doc] || 0;
                          const isSelected = selectedInstructor === doc;

                          return (
                            <button
                              key={doc}
                              type="button"
                              onClick={() => {
                                setSelectedInstructor(doc);
                                setIsDoctorDropdownOpen(false);
                                setDoctorSearchQuery("");
                              }}
                              className={cn(
                                "w-full px-2.5 py-1.5 rounded-lg text-right flex items-center justify-between transition-colors cursor-pointer",
                                isSelected
                                  ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-bold"
                                  : "hover:bg-[var(--sunken)] text-[var(--text)] font-medium",
                              )}
                            >
                              <div className="truncate flex items-center gap-1.5">
                                <User
                                  size={12}
                                  className="text-[var(--text-3)] shrink-0"
                                />
                                <span className="truncate">
                                  {renderHighlightedDoctorName(
                                    doc,
                                    doctorSearchQuery,
                                  )}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 mr-1.5">
                                {count > 0 && (
                                  <span className="text-[10px] text-[var(--text-3)] bg-[var(--sunken)] px-1.5 py-0.2 rounded font-mono">
                                    {count} {count === 1 ? "مادة" : "مواد"}
                                  </span>
                                )}
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDoctorScheduleModalName(doc);
                                    setIsDoctorDropdownOpen(false);
                                  }}
                                  className="p-1 hover:bg-indigo-500/25 text-indigo-600 dark:text-indigo-400 rounded cursor-pointer transition-colors"
                                  title={`عرض جدول د. ${doc} الأسبوعي`}
                                >
                                  <Calendar size={12} />
                                </span>
                                {isSelected && (
                                  <Check
                                    size={12}
                                    className="text-indigo-600 mr-1"
                                  />
                                )}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Category Dropdown */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-[var(--control-h)] px-3 text-[13px] bg-[var(--surface)] border border-[var(--line-control)] rounded-[var(--r-control)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] cursor-pointer"
            >
              <option value="all">جميع التصنيفات</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Semantic Table Container */}
      <div className="flex-1 p-4 sm:p-6 overflow-x-auto">
        {/* Permission Warning Banner if notifications are blocked */}
        {permissionWarning && (
          <div
            role="alert"
            className="mb-4 p-3.5 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between gap-3 animate-in fade-in no-print"
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="text-rose-600 shrink-0" />
              <span className="font-bold">{permissionWarning}</span>
            </div>
            <button
              type="button"
              onClick={() => setPermissionWarning(null)}
              className="px-2.5 py-1 rounded bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition-colors shrink-0 cursor-pointer"
            >
              حسناً
            </button>
          </div>
        )}

        {/* Browser Notifications Live Banner when in "المتتبعة" tab */}
        {statusFilter === "tracked" && (
          <div className="mb-4 p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/5 dark:bg-blue-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs no-print">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Smartphone size={16} />
              </div>
              <div>
                <div className="font-bold text-[var(--text)] flex items-center gap-2">
                  <span>إشعارات المتصفح للشعب المغلقة</span>
                  {isBrowserNotifActive ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle2 size={11} />
                      <span>مفعلة وتصلك فوراً</span>
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-bold flex items-center gap-1">
                      <AlertCircle size={11} />
                      <span>تتطلب إذن المتصفح</span>
                    </span>
                  )}
                </div>
                <p className="text-[var(--text-3)] text-[11px] mt-0.5">
                  التتبع مخصص للشعب المغلقة فقط. ستصلك رسالة فورية مع صوت تنبيه
                  من المتصفح فور فتح أي مقعد شاغر.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isBrowserNotifActive ? (
                <button
                  type="button"
                  onClick={handleTestBrowserNotification}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <Volume2 size={13} />
                  <span>اختبار إشعار المتصفح الآن</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleEnableWebPush}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <Bell size={13} />
                  <span>تفعيل إشعارات المتصفح الآن</span>
                </button>
              )}
            </div>
          </div>
        )}

        {webPushNotice && (
          <div className="mb-3 p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-700 dark:text-purple-300 text-xs font-bold flex items-center gap-2 animate-in fade-in no-print">
            <CheckCircle2 size={14} />
            <span>{webPushNotice}</span>
          </div>
        )}

        {/* Feature 4: View Mode Rendering (Grouped by Year vs Flat Table) */}
        {viewMode === "grouped" ? (
          <div className="space-y-6">
            {yearGroups.map((group) => {
              const isCollapsed = Boolean(collapsedYears[group.id]);
              const pct =
                group.totalCredits > 0
                  ? Math.round(
                      (group.completedCredits / group.totalCredits) * 100,
                    )
                  : 0;

              return (
                <div
                  key={group.id}
                  className="border border-[var(--line)] rounded-[var(--r-surface)] overflow-hidden bg-[var(--surface)] shadow-xs"
                >
                  {/* Group Header Card */}
                  <div
                    onClick={() => toggleYearCollapse(group.id)}
                    className="p-4 bg-[var(--sunken)] flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line-control)] cursor-pointer select-none hover:bg-[var(--sunken)]/80 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center font-bold text-sm">
                        <Calendar size={16} />
                      </div>
                      <div>
                        <h3 className="font-bold text-[15px] text-[var(--text)] flex items-center gap-2">
                          <span>{group.title}</span>
                          <span className="text-xs text-[var(--text-3)] font-normal">
                            ({group.courses.length} مساقات)
                          </span>
                        </h3>
                        <div className="text-xs text-[var(--text-3)] flex items-center gap-2 mt-0.5">
                          <span>
                            {group.completedCredits} من أصل {group.totalCredits}{" "}
                            ساعة منجزة
                          </span>
                          <span>•</span>
                          <span
                            className={
                              pct === 100
                                ? "text-emerald-600 font-bold"
                                : "font-medium"
                            }
                          >
                            {pct}% مكتمل
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Mini progress bar */}
                      <div className="w-24 sm:w-36 h-2 rounded-full bg-[var(--line-control)] overflow-hidden">
                        <div
                          className="h-full bg-[var(--accent)] rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <button
                        type="button"
                        className="text-[var(--text-3)] p-1 rounded hover:text-[var(--text)] transition-colors"
                      >
                        {isCollapsed ? (
                          <ChevronDown size={18} />
                        ) : (
                          <ChevronUp size={18} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Group Table */}
                  {!isCollapsed && (
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="border-b border-[var(--line-control)] bg-[var(--surface)] text-[12px] font-semibold text-[var(--text-3)]">
                          <th
                            scope="col"
                            className="py-2 px-3 w-12 text-center"
                          >
                            #
                          </th>
                          <th scope="col" className="py-2 px-4 w-28">
                            الرمز
                          </th>
                          <th scope="col" className="py-2 px-4 min-w-[240px]">
                            اسم المقرر
                          </th>
                          <th
                            scope="col"
                            className="py-2 px-4 w-20 text-center"
                          >
                            الساعات
                          </th>
                          <th scope="col" className="py-2 px-4 w-44">
                            التصنيف
                          </th>
                          <th scope="col" className="py-2 px-4 min-w-[160px]">
                            المتطلب السابق
                          </th>
                          <th scope="col" className="py-2 px-4 w-32">
                            الحالة
                          </th>
                          <th scope="col" className="py-2 px-4 w-28 text-left">
                            إجراء
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--line)]">
                        {group.courses.map((c, idx) => renderCourseRow(c, idx))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            ref={catalogTableRef}
            className="border border-[var(--line)] rounded-[var(--r-surface)] overflow-hidden bg-[var(--surface)]"
          >
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-[var(--line-control)] bg-[var(--sunken)] text-[13px] font-semibold text-[var(--text-2)]">
                  <th scope="col" className="py-3 px-4 w-12 text-center">
                    #
                  </th>
                  <th scope="col" className="py-3 px-4 w-28">
                    الرمز
                  </th>
                  <th scope="col" className="py-3 px-4 min-w-[240px]">
                    اسم المقرر والشعب المتبوعة
                  </th>
                  <th scope="col" className="py-3 px-4 w-20 text-center">
                    الساعات
                  </th>
                  <th scope="col" className="py-3 px-4 w-44">
                    التصنيف
                  </th>
                  <th scope="col" className="py-3 px-4 min-w-[160px]">
                    المتطلب السابق
                  </th>
                  <th scope="col" className="py-3 px-4 w-32">
                    الحالة
                  </th>
                  <th scope="col" className="py-3 px-4 w-28 text-left">
                    إجراء
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {filteredCourses.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-12 text-center text-[15px] text-[var(--text-2)]"
                    >
                      {statusFilter === "tracked"
                        ? "لا تتابع أي شعب مغلقة حالياً. انقر على أيقونة الجرس بجانب أي مادة لمراقبة شعبها المغلقة."
                        : "لا توجد مواد تطابق معايير التصفية المحددة."}
                    </td>
                  </tr>
                ) : (
                  <>
                    {paddingTop > 0 && (
                      <tr
                        style={{ height: `${paddingTop}px` }}
                        aria-hidden="true"
                      >
                        <td
                          colSpan={8}
                          className="p-0 border-0 pointer-events-none"
                        />
                      </tr>
                    )}
                    {virtualItems.map(({ index }) => {
                      const c = filteredCourses[index];
                      if (!c) return null;
                      return renderCourseRow(c, index);
                    })}
                    {paddingBottom > 0 && (
                      <tr
                        style={{ height: `${paddingBottom}px` }}
                        aria-hidden="true"
                      >
                        <td
                          colSpan={8}
                          className="p-0 border-0 pointer-events-none"
                        />
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating Planned Course Feedback Toast */}
      {plannedNotice && (
        <div
          role="status"
          className="fixed bottom-6 right-6 left-6 sm:left-auto sm:max-w-md z-50 p-4 rounded-2xl bg-[var(--surface)] border border-[var(--line-control)] shadow-2xl text-xs space-y-2.5 animate-in slide-in-from-bottom-5 duration-200 no-print"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              {plannedNotice.isAdded ? (
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={18} />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Trash2 size={18} />
                </div>
              )}
              <div>
                <span className="font-extrabold text-[13px] text-[var(--text)] block">
                  {plannedNotice.isAdded
                    ? "تمت إضافة المادة إلى الخطة والجدول"
                    : "تمت إزالة المادة من الخطة"}
                </span>
                <span className="text-[11px] text-[var(--text-3)] font-mono">
                  {plannedNotice.courseName}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPlannedNotice(null)}
              className="text-[var(--text-3)] hover:text-[var(--text)] p-1 rounded cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          {plannedNotice.isAdded && (
            <div className="space-y-2 pt-1 border-t border-[var(--line)]">
              <p className="text-[11px] text-[var(--text-2)] leading-relaxed">
                أُضيفت المادة إلى{" "}
                <span className="font-bold text-[var(--text)] font-sans">
                  «{plannedNotice.semester}»
                </span>
                . يمكنك الآن رؤيتها في الخطة الأكاديمية أو توليد واختيار شعبها
                في الجدول الأسبوعي.
              </p>
              {onNavigate && (
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate("schedule");
                      setPlannedNotice(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-[var(--text-on-accent)] font-bold text-[11px] flex items-center gap-1 cursor-pointer hover:opacity-90 shadow-2xs"
                  >
                    <span>الذهاب للجدول الأسبوعي</span>
                    <ExternalLink size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate("plan");
                      setPlannedNotice(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[var(--sunken)] border border-[var(--line-control)] text-[var(--text)] font-bold text-[11px] flex items-center gap-1 cursor-pointer hover:bg-[var(--line-control)]"
                  >
                    <span>عرض في الخطة</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Feature 7: Quick GPA Impact Interactive Modal */}
      {gpaModalCourse && (
        <div
          dir="rtl"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            className="w-full max-w-md bg-[var(--surface)] border border-[var(--line-control)] rounded-2xl shadow-2xl overflow-hidden text-[var(--text)] animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            <div className="px-5 py-4 border-b border-[var(--line)] flex items-center justify-between bg-[var(--sunken)]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Calculator size={18} />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[var(--text)]">
                    حاسبة أثر المادة على المعدل
                  </h3>
                  <p className="text-[12px] text-[var(--text-3)] font-mono">
                    {gpaModalCourse.name} ({gpaModalCourse.credits} ساعات
                    معتمدة)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGpaModalCourse(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Current Standing Card */}
              <div className="p-3 bg-[var(--sunken)] rounded-xl border border-[var(--line-control)] flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-[var(--text-3)] block">
                    معدلك التراكمي الحالي
                  </span>
                  <span className="text-base font-extrabold text-[var(--text)] font-mono">
                    {currentComputedGpa.toFixed(1)}%
                  </span>
                </div>
                <div className="text-left">
                  <span className="text-[11px] text-[var(--text-3)] block">
                    الساعات المقطوعة
                  </span>
                  <span className="text-base font-extrabold text-[var(--text)] font-mono">
                    {currentDegreeCredits} ساعة
                  </span>
                </div>
              </div>

              {/* Instant Estimates List */}
              <div className="space-y-2">
                <label className="font-bold text-[var(--text)] block text-[13px]">
                  التوقعات السريعة للمعدل التراكمي الجديد:
                </label>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {/* Grade 95 */}
                  {(() => {
                    const { newGpa, diff } = calculateGpaImpact(
                      gpaModalCourse.credits,
                      95,
                    );
                    return (
                      <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                        <span className="text-[10px] text-emerald-600 font-bold block">
                          علامة 95 (امتياز)
                        </span>
                        <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 font-mono">
                          {newGpa}%
                        </span>
                        <span className="text-[10px] text-emerald-600 font-mono font-bold block">
                          {diff >= 0 ? `+${diff}` : diff}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Grade 85 */}
                  {(() => {
                    const { newGpa, diff } = calculateGpaImpact(
                      gpaModalCourse.credits,
                      85,
                    );
                    return (
                      <div className="p-2.5 rounded-xl border border-blue-500/30 bg-blue-500/5">
                        <span className="text-[10px] text-blue-600 font-bold block">
                          علامة 85 (جيد جداً)
                        </span>
                        <span className="text-sm font-black text-blue-700 dark:text-blue-400 font-mono">
                          {newGpa}%
                        </span>
                        <span className="text-[10px] text-blue-600 font-mono font-bold block">
                          {diff >= 0 ? `+${diff}` : diff}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Grade 75 */}
                  {(() => {
                    const { newGpa, diff } = calculateGpaImpact(
                      gpaModalCourse.credits,
                      75,
                    );
                    return (
                      <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5">
                        <span className="text-[10px] text-amber-600 font-bold block">
                          علامة 75 (جيد)
                        </span>
                        <span className="text-sm font-black text-amber-700 dark:text-amber-400 font-mono">
                          {newGpa}%
                        </span>
                        <span className="text-[10px] text-amber-600 font-mono font-bold block">
                          {diff >= 0 ? `+${diff}` : diff}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Interactive Custom Grade Slider */}
              <div className="p-3.5 bg-[var(--surface)] border border-[var(--line-control)] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[var(--text)]">
                    جرّب علامة متوقعة أخرى:
                  </span>
                  <span className="font-black text-indigo-600 dark:text-indigo-400 text-sm font-mono">
                    {customGrade}%
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={customGrade}
                  onChange={(e) => setCustomGrade(parseInt(e.target.value, 10))}
                  className="w-full accent-[var(--accent)] cursor-pointer"
                />
                {(() => {
                  const { newGpa, diff } = calculateGpaImpact(
                    gpaModalCourse.credits,
                    customGrade,
                  );
                  return (
                    <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between text-xs">
                      <span className="text-[var(--text-2)]">
                        المعدل التراكمي المتوقع:
                      </span>
                      <span className="font-bold text-[var(--text)] font-mono">
                        {newGpa}%{" "}
                        <span
                          className={
                            diff >= 0 ? "text-emerald-600" : "text-rose-600"
                          }
                        >
                          ({diff >= 0 ? `+${diff}` : diff})
                        </span>
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="px-5 py-3 border-t border-[var(--line)] bg-[var(--sunken)] flex justify-end">
              <button
                type="button"
                onClick={() => setGpaModalCourse(null)}
                className="px-4 py-1.5 rounded-[var(--r-control)] text-xs font-bold bg-[var(--accent)] text-[var(--text-on-accent)] cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Select Section for Tracking (تتبع الشعب المغلقة فقط) */}
      {selectedCourseForTracking && (
        <div
          dir="rtl"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            className="w-full max-w-lg bg-[var(--surface)] border border-[var(--line-control)] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[var(--text)] animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-[var(--line)] flex items-center justify-between bg-[var(--sunken)]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center">
                  <Bell size={18} className="fill-amber-500" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[var(--text)]">
                    تتبع الشعب المغلقة: {selectedCourseForTracking.name}
                  </h3>
                  <p className="text-[12px] text-[var(--text-3)] font-mono">
                    الرمز: {selectedCourseForTracking.id} · التتبع مخصص للشعب
                    المغلقة فقط
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCourseForTracking(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 max-h-[65vh] overflow-y-auto space-y-4 custom-scrollbar">
              {permissionWarning && (
                <div
                  role="alert"
                  className="p-3 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between gap-2"
                >
                  <span className="font-bold">{permissionWarning}</span>
                  <button
                    type="button"
                    onClick={() => setPermissionWarning(null)}
                    className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-[11px]"
                  >
                    إغلاق
                  </button>
                </div>
              )}

              {/* Master Option: Track All Closed Sections */}
              <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-bold text-xs text-[var(--text)] flex items-center gap-1.5">
                    <Sparkles size={14} className="text-amber-500" />
                    <span>تتبع تلقائي لجميع شعب المادة المغلقة</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-3)]">
                    ستصلك رسالة فورية عبر المتصفح فور فتح أي شعبة مغلقة لهذا
                    المساق.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleToggleAllClosedSections(selectedCourseForTracking)
                  }
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer",
                    isAllSectionsTracked(selectedCourseForTracking.id)
                      ? "bg-amber-500 text-white shadow-2xs"
                      : "bg-[var(--surface)] border border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10",
                  )}
                >
                  <Bell
                    size={13}
                    className={
                      isAllSectionsTracked(selectedCourseForTracking.id)
                        ? "fill-white"
                        : ""
                    }
                  />
                  <span>
                    {isAllSectionsTracked(selectedCourseForTracking.id)
                      ? "إلغاء تتبع الكل"
                      : "تتبع كل المغلقة"}
                  </span>
                </button>
              </div>

              {/* Sections Breakdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[var(--text-2)] font-semibold px-1">
                  <span>
                    الشعب المسجلة في الجدول (حدد شعبة مغلقة لمتابعتها):
                  </span>
                  {isLoadingSections && (
                    <span className="text-[var(--text-3)]">جاري الفحص...</span>
                  )}
                </div>

                {isLoadingSections ? (
                  <div className="py-8 text-center text-xs text-[var(--text-3)]">
                    جاري تحميل شعب المساق من الكتالوج...
                  </div>
                ) : catalogCourseForTracking?.sections &&
                  catalogCourseForTracking.sections.length > 0 ? (
                  <div className="space-y-2">
                    {catalogCourseForTracking.sections.map((sec) => {
                      const isClosed = isSectionClosed(sec.status);
                      const isTracked = isSpecificSectionTracked(
                        selectedCourseForTracking.id,
                        sec.sec,
                      );
                      const capInfo = getSectionCapacityDetails(
                        sec,
                        selectedCourseForTracking.id,
                      );
                      const daysText = sec.blocks
                        ?.map((b) => `${b.rawTime || ""}`)
                        .filter(Boolean)
                        .join(" | ");

                      return (
                        <div
                          key={sec.sec}
                          className={cn(
                            "p-3 rounded-xl border text-xs flex items-center justify-between gap-3 transition-colors",
                            isTracked
                              ? "border-amber-500/50 bg-amber-500/10 dark:bg-amber-950/25"
                              : isClosed
                                ? "border-[var(--line)] bg-[var(--sunken)]/30 hover:bg-[var(--sunken)]/60"
                                : "border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/10 opacity-90",
                          )}
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-[13px] text-[var(--text)]">
                                شعبة {sec.sec}
                              </span>
                              {isClosed ? (
                                <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-rose-500/15 text-rose-600">
                                  مغلقة
                                </span>
                              ) : (
                                <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-emerald-500/15 text-emerald-600">
                                  مفتوحة (بها مقاعد)
                                </span>
                              )}
                              <span className="text-[11px] text-[var(--text-3)]">
                                الدكتور: {sec.instructor || "غير محدد"}
                              </span>
                            </div>

                            {/* Section Enrolled Student Count & Capacity (User Request 1) */}
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "text-[11px] px-2 py-0.5 rounded-md font-bold flex items-center gap-1.5 border",
                                  isClosed
                                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                                )}
                              >
                                <Users size={12} />
                                <span>
                                  العدد الحالي:{" "}
                                  <strong>{capInfo.registered}</strong> /{" "}
                                  {capInfo.capacity} طالب
                                </span>
                                <span className="text-[10px] font-normal opacity-85">
                                  (
                                  {isClosed
                                    ? "ممتلئة بالكامل - لا مقاعد شاغرة"
                                    : `متبقي ${capInfo.available} مقاعد شاغرة`}
                                  )
                                </span>
                              </span>
                            </div>

                            <div className="text-[11px] text-[var(--text-3)] flex items-center gap-2">
                              <span>القاعة: {sec.room || "غير محددة"}</span>
                              {daysText && <span>• {daysText}</span>}
                            </div>
                          </div>

                          {isClosed ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleSpecificSection(
                                  selectedCourseForTracking,
                                  sec,
                                )
                              }
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1",
                                isTracked
                                  ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40"
                                  : "bg-amber-600 hover:bg-amber-700 text-white shadow-2xs",
                              )}
                            >
                              {isTracked ? (
                                <>
                                  <CheckCheck
                                    size={13}
                                    className="text-amber-500"
                                  />
                                  <span>قيد المراقبة</span>
                                </>
                              ) : (
                                <>
                                  <Bell size={13} />
                                  <span>تتبع هذه الشعبة</span>
                                </>
                              )}
                            </button>
                          ) : (
                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-2.5 py-1 rounded-lg shrink-0">
                              مفتوحة للتسجيل المباشر
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-[var(--line)] text-center text-[12px] text-[var(--text-3)]">
                    <p>لا تتوفر شعب مسجلة لهذا المساق في الكتالوج الحالي.</p>
                  </div>
                )}
              </div>

              {/* Notification Channel Quick Reminder */}
              <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between text-[11px] text-[var(--text-3)]">
                <span>تصلك التنبيهات من المتصفح مباشرة عند فتح أي مقعد</span>
                <button
                  type="button"
                  onClick={handleTestBrowserNotification}
                  className="font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Volume2 size={11} />
                  <span>اختبار وصول إشعار الآن</span>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-[var(--line)] bg-[var(--sunken)] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedCourseForTracking(null)}
                className="px-4 py-1.5 rounded-[var(--r-control)] text-[12px] font-semibold bg-[var(--accent)] text-[var(--text-on-accent)] cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 9: Smart Section Swap Toast */}
      {swapNotice && (
        <div
          role="status"
          className="fixed bottom-6 right-6 left-6 sm:left-auto sm:max-w-md z-50 p-4 rounded-2xl bg-emerald-950/95 border border-emerald-500/40 text-emerald-100 shadow-2xl text-xs space-y-2 animate-in slide-in-from-bottom-5 duration-200 no-print"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span className="font-bold text-xs">{swapNotice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setSwapNotice(null)}
              className="p-1 text-emerald-400 hover:text-white rounded cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
          {onNavigate && (
            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  onNavigate("schedule");
                  setSwapNotice(null);
                }}
                className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
              >
                <span>معاينة في الجدول الأسبوعي</span>
                <ExternalLink size={10} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Feature 1: Doctor Weekly Schedule Modal */}
      <DoctorScheduleModal
        isOpen={Boolean(doctorScheduleModalName)}
        onClose={() => setDoctorScheduleModalName(null)}
        doctorName={doctorScheduleModalName}
        catalogCourses={catalogMap}
        courses={courses}
        onSelectDoctorFilter={(doc) => {
          setSelectedInstructor(doc);
          setIsDoctorDropdownOpen(false);
        }}
      />
    </div>
  );
};

export default CoursesPage;
