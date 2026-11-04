/**
 * Offline Mutation Queue
 * Stores pending mutations (plan saves, shared schedule snapshots) when network is offline,
 * and automatically drains & synchronizes them when connectivity is restored.
 */

export interface QueuedMutation {
  id: string;
  type: "SAVE_PLAN" | "SHARE_SCHEDULE" | "UPDATE_DRAFT";
  payload: any;
  timestamp: number;
  retryCount: number;
}

const QUEUE_STORAGE_KEY = "ptuk_offline_mutation_queue_v1";

export function getOfflineQueue(): QueuedMutation[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue: QueuedMutation[]): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.warn("Could not persist offline mutation queue:", err);
  }
}

export function enqueueMutation(
  type: QueuedMutation["type"],
  payload: any,
): void {
  const queue = getOfflineQueue();
  const item: QueuedMutation = {
    id: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    payload,
    timestamp: Date.now(),
    retryCount: 0,
  };
  queue.push(item);
  saveOfflineQueue(queue);
}

export async function drainOfflineQueue(
  handler: (item: QueuedMutation) => Promise<boolean>,
): Promise<number> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return 0;

  const remaining: QueuedMutation[] = [];
  let successful = 0;

  for (const item of queue) {
    try {
      const ok = await handler(item);
      if (ok) {
        successful++;
      } else {
        item.retryCount++;
        if (item.retryCount < 5) remaining.push(item);
      }
    } catch {
      item.retryCount++;
      if (item.retryCount < 5) remaining.push(item);
    }
  }

  saveOfflineQueue(remaining);
  return successful;
}
