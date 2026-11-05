"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X, Share, SquarePlus, EllipsisVertical, Ellipsis, ExternalLink, Check } from "lucide-react";
import { getPublicSettings } from "@/app/actions/settings";

// 휴대폰 "홈 화면에 추가" 권유
// - 휴대폰에서만, 이미 홈 화면 앱으로 열었으면 안 보임. 키오스크(공용 태블릿) 모드·대여하기 화면 제외.
// - 들어오자마자 띄우지 않는다: 화면을 2번 이상 옮겼거나 20초 넘게 둘러본 뒤. 공지 팝업이 떠 있으면 닫힌 다음.
// - ✕로 닫으면 7일 → 30일 뒤 다시, 3번 닫으면 그만. "이미 추가했어요"·설치 완료면 다시 안 보임.
// - 안드로이드(Chrome·삼성 인터넷): 버튼 → 바로 설치 창. 아이폰: 웹에서 직접 추가가 안 돼서 순서 안내.
// - 카카오톡 등 앱 안 브라우저에서는 추가가 안 되므로 먼저 바깥 브라우저로 연다.

const KEY = "bv_install_prompt";
const DAY = 24 * 60 * 60 * 1000;
const SNOOZE_DAYS = [7, 30];
const DELAY_MS = 20_000;
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "자람도서관";

type Saved = { dismiss: number; until: number; never: boolean };
type Env = "android" | "ios" | "ios-chrome" | "kakao" | "inapp-android" | "inapp-ios";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
declare global {
  interface Window {
    __bvInstallEvent?: BIPEvent | null;
  }
}

function load(): Saved {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v && typeof v === "object") return { dismiss: v.dismiss ?? 0, until: v.until ?? 0, never: !!v.never };
  } catch {}
  return { dismiss: 0, until: 0, never: false };
}
function save(v: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {}
}

