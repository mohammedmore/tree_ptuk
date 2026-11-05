import type { RequestHandler } from "express";

export const sanitizeQuery: RequestHandler;
export const sanitizeBody: RequestHandler;
export const enforceContentType: RequestHandler;
export const additionalSecurityHeaders: RequestHandler;
export function verifyCsrfOrigin(allowedOrigins?: string[]): RequestHandler;
export function validateSsrfTarget(
  urlExtractor?: (req: any) => string | undefined,
): RequestHandler;
export const requireAdminAuth: RequestHandler;
export const authenticateStudentSession: RequestHandler;
export const extractClientIdentity: RequestHandler;
