import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16;
const HKDF_SALT = Buffer.from("ptuk-secure-planner-salt-v1", "utf8");
const HKDF_INFO = Buffer.from("ptuk-vault-encryption-key", "utf8");

// Ephemeral fallback key generated once at process start if no secret is configured
const EPHEMERAL_PROCESS_SECRET = crypto.randomBytes(32).toString("hex");

/**
 * Redacts student IDs for privacy compliance in logs and telemetry (e.g. 202110123 -> 20211****).
 * @param {string|number} id
 * @returns {string}
 */
export function maskStudentId(id) {
  if (!id) return "****";
  const str = String(id).trim();
  if (str.length <= 4) return "****";
  return str.slice(0, 5) + "*".repeat(Math.max(1, str.length - 5));
}

/**
 * Derives a cryptographically strong 32-byte key using HKDF (SHA-256).
 */
function getEncryptionKey(version = "v1") {
  const rawSecret =
    process.env.SESSION_SECRET ||
    process.env.SYNC_API_KEY ||
    (process.env.NODE_ENV === "production"
      ? EPHEMERAL_PROCESS_SECRET
      : "ptuk-planner-vault-secure-key-2026");

  if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
    console.warn(
      "⚠️ [SECURITY WARNING] SESSION_SECRET is not set in production. Using ephemeral in-memory secret.",
    );
  }

  // Derive 32 bytes using HKDF-SHA256
  return crypto.hkdfSync("sha256", rawSecret, HKDF_SALT, HKDF_INFO, 32);
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Uses SHA-256 hashing to guarantee equal buffer lengths.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function timingSafeEqualStrings(a, b) {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }
  const hashA = crypto.createHash("sha256").update(a).digest();
  const hashB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Hashes a student password securely with a salt for local fast authentication caching.
 * Uses crypto.scryptSync with 32 bytes derived key.
 * Format: "salt:hash"
 * @param {string} password
 * @returns {string}
 */
export function hashStudentPassword(password) {
  if (typeof password !== "string" || !password) return "";
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verifies a student password against a stored hashed password.
 * @param {string} password
 * @param {string} storedHash
 * @returns {boolean}
 */
export function verifyStudentPassword(password, storedHash) {
  if (
    typeof password !== "string" ||
    !password ||
    typeof storedHash !== "string" ||
    !storedHash
  ) {
    return false;
  }
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, expectedHash] = parts;
  try {
    const computedHash = crypto.scryptSync(password, salt, 32).toString("hex");
    return timingSafeEqualStrings(computedHash, expectedHash);
  } catch {
    return false;
  }
}

/**
 * Encrypts sensitive payload using AES-256-GCM.
 * @param {string|object} data
 * @returns {string} Hex encoded payload (iv:tag:ciphertext)
 */
export function encryptPayload(data) {
  if (data === undefined || data === null || data === "") return "";
  const text = typeof data === "object" ? JSON.stringify(data) : String(data);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts AES-256-GCM payload.
 * @param {string} encryptedString
 * @returns {string|null} Decrypted plaintext or null if compromised/invalid
 */
export function decryptPayload(encryptedString) {
  if (!encryptedString || typeof encryptedString !== "string") return null;
  let raw = encryptedString;
  let version = "v1";
  if (raw.startsWith("v1:") || raw.startsWith("v2:")) {
    const colonIdx = raw.indexOf(":");
    version = raw.slice(0, colonIdx);
    raw = raw.slice(colonIdx + 1);
  }
  const parts = raw.split(":");
  if (parts.length !== 3) return null;

  try {
    const [ivHex, tagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(tagHex, "hex");
    if (iv.length !== IV_LENGTH || authTag.length !== TAG_LENGTH) {
      return null;
    }

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      getEncryptionKey(version),
      iv,
    );
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return null;
  }
}

/**
 * Base64URL encoding helper
 */
function base64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Base64URL decoding helper
 */
function unbase64url(input) {
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf8");
}

// ─── Token Revocation Blacklist ───────────────────────────────────────────
const revokedTokens = new Map(); // signature -> expiry timestamp
const REVOCATION_CLEANUP_INTERVAL_MS = 60 * 1000;

const cleanupInterval = setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const [sig, exp] of revokedTokens.entries()) {
    if (exp <= now) {
      revokedTokens.delete(sig);
    }
  }
}, REVOCATION_CLEANUP_INTERVAL_MS);
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

