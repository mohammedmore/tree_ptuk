import { useState, useCallback } from "react";

export type ModalName =
  | "addCourse"
  | "resetConfirmation"
  | "majorSelector"
  | "support"
  | "export"
  | "weeklySchedule"
  | "shareSchedule"
  | "loadSchedule"
  | "sharedPreview"
  | "studentPortal"
  | "commandPalette"
  | "courseComparison";

export function useModalManager() {
  const [activeModals, setActiveModals] = useState<Record<string, boolean>>({});
  const [modalPayloads, setModalPayloads] = useState<Record<string, any>>({});

  const isOpen = useCallback(
    (name: ModalName): boolean => Boolean(activeModals[name]),
    [activeModals],
  );

  const open = useCallback((name: ModalName, payload?: any) => {
    setActiveModals((prev) => ({ ...prev, [name]: true }));
    if (payload !== undefined) {
      setModalPayloads((prev) => ({ ...prev, [name]: payload }));
    }
  }, []);

  const close = useCallback((name: ModalName) => {
    setActiveModals((prev) => ({ ...prev, [name]: false }));
    setModalPayloads((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const getPayload = useCallback(
    <T = any>(name: ModalName): T | undefined => modalPayloads[name],
    [modalPayloads],
  );

  return {
    isOpen,
    open,
    close,
    getPayload,
  };
}
