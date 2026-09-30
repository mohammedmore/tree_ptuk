import React from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../utils";

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
  className?: string;
}

export const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "max-w-2xl",
  className
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xl z-[110] flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className={cn("bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl sm:rounded-3xl shadow-2xl shadow-gray-900/20 dark:shadow-slate-950/50 relative overflow-hidden border border-gray-200/50 dark:border-slate-700/50 flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] w-full", maxWidth, className)}
          >
            {title && (
              <div className="p-4 sm:p-6 border-b border-gray-200/50 dark:border-slate-700/50 flex justify-between items-center bg-gradient-to-r from-gray-50/80 to-slate-50/80 dark:from-slate-950/40 dark:to-slate-900/40 shrink-0">
                <div className="text-lg sm:text-xl font-extrabold bg-gradient-to-r from-gray-800 to-gray-900 dark:from-slate-100 dark:to-slate-200 bg-clip-text text-transparent">{title}</div>
                <button 
                  onClick={onClose} 
                  className="p-2 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-gray-100/80 dark:hover:bg-slate-800/80 rounded-full transition-all duration-200 hover:scale-110 hover:shadow-md"
                >
                  <X size={20} />
                </button>
              </div>
            )}
            <div className="overflow-y-auto flex-1">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};