/**
 * Revokes a session token immediately.
 * @param {string} token
 * @returns {boolean}
 */
export function revokeSessionToken(token) {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [, encodedPayload, signature] = parts;
  try {
    const payload = JSON.parse(unbase64url(encodedPayload));
    const exp = payload.exp || Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
    revokedTokens.set(signature, exp);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a session token has been revoked.
 * @param {string} token
 * @returns {boolean}
 */
export function isSessionTokenRevoked(token) {
  if (!token || typeof token !== "string") return true;
  const parts = token.split(".");
  if (parts.length !== 3) return true;
  const signature = parts[2];
  return revokedTokens.has(signature);
}

// ─── Account-Based Brute Force Lockout Tracker (Dual-Key Security) ────────
const accountLockouts = new Map(); // studentId -> { attempts: number, firstAttempt: number, lockedUntil: number }
const MAX_FAILED_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout

/**
 * Checks if an account is locked due to repeated failed logins.
 * @param {string} studentId
 * @returns {{ locked: boolean, remainingSeconds: number }}
 */
export function isAccountLocked(studentId) {
  if (!studentId) return { locked: false, remainingSeconds: 0 };
  const normId = String(studentId).trim().toLowerCase();
  const state = accountLockouts.get(normId);
  if (!state) return { locked: false, remainingSeconds: 0 };

  const now = Date.now();
  if (state.lockedUntil && state.lockedUntil > now) {
    const remainingSeconds = Math.ceil((state.lockedUntil - now) / 1000);
    return { locked: true, remainingSeconds };
  }

  // Lockout expired
  if (state.lockedUntil && state.lockedUntil <= now) {
    accountLockouts.delete(normId);
  }

  return { locked: false, remainingSeconds: 0 };
}

/**
 * Records a failed login attempt for an account.
 * Triggers a 15-minute lockout if threshold is exceeded.
 * @param {string} studentId
 */
export function recordFailedLogin(studentId) {
  if (!studentId) return;
  const normId = String(studentId).trim().toLowerCase();
  const now = Date.now();
  const state = accountLockouts.get(normId) || {
    attempts: 0,
    firstAttempt: now,
    lockedUntil: 0,
  };

  if (now - state.firstAttempt > ATTEMPT_WINDOW_MS) {
    state.attempts = 1;
    state.firstAttempt = now;
    state.lockedUntil = 0;
  } else {
    state.attempts += 1;
  }

  if (state.attempts >= MAX_FAILED_ATTEMPTS) {
    state.lockedUntil = now + LOCKOUT_DURATION_MS;
    console.warn(
      `🚨 [SECURITY LOCKOUT] Account (${normId}) locked for 15 minutes after ${state.attempts} failed login attempts.`,
    );
  }

  accountLockouts.set(normId, state);
  return state;
}

/**
 * Resets failed attempts upon successful authentication.
 * @param {string} studentId
 */
export function recordSuccessfulLogin(studentId) {
  if (!studentId) return;
  const normId = String(studentId).trim().toLowerCase();
  accountLockouts.delete(normId);
}

/**
 * Signs a tamper-proof session token using HMAC-SHA256.
 * @param {object} payload
 * @param {number} [expiresInSeconds=604800] Default 7 days
 * @returns {string}
 */
export function signSessionToken(payload, expiresInSeconds = 7 * 24 * 3600) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(fullPayload));
  const message = `${encodedHeader}.${encodedPayload}`;

  const hmac = crypto.createHmac("sha256", getEncryptionKey());
  hmac.update(message);
  const signature = base64url(hmac.digest());

  return `${message}.${signature}`;
}

/**
 * Verifies a signed session token.
 * Checks HMAC signature, expiration, and revocation status.
 * @param {string} token
 * @returns {object|null} Decoded payload or null if invalid/expired/revoked
 */
export function verifySessionToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  if (isSessionTokenRevoked(token)) {
    return null; // Token was revoked
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const message = `${encodedHeader}.${encodedPayload}`;

  const hmac = crypto.createHmac("sha256", getEncryptionKey());
  hmac.update(message);
  const expectedSignature = base64url(hmac.digest());

  if (!timingSafeEqualStrings(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(unbase64url(encodedPayload));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return null; // Expired token
    }

    return payload;
  } catch {
    return null;
  }
}
