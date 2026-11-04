import { useSyncExternalStore, useCallback } from "react";
import {
  getPrivacyMask,
  setPrivacyMask,
  togglePrivacyMask as storeTogglePrivacyMask,
  subscribePrivacyMask,
} from "../services/privacyMaskStore";

/**
 * usePrivacyMask - React hook subscribing to centralized privacy mask store
 * Uses useSyncExternalStore for tear-free, synchronous state updates across all components
 */
export function usePrivacyMask() {
  const isPrivacyMasked = useSyncExternalStore(
    subscribePrivacyMask,
    getPrivacyMask,
    () => false,
  );

  const togglePrivacyMask = useCallback(() => {
    return storeTogglePrivacyMask();
  }, []);

  return {
    isPrivacyMasked,
    togglePrivacyMask,
    setPrivacyMask,
  };
}
