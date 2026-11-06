import { useEffect, useState, useRef } from "react";

export interface StreamEvent {
  type: string;
  payload: any;
  timestamp: string;
}

export interface UseRealtimeRegistrationStreamOptions {
  enabled?: boolean;
  onSeatUpdate?: (data: any) => void;
  onConnected?: (data: any) => void;
}

/**
 * Enterprise-grade resilient Server-Sent Events (SSE) hook.
 * Streams real-time section seat openings and registration alerts from PTUK backend.
 */
export function useRealtimeRegistrationStream(
  options: UseRealtimeRegistrationStreamOptions = {},
) {
  const { enabled = true, onSeatUpdate, onConnected } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<StreamEvent | null>(null);
  const [errorCount, setErrorCount] = useState(0);

  const onSeatUpdateRef = useRef(onSeatUpdate);
  const onConnectedRef = useRef(onConnected);

  useEffect(() => {
    onSeatUpdateRef.current = onSeatUpdate;
    onConnectedRef.current = onConnected;
  });

  useEffect(() => {
    if (
      !enabled ||
      typeof window === "undefined" ||
      !("EventSource" in window)
    ) {
      setIsConnected(false);
      return;
    }

    let es: EventSource | null = null;
    let reconnectTimeout: any = null;
    let currentErrors = 0;

    function connect() {
      try {
        es = new EventSource("/api/registration/stream");

        es.addEventListener("connected", (event) => {
          setIsConnected(true);
          setErrorCount(0);
          currentErrors = 0;
          try {
            const data = JSON.parse(event.data);
            setLastEvent({
              type: "connected",
              payload: data,
              timestamp: new Date().toISOString(),
            });
            onConnectedRef.current?.(data);
          } catch {}
        });

        es.addEventListener("seat_update", (event) => {
          try {
            const data = JSON.parse(event.data);
            setLastEvent({
              type: "seat_update",
              payload: data,
              timestamp: new Date().toISOString(),
            });
            onSeatUpdateRef.current?.(data);
          } catch {}
        });

        es.onerror = () => {
          setIsConnected(false);
          currentErrors++;
          setErrorCount(currentErrors);
          if (es) {
            es.close();
            es = null;
          }
          // Exponential backoff reconnect: 3s -> 4.5s -> 6.75s ... up to 30s
          const delay = Math.min(30000, 3000 * Math.pow(1.5, currentErrors));
          reconnectTimeout = setTimeout(connect, delay);
        };
      } catch {
        setIsConnected(false);
      }
    }

    connect();

    return () => {
      if (es) {
        es.close();
        es = null;
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      setIsConnected(false);
    };
  }, [enabled]);

  return { isConnected, lastEvent, errorCount };
}
