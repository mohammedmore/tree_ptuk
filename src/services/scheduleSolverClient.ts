import {
  generateAllSchedules,
  explainScheduleConflicts,
  type CatalogCourse,
  type CatalogScheduleFilters,
  type GeneratedScheduleCourse,
  type ConflictExplanation,
} from "./scheduleSolver";
import type {
  SolverWorkerRequest,
  SolverWorkerResponse,
} from "../workers/scheduleSolver.worker";

interface PendingResolver {
  resolve: (val: any) => void;
  reject: (err: any) => void;
  timer?: ReturnType<typeof setTimeout>;
}

class ScheduleWorkerPool {
  private workers: Worker[] = [];
  private poolSize: number;
  private currentWorkerIndex = 0;
  private pendingResolvers = new Map<string, PendingResolver>();

  constructor(poolSize = 2) {
    if (typeof navigator !== "undefined" && navigator.hardwareConcurrency) {
      this.poolSize = Math.max(
        1,
        Math.min(poolSize, Math.floor(navigator.hardwareConcurrency / 2)),
      );
    } else {
      this.poolSize = poolSize;
    }
  }

  private initWorker(): Worker | null {
    if (typeof window === "undefined" || typeof Worker === "undefined") {
      return null;
    }

    try {
      const worker = new Worker(
        new URL("../workers/scheduleSolver.worker.ts", import.meta.url),
        { type: "module" },
      );

      worker.onmessage = (event: MessageEvent<SolverWorkerResponse>) => {
        const { id, type, result, error } = event.data;
        const entry = this.pendingResolvers.get(id);
        if (!entry) return;

        if (entry.timer) clearTimeout(entry.timer);
        this.pendingResolvers.delete(id);
        if (type === "ERROR") {
          entry.reject(new Error(error || "Worker schedule generation error"));
        } else {
          entry.resolve(result);
        }
      };

      worker.onerror = (err) => {
        console.warn(
          "Schedule worker encountered an error, falling back:",
          err,
        );
        this.pendingResolvers.forEach(({ reject, timer }) => {
          if (timer) clearTimeout(timer);
          reject(new Error("Worker terminated due to error"));
        });
        this.pendingResolvers.clear();
      };

      return worker;
    } catch (e) {
      console.warn("Unable to initialize schedule solver Web Worker:", e);
      return null;
    }
  }

  private getNextWorker(): Worker | null {
    if (typeof window === "undefined" || typeof Worker === "undefined") {
      return null;
    }

    // Lazy populate pool
    if (this.workers.length < this.poolSize) {
      const newWorker = this.initWorker();
      if (newWorker) {
        this.workers.push(newWorker);
      }
    }

    if (this.workers.length === 0) return null;

    // Round-robin dispatch
    const worker = this.workers[this.currentWorkerIndex % this.workers.length];
    this.currentWorkerIndex =
      (this.currentWorkerIndex + 1) % this.workers.length;
    return worker;
  }

  public execute<T>(
    requestType: "GENERATE_SCHEDULES" | "EXPLAIN_CONFLICTS",
    courses: CatalogCourse[],
    filters: CatalogScheduleFilters = {},
    fallbackFn: () => T,
  ): Promise<T> {
    const worker = this.getNextWorker();
    if (!worker) {
      return Promise.resolve(fallbackFn());
    }

    const id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingResolvers.has(id)) {
          this.pendingResolvers.delete(id);
          try {
            resolve(fallbackFn());
          } catch (err) {
            reject(err);
          }
        }
      }, 15000);

      this.pendingResolvers.set(id, { resolve, reject, timer });

      const request: SolverWorkerRequest = {
        id,
        type: requestType,
        courses,
        filters,
      };

      worker.postMessage(request);
    });
  }

  public terminate() {
    for (const w of this.workers) {
      w.terminate();
    }
    this.workers = [];
    this.pendingResolvers.clear();
  }
}

const solverPool = new ScheduleWorkerPool(2);

/**
 * Asynchronously generates valid, conflict-free schedules using worker pool.
 */
export async function generateSchedulesAsync(
  courses: CatalogCourse[],
  filters: CatalogScheduleFilters = {},
): Promise<GeneratedScheduleCourse[][]> {
  return solverPool.execute("GENERATE_SCHEDULES", courses, filters, () =>
    generateAllSchedules(courses, filters),
  );
}

/**
 * Asynchronously detects and explains conflicts using worker pool.
 */
export async function explainConflictsAsync(
  courses: CatalogCourse[],
  filters: CatalogScheduleFilters = {},
): Promise<ConflictExplanation | null> {
  return solverPool.execute("EXPLAIN_CONFLICTS", courses, filters, () =>
    explainScheduleConflicts(courses, filters),
  );
}
