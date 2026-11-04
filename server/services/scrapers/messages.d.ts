export function normalizeArabicMessage(text: string): string;

export interface ClassifiedMessage {
  code: string;
  userMessage: string;
  rawText: string;
}

export function classifyPortalMessage(text: string): ClassifiedMessage;

export const MESSAGE_PATTERNS: Array<{
  code: string;
  pattern: RegExp;
  userMessage: string;
}>;
