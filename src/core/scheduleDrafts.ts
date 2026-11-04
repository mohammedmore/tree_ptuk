import type { ScheduleEntry } from "../data";

export interface ScheduleDraft {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  schedule: Record<string, ScheduleEntry>;
}

const DRAFTS_KEY_PREFIX = "ptuk_schedule_drafts_v1_";
const ACTIVE_DRAFT_KEY_PREFIX = "ptuk_active_draft_id_v1_";

function getStorageKey(semester: string): string {
  return `${DRAFTS_KEY_PREFIX}${semester.replace(/\s+/g, "_")}`;
}

function getActiveKey(semester: string): string {
  return `${ACTIVE_DRAFT_KEY_PREFIX}${semester.replace(/\s+/g, "_")}`;
}

/**
 * Loads all drafts for a semester. If none exist, initializes a default primary draft
 * populated with the current live schedule.
 */
export function getSemesterDrafts(
  semester: string,
  currentLiveSchedule?: Record<string, ScheduleEntry>,
): ScheduleDraft[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [
      {
        id: "draft-default",
        name: "المسودة 1 (الأساسية)",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        schedule: currentLiveSchedule || {},
      },
    ];
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(semester));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Error reading drafts from localStorage:", err);
  }

  // Fallback initial draft
  const initialDraft: ScheduleDraft = {
    id: `draft-primary-${Date.now()}`,
    name: "المسودة 1 (الأساسية)",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    schedule: currentLiveSchedule || {},
  };

  saveSemesterDrafts(semester, [initialDraft]);
  setActiveDraftId(semester, initialDraft.id);
  return [initialDraft];
}

/**
 * Persists full drafts array for a semester.
 */
export function saveSemesterDrafts(
  semester: string,
  drafts: ScheduleDraft[],
): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      getStorageKey(semester),
      JSON.stringify(drafts),
    );
  } catch (err) {
    console.error("Error saving drafts to localStorage:", err);
  }
}

/**
 * Gets active draft id for a semester.
 */
export function getActiveDraftId(semester: string): string | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage.getItem(getActiveKey(semester));
}

/**
 * Sets active draft id for a semester.
 */
export function setActiveDraftId(semester: string, draftId: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(getActiveKey(semester), draftId);
  } catch (err) {
    console.error("Error setting active draft id in localStorage:", err);
  }
}

/**
 * Updates the schedule of an existing draft.
 */
export function updateDraftSchedule(
  semester: string,
  draftId: string,
  schedule: Record<string, ScheduleEntry>,
): ScheduleDraft[] {
  const drafts = getSemesterDrafts(semester);
  const updated = drafts.map((d) =>
    d.id === draftId ? { ...d, schedule, updatedAt: Date.now() } : d,
  );
  saveSemesterDrafts(semester, updated);
  return updated;
}

/**
 * Creates a new draft for a semester.
 */
export function createSemesterDraft(
  semester: string,
  name?: string,
  schedule: Record<string, ScheduleEntry> = {},
): ScheduleDraft {
  const drafts = getSemesterDrafts(semester);
  const draftNumber = drafts.length + 1;
  const draftName = name?.trim() || `المسودة ${draftNumber}`;

  const newDraft: ScheduleDraft = {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: draftName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    schedule,
  };

  const next = [...drafts, newDraft];
  saveSemesterDrafts(semester, next);
  setActiveDraftId(semester, newDraft.id);
  return newDraft;
}

/**
 * Duplicates an existing draft.
 */
export function duplicateSemesterDraft(
  semester: string,
  draftId: string,
): ScheduleDraft | null {
  const drafts = getSemesterDrafts(semester);
  const target = drafts.find((d) => d.id === draftId);
  if (!target) return null;

  const copyName = `${target.name} (نسخة)`;
  const newDraft: ScheduleDraft = {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: copyName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    schedule: { ...target.schedule },
  };

  const next = [...drafts, newDraft];
  saveSemesterDrafts(semester, next);
  setActiveDraftId(semester, newDraft.id);
  return newDraft;
}

/**
 * Renames a draft.
 */
export function renameSemesterDraft(
  semester: string,
  draftId: string,
  newName: string,
): ScheduleDraft[] {
  const trimmed = newName.trim();
  if (!trimmed) return getSemesterDrafts(semester);

  const drafts = getSemesterDrafts(semester);
  const updated = drafts.map((d) =>
    d.id === draftId ? { ...d, name: trimmed, updatedAt: Date.now() } : d,
  );
  saveSemesterDrafts(semester, updated);
  return updated;
}

/**
 * Deletes a draft (ensures at least 1 draft always remains).
 */
export function deleteSemesterDraft(
  semester: string,
  draftId: string,
): { updatedDrafts: ScheduleDraft[]; newActiveId: string } {
  const drafts = getSemesterDrafts(semester);
  if (drafts.length <= 1) {
    return { updatedDrafts: drafts, newActiveId: drafts[0].id };
  }

  const updated = drafts.filter((d) => d.id !== draftId);
  saveSemesterDrafts(semester, updated);

  const currentActive = getActiveDraftId(semester);
  let nextActive = currentActive;
  if (
    currentActive === draftId ||
    !updated.some((d) => d.id === currentActive)
  ) {
    nextActive = updated[0].id;
    setActiveDraftId(semester, nextActive);
  }

  return { updatedDrafts: updated, newActiveId: nextActive! };
}
