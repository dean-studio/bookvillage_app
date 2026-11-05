"use client";

import { useEffect, useRef, useCallback } from "react";
import { signOut } from "@/app/actions/auth";
import { getPublicSettings } from "@/app/actions/settings";

// 자동 로그아웃
// - 공용 기기(태블릿·PC, 키오스크 모드): 2분 동안 아무 조작이 없으면 로그아웃 (다음 사람이 남의 계정을 쓰지 않게)
// - 개인 휴대폰: 로그인 유지. 마지막으로 쓴 날부터 30일 동안 안 쓰면 로그아웃
const IDLE_MS = 2 * 60 * 1000; // 2분
const PHONE_KEEP_MS = 30 * 24 * 60 * 60 * 1000; // 30일
const LAST_ACTIVE_KEY = "bv_last_active";

function isPhone() {
  const ua = navigator.userAgent;
  return /iPhone|iPod/.test(ua) || /Android.+Mobile/.test(ua);
}

export function AutoLogout() {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      signOut();
    }, IDLE_MS);
  }, []);

  useEffect(() => {
    const events = ["pointerdown", "keydown", "scroll", "touchstart"];
    let alive = true;
    let idleOn = false;

    // 개인 휴대폰: 30일 넘게 안 썼으면 로그아웃, 아니면 마지막 사용 시각 갱신
    const touchPhone = () => {
      try {
        const last = Number(localStorage.getItem(LAST_ACTIVE_KEY) || 0);
        if (last && Date.now() - last > PHONE_KEEP_MS) {
          localStorage.removeItem(LAST_ACTIVE_KEY);
          signOut();
          return;
        }
        localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
      } catch {}
    };
    const onVisible = () => document.visibilityState === "visible" && touchPhone();

    const startIdle = () => {
      idleOn = true;
      events.forEach((e) => window.addEventListener(e, resetTimer));
      resetTimer();
    };

    if (!isPhone()) {
      startIdle();
    } else {
      getPublicSettings()
        .then((s) => {
          if (!alive) return;
          if (s.kiosk_mode === "on") startIdle();
          else {
            touchPhone();
            document.addEventListener("visibilitychange", onVisible);
          }
        })
        .catch(() => alive && startIdle());
    }

    return () => {
      alive = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (idleOn) events.forEach((e) => window.removeEventListener(e, resetTimer));
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [resetTimer]);

  return null;
}
