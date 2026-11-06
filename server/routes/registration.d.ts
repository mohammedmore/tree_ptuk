import type { Router } from "express";

export function broadcastRegistrationEvent(
  eventType: string,
  payload?: any,
): void;

export function closeAllSseClients(): void;

declare const router: Router;
export default router;
