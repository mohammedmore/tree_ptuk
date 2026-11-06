import { create } from "zustand";
import type { ScheduleEntry } from "../data";
import type { ScheduleDraft } from "../core/scheduleDrafts";
import type { TrackedSeat } from "../core/seatTracker";

export interface ScheduleState {
  weeklySchedule: Record<string, Record<string, ScheduleEntry>>;
  scheduleDrafts: ScheduleDraft[];
  activeDraftId: string | null;
  trackedSeats: TrackedSeat[];
  timeFormat: "12h" | "24h";

  // Actions
  setWeeklySchedule: (
    schedule:
      | Record<string, Record<string, ScheduleEntry>>
      | ((
          prev: Record<string, Record<string, ScheduleEntry>>,
        ) => Record<string, Record<string, ScheduleEntry>>),
  ) => void;
  setScheduleEntry: (
    day: string,
    time: string,
    entry: ScheduleEntry | null,
  ) => void;
  clearWeeklySchedule: () => void;
  setScheduleDrafts: (drafts: ScheduleDraft[]) => void;
  setActiveDraftId: (id: string | null) => void;
  setTrackedSeats: (
    seats: TrackedSeat[] | ((prev: TrackedSeat[]) => TrackedSeat[]),
  ) => void;
  addTrackedSeat: (seat: TrackedSeat) => void;
  removeTrackedSeat: (courseCode: string, sec: string) => void;
  setTimeFormat: (format: "12h" | "24h") => void;
}

export const useScheduleStore = create<ScheduleState>((set) => ({
  weeklySchedule: {},
  scheduleDrafts: [],
  activeDraftId: null,
  trackedSeats: [],
  timeFormat: "12h",

  setWeeklySchedule: (schedule) =>
    set((state) => ({
      weeklySchedule:
        typeof schedule === "function"
          ? schedule(state.weeklySchedule)
          : schedule,
    })),

  setScheduleEntry: (day, time, entry) =>
    set((state) => {
      const next = { ...state.weeklySchedule };
      if (!next[day]) next[day] = {};

      if (entry === null) {
        delete next[day][time];
        if (Object.keys(next[day]).length === 0) {
          delete next[day];
        }
      } else {
        next[day] = {
          ...next[day],
          [time]: entry,
        };
      }

      return { weeklySchedule: next };
    }),

  clearWeeklySchedule: () => set({ weeklySchedule: {} }),
  setScheduleDrafts: (scheduleDrafts) => set({ scheduleDrafts }),
  setActiveDraftId: (activeDraftId) => set({ activeDraftId }),

  setTrackedSeats: (seats) =>
    set((state) => ({
      trackedSeats:
        typeof seats === "function" ? seats(state.trackedSeats) : seats,
    })),

  addTrackedSeat: (seat) =>
    set((state) => {
      const filtered = state.trackedSeats.filter(
        (s) => !(s.courseCode === seat.courseCode && s.sec === seat.sec),
      );
      return { trackedSeats: [seat, ...filtered] };
    }),

  removeTrackedSeat: (courseCode, sec) =>
    set((state) => ({
      trackedSeats: state.trackedSeats.filter(
        (s) => !(s.courseCode === courseCode && s.sec === sec),
      ),
    })),

  setTimeFormat: (timeFormat) => set({ timeFormat }),
}));