function detect(): Env | null {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPod/.test(ua) || (/iPad|Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  if (!ios && !android) return null;
  if (/KAKAOTALK/i.test(ua)) return "kakao";
  if (/NAVER\(inapp|Instagram|FBAN|FBAV|FB_IAB|Line\/|DaumApps|everytimeApp|BAND\//i.test(ua)) {
    return ios ? "inapp-ios" : "inapp-android";
  }
  if (ios) return /CriOS|EdgiOS|FxiOS/.test(ua) ? "ios-chrome" : "ios";
  return "android";
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

// 카카오톡·기타 앱 안 브라우저 → 바깥 브라우저로 열기
function openExternal(env: Env) {
  const url = location.href;
  if (env === "kakao") {
    location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
  } else if (env === "inapp-android") {
    location.href = `intent://${url.replace(/^https?:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;end`;
  }
}

export function InstallPrompt() {
  const pathname = usePathname();
  const [env, setEnv] = useState<Env | null>(null);
  const [eligible, setEligible] = useState(false); // 조건 통과(기기·저장값·키오스크)
  const [timeUp, setTimeUp] = useState(false); // 20초 지남
  const [nav, setNav] = useState({ path: pathname, count: 0 }); // 화면 이동 횟수
  const [show, setShow] = useState(false); // 띠 표시
  const [guide, setGuide] = useState(false); // 안내 시트
  const [canPrompt, setCanPrompt] = useState(false); // 안드로이드 설치 창 가능

  // 기기·저장값·키오스크 확인
  useEffect(() => {
    const e = detect();
    // 확인용: 주소 뒤에 ?a2hs=1 을 붙이면 조건 없이 바로 띄운다
    const force = new URLSearchParams(location.search).get("a2hs") === "1";
    if (!e || isStandalone()) return;
    const s = load();
    if (!force && (s.never || s.until > Date.now())) return;
    let alive = true;
    getPublicSettings()
      .then((settings) => {
        if (!alive || (!force && settings.kiosk_mode === "on")) return;
        setEnv(e);
        setEligible(true);
        if (force) setTimeUp(true);
      })
      .catch(() => {});

    // 안드로이드 설치 창: 루트 레이아웃에서 미리 잡아 둔 이벤트 또는 지금부터 오는 이벤트
    const sync = () => setCanPrompt(!!window.__bvInstallEvent);
    sync();
    window.addEventListener("bv-installable", sync);
    const onInstalled = () => {
      save({ ...load(), never: true });
      setShow(false);
      setGuide(false);
    };
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      alive = false;
      window.removeEventListener("bv-installable", sync);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // 둘러본 뒤: 화면 이동 2번 또는 20초
  if (nav.path !== pathname) setNav({ path: pathname, count: nav.count + 1 });
  const ready = timeUp || nav.count >= 2;
  useEffect(() => {
    const t = setTimeout(() => setTimeUp(true), DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  // 띄우기: 대여하기(스캔) 화면이 아니고, 공지 팝업이 닫혀 있을 때
  useEffect(() => {
    if (!eligible || !ready || show) return;
    if (pathname.startsWith("/rent")) return;
    const tryShow = () => {
      if (document.querySelector("[data-notice-popup]")) return false;
      setShow(true);
      return true;
    };
    if (tryShow()) return;
    const t = setInterval(() => tryShow() && clearInterval(t), 1000);
    return () => clearInterval(t);
  }, [eligible, ready, show, pathname]);

  function snooze() {
    const s = load();
    const dismiss = s.dismiss + 1;
    const days = SNOOZE_DAYS[dismiss - 1];
    save(days ? { dismiss, until: Date.now() + days * DAY, never: false } : { dismiss, until: 0, never: true });
    setShow(false);
    setGuide(false);
    setEligible(false);
  }

  function never() {
    save({ ...load(), never: true });
    setShow(false);
    setGuide(false);
    setEligible(false);
  }

  async function add() {
    const ev = window.__bvInstallEvent;
    if (env === "android" && ev) {
      await ev.prompt();
      const { outcome } = await ev.userChoice;
      window.__bvInstallEvent = null;
      setCanPrompt(false);
      if (outcome === "accepted") never();
      return;
    }
    setGuide(true);
  }

  if (!show || !env) return null;

  const inApp = env === "kakao" || env === "inapp-android" || env === "inapp-ios";

  return (
    <>
      {/* 위쪽 띠 */}
      {!guide && (
        <div className="install-slide-down fixed inset-x-0 top-0 z-[150] px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] pointer-events-none">
          <div className="pointer-events-auto mx-auto flex max-w-lg items-center gap-3 rounded-2xl border bg-background/95 p-3 pr-2 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.35)] backdrop-blur">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-192.png" alt="" className="size-12 shrink-0 rounded-xl border bg-white object-contain" />
            <div className="min-w-0 flex-1">
              <p className="text-[clamp(0.95rem,2.4vw,1.1rem)] font-bold leading-tight">홈 화면에 {APP_NAME} 추가</p>
              <p className="mt-0.5 text-[clamp(0.78rem,2vw,0.9rem)] leading-snug text-muted-foreground break-keep">
                {inApp ? "브라우저에서 열면 앱처럼 바로 쓸 수 있어요" : "앱처럼 한 번에 열고, 대여 현황을 바로 봐요"}
              </p>
            </div>
            <button
              onClick={inApp && env !== "inapp-ios" ? () => openExternal(env) : add}
              className="shrink-0 rounded-full bg-primary px-4 py-2 text-[clamp(0.85rem,2.2vw,1rem)] font-bold text-primary-foreground active:scale-95 transition-transform"
            >
              {inApp && env !== "inapp-ios" ? "열기" : env === "android" && canPrompt ? "설치" : "추가"}
            </button>
            <button onClick={snooze} aria-label="닫기" className="shrink-0 rounded-full p-1.5 text-muted-foreground active:bg-muted">
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}

      {/* 안내 시트 (아이폰·설치 창 없는 안드로이드·앱 안 브라우저) */}
      {guide && (
        <div className="fixed inset-0 z-[210] flex items-end justify-center">
          <div className="install-fade absolute inset-0 bg-black/45" onClick={() => setGuide(false)} />
          <div className="install-slide-up relative w-full max-w-lg rounded-t-3xl bg-background px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon-192.png" alt="" className="size-12 rounded-xl border bg-white object-contain" />
              <div className="min-w-0 flex-1">
                <p className="text-[clamp(1.05rem,2.8vw,1.25rem)] font-bold">홈 화면에 추가하기</p>
                <p className="text-[clamp(0.8rem,2vw,0.95rem)] text-muted-foreground">딱 두 번만 누르면 돼요</p>
              </div>
              <button onClick={() => setGuide(false)} aria-label="닫기" className="rounded-full p-2 -mr-2 active:bg-muted">
                <X className="size-6" />
              </button>
            </div>

            <ol className="space-y-2.5">
              {guideSteps(env).map((step, i) => (
                <li key={i} className="flex items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <p className="min-w-0 flex-1 text-[clamp(0.92rem,2.4vw,1.05rem)] leading-snug break-keep">{step.text}</p>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-background text-[#007AFF]">
                    {step.icon}
                  </span>
                </li>
              ))}
            </ol>

            <div className="mt-4 flex gap-2">
              <button
                onClick={never}
                className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border text-[clamp(0.9rem,2.2vw,1.05rem)] font-medium active:bg-muted"
              >
                <Check className="size-4" />
                이미 추가했어요
              </button>
              <button
                onClick={() => setGuide(false)}
                className="h-12 flex-1 rounded-xl bg-primary text-[clamp(0.9rem,2.2vw,1.05rem)] font-bold text-primary-foreground active:opacity-90"
              >
                알겠어요
              </button>
            </div>
          </div>

          {/* 아이폰 Safari: 아래 도구 막대 쪽을 가리키는 화살표 */}
          {env === "ios" && (
            <div className="install-bounce pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+0.25rem)] left-1/2 z-10 -translate-x-1/2 text-white drop-shadow">
              ▼
            </div>
          )}
        </div>
      )}
    </>
  );
}

function guideSteps(env: Env): { text: React.ReactNode; icon: React.ReactNode }[] {
  const add = { text: <><b>&lsquo;홈 화면에 추가&rsquo;</b>를 누르고, 오른쪽 위 <b>추가</b>를 눌러요</>, icon: <SquarePlus className="size-5" /> };
  switch (env) {
    case "ios":
      return [
        { text: <>화면 아래 <b>공유 버튼</b>을 눌러요 <span className="text-muted-foreground">(안 보이면 <b>⋯</b> 버튼 → 공유)</span></>, icon: <Share className="size-5" /> },
        add,
      ];
    case "ios-chrome":
      return [{ text: <>주소창 오른쪽 <b>공유 버튼</b>을 눌러요</>, icon: <Share className="size-5" /> }, add];
    case "inapp-ios":
      return [
        { text: <>오른쪽 아래 또는 위 <b>⋯</b> 버튼 → <b>Safari로 열기</b></>, icon: <Ellipsis className="size-5" /> },
        { text: <>Safari에서 <b>공유 버튼</b> → <b>&lsquo;홈 화면에 추가&rsquo;</b></>, icon: <Share className="size-5" /> },
      ];
    case "kakao":
    case "inapp-android":
      return [
        { text: <>오른쪽 위 <b>⋮</b> 버튼 → <b>다른 브라우저로 열기</b></>, icon: <ExternalLink className="size-5" /> },
        { text: <>브라우저 메뉴에서 <b>&lsquo;홈 화면에 추가&rsquo;</b></>, icon: <SquarePlus className="size-5" /> },
      ];
    default:
      return [
        { text: <>브라우저 오른쪽 위(삼성 인터넷은 아래) <b>⋮ / ≡ 메뉴</b>를 눌러요</>, icon: <EllipsisVertical className="size-5" /> },
        { text: <><b>&lsquo;홈 화면에 추가&rsquo;</b> 또는 <b>&lsquo;앱 설치&rsquo;</b>를 눌러요</>, icon: <SquarePlus className="size-5" /> },
      ];
  }
}
