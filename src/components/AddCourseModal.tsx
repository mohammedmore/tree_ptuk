import React, { useState } from "react";
import { BaseModal } from "./BaseModal";
import { Course } from "../data";
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
];

export const AddCourseModal: React.FC<AddCourseModalProps> = ({
  isOpen,
  onClose,
  onAddCourse,
}) => {
  const [courseData, setCourseData] = useState<Partial<Course>>({
    id: "",
    name: "",
    credits: 3,
    category: CATEGORIES[0],
    prerequisites: [],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (courseData.id && courseData.name && courseData.credits) {
      onAddCourse(courseData as Course);
      setCourseData({
        id: "",
        name: "",
        credits: 3,
        category: CATEGORIES[0],
        prerequisites: [],
      });
      onClose();
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="إضافة مادة جديدة مخصصة">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ID */}
          <div className="space-y-2">
            <label className="text-sm font-black text-gray-600 dark:text-slate-400">رقم المادة:</label>
            <div className="relative">
              <Hash size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                required
                value={courseData.id}
                onChange={(e) => setCourseData({ ...courseData, id: e.target.value })}
                placeholder="مثلاً: 12140101"
                className="w-full pr-10 pl-3 py-3 bg-gray-50 dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-800 rounded-2xl font-bold focus:border-blue-500 outline-none transition-all dark:text-slate-200"
              />
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <label className="text-sm font-black text-gray-600 dark:text-slate-400">اسم المادة:</label>
            <div className="relative">
              <Book size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                required
                value={courseData.name}
                onChange={(e) => setCourseData({ ...courseData, name: e.target.value })}
                placeholder="اسم المادة"
                className="w-full pr-10 pl-3 py-3 bg-gray-50 dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-800 rounded-2xl font-bold focus:border-blue-500 outline-none transition-all dark:text-slate-200"
              />
            </div>
          </div>

          {/* Credits */}
          <div className="space-y-2">
            <label className="text-sm font-black text-gray-600 dark:text-slate-400">عدد الساعات:</label>
            <div className="relative">
              <Layers size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="number"
                required
                min={1}
                max={10}
                value={courseData.credits}
                onChange={(e) => setCourseData({ ...courseData, credits: parseInt(e.target.value) })}
                className="w-full pr-10 pl-3 py-3 bg-gray-50 dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-800 rounded-2xl font-bold focus:border-blue-500 outline-none transition-all dark:text-slate-200"
              />
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <label className="text-sm font-black text-gray-600 dark:text-slate-400">التصنيف:</label>
            <div className="relative">
              <GraduationCap size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={courseData.category}
                onChange={(e) => setCourseData({ ...courseData, category: e.target.value })}
                className="w-full pr-10 pl-3 py-3 bg-gray-50 dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-800 rounded-2xl font-bold focus:border-blue-500 outline-none transition-all dark:text-slate-200 appearance-none"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

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
