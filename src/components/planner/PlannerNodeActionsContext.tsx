import React, { createContext, useContext } from "react";

export interface PlannerNodeActions {
  onToggleComplete: (courseId: string) => void;
  onSelectDetails: (courseId: string) => void;
  onTogglePin: (courseId: string) => void;
}

export const PlannerNodeActionsContext =
  createContext<PlannerNodeActions | null>(null);

export const usePlannerNodeActions = (): PlannerNodeActions | null => {
  return useContext(PlannerNodeActionsContext);
};
