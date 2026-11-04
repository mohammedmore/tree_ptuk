import { isIP } from "node:net";

/**
 * SSRF Guard Utility (Item 117)
 * Strictly verifies outbound target URLs to prevent Server-Side Request Forgery (SSRF),
 * blocking internal IP ranges, loopbacks, cloud metadata endpoints, and unauthorized domains.
 */

const ALLOWED_PTUK_DOMAINS = [
  "ptuk.edu.ps",
  "edugate.ptuk.edu.ps",
  "www.ptuk.edu.ps",
];

const PRIVATE_IP_PATTERNS = [
  /^127\.\d+\.\d+\.\d+$/, // Loopback IPv4
  /^10\.\d+\.\d+\.\d+$/, // Class A Private
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/, // Class B Private
  /^192\.168\.\d+\.\d+$/, // Class C Private
  /^169\.254\.\d+\.\d+$/, // Link-local / Cloud Metadata (AWS, GCP, Azure)
  /^0\.0\.0\.0$/, // Any address
  /^::1$/, // IPv6 loopback
  /^fe80:/i, // IPv6 link-local
  /^fc00:/i, // IPv6 unique local
  /^fd00:/i, // IPv6 unique local
];

/**
 * Checks if a hostname belongs to PTUK domain hierarchy.
 * @param {string} hostname
 * @returns {boolean}
 */
export function isAllowedPtukHost(hostname) {
  if (!hostname || typeof hostname !== "string") return false;
  const cleanHost = hostname.toLowerCase().trim();

  // Exact match
  if (ALLOWED_PTUK_DOMAINS.includes(cleanHost)) {
    return true;
  }

  // Subdomain match: *.ptuk.edu.ps
  if (cleanHost.endsWith(".ptuk.edu.ps")) {
    const prefix = cleanHost.slice(0, -".ptuk.edu.ps".length);
    // Disallow malformed subdomains like ..ptuk.edu.ps or malicious-ptuk.edu.ps
    return /^[a-z0-9][a-z0-9\-_.]*$/.test(prefix) && !prefix.includes("..");
  }

  return false;
}

/**
 * Checks whether an IP string is a private, loopback, or metadata address.
 * @param {string} ip
 * @returns {boolean}
 */
export function isPrivateOrReservedIp(ip) {
  if (!ip || typeof ip !== "string") return false;
  const trimmed = ip.trim();
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Validates a target URL against SSRF vulnerabilities.
 * @param {string} urlStr
 * @param {{ allowLocalDev?: boolean }} [options]
 * @returns {{ safe: boolean; reason?: string; url?: URL }}
 */
export function isSafeOutboundUrl(urlStr, options = {}) {
  const { allowLocalDev = false } = options;

  if (!urlStr || typeof urlStr !== "string") {
    return { safe: false, reason: "الرابط غير موجود أو ليس نصاً صالحاً." };
  }

  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { safe: false, reason: "صيغة الرابط غير صالحة." };
  }

  // 1. Protocol restriction: only http and https allowed
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return {
      safe: false,
      reason: `البروتوكول '${parsed.protocol}' غير مسموح به. يُسمح فقط بـ http و https.`,
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 2. Reject credentials in URL (user:pass@host)
  if (parsed.username || parsed.password) {
    return {
      safe: false,
      reason:
        "يُحظر تضمين بيانات الاعتماد (user:pass) داخل الرابط لمنع تسريبها.",
    };
  }

  // 3. Local dev bypass check (if explicitly enabled)
  if (allowLocalDev) {
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    ) {
      return { safe: true, url: parsed };
    }
  }

  // 4. IP address detection and filtering
  if (isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      return {
        safe: false,
        reason: `عناوين الشبكات الخاصة والـ Metadata محظورة لأسباب أمنية (${hostname}).`,
      };
    }
    // Block direct IP access to enforce domain whitelist
    return {
      safe: false,
      reason: "يُحظر الاتصال المباشر بعناوين IP دون اسم نطاق رسمي.",
    };
  }

  // 5. University domain whitelist
  if (!isAllowedPtukHost(hostname)) {
    return {
      safe: false,
      reason: `النطاق '${hostname}' غير مصرح به. النطاقات المسموحة تتبع جامعة خضوري (*.ptuk.edu.ps).`,
    };
  }

  return { safe: true, url: parsed };
}

/**
 * Strict validator that throws an Error if the URL is unsafe.
 * @param {string} urlStr
 * @param {{ allowLocalDev?: boolean }} [options]
 * @returns {URL}
 */
export function assertSafeOutboundUrl(urlStr, options = {}) {
  const check = isSafeOutboundUrl(urlStr, options);
  if (!check.safe) {
    throw new Error(`SSRF Blocked: ${check.reason}`);
  }
  return check.url;
}
