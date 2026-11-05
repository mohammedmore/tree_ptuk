/**
 * Circuit Breaker for University Edugate Gateway
 * Prevents cascading failure, socket exhaustion, and long browser timeouts
 * when upstream university servers are under heavy load or down.
 */

const STATE = {
  CLOSED: "CLOSED", // Normal operation: requests pass through
  OPEN: "OPEN", // Tripped: requests fail fast without spawning Playwright
  HALF_OPEN: "HALF_OPEN", // Canary testing: allows single probe request
};

class CircuitBreaker {
  constructor(options = {}) {
    this.name = options.name || "EdugateGateway";
    this.failureThreshold = options.failureThreshold || 3; // Trips after 3 consecutive failures
    this.cooldownMs = options.cooldownMs || 60 * 1000; // 60 seconds cooldown before half-open probe
    this.consecutiveFailures = 0;
    this.state = STATE.CLOSED;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.lastErrorMessage = null;
  }

  /**
   * Checks if requests to Edugate should be permitted.
   * @returns {{ allowed: boolean, reason?: string, state: string }}
   */
  canExecute() {
    const now = Date.now();

    if (this.state === STATE.OPEN) {
      if (now - this.lastFailureTime > this.cooldownMs) {
        this.state = STATE.HALF_OPEN;
        console.log(
          `🟡 [CIRCUIT BREAKER] ${this.name} entered HALF_OPEN state. Permitting canary probe.`,
        );
        return { allowed: true, state: this.state };
      }

      const remainingSec = Math.ceil(
        (this.cooldownMs - (now - this.lastFailureTime)) / 1000,
      );
      return {
        allowed: false,
        state: this.state,
        reason: `بوابة الجامعة تحت ضغط شديد أو تخضع للصيانة حالياً (Circuit Breaker Tripped). يرجى المحاولة بعد ${remainingSec} ثانية.`,
        remainingSeconds: remainingSec,
      };
    }

    return { allowed: true, state: this.state };
  }

  /**
   * Records a successful communication with Edugate.
   */
  recordSuccess() {
    this.consecutiveFailures = 0;
    this.lastSuccessTime = new Date().toISOString();
    this.lastErrorMessage = null;

    if (this.state !== STATE.CLOSED) {
      console.log(
        `🟢 [CIRCUIT BREAKER] ${this.name} recovered. State reset to CLOSED.`,
      );
      this.state = STATE.CLOSED;
    }
  }

  /**
   * Records a failure contacting Edugate.
   * Ignores user credential errors (invalid password is NOT a server outage).
   * @param {Error|string} error
   */
  recordFailure(error) {
    const msg = error instanceof Error ? error.message : String(error || "");

    // Do NOT trip circuit on student user errors (wrong password, warning, not registered)
    const isClientAuthError =
      msg.includes("كلمة المرور") ||
      msg.includes("اسم المستخدم") ||
      msg.includes("بيانات الدخول") ||
      msg.includes("credentials") ||
      msg.includes("الرقم الجامعي");

    if (isClientAuthError) {
      return;
    }

    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();
    this.lastErrorMessage = msg;

    if (this.consecutiveFailures >= this.failureThreshold) {
      this.state = STATE.OPEN;
      console.warn(
        `🚨 [CIRCUIT BREAKER] ${this.name} TRIPPED to OPEN after ${this.consecutiveFailures} consecutive upstream failures. Reason: ${msg}`,
      );
    }
  }

  getStatus() {
    return {
      name: this.name,
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      lastFailureTime: this.lastFailureTime
        ? new Date(this.lastFailureTime).toISOString()
        : null,
      lastSuccessTime: this.lastSuccessTime,
      lastErrorMessage: this.lastErrorMessage,
    };
  }

  reset() {
    this.consecutiveFailures = 0;
    this.state = STATE.CLOSED;
    this.lastFailureTime = null;
    this.lastErrorMessage = null;
  }
}

export const edugateCircuitBreaker = new CircuitBreaker({
  name: "PTUK-Edugate-Portal",
  failureThreshold: 3,
  cooldownMs: 60 * 1000,
});
