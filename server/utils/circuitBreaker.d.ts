export interface CircuitStatus {
  name: string;
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  consecutiveFailures: number;
  tripCount: number;
  lastFailureTime: string | null;
  lastSuccessTime: string | null;
  lastErrorMessage: string | null;
}

export interface CircuitBreakerInstance {
  canExecute(): {
    allowed: boolean;
    reason?: string;
    state: string;
    remainingSeconds?: number;
  };
  recordSuccess(): void;
  recordFailure(error: any): void;
  getStatus(): CircuitStatus;
  reset(): void;
}

export const edugateCircuitBreaker: CircuitBreakerInstance;
