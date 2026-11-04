import React, { useState, useEffect } from "react";
import {
  X,
  Bookmark,
  Plus,
  Copy,
  Check,
  Trash2,
  Share2,
  Upload,
  Files,
  Pencil,
  AlertCircle,
} from "lucide-react";
import {
  PlanScenario,
  saveScenario,
  duplicateScenario,
  renameScenario,
  deleteScenario,
  exportScenarioToShareCode,
  importScenarioFromShareCode,
} from "../../core/planScenarios";
import { cn } from "../../utils";

interface PlanScenarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenarios: PlanScenario[];
  activeScenarioId: string;
  onSelectScenario: (id: string) => void;
  onRefreshScenarios: () => void;
  plannedCourses: Record<string, string>;
  selectedElectives?: Record<string, string>;
}

export const PlanScenarioModal: React.FC<PlanScenarioModalProps> = ({
  isOpen,
  onClose,
  scenarios,
  activeScenarioId,
  onSelectScenario,
  onRefreshScenarios,
  plannedCourses,
  selectedElectives,
}) => {
  const [mode, setMode] = useState<"list" | "new" | "import" | "share">("list");
  const [newScenarioName, setNewScenarioName] = useState("");
  const [newScenarioDesc, setNewScenarioDesc] = useState("");
  const [importCode, setImportCode] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [shareTargetScenario, setShareTargetScenario] =
    useState<PlanScenario | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (deletingId) {
          setDeletingId(null);
        } else if (editingId) {
          setEditingId(null);
        } else if (mode !== "list") {
          setMode("list");
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, mode, deletingId, editingId, onClose]);

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScenarioName.trim()) return;

    const created = saveScenario(
      newScenarioName.trim(),
      plannedCourses,
      selectedElectives,
      newScenarioDesc.trim() || undefined,
    );

    onRefreshScenarios();
    onSelectScenario(created.id);
    setNewScenarioName("");
    setNewScenarioDesc("");
    setMode("list");
  };

  const handleDuplicate = (id: string) => {
    const duplicated = duplicateScenario(id);
    if (duplicated) {
      onRefreshScenarios();
      onSelectScenario(duplicated.id);
    }
  };

  const handleDelete = (id: string) => {
    if (scenarios.length <= 1) {
      setActionNotice("لا يمكن حذف السيناريو الأخير في الخطة.");
      setTimeout(() => setActionNotice(null), 3000);
      return;
    }
    setDeletingId(id);
  };

  const confirmDelete = (id: string) => {
    deleteScenario(id);
    setDeletingId(null);
    onRefreshScenarios();
  };

  const handleStartRename = (scenario: PlanScenario) => {
    setEditingId(scenario.id);
    setEditingName(scenario.name);
  };

  const handleSaveRename = (id: string) => {
    if (editingName.trim()) {
      renameScenario(id, editingName.trim());
      onRefreshScenarios();
    }
    setEditingId(null);
  };

  const handleOpenShare = (scenario: PlanScenario) => {
    setShareTargetScenario(scenario);
    setMode("share");
    setCopiedCode(false);
  };

  const handleCopyShareCode = () => {
    if (!shareTargetScenario) return;
    const code = exportScenarioToShareCode(shareTargetScenario);
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault();
    setImportError(null);
    if (!importCode.trim()) return;

    const imported = importScenarioFromShareCode(importCode.trim());
    if (!imported) {
      setImportError(
        "رمز الخطة غير صالح أو تالف. يرجى التأكد من نسخه بالكامل.",
      );
      return;
    }

    // Save as new scenario
    const created = saveScenario(
      imported.name,
      imported.plannedCourses,
      imported.selectedElectives,
      "خطة مستوردة عبر رمز المشاركة",
    );

    onRefreshScenarios();
    onSelectScenario(created.id);
    setImportCode("");
    setMode("list");
  };

  return (
    <div
      dir="rtl"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-[var(--scrim)]/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--surface)] border border-[var(--line)] rounded-[var(--r-card)] shadow-[var(--shadow-pop)] flex flex-col overflow-hidden text-[var(--text)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[var(--line)] flex items-center justify-between bg-[var(--bg)]">
          <div className="flex items-center gap-2">
            <Bookmark size={18} className="text-[var(--accent)]" />
            <h2 className="text-[16px] font-bold">
              {mode === "list" && "إدارة سيناريوهات الخطة"}
              {mode === "new" && "حفظ سيناريو جديد"}
              {mode === "share" && "مشاركة السيناريو"}
              {mode === "import" && "استيراد سيناريو من رمز"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-2 text-[var(--text-3)] hover:text-[var(--text)] rounded-[var(--r-control)] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto max-h-[70vh]">
          {actionNotice && (
            <div className="mb-3 p-2.5 rounded-[var(--r-control)] bg-[var(--warn-soft)] border border-[var(--warn)] text-[var(--warn)] text-[12px] flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{actionNotice}</span>
            </div>
          )}

          {mode === "list" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setMode("new")}
                  className="px-3.5 py-2 text-[12.5px] font-medium bg-[var(--accent)] text-[var(--text-on-accent)] rounded-[var(--r-control)] flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-opacity"
                >
                  <Plus size={14} />
                  <span>سيناريو جديد</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("import")}
                  className="px-3.5 py-2 text-[12.5px] font-medium border border-[var(--line-control)] bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text)] rounded-[var(--r-control)] flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Upload size={14} />
                  <span>استيراد رمز</span>
                </button>
              </div>

              <div className="space-y-2 mt-2">
                {scenarios.map((scen) => {
                  const isActive = scen.id === activeScenarioId;
                  const isEditing = editingId === scen.id;
                  const isDeleting = deletingId === scen.id;

                  return (
                    <div
                      key={scen.id}
                      className={cn(
                        "p-3 rounded-[var(--r-control)] border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                        isActive
                          ? "bg-[var(--accent-soft)] border-[var(--accent)]"
                          : "bg-[var(--surface)] border-[var(--line-control)] hover:border-[var(--line)]",
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="text-[13px] px-2 py-1 bg-[var(--bg)] border border-[var(--line-control)] rounded-[var(--r-control)] text-[var(--text)] w-full"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  handleSaveRename(scen.id);
                                if (e.key === "Escape") setEditingId(null);
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveRename(scen.id)}
                              className="px-2.5 py-1 text-[11px] bg-[var(--accent)] text-[var(--text-on-accent)] rounded"
                            >
                              حفظ
                            </button>
                          </div>
                        ) : isDeleting ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-medium text-[var(--danger)]">
                              تأكيد حذف "{scen.name}"؟
                            </span>
                            <button
                              type="button"
                              onClick={() => confirmDelete(scen.id)}
                              className="px-2 py-1 text-[11px] font-bold bg-[var(--danger)] text-white rounded"
                            >
                              نعم، حذف
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingId(null)}
                              className="px-2 py-1 text-[11px] border border-[var(--line-control)] rounded text-[var(--text-2)]"
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => onSelectScenario(scen.id)}
                            className="cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-[13.5px] font-bold text-[var(--text)] truncate">
                                {scen.name}
                              </span>
                              {isActive && (
                                <span className="text-[10px] bg-[var(--accent)] text-[var(--text-on-accent)] px-1.5 py-0.5 rounded-full font-semibold">
                                  نشط
                                </span>
                              )}
                            </div>
                            {scen.description && (
                              <p className="text-[11.5px] text-[var(--text-3)] truncate mt-0.5">
                                {scen.description}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Scenario Actions */}
                      {!isDeleting && !isEditing && (
                        <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleOpenShare(scen)}
                            aria-label={`مشاركة سيناريو ${scen.name}`}
                            className="p-2 min-w-[32px] min-h-[32px] flex items-center justify-center text-[var(--text-3)] hover:text-[var(--accent)] hover:bg-[var(--sunken)] rounded-[var(--r-control)] cursor-pointer"
                            title="مشاركة السيناريو"
                          >
                            <Share2 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicate(scen.id)}
                            aria-label={`تكرار سيناريو ${scen.name}`}
                            className="p-2 min-w-[32px] min-h-[32px] flex items-center justify-center text-[var(--text-3)] hover:text-[var(--accent)] hover:bg-[var(--sunken)] rounded-[var(--r-control)] cursor-pointer"
                            title="تكرار السيناريو"
                          >
                            <Files size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartRename(scen)}
                            aria-label={`إعادة تسمية سيناريو ${scen.name}`}
                            className="p-2 min-w-[32px] min-h-[32px] flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--sunken)] rounded-[var(--r-control)] cursor-pointer"
                            title="إعادة التسمية"
                          >
                            <Pencil size={15} />
                          </button>
                          {scenarios.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDelete(scen.id)}
                              aria-label={`حذف سيناريو ${scen.name}`}
                              className="p-2 min-w-[32px] min-h-[32px] flex items-center justify-center text-[var(--text-3)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] rounded-[var(--r-control)] cursor-pointer"
                              title="حذف"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {mode === "new" && (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-[var(--text)] mb-1">
                  اسم السيناريو <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: خطة التخرج السريع مع صيفي"
                  value={newScenarioName}
                  onChange={(e) => setNewScenarioName(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] bg-[var(--surface)] border border-[var(--line-control)] rounded-[var(--r-control)] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[var(--text)] mb-1">
                  وصف مختصر (اختياري)
                </label>
                <textarea
                  rows={2}
                  placeholder="ملاحظات حول هذا التوزيع..."
                  value={newScenarioDesc}
                  onChange={(e) => setNewScenarioDesc(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] bg-[var(--surface)] border border-[var(--line-control)] rounded-[var(--r-control)] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMode("list")}
                  className="px-3.5 py-1.5 text-[12.5px] border border-[var(--line-control)] rounded-[var(--r-control)] text-[var(--text-2)] hover:bg-[var(--sunken)] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-[12.5px] font-semibold bg-[var(--accent)] text-[var(--text-on-accent)] rounded-[var(--r-control)] hover:opacity-90 cursor-pointer"
                >
                  حفظ السيناريو
                </button>
              </div>
            </form>
          )}

          {mode === "share" && shareTargetScenario && (
            <div className="space-y-4">
              <p className="text-[13px] text-[var(--text-2)]">
                تم توليد رمز مشاركة آمن للسيناريو (
                <strong>{shareTargetScenario.name}</strong>). يمكن لزملائك نسخ
                هذا الرمز واستيراد نفس توزيع الخطة فوراً:
              </p>

              <div className="relative">
                <textarea
                  readOnly
                  rows={3}
                  value={exportScenarioToShareCode(shareTargetScenario)}
                  className="w-full p-2.5 text-[11.5px] font-mono bg-[var(--sunken)] border border-[var(--line-control)] rounded-[var(--r-control)] text-[var(--text)] break-all select-all focus:outline-none"
                />
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setMode("list")}
                  className="px-3.5 py-1.5 text-[12.5px] border border-[var(--line-control)] rounded-[var(--r-control)] text-[var(--text-2)] hover:bg-[var(--sunken)] cursor-pointer"
                >
                  رجوع
                </button>

                <button
                  type="button"
                  onClick={handleCopyShareCode}
                  className="px-4 py-1.5 text-[12.5px] font-semibold bg-[var(--accent)] text-[var(--text-on-accent)] rounded-[var(--r-control)] flex items-center gap-1.5 hover:opacity-90 cursor-pointer"
                >
                  {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedCode ? "تم النسخ بنجاح!" : "نسخ الرمز"}</span>
                </button>
              </div>
            </div>
          )}

          {mode === "import" && (
            <form onSubmit={handleImport} className="space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-[var(--text)] mb-1">
                  ألصق رمز المشاركة (يبدأ بـ PTUK-PLAN-):
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="PTUK-PLAN-..."
                  value={importCode}
                  onChange={(e) => setImportCode(e.target.value)}
                  className="w-full p-2.5 text-[12px] font-mono bg-[var(--surface)] border border-[var(--line-control)] rounded-[var(--r-control)] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  autoFocus
                />
              </div>

              {importError && (
                <div className="p-2.5 text-[12px] bg-[var(--danger-soft)] text-[var(--danger)] rounded-[var(--r-control)]">
                  {importError}
                </div>
              )}

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setMode("list")}
                  className="px-3.5 py-1.5 text-[12.5px] border border-[var(--line-control)] rounded-[var(--r-control)] text-[var(--text-2)] hover:bg-[var(--sunken)] cursor-pointer"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  className="px-4 py-1.5 text-[12.5px] font-semibold bg-[var(--accent)] text-[var(--text-on-accent)] rounded-[var(--r-control)] hover:opacity-90 cursor-pointer"
                >
                  استيراد الخطة
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlanScenarioModal;
