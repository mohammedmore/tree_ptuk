export function isAllowedPtukHost(hostname: string): boolean;
export function isPrivateOrReservedIp(ip: string): boolean;
export function isSafeOutboundUrl(
  urlStr: string,
  options?: { allowLocalDev?: boolean },
): { safe: boolean; reason?: string; url?: URL };
export function assertSafeOutboundUrl(
  urlStr: string,
  options?: { allowLocalDev?: boolean },
): URL;
