import React, { useState } from "react";
import {
  GraduationCap,
  KeyRound,
  UserCheck,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  BookOpen,
  Calendar,
  Award,
} from "lucide-react";
import { BaseModal } from "./BaseModal";
import {
  syncStudentProfile,
  StudentSyncProfile,
  getCachedStudentProfile,
} from "../services/studentService";

interface StudentPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyStudentData: (profile: StudentSyncProfile) => void;
}

export const StudentPortalModal: React.FC<StudentPortalModalProps> = ({
  isOpen,
  onClose,
  onApplyStudentData,
}) => {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncedProfile, setSyncedProfile] = useState<StudentSyncProfile | null>(
    () => getCachedStudentProfile(),
  );

  const handleSync = async (demoMode = false) => {
    const idToUse = demoMode ? (studentId || "202110123") : studentId;
    if (!idToUse.trim()) {
      setError("يرجى إدخال الرقم الجامعي.");
      return;
    }
    if (!demoMode && !password.trim()) {
      setError("يرجى إدخال كلمة مرور البوابة الجامعية.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const profile = await syncStudentProfile(idToUse, password, demoMode);
      setSyncedProfile(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشلت عملية المزامنة مع بوابة الجامعة.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (!syncedProfile) return;
    onApplyStudentData(syncedProfile);
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <GraduationCap className="text-emerald-600 dark:text-emerald-400" size={24} />
          <span>مزامنة بوابة الطالب (Edugate PTUK)</span>
        </div>
      }
      maxWidth="max-w-xl"
    >
      <div className="p-4 sm:p-6 space-y-5" dir="rtl">
        {/* Information Callout */}
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3.5 text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 flex items-start gap-3">
          <Sparkles className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" size={18} />
          <p className="leading-relaxed">
            قم بإدخال بيانات دخول بوابتك الجامعية (Edugate) لمزامنة سجلك الأكاديمي تلقائياً:
            تحديد المواد المجتازة، احتساب الساعات المقطوعة، ضبط المعدل التراكمي، وإدراج جدولك الحالي.
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl p-3.5 text-xs sm:text-sm text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
            <AlertCircle className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" size={18} />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        {/* Form Inputs */}
        <div className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              الرقم الجامعي (Student ID)
            </label>
            <div className="relative">
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="مثال: 202110123"
                disabled={isLoading}
                className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-mono"
              />
              <UserCheck
                size={18}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              كلمة مرور بوابة خضوري (Edugate Password)
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                disabled={isLoading}
                className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              />
              <KeyRound
                size={18}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              🔒 يتم التعامل مع كلمة المرور بجلسة آمنة ومؤقتة لاسترجاع خطتك فقط ولا يتم تخزينها.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => void handleSync(false)}
            disabled={isLoading}
            className="flex-1 min-h-11 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>جاري المزامنة مع بوابة خضوري...</span>
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                <span>مزامنة بوابتي الآن</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => void handleSync(true)}
            disabled={isLoading}
            className="py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-xl text-sm transition-colors flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 disabled:opacity-50"
          >
            <Sparkles size={16} className="text-amber-500" />
            <span>تجربة سريعة (حساب تجريبي)</span>
          </button>
        </div>

        {/* Synced Profile Preview */}
        {syncedProfile && (
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-500" />
                <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                  {syncedProfile.studentName}
                </span>
                {syncedProfile.isDemo && (
                  <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
                    حساب تجريبي
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                #{syncedProfile.studentId}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-center gap-1 text-slate-500 mb-1">
                  <GraduationCap size={13} />
                  <span>التخصص</span>
                </div>
                <div className="font-bold text-slate-800 dark:text-slate-200 text-[11px] truncate">
                  {syncedProfile.majorName}
                </div>
              </div>

              <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-center gap-1 text-slate-500 mb-1">
                  <Award size={13} />
                  <span>المعدل التراكمي</span>
                </div>
                <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  {syncedProfile.gpa}%
                </div>
              </div>

              <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-center gap-1 text-slate-500 mb-1">
                  <BookOpen size={13} />
                  <span>مواد مجتازة</span>
                </div>
                <div className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                  {syncedProfile.passedCourseIds.length} مساق
                </div>
              </div>

              <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-center gap-1 text-slate-500 mb-1">
                  <Calendar size={13} />
                  <span>ساعات مقطوعة</span>
                </div>
                <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                  {syncedProfile.earnedCredits} ساعة
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleApply}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <CheckCircle2 size={16} />
              <span>تطبيق بيانات الطالب على الخطة والجدول</span>
            </button>
          </div>
        )}
      </div>
    </BaseModal>
  );
};
