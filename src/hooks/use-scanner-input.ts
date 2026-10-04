"use client";

import { useEffect, useRef } from "react";
import { keyEventToChar } from "@/lib/member-card";

// USB 리더기(키보드 입력 방식)로 찍은 값을 입력창 없이 화면 전역에서 받는다.
// 리더기는 문자를 연속으로 빠르게 치고 Enter로 끝내므로, 입력 간격이 벌어지면 버퍼를 비운다.
const MAX_GAP_MS = 300;

export function useScannerInput(onScan: (value: string) => void, enabled = true) {
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;
    let buffer = "";
    let lastAt = 0;

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;

      const now = Date.now();
      if (now - lastAt > MAX_GAP_MS) buffer = "";
      lastAt = now;

      if (e.key === "Enter") {
        const value = buffer;
        buffer = "";
        if (value.length >= 4) {
          e.preventDefault();
          onScanRef.current(value);
        }
        return;
      }

      const ch = keyEventToChar(e);
      if (ch) buffer += ch;
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}
