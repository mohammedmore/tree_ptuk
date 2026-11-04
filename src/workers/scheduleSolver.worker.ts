/**
 * Web Worker for PTUK Schedule Solver.
 * Executes combinatorial schedule generation and conflict analysis in the background
 * to prevent main thread freezing and maintain 60 FPS UI responsiveness.
 */

import {
  generateAllSchedules,
  explainScheduleConflicts,
} from "../services/scheduleSolver";

export interface SolverWorkerRequest {
  id: string;
  type: "GENERATE_SCHEDULES" | "EXPLAIN_CONFLICTS";
  courses: any[];
  filters: any;
}

export interface SolverWorkerResponse {
  id: string;
  type: "SCHEDULES_GENERATED" | "CONFLICTS_EXPLAINED" | "ERROR";
  result?: any;
  error?: string;
}

self.onmessage = (event: MessageEvent<SolverWorkerRequest>) => {
  const { id, type, courses, filters } = event.data;

  try {
    if (type === "GENERATE_SCHEDULES") {
      const schedules = generateAllSchedules(courses, filters);
      const response: SolverWorkerResponse = {
        id,
        type: "SCHEDULES_GENERATED",
        result: schedules,
      };
      self.postMessage(response);
    } else if (type === "EXPLAIN_CONFLICTS") {
      const explanation = explainScheduleConflicts(courses, filters);
      const response: SolverWorkerResponse = {
        id,
        type: "CONFLICTS_EXPLAINED",
        result: explanation,
      };
      self.postMessage(response);
    }
  } catch (err) {
    const response: SolverWorkerResponse = {
      id,
      type: "ERROR",
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
