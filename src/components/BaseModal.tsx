import React, { useEffect, useId, useRef } from "react";
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
  ariaLabel?: string;
}

let openModalCount = 0;
let bodyOverflowBeforeModal = "";

const ModalContent: React.FC<Omit<BaseModalProps, "isOpen">> = ({
  onClose,
  title,
  children,
  maxWidth = "max-w-2xl",
  className,
  ariaLabel,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    if (openModalCount === 0)
      bodyOverflowBeforeModal = document.body.style.overflow;
    openModalCount += 1;
    document.body.style.overflow = "hidden";
    (closeButtonRef.current ?? dialogRef.current)?.focus();

    return () => {
      openModalCount -= 1;
      if (openModalCount === 0)
        document.body.style.overflow = bodyOverflowBeforeModal;
      if (
        previouslyFocused instanceof HTMLElement &&
        previouslyFocused.isConnected
      ) {
        previouslyFocused.focus();
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const dialog = dialogRef.current;
      const dialogs =
        document.querySelectorAll<HTMLElement>("[data-base-modal]");
      if (!dialog || dialogs[dialogs.length - 1] !== dialog) return;

      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;
      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === firstElement ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        lastElement.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === lastElement ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm z-[110] flex items-center justify-center p-2 sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={dialogRef}
        data-base-modal
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : (ariaLabel ?? "نافذة حوارية")}
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl shadow-xl shadow-slate-900/15 dark:shadow-black/30 relative overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] w-full",
          maxWidth,
          className,
        )}
      >
        {title ? (
          <div className="p-3 sm:p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60 shrink-0">
            <h2
              id={titleId}
              className="text-base sm:text-xl font-bold text-slate-900 dark:text-slate-100"
            >
              {title}
            </h2>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="إغلاق النافذة"
              className="min-h-11 min-w-11 flex items-center justify-center p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="إغلاق النافذة"
            className="absolute top-3 left-3 z-20 min-h-11 min-w-11 flex items-center justify-center p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors"
          >
            <X size={20} aria-hidden="true" />
          </button>
        )}
        <div className="overflow-y-auto flex-1 custom-scrollbar">{children}</div>
      </motion.div>
    </div>
  );
};

export const BaseModal: React.FC<BaseModalProps> = ({ isOpen, ...props }) => (
  <AnimatePresence>{isOpen && <ModalContent {...props} />}</AnimatePresence>
);
