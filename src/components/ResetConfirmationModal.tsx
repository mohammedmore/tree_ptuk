import React from "react";
import { Trash2 } from "lucide-react";
import { BaseModal } from "./BaseModal";

interface ResetConfirmationModalProps {
  showResetConfirm: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const ResetConfirmationModal: React.FC<ResetConfirmationModalProps> = ({
  showResetConfirm,
  onClose,
  onConfirm,
}) => {
  if (!showResetConfirm) return null;

  return (
    <BaseModal isOpen={showResetConfirm} onClose={onClose} title="تهيئة البيانات" maxWidth="max-w-sm">
      <div className="p-6" dir="rtl">
        <div className="flex items-center gap-3 mb-4 text-red-600">
          <Trash2 size={24} aria-hidden="true" />
          <p className="text-sm font-bold">إجراء لا يمكن التراجع عنه</p>
        </div>
        <p className="text-gray-650 dark:text-slate-300 font-medium text-sm mb-6 leading-relaxed">
          هل أنت متأكد من مسح كافة بيانات المواد المنجزة؟ هذا الإجراء لا
          يمكن التراجع عنه.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-sm font-bold rounded-xl transition-colors"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-colors shadow-md shadow-red-200"
          >
            تأكيد الحذف
          </button>
        </div>
      </div>
    </BaseModal>
  );
};

export default ResetConfirmationModal;
