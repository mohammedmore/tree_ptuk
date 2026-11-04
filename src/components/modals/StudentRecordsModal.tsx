import React, { useState } from "react";
import {
  X,
  CreditCard,
  History,
  GraduationCap,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  ArrowUpRight,
  Calculator,
  ExternalLink,
  Eye,
  EyeOff,
  Award,
  Sparkles,
  ShieldCheck,
  Check,
} from "lucide-react";
import { cn } from "../../utils";
import { usePrivacyMask } from "../../hooks/usePrivacyMask";
import {
  getOfficialTuitionRate,
  OFFICIAL_FIXED_FEES,
} from "../../services/tuitionFeesService";
import type {
  StudentSyncProfile,
  AcademicTransaction,
  FinancialRecord,
  ExemptionExamRecord,
} from "../../services/studentService";

interface StudentRecordsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: StudentSyncProfile | null;
  onOpenSyncModal?: () => void;
  onApplyExemption?: (courseCode: string, shouldExempt: boolean) => void;
  completedCourseIds?: Set<string>;
}

export const StudentRecordsModal: React.FC<StudentRecordsModalProps> = ({
  isOpen,
  onClose,
  profile,
  onOpenSyncModal,
  onApplyExemption,
  completedCourseIds,
}) => {
  const [activeTab, setActiveTab] = useState<
    "financial" | "exemptions" | "transactions" | "semesters"
  >("financial");
  const { isPrivacyMasked, togglePrivacyMask } = usePrivacyMask();

  // Official Study Fees Calculator (Accredited by PTUK Admission & Registration)
  const defaultMajorRate = React.useMemo(() => {
    return getOfficialTuitionRate(profile?.majorName);
  }, [profile?.majorName]);

  const [calcCredits, setCalcCredits] = useState<number>(() => {
    return profile?.registeredCourseIds?.length
      ? profile.registeredCourseIds.length * 3
      : 16;
  });
  const [hourlyRate, setHourlyRate] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("ptuk_hourly_rate");
      if (saved) return Number(saved);
    } catch {}
    return defaultMajorRate.hourlyRateJOD;
  });
  const fixedRegistrationFees = OFFICIAL_FIXED_FEES.registrationFeeJOD; // 25 JOD
  const studentUnionFee = OFFICIAL_FIXED_FEES.studentUnionFeeJOD; // 1 JOD
  const totalFixedFees = fixedRegistrationFees + studentUnionFee; // 26 JOD
  const exchangeRate = OFFICIAL_FIXED_FEES.defaultExchangeRateILS;

  const totalCreditsCostJOD = calcCredits * hourlyRate;
  const grandTotalJOD = totalCreditsCostJOD + totalFixedFees;
  const grandTotalILS = Math.round(grandTotalJOD * exchangeRate);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const financial: FinancialRecord = profile?.financial || {
    balance: profile?.financialBalance || "0 دائن",
    currency: "دينار أردني (JOD)",
    totalDebit: 0,
    totalCredit: 0,
    payments: [],
  };

  const transactions: AcademicTransaction[] = profile?.transactions || [];

  const semesters = profile?.semesters || [];

  const exemptionExams: ExemptionExamRecord[] = React.useMemo(() => {
    const list = [...(profile?.exemptionExams || [])];
    if (
      list.some((e) => e.code === "15200106") &&
      !list.some((e) => e.code === "15200099")
    ) {
      list.unshift({
        code: "15200099",
        name: "إنجليزي إستدراكي",
        examName: "امتحان مستوى انجليزي",
        status: "معفى/ناجح",
        isPassed: true,
      });
    }
    return list;
  }, [profile?.exemptionExams]);

  const englishExam = exemptionExams.find(
    (e) =>
      e.code === "15200106" ||
      e.code === "15200099" ||
      /انجليزي|إنجليزية|English/i.test(e.examName || ""),
  );

  const englishGrade =
    typeof englishExam?.grade === "number" ? englishExam.grade : null;
  const isEnglishHighScore = englishGrade !== null && englishGrade >= 80;
  const isEnglish1ExemptedInPlan = Boolean(completedCourseIds?.has("15200106"));

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] bg-[var(--surface)] border border-[var(--line-control)] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[var(--text)]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--line)] flex items-center justify-between bg-[var(--sunken)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center">
              <CreditCard size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[18px] font-bold">
                  السجل المالي والأكاديمي
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] font-semibold">
                  بوابة خضوري Edugate
                </span>
              </div>
              <p className="text-[13px] text-[var(--text-3)] mt-0.5">
                <span
                  className={cn(
                    "privacy-sensitive transition-all duration-200",
                    isPrivacyMasked && "blur-md select-none",
                  )}
                >
                  {profile?.studentName || "طالب جامعة فلسطين التقنية"}
                </span>{" "}
                •{" "}
                <span
                  dir="ltr"
                  className={cn(
                    "tabular-nums privacy-sensitive transition-all duration-200",
                    isPrivacyMasked && "blur-md select-none",
                  )}
                >
                  {profile?.studentId || "—"}
                </span>{" "}
                • {profile?.majorName || "الخطة الدراسية الجامعية"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePrivacyMask}
              className={cn(
                "px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all",
                isPrivacyMasked
                  ? "bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400"
                  : "border-[var(--line-control)] bg-[var(--surface)] text-[var(--text-2)] hover:bg-[var(--sunken)]",
              )}
              title="وضع الخصوصية: تمويه المعلومات والبيانات الشخصية والمالية"
            >
              {isPrivacyMasked ? <EyeOff size={15} /> : <Eye size={15} />}
              <span className="hidden sm:inline">
                {isPrivacyMasked ? "إلغاء تمويه البيانات" : "تمويه البيانات"}
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
              aria-label="إغلاق النافذة"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 border-b border-[var(--line)] bg-[var(--surface)] flex items-center gap-4 sm:gap-6 text-[14px] overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("financial")}
            className={cn(
              "py-3 border-b-2 font-medium flex items-center gap-2 transition-colors cursor-pointer shrink-0",
              activeTab === "financial"
                ? "border-[var(--accent)] text-[var(--accent)] font-semibold"
                : "border-transparent text-[var(--text-2)] hover:text-[var(--text)]",
            )}
          >
            <DollarSign size={16} />
            <span>السجل المالي والرسوم</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("exemptions")}
            className={cn(
              "py-3 border-b-2 font-medium flex items-center gap-2 transition-colors cursor-pointer shrink-0",
              activeTab === "exemptions"
                ? "border-[var(--accent)] text-[var(--accent)] font-semibold"
                : "border-transparent text-[var(--text-2)] hover:text-[var(--text)]",
            )}
          >
            <Award size={16} />
            <span>امتحانات المستوى والإعفاءات ({exemptionExams.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("transactions")}
            className={cn(
              "py-3 border-b-2 font-medium flex items-center gap-2 transition-colors cursor-pointer shrink-0",
              activeTab === "transactions"
                ? "border-[var(--accent)] text-[var(--accent)] font-semibold"
                : "border-transparent text-[var(--text-2)] hover:text-[var(--text)]",
            )}
          >
            <History size={16} />
            <span>الحركات الأكاديمية ({transactions.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("semesters")}
            className={cn(
              "py-3 border-b-2 font-medium flex items-center gap-2 transition-colors cursor-pointer shrink-0",
              activeTab === "semesters"
                ? "border-[var(--accent)] text-[var(--accent)] font-semibold"
                : "border-transparent text-[var(--text-2)] hover:text-[var(--text)]",
            )}
          >
            <GraduationCap size={16} />
            <span>الفصول السابقة ({semesters.length})</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {activeTab === "financial" && (
            <div className="space-y-6">
              {/* Stats overview */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[var(--sunken)] border border-[var(--line)]">
                  <div className="text-[12px] text-[var(--text-3)] font-medium mb-1">
                    الرصيد المالي الحالي
                  </div>
                  <div
                    className={cn(
                      "text-[22px] font-black text-emerald-600 tabular-nums privacy-sensitive transition-all duration-200",
                      isPrivacyMasked && "blur-md select-none",
                    )}
                  >
                    {financial.balance || profile?.financialBalance || "0 دائن"}
                  </div>
                  <div className="text-[11px] text-[var(--text-3)] mt-1">
                    العملة: {financial.currency || "دينار أردني (JOD)"}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[var(--sunken)] border border-[var(--line)]">
                  <div className="text-[12px] text-[var(--text-3)] font-medium mb-1">
                    المرشد الأكاديمي
                  </div>
                  <div
                    className={cn(
                      "text-[16px] font-bold text-[var(--text)] truncate privacy-sensitive transition-all duration-200",
                      isPrivacyMasked && "blur-md select-none",
                    )}
                  >
                    {profile?.academicAdvisor || "عمادة الكلية"}
                  </div>
                  <div className="text-[11px] text-[var(--text-3)] mt-1">
                    الحالة: {profile?.academicStatus || "منتظم"}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[var(--sunken)] border border-[var(--line)]">
                  <div className="text-[12px] text-[var(--text-3)] font-medium mb-1">
                    حالة الإنذار الأكاديمي
                  </div>
                  <div
                    className={cn(
                      "text-[16px] font-bold privacy-sensitive transition-all duration-200",
                      isPrivacyMasked && "blur-md select-none",
                      profile?.academicWarning &&
                        profile.academicWarning !== "لا يوجد"
                        ? "text-red-500"
                        : "text-emerald-600",
                    )}
                  >
                    {profile?.academicWarning || "لا يوجد إنذارات"}
                  </div>
                  <div
                    className={cn(
                      "text-[11px] text-[var(--text-3)] mt-1 privacy-sensitive transition-all duration-200",
                      isPrivacyMasked && "blur-md select-none",
                    )}
                  >
                    المعدل: %{profile?.gpa?.toFixed(1) || "0.0"}
                  </div>
                </div>
              </div>

              {/* Payments & Receipts */}
              <div>
                <h3 className="text-[15px] font-bold mb-3 flex items-center gap-2">
                  <FileText size={16} className="text-[var(--accent)]" />
                  <span>دفعات الرسوم والوصولات المالية المسجلة</span>
                </h3>

                {financial.payments && financial.payments.length > 0 ? (
                  <div className="border border-[var(--line)] rounded-xl overflow-hidden">
                    <table className="w-full text-[13px] text-right">
                      <thead className="bg-[var(--sunken)] border-b border-[var(--line)] text-[var(--text-2)] font-semibold">
                        <tr>
                          <th className="py-2.5 px-4">رقم الوصل</th>
                          <th className="py-2.5 px-4">التاريخ</th>
                          <th className="py-2.5 px-4">المبلغ</th>
                          <th className="py-2.5 px-4">البيان / التفاصيل</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--line)]">
                        {financial.payments.map((p, idx) => (
                          <tr key={idx} className="hover:bg-[var(--sunken)]/50">
                            <td className="py-3 px-4 font-mono font-medium text-[var(--text-3)]">
                              <span dir="ltr">{p.receiptNo}</span>
                            </td>
                            <td className="py-3 px-4 tabular-nums text-[var(--text-2)]">
                              {p.date}
                            </td>
                            <td
                              className={cn(
                                "py-3 px-4 font-bold text-emerald-600 tabular-nums privacy-sensitive transition-all duration-200",
                                isPrivacyMasked && "blur-md select-none",
                              )}
                            >
                              {p.amount} د.أ
                            </td>
                            <td className="py-3 px-4 text-[var(--text)]">
                              {p.description}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center border border-dashed border-[var(--line)] rounded-xl bg-[var(--sunken)]/40 text-[var(--text-3)]">
                    <p className="text-[14px]">
                      لا توجد وصولات مالية مسجلة حالياً للفصل الجاري.
                    </p>
                  </div>
                )}
              </div>

              {/* PTUK Official Tuition & Study Fees Estimator */}
              <div className="p-5 rounded-2xl bg-[var(--sunken)] border border-[var(--line-control)] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
                  <div className="flex items-center gap-2">
                    <Calculator size={18} className="text-[var(--accent)]" />
                    <h3 className="text-[15px] font-bold text-[var(--text)]">
                      حاسبة الأقساط والرسوم الدراسية المتوقعة
                    </h3>
                  </div>
                  <a
                    href="https://edugate.ptuk.edu.ps/student/studyFees"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] text-[var(--accent)] hover:underline flex items-center gap-1 font-semibold no-underline"
                  >
                    <span>لوائح الرسوم الرسمية (Edugate)</span>
                    <ExternalLink size={12} />
                  </a>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11.5px] font-semibold text-[var(--text-3)] block mb-1">
                      عدد الساعات المعتمدة للفصل:
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={calcCredits}
                      onChange={(e) =>
                        setCalcCredits(
                          Math.max(
                            1,
                            Math.min(24, Number(e.target.value) || 0),
                          ),
                        )
                      }
                      className="w-full h-9 px-3 text-[13px] font-bold bg-[var(--surface)] border border-[var(--line-control)] rounded-[var(--r-control)] text-[var(--text)] outline-none focus:border-[var(--accent)] tabular-nums"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11.5px] font-semibold text-[var(--text-3)] block">
                        سعر الساعة المعتمد (دينار):
                      </label>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                        {defaultMajorRate.faculty}
                      </span>
                    </div>
                    <select
                      value={hourlyRate}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setHourlyRate(val);
                        try {
                          localStorage.setItem("ptuk_hourly_rate", String(val));
                        } catch {}
                      }}
                      className="w-full h-9 px-3 text-[13px] font-bold bg-[var(--surface)] border border-[var(--line-control)] rounded-[var(--r-control)] text-[var(--text)] outline-none focus:border-[var(--accent)] cursor-pointer"
                    >
                      <option value={24}>
                        24 د.أ (كلية الهندسة والتكنولوجيا)
                      </option>
                      <option value={26}>26 د.أ (تخصص الذكاء الاصطناعي)</option>
                      <option value={20}>
                        20 د.أ (تكنولوجيا المعلومات والبرمجيات والحاسوب)
                      </option>
                      <option value={36}>
                        36 د.أ (كلية العلوم الطبية المساندة)
                      </option>
                      <option value={32}>32 د.أ (التمريض)</option>
                      <option value={20}>
                        20 د.أ (كلية الأعمال والاقتصاد)
                      </option>
                      <option value={18}>
                        18 د.أ (كلية العلوم التطبيقية والآداب)
                      </option>
                      <option value={12}>12 د.أ (برامج الدبلوم المتوسط)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11.5px] font-semibold text-[var(--text-3)] block mb-1">
                      الرسوم الفصلية الثابتة:
                    </label>
                    <div className="h-9 px-3 bg-[var(--surface)] border border-[var(--line-control)] rounded-[var(--r-control)] flex items-center justify-between text-[12px] font-medium text-[var(--text)]">
                      <span>تسجيل (25) + مجلس طلبة (1)</span>
                      <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        26 د.أ
                      </span>
                    </div>
                  </div>
                </div>

                {/* Calculation breakdown summary */}
                <div className="p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-wrap items-center justify-between gap-3 text-[13px]">
                  <div className="space-y-0.5 text-[12px] text-[var(--text-3)]">
                    <div>
                      رسوم الساعات المعتمدة ({calcCredits} × {hourlyRate} د.أ):{" "}
                      <span className="font-bold text-[var(--text)] tabular-nums">
                        {totalCreditsCostJOD} د.أ
                      </span>
                    </div>
                    <div>
                      رسوم التسجيل الفصلية (25 د.أ) + مجلس الطلبة (1 د.أ):{" "}
                      <span className="font-bold text-[var(--text)] tabular-nums">
                        {totalFixedFees} د.أ
                      </span>
                    </div>
                  </div>

                  <div className="text-left">
                    <div className="text-[11px] text-[var(--text-3)] font-semibold">
                      المجموع الإجمالي المتوقع:
                    </div>
                    <div className="text-[19px] font-black text-emerald-600 tabular-nums">
                      {grandTotalJOD} د.أ{" "}
                      <span className="text-[13px] font-bold text-[var(--text-2)]">
                        (≈ {grandTotalILS} ₪)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "exemptions" && (
            <div className="space-y-5">
              {/* PTUK Placement Regulations Header Banner */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[var(--text)] space-y-3">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-[15px]">
                  <Award size={20} className="shrink-0" />
                  <span>
                    قوانين امتحانات المستوى والقبول (جامعة فلسطين التقنية -
                    خضوري)
                  </span>
                </div>
                <div className="text-[12.5px] leading-relaxed text-[var(--text-2)] space-y-2">
                  <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-2">
                    <div className="font-bold text-[var(--text)] flex items-center gap-1.5">
                      <Sparkles size={14} className="text-amber-500 shrink-0" />
                      <span>
                        امتحان مستوى اللغة الإنجليزية (متطلب جامعة إجباري):
                      </span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 pr-1 text-[12px]">
                      <li>
                        <strong className="text-emerald-600 dark:text-emerald-400">
                          علامة 80% فما فوق (تفوق):
                        </strong>{" "}
                        يُعفى الطالب رسمياً من <strong>كلا المساقين</strong>:
                        إنجليزي إستدراكي (15200099) ولغة إنجليزية 1 (15200106)،
                        ويتأهل مباشرة للتسجيل في مساق اللغة الإنجليزية 2
                        (15200112).
                      </li>
                      <li>
                        <strong className="text-blue-600 dark:text-blue-400">
                          علامة من 50% إلى 79% (اجتياز):
                        </strong>{" "}
                        يُعفى الطالب من إنجليزي إستدراكي (15200099) فقط، ويُسجل
                        لمساق اللغة الإنجليزية 1 (15200106).
                      </li>
                      <li>
                        <strong className="text-red-500">
                          علامة أقل من 50% (رسوب):
                        </strong>{" "}
                        يتوجب على الطالب دراسة واجتياز إنجليزي إستدراكي
                        (15200099) قبل السماح له بتسجيل لغة إنجليزية 1.
                      </li>
                    </ul>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11.5px]">
                    <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--line)]">
                      <strong className="text-[var(--text)] block mb-0.5">
                        امتحان مهارات الحاسوب (13010006):
                      </strong>
                      علامة 50% فأعلى تعفي الطالب من دراسة مساق مهارات الحاسوب
                      وتطبيقاته.
                    </div>
                    <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--line)]">
                      <strong className="text-[var(--text)] block mb-0.5">
                        امتحان اللغة العربية (15200098):
                      </strong>
                      علامة 50% فأعلى تعفي الطالب من مساق لغة عربية إستدراكية.
                    </div>
                  </div>
                </div>
              </div>

              {/* Status and Action for English 1 Exemption */}
              <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--sunken)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[14px] text-[var(--text)]">
                      حالة إعفاء مساق اللغة الإنجليزية 1 (15200106)
                    </span>
                    {isEnglish1ExemptedInPlan ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 flex items-center gap-1">
                        <Check size={12} />
                        معفى ومحتسب بالخطة
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 border border-amber-500/30">
                        غير محتسب كمعفى
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-[var(--text-3)]">
                    {englishGrade !== null ? (
                      <>
                        علامتك في امتحان مستوى اللغة الإنجليزية:{" "}
                        <strong className="text-[var(--text)] tabular-nums font-bold">
                          {englishGrade}%
                        </strong>{" "}
                        {isEnglishHighScore
                          ? "🌟 (مؤهل لإعفاء لغة إنجليزية 1 لتجاوز 80%)"
                          : "(أقل من 80%، مطلوب دراسة لغة إنجليزية 1)"}
                      </>
                    ) : (
                      "إذا حصلت على علامة 80 فما فوق بامتحان القبول، يمكنك تفعيل الإعفاء فورياً لتحديث خطتك الدراسية."
                    )}
                  </p>
                </div>

                {onApplyExemption && (
                  <button
                    type="button"
                    onClick={() =>
                      onApplyExemption("15200106", !isEnglish1ExemptedInPlan)
                    }
                    className={cn(
                      "px-3.5 py-2 rounded-xl text-[12.5px] font-bold flex items-center gap-1.5 cursor-pointer transition-all shrink-0 shadow-sm",
                      isEnglish1ExemptedInPlan
                        ? "bg-[var(--surface)] border border-[var(--line-control)] text-[var(--text-2)] hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-500"
                        : "bg-[var(--accent)] text-[var(--text-on-accent)] hover:opacity-90",
                    )}
                  >
                    {isEnglish1ExemptedInPlan ? (
                      <>
                        <X size={14} />
                        <span>إلغاء الإعفاء من الخطة</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        <span>تطبيق إعفاء لغة إنجليزية 1 (≥ 80) بالخطة</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Exemption Exams Scraped Table */}
              <div className="space-y-3">
                <h4 className="text-[14px] font-bold flex items-center gap-2">
                  <ShieldCheck size={16} className="text-[var(--accent)]" />
                  <span>المساقات المعفاة ونتائج امتحانات المستوى المسجلة</span>
                </h4>

                {exemptionExams.length > 0 ? (
                  <div className="border border-[var(--line)] rounded-xl overflow-hidden bg-[var(--surface)]">
                    <table className="w-full text-[13px] text-right">
                      <thead className="bg-[var(--sunken)] border-b border-[var(--line)] text-[var(--text-2)] font-semibold">
                        <tr>
                          <th className="py-2.5 px-4">امتحان المستوى</th>
                          <th className="py-2.5 px-4">رمز المساق</th>
                          <th className="py-2.5 px-4">اسم المساق المعفى</th>
                          <th className="py-2.5 px-4">العلامة</th>
                          <th className="py-2.5 px-4">الحالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--line)]">
                        {exemptionExams.map((ex, idx) => (
                          <tr key={idx} className="hover:bg-[var(--sunken)]/50">
                            <td className="py-3 px-4 font-bold text-[var(--text)]">
                              {ex.examName || "امتحان مستوى"}
                            </td>
                            <td
                              className="py-3 px-4 font-mono text-[var(--text-3)]"
                              dir="ltr"
                            >
                              {ex.code}
                            </td>
                            <td className="py-3 px-4 font-medium text-[var(--text)]">
                              {ex.name}
                            </td>
                            <td className="py-3 px-4 tabular-nums">
                              {typeof ex.grade === "number" && ex.grade >= 0 ? (
                                <span
                                  className={cn(
                                    "font-bold",
                                    ex.grade >= 80
                                      ? "text-amber-500"
                                      : ex.grade >= 50
                                        ? "text-emerald-600"
                                        : "text-red-500",
                                  )}
                                >
                                  %{ex.grade}
                                </span>
                              ) : (
                                <span className="text-[var(--text-3)]">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={cn(
                                  "px-2 py-0.5 text-[11px] font-semibold rounded-md border inline-flex items-center gap-1",
                                  ex.isPassed
                                    ? ex.code === "15200106"
                                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                      : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                    : "bg-red-500/10 text-red-600 border-red-500/20",
                                )}
                              >
                                {ex.isPassed && <CheckCircle2 size={12} />}
                                <span>{ex.status}</span>
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-6 text-center border border-dashed border-[var(--line)] rounded-xl bg-[var(--sunken)]/40 text-[var(--text-3)] space-y-3">
                    <p className="text-[13.5px]">
                      لم يتم العثور على سجلات امتحانات مستوى من البوابة مباشرة،
                      أو أن البوابة لم تسجل رموز المقررات المعفاة في جدول
                      المقررات.
                    </p>
                    {onApplyExemption && (
                      <div className="flex flex-wrap justify-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => onApplyExemption("15200106", true)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent)] text-[var(--text-on-accent)] hover:opacity-90 transition cursor-pointer"
                        >
                          احتساب إعفاء لغة إنجليزية (1)
                        </button>
                        <button
                          type="button"
                          onClick={() => onApplyExemption("13010006", true)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--line-control)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--sunken)] transition cursor-pointer"
                        >
                          احتساب إعفاء مهارات حاسوب
                        </button>
                        <button
                          type="button"
                          onClick={() => onApplyExemption("15200098", true)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--line-control)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--sunken)] transition cursor-pointer"
                        >
                          احتساب إعفاء عربي استدراكي
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "transactions" && (
            <div className="space-y-4">
              <h3 className="text-[15px] font-bold flex items-center gap-2">
                <History size={16} className="text-[var(--accent)]" />
                <span>سجل الحركات الأكاديمية والتسجيل</span>
              </h3>

              {transactions.length > 0 ? (
                <div className="border border-[var(--line)] rounded-xl overflow-hidden">
                  <table className="w-full text-[13px] text-right">
                    <thead className="bg-[var(--sunken)] border-b border-[var(--line)] text-[var(--text-2)] font-semibold">
                      <tr>
                        <th className="py-2.5 px-4">نوع الحركة الأكاديمية</th>
                        <th className="py-2.5 px-4">الفصل الدراسي</th>
                        <th className="py-2.5 px-4">التاريخ</th>
                        <th className="py-2.5 px-4">الحالة</th>
                        <th className="py-2.5 px-4">الملاحظات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line)]">
                      {transactions.map((tx, idx) => (
                        <tr key={idx} className="hover:bg-[var(--sunken)]/50">
                          <td className="py-3 px-4 font-bold text-[var(--text)] flex items-center gap-2">
                            <CheckCircle2
                              size={15}
                              className="text-emerald-500 shrink-0"
                            />
                            <span>{tx.type}</span>
                          </td>
                          <td className="py-3 px-4 text-[var(--text-2)]">
                            {tx.semester}
                          </td>
                          <td className="py-3 px-4 tabular-nums text-[var(--text-3)]">
                            {tx.date}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              {tx.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[var(--text-3)]">
                            {tx.notes || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center border border-dashed border-[var(--line)] rounded-xl bg-[var(--sunken)]/40 text-[var(--text-3)]">
                  <p className="text-[14px]">
                    لا توجد حركات أكاديمية سابقة مسجلة.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "semesters" && (
            <div className="space-y-4">
              <h3 className="text-[15px] font-bold flex items-center gap-2">
                <GraduationCap size={16} className="text-[var(--accent)]" />
                <span>سجل الفصول والمساقات المحتسبة بالجامعة</span>
              </h3>

              {semesters.length > 0 ? (
                <div className="space-y-4">
                  {semesters.map((sem, sIdx) => (
                    <div
                      key={sIdx}
                      className="border border-[var(--line)] rounded-xl overflow-hidden bg-[var(--surface)]"
                    >
                      <div className="px-4 py-2.5 bg-[var(--sunken)] border-b border-[var(--line)] flex items-center justify-between">
                        <span className="font-bold text-[14px] text-[var(--text)]">
                          {sem.title}
                        </span>
                        <span className="text-[12px] text-[var(--text-3)] font-medium">
                          {sem.courses.length} مساقات
                        </span>
                      </div>
                      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {sem.courses.map((c) => (
                          <div
                            key={c.code}
                            className="p-2.5 rounded-lg border border-[var(--line)] bg-[var(--sunken)]/30 flex items-center justify-between text-[12px]"
                          >
                            <div className="overflow-hidden">
                              <span
                                className="font-mono text-[10px] text-[var(--text-3)] block"
                                dir="ltr"
                              >
                                {c.code}
                              </span>
                              <span className="font-medium text-[var(--text)] truncate block">
                                {c.name}
                              </span>
                            </div>
                            <div className="text-left shrink-0 mr-2">
                              {c.grade !== null &&
                              typeof c.grade === "number" &&
                              c.grade >= 0 ? (
                                <span
                                  className={cn(
                                    "font-bold tabular-nums privacy-sensitive transition-all duration-200",
                                    isPrivacyMasked && "blur-md select-none",
                                    c.grade >= 60
                                      ? "text-emerald-600"
                                      : "text-amber-600",
                                  )}
                                >
                                  {c.grade}
                                </span>
                              ) : (
                                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                  {c.status || "ناجح"}
                                </span>
                              )}
                              <span className="text-[10px] text-[var(--text-3)] block">
                                {c.credits}س
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center border border-dashed border-[var(--line)] rounded-xl bg-[var(--sunken)]/40 text-[var(--text-3)]">
                  <p className="text-[14px]">
                    لا توجد فصول مكتملة مسجلة بعد في كشف العلامات المخزن.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[var(--line)] bg-[var(--sunken)] flex items-center justify-between">
          <div className="text-[12px] text-[var(--text-3)]">
            آخر مزامنة مع Edugate:{" "}
            {profile?.lastSyncedAt
              ? new Date(profile.lastSyncedAt).toLocaleString("ar-EG")
              : "مزامنة محلية"}
          </div>
          <div className="flex items-center gap-2">
            {onOpenSyncModal && (
              <button
                type="button"
                onClick={onOpenSyncModal}
                className="px-3 py-1.5 rounded-[var(--r-control)] text-[12px] font-medium border border-[var(--line-control)] bg-[var(--surface)] hover:bg-[var(--sunken)] text-[var(--text)] transition-colors cursor-pointer"
              >
                تحديث البيانات من Edugate
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-[var(--r-control)] text-[12px] font-semibold bg-[var(--accent)] text-[var(--text-on-accent)] hover:opacity-90 transition-opacity cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentRecordsModal;
