export function encryptPayload(data: any): string;
export function decryptPayload(encryptedString: string): string | null;
export function signSessionToken(
  payload: any,
  expiresInSeconds?: number,
): string;
export function verifySessionToken(token: string): any;
export function timingSafeEqualStrings(a: string, b: string): boolean;
export function revokeSessionToken(token: string): boolean;
export function isSessionTokenRevoked(token: string): boolean;
export function isAccountLocked(studentId: string): {
  locked: boolean;
  remainingSeconds: number;
};
export function recordFailedLogin(studentId: string): any;
export function recordSuccessfulLogin(studentId: string): void;
