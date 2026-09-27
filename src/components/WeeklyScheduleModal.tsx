import React, { useState, useMemo } from "react";
import { Calendar, Clock, User, MapPin, Hash, Layout, Edit3 } from "lucide-react";
import { BaseModal } from "./BaseModal";
import { Course, ScheduleEntry } from "../data";
import { cn } from "../utils";
import { SEMESTERS } from "../constants";

interface WeeklyScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  plannedCourses: Record<string, string>;
  courses: Course[];
  weeklySchedule: Record<string, Record<string, ScheduleEntry>>;
  setWeeklySchedule: React.Dispatch<React.SetStateAction<Record<string, Record<string, ScheduleEntry>>>>;
}

const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // من 8 صباحاً لـ 9 مساءً

export const WeeklyScheduleModal: React.FC<WeeklyScheduleModalProps> = ({
  isOpen,
  onClose,
  plannedCourses,
  courses,
  weeklySchedule,
  setWeeklySchedule,
}) => {
  const [selectedSemester, setSelectedSemester] = useState<string>(
    SEMESTERS.find(s => Object.values(plannedCourses).includes(s)) || SEMESTERS[0]
  );
  const [activeTab, setActiveTab] = useState<"edit" | "visual">("visual");

  const semesterCourses = useMemo(() => {
    return Object.entries(plannedCourses)
      .filter(([_, sem]) => sem === selectedSemester)
      .map(([id, _]) => courses.find(c => c.id === id))
      .filter((c): c is Course => !!c);
  }, [plannedCourses, selectedSemester, courses]);

  const handleUpdateEntry = (courseId: string, field: keyof ScheduleEntry, value: any) => {
    setWeeklySchedule(prev => {
      const newSchedule = { ...prev };
      if (!newSchedule[selectedSemester]) {
        newSchedule[selectedSemester] = {};
      }
      const existing = newSchedule[selectedSemester][courseId] || {
        courseId,
        startTime: "08:00",
        endTime: "09:00",
        section: "",
        instructor: "",
        room: "",
        days: [],
      };
      newSchedule[selectedSemester][courseId] = {
        ...existing,
        [field]: value,
      };
      return newSchedule;
    });
  };

  const toggleDay = (courseId: string, day: string) => {
    const entry = weeklySchedule[selectedSemester]?.[courseId] || {
      courseId,
      startTime: "08:00",
      endTime: "09:00",
      days: [],
    };
    const days = entry.days || [];
    const newDays = days.includes(day)
      ? days.filter(d => d !== day)
      : [...days, day];
    handleUpdateEntry(courseId, "days", newDays);
  };

  const timeToMinutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };

  const getPosition = (startTime: string, endTime: string) => {
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    const gridStart = 8 * 60; // 8:00 AM
    const totalMinutes = 14 * 60; // 14 hours total

    return {
      top: `${((start - gridStart) / totalMinutes) * 100}%`,
      height: `${((end - start) / totalMinutes) * 100}%`,
    };
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="الجدول الدراسي الأسبوعي" maxWidth="max-w-6xl">
      <div className="flex flex-col h-full max-h-[85vh]">
        {/* Header Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-6 items-center justify-between">
          <div className="flex bg-gray-100 dark:bg-slate-900 p-1 rounded-2xl w-full md:w-auto">
            <button
              onClick={() => setActiveTab("visual")}
              className={cn(
                "flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-xl text-sm font-black transition-all",
                activeTab === "visual" 
                  ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm" 
                  : "text-gray-500 hover:text-gray-700 dark:text-slate-400"
              )}
            >
              <Layout size={18} />
              الجدول البصري
            </button>
            <button
              onClick={() => setActiveTab("edit")}
              className={cn(
                "flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-xl text-sm font-black transition-all",
                activeTab === "edit" 
                  ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm" 
                  : "text-gray-500 hover:text-gray-700 dark:text-slate-400"
              )}
            >
              <Edit3 size={18} />
              تعبئة البيانات
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
             <label className="text-xs font-black text-gray-500 dark:text-slate-400 whitespace-nowrap">الفصل:</label>
             <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="flex-1 md:w-48 p-2 bg-gray-50 dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-800 rounded-xl font-bold text-sm focus:border-blue-500 outline-none transition-all"
            >
              {SEMESTERS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {semesterCourses.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 bg-gray-50/50 dark:bg-slate-900/30 rounded-3xl border-2 border-dashed border-gray-100 dark:border-slate-800">
            <Calendar size={64} className="text-gray-300 dark:text-slate-700 mb-4 opacity-50" />
            <h3 className="text-xl font-black text-gray-400 dark:text-slate-600">لا توجد مواد مخططة لهذا الفصل</h3>
            <p className="text-sm text-gray-400 dark:text-slate-500 mt-2 font-bold">أضف بعض المواد في "عرض الخطة" لتتمكن من جدولتها</p>
          </div>
        ) : activeTab === "edit" ? (
          /* Data Entry View */
          <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
            {semesterCourses.map(course => {
              const entry = weeklySchedule[selectedSemester]?.[course.id] || {
                courseId: course.id,
                startTime: "08:00",
                endTime: "09:00",
                section: "",
                instructor: "",
                room: "",
                days: [],
              };

              return (
                <div key={course.id} className="group bg-white dark:bg-slate-800/50 border-2 border-gray-100 dark:border-slate-800 rounded-3xl p-5 hover:border-blue-200 dark:hover:border-blue-900/30 transition-all shadow-sm">
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="md:w-1/3">
                      <div className="mb-4">
                        <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md mb-2 inline-block">
                          {course.id}
                        </span>
                        <h3 className="text-lg font-black text-gray-800 dark:text-slate-100 leading-tight">{course.name}</h3>
                        <p className="text-xs font-bold text-gray-400 dark:text-slate-500 mt-1">{course.credits} ساعات معتمدة</p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-500 dark:text-slate-400">أيام المحاضرات:</label>
                        <div className="flex flex-wrap gap-1.5">
                          {DAYS.slice(0, 5).map(day => (
                            <button
                              key={day}
                              onClick={() => toggleDay(course.id, day)}
                              className={cn(
                                "w-10 h-10 rounded-xl text-xs font-black transition-all border-2",
                                entry.days?.includes(day)
                                  ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none"
                                  : "bg-gray-50 dark:bg-slate-900 text-gray-400 border-gray-100 dark:border-slate-800 hover:border-blue-200"
                              )}
                            >
                              {day.charAt(0)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-black text-gray-400 px-1">وقت البدء</label>
                          <div className="relative">
                            <Clock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300" />
                            <input
                              type="time"
                              value={entry.startTime}
                              onChange={(e) => handleUpdateEntry(course.id, "startTime", e.target.value)}
                              className="w-full pr-10 pl-3 py-2.5 bg-gray-50 dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-800 rounded-xl text-sm font-bold focus:border-blue-500 outline-none transition-all"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-black text-gray-400 px-1">وقت الانتهاء</label>
                          <div className="relative">
                            <Clock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300" />
                            <input
                              type="time"
                              value={entry.endTime}
                              onChange={(e) => handleUpdateEntry(course.id, "endTime", e.target.value)}
                              className="w-full pr-10 pl-3 py-2.5 bg-gray-50 dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-800 rounded-xl text-sm font-bold focus:border-blue-500 outline-none transition-all"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-black text-gray-400 px-1">الدكتور / القاعة</label>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="relative">
                              <User size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300" />
                              <input
                                type="text"
                                placeholder="الدكتور"
                                value={entry.instructor}
                                onChange={(e) => handleUpdateEntry(course.id, "instructor", e.target.value)}
                                className="w-full pr-9 pl-3 py-2.5 bg-gray-50 dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-800 rounded-xl text-xs font-bold focus:border-blue-500 outline-none transition-all"
                              />
                            </div>
                            <div className="relative">
                              <MapPin size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300" />
                              <input
                                type="text"
                                placeholder="القاعة"
                                value={entry.room}
                                onChange={(e) => handleUpdateEntry(course.id, "room", e.target.value)}
                                className="w-full pr-9 pl-3 py-2.5 bg-gray-50 dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-800 rounded-xl text-xs font-bold focus:border-blue-500 outline-none transition-all"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-black text-gray-400 px-1">رقم الشعبة</label>
                          <div className="relative">
                            <Hash size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300" />
                            <input
                              type="text"
                              placeholder="مثلاً: 101"
                              value={entry.section}
                              onChange={(e) => handleUpdateEntry(course.id, "section", e.target.value)}
                              className="w-full pr-10 pl-3 py-2.5 bg-gray-50 dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-800 rounded-xl text-sm font-bold focus:border-blue-500 outline-none transition-all"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Visual Grid View */
          <div className="flex-1 overflow-hidden bg-gray-50 dark:bg-slate-900/50 rounded-3xl border-2 border-gray-100 dark:border-slate-800 relative flex flex-col">
            {/* Days Header */}
            <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr_1fr] border-b border-gray-200 dark:border-slate-800/40 bg-white dark:bg-slate-900 z-10">
              <div className="p-3 border-l border-gray-100 dark:border-slate-800/40"></div>
              {DAYS.slice(0, 5).map(day => (
                <div key={day} className="p-3 text-center text-xs font-black text-gray-600 dark:text-slate-400 border-l border-gray-100 dark:border-slate-800/40">
                  {day}
                </div>
              ))}
            </div>

            {/* Grid Content */}
            <div className="flex-1 overflow-y-auto relative custom-scrollbar">
              <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr_1fr] min-h-210 relative">
                {/* Hour Labels */}
                <div className="flex flex-col">
                  {HOURS.map(hour => (
                    <div key={hour} className="h-15 flex items-start justify-center pt-2 text-[10px] font-black text-gray-400 border-l border-b border-gray-100 dark:border-slate-800/40">
                      {hour > 12 ? `${hour - 12} م` : `${hour} ص`}
                    </div>
                  ))}
                </div>

                {/* Grid Lines and Slots */}
                {DAYS.slice(0, 5).map((day, dayIdx) => (
                  <div key={day} className="relative border-l border-gray-100 dark:border-slate-800/40">
                    {/* Horizontal background lines */}
                    {HOURS.map(hour => (
                      <div key={hour} className="h-15 border-b border-gray-50 dark:border-slate-800/20"></div>
                    ))}

                    {/* Courses in this day */}
                    {semesterCourses.map(course => {
                      const entry = weeklySchedule[selectedSemester]?.[course.id];
                      if (!entry || !entry.days?.includes(day)) return null;

                      const { top, height } = getPosition(entry.startTime, entry.endTime);
                      
                      return (
                        <div
                          key={`${course.id}-${dayIdx}`}
                          style={{ top, height }}
                          className="absolute left-1 right-1 p-2 rounded-xl bg-blue-500/10 dark:bg-blue-400/10 border border-blue-200 dark:border-blue-900/50 overflow-hidden group cursor-help transition-all hover:z-20 hover:scale-[1.02] hover:shadow-xl hover:bg-blue-500/20"
                        >
                          <div className="h-full flex flex-col">
                            <h4 className="text-[10px] font-black text-blue-700 dark:text-blue-300 leading-tight truncate">{course.name}</h4>
                            <div className="mt-auto flex flex-col gap-0.5">
                              {entry.room && (
                                <div className="flex items-center gap-1 text-[8px] font-bold text-blue-600/70 dark:text-blue-400/70">
                                  <MapPin size={8} />
                                  <span className="truncate">{entry.room}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1 text-[8px] font-bold text-blue-600/70 dark:text-blue-400/70">
                                <Clock size={8} />
                                <span>{entry.startTime}</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Tooltip on hover */}
                          <div className="absolute inset-0 bg-blue-600 text-white p-2 text-[9px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center gap-1">
                             <span className="font-black truncate">{course.name}</span>
                             <div className="flex flex-col">
                                <span>{entry.startTime} - {entry.endTime}</span>
                                <span>د. {entry.instructor || "غير محدد"}</span>
                                <span>قاعة: {entry.room || "غير محدد"}</span>
                             </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800 flex justify-between items-center text-[10px] font-bold text-gray-400">
           <div className="flex gap-4">
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> جدولك مرتب</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-500"></div> يتم الحفظ تلقائياً</span>
           </div>
           <p>يمكنك التبديل بين الأقسام من الأعلى</p>
        </div>
      </div>
    </BaseModal>
  );
};
