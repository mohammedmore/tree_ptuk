import React from "react";
import { Trash2 } from "lucide-react";

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
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full animate-in fade-in zoom-in duration-200 shadow-2xl">
        <div className="flex items-center gap-3 mb-4 text-red-600">
          <Trash2 size={24} />
          <h3 className="text-xl font-black">تهيئة البيانات</h3>
        </div>
        <p className="text-gray-650 font-medium text-sm mb-6 leading-relaxed">
          هل أنت متأكد من مسح كافة بيانات المواد المنجزة؟ هذا الإجراء لا
          يمكن التراجع عنه.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-xl transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-colors shadow-md shadow-red-200"
          >
            تأكيد الحذف
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetConfirmationModal;
