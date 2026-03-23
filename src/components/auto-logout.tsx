"use client";

import { useEffect, useRef, useCallback } from "react";
import { signOut } from "@/app/actions/auth";

const TIMEOUT_MS = 2 * 60 * 1000; // 2분

export function AutoLogout() {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      signOut();
    }, TIMEOUT_MS);
  }, []);

  useEffect(() => {
    const events = ["pointerdown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [resetTimer]);

  return null;
}
