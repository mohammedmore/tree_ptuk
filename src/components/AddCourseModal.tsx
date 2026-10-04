import React, { useState } from "react";
import { BaseModal } from "./BaseModal";
import type { Course } from "../data";
import { Plus, Book, Hash, Layers, GraduationCap } from "lucide-react";

interface AddCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCourse: (course: Course) => void;
}

const CATEGORIES = [
  "متطلب جامعة إجباري",
  "متطلب جامعة اختياري",
  "متطلب كلية إجباري",
  "متطلب تخصص إجباري",
  "متطلب تخصص اختياري",
  "متطلب استدراكي إجباري",
] as const;

interface AddCourseForm {
  id: string;
  name: string;
  credits: string;
  category: (typeof CATEGORIES)[number];
}

const createInitialForm = (): AddCourseForm => ({
  id: "",
  name: "",
  credits: "3",
  category: CATEGORIES[0],
});

export const AddCourseModal: React.FC<AddCourseModalProps> = ({
  isOpen,
  onClose,
  onAddCourse,
}) => {
  const [courseData, setCourseData] =
    useState<AddCourseForm>(createInitialForm);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const id = courseData.id.trim();
    const name = courseData.name.trim();
    const credits = Number(courseData.credits);
    if (!id || !name) {
      setValidationError("أدخل رقم المادة واسمها.");
      return;
    }
    if (id.length > 32 || name.length > 120) {
      setValidationError(
        "رقم المادة يجب ألا يتجاوز 32 حرفاً واسمها 120 حرفاً.",
      );
      return;
    }
    if (!Number.isInteger(credits) || credits < 1 || credits > 10) {
      setValidationError("يجب أن يكون عدد الساعات عدداً صحيحاً من 1 إلى 10.");
      return;
    }
    if (!CATEGORIES.includes(courseData.category)) {
      setValidationError("اختر تصنيفاً صالحاً للمادة.");
      return;
    }

    const course: Course = {
      id,
      name,
      credits,
      category: courseData.category,
      prerequisites: [],
    };
    onAddCourse(course);
    setCourseData(createInitialForm());
    setValidationError(null);
    onClose();
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="إضافة مادة جديدة مخصصة">
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ID */}
          <div className="space-y-2">
            <label
              htmlFor="custom-course-id"
              className="text-sm font-black text-gray-600 dark:text-slate-400"
            >
              رقم المادة:
            </label>
            <div className="relative">
              <Hash
                size={18}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                id="custom-course-id"
                required
                maxLength={32}
                value={courseData.id}
                onChange={(e) => {
                  setCourseData((previous) => ({
                    ...previous,
                    id: e.target.value,
                  }));
                  setValidationError(null);
                }}
                aria-invalid={Boolean(validationError && !courseData.id.trim())}
                placeholder="مثلاً: 12140101"
                className="w-full pr-10 pl-3 py-3 bg-gray-50 dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-800 rounded-2xl font-bold focus:border-blue-500 outline-none transition-all dark:text-slate-200"
              />
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <label
              htmlFor="custom-course-name"
              className="text-sm font-black text-gray-600 dark:text-slate-400"
            >
              اسم المادة:
            </label>
            <div className="relative">
              <Book
                size={18}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                id="custom-course-name"
                required
                maxLength={120}
                value={courseData.name}
                onChange={(e) => {
                  setCourseData((previous) => ({
                    ...previous,
                    name: e.target.value,
                  }));
                  setValidationError(null);
                }}
                placeholder="اسم المادة"
                className="w-full pr-10 pl-3 py-3 bg-gray-50 dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-800 rounded-2xl font-bold focus:border-blue-500 outline-none transition-all dark:text-slate-200"
              />
            </div>
          </div>

          {/* Credits */}
          <div className="space-y-2">
            <label
              htmlFor="custom-course-credits"
              className="text-sm font-black text-gray-600 dark:text-slate-400"
            >
              عدد الساعات:
            </label>
            <div className="relative">
              <Layers
                size={18}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="number"
                id="custom-course-credits"
                required
                min={1}
                max={10}
                value={courseData.credits}
                onChange={(e) => {
                  setCourseData((previous) => ({
                    ...previous,
                    credits: e.target.value,
                  }));
                  setValidationError(null);
                }}
                className="w-full pr-10 pl-3 py-3 bg-gray-50 dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-800 rounded-2xl font-bold focus:border-blue-500 outline-none transition-all dark:text-slate-200"
              />
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <label
              htmlFor="custom-course-category"
              className="text-sm font-black text-gray-600 dark:text-slate-400"
            >
              التصنيف:
            </label>
            <div className="relative">
              <GraduationCap
                size={18}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <select
                id="custom-course-category"
                value={courseData.category}
                onChange={(e) => {
                  const category = CATEGORIES.find(
                    (item) => item === e.target.value,
                  );
                  if (!category) return;
                  setCourseData((previous) => ({
                    ...previous,
                    category,
                  }));
                  setValidationError(null);
                }}
                className="w-full pr-10 pl-3 py-3 bg-gray-50 dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-800 rounded-2xl font-bold focus:border-blue-500 outline-none transition-all dark:text-slate-200 appearance-none"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {validationError && (
          <p
            role="alert"
            className="text-sm font-bold text-red-600 dark:text-red-400"
          >
            {validationError}
          </p>
        )}

        <button
          type="submit"
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black transition-all shadow-lg flex items-center justify-center gap-2 mt-4"
        >
          <Plus size={20} />
          إضافة المادة للخطة
        </button>
      </form>
    </BaseModal>
  );
};
