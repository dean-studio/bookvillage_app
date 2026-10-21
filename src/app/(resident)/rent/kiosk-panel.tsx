"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { QrCode, ScanBarcode, BookOpen, CheckCircle2, AlertCircle, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ManualScanInput } from "@/components/manual-scan-input";
import { useScannerInput } from "@/hooks/use-scanner-input";
import { isMemberCardCode, normalizeScanInput } from "@/lib/member-card";
import { signInByCard, kioskSignOut } from "@/app/actions/member-cards";
import { getCurrentUser } from "@/app/actions/auth";
import { selfCheckout, kioskReturn } from "@/app/actions/rentals";

type Borrowed = { barcode: string; title: string; due_date: string };
type Message = { type: "success" | "error"; text: string } | null;

const BYE_MS = 5000;

function formatDue(date: string) {
  return new Date(date).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" });
}

// 홈 화면 리더기 대출(유치원 등): 대여하기 화면 가운데에서
// 회원카드 찍기 → 책 바코드 찍기 → 자동 대출 → 일정 시간 후 자동 로그아웃
// 반납(유치원 모드만): 대출 중인 책 바코드를 찍으면 카드 없이도 바로 반납
export function KioskPanel({
  logoutSec,
  allowReturn,
  scannerEnabled,
  onSignedOut,
}: {
  logoutSec: number;
  /** 유치원 모드: 책 바코드를 찍으면 반납도 받음 */
  allowReturn: boolean;
  /** 도서 정보/검색 등 오버레이가 열려 있으면 리더기 입력을 받지 않음 */
  scannerEnabled: boolean;
  /** 자동 로그아웃 시 대여 화면 상태 초기화 */
  onSignedOut: () => void;
}) {
  const [phase, setPhase] = useState<"loading" | "idle" | "member" | "bye">("loading");
  const [memberName, setMemberName] = useState("");
  const [borrowed, setBorrowed] = useState<Borrowed[]>([]);
  const [message, setMessage] = useState<Message>(null);
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(logoutSec);

  const busyRef = useRef(false);
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  const borrowedRef = useRef(borrowed);
  useEffect(() => {
    borrowedRef.current = borrowed;
  }, [borrowed]);
  const messageTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const byeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function showMessage(msg: Message, ms = 3500) {
    if (messageTimer.current) clearTimeout(messageTimer.current);
    setMessage(msg);
    if (msg) messageTimer.current = setTimeout(() => setMessage(null), ms);
  }

  // 도서 목록 등 다른 화면에서 돌아온 경우 로그인 상태 이어가기
  useEffect(() => {
    getCurrentUser().then((u) => {
      if (u && u.role === "resident") {
        setMemberName(u.name);
        setPhase("member");
        return;
      }
      setPhase("idle");
    });
  }, []);

  const finish = useCallback(
    async (list: Borrowed[]) => {
      await kioskSignOut();
      onSignedOut();
      if (byeTimer.current) clearTimeout(byeTimer.current);
      setMessage(null);
      if (list.length === 0) {
        setPhase("idle");
        setMemberName("");
        return;
      }
      setPhase("bye");
      byeTimer.current = setTimeout(() => {
        setPhase("idle");
        setMemberName("");
        setBorrowed([]);
      }, BYE_MS);
    },
    [onSignedOut]
  );

  // 자동 로그아웃 카운트다운 (회원 로그인 상태에서만)
  useEffect(() => {
    if (phase !== "member") return;
    if (remaining <= 0) {
      finish(borrowed);
      return;
    }
    const t = setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, remaining, borrowed, finish]);

  // 화면 터치·입력 시 시간 연장
  useEffect(() => {
    if (phase !== "member") return;
    const reset = () => setRemaining(logoutSec);
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    return () => {
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
    };
  }, [phase, logoutSec]);

  async function handleScan(raw: string) {
    if (busyRef.current) return;
    const code = normalizeScanInput(raw);
    if (!code) return;

    busyRef.current = true;
    setBusy(true);
    try {
      if (isMemberCardCode(code)) {
        // 다른 카드가 찍히면 그 회원으로 전환
        const result = await signInByCard(code);
        if (!result.success) {
          showMessage({ type: "error", text: result.error ?? "로그인에 실패했습니다." });
          return;
        }
        if (byeTimer.current) clearTimeout(byeTimer.current);
        setMemberName(result.data?.name ?? "");
        setBorrowed([]);
        setRemaining(logoutSec);
        setPhase("member");
        showMessage(null);
        return;
      }

      // 책 바코드: 방금 빌린 책이 한 번 더 찍히면 반납되지 않게 무시
      const member = phaseRef.current === "member";
      if (member) setRemaining(logoutSec);
      if (member && borrowedRef.current.some((b) => b.barcode === code)) {
        showMessage({ type: "success", text: "이미 빌린 책이에요" });
        return;
      }
      // 대출 중인 책이면 반납, 아니면 (회원이 찍었을 때) 대출
      if (allowReturn) {
        const ret = await kioskReturn(code);
        if (!ret.success || !ret.data) {
          showMessage({ type: "error", text: ret.error ?? "반납에 실패했습니다." });
          return;
        }
        if (ret.data.status === "returned") {
          showMessage({ type: "success", text: `「${ret.data.book_title}」 반납 완료!` });
          return;
        }
      }
      if (!member) {
        showMessage({ type: "error", text: allowReturn ? "책을 빌리려면 먼저 회원카드를 찍어주세요" : "먼저 회원카드를 찍어주세요" });
        return;
      }
      const result = await selfCheckout(code);
      if (result.success && result.data) {
        const item = result.data;
        setBorrowed((prev) => [...prev, { barcode: code, title: item.book_title, due_date: item.due_date }]);
        showMessage({ type: "success", text: `「${item.book_title}」 대출 완료!` });
      } else {
        showMessage({ type: "error", text: result.error ?? "대출에 실패했습니다." });
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  useScannerInput(handleScan, scannerEnabled);

  // 결과 메시지 (대출 완료 / 오류)
  const messageArea = (
    <div className="min-h-[clamp(3.5rem,8vh,5rem)] w-full max-w-2xl flex items-center justify-center">
      {busy ? (
        <Loader2 className="size-[clamp(2.5rem,6vw,3.5rem)] animate-spin text-primary" />
      ) : message ? (
        <div
          className={`w-full flex items-center justify-center gap-3 rounded-2xl px-6 py-4 text-[clamp(1.1rem,3vw,1.6rem)] font-bold ${
            message.type === "success" ? "bg-primary/15 text-primary" : "bg-destructive/10 text-destructive"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="size-[clamp(1.4rem,3.5vw,2rem)] shrink-0" />
          ) : (
            <AlertCircle className="size-[clamp(1.4rem,3.5vw,2rem)] shrink-0" />
          )}
          <span className="text-center">{message.text}</span>
        </div>
      ) : null}
    </div>
  );

  // 로그인 전: 헤더·하단 메뉴 없이 카드 안내만 전체 화면으로
  if (phase !== "member") {
    return (
      <div className="fixed inset-0 z-[140] bg-background flex flex-col items-center justify-center gap-[3vh] px-6 h-dvh">
        {phase === "loading" && <Loader2 className="size-10 animate-spin text-muted-foreground" />}

        {phase === "idle" && (
          <>
            <div className="rounded-[2rem] bg-primary/10 p-[clamp(1.5rem,5vw,3rem)]">
              <QrCode className="size-[clamp(6rem,22vw,12rem)] text-primary" />
            </div>
            <div className="text-center space-y-[1vh]">
              <p className="text-[clamp(2rem,6vw,3.5rem)] font-bold leading-tight">회원카드를 찍어주세요</p>
              <p className="text-[clamp(1.1rem,3vw,1.6rem)] text-muted-foreground">
                QR 코드를 리더기에 대면 책을 빌릴 수 있어요
              </p>
              {allowReturn && (
                <p className="text-[clamp(1.1rem,3vw,1.6rem)] text-muted-foreground">
                  반납할 책은 카드 없이 바코드를 바로 찍어주세요
                </p>
              )}
            </div>
          </>
        )}

        {phase === "bye" && (
          <div className="flex flex-col items-center gap-[2vh] text-center">
            <CheckCircle2 className="size-[clamp(5rem,16vw,9rem)] text-primary" />
            <p className="text-[clamp(2rem,6vw,3.5rem)] font-bold">{borrowed.length}권 빌렸어요!</p>
            <p className="text-[clamp(1.2rem,3.2vw,1.8rem)] text-muted-foreground">반납일을 꼭 지켜주세요. 안녕히 가세요 👋</p>
          </div>
        )}

        {phase !== "loading" && (
          <>
            {messageArea}
            <ManualScanInput onSubmit={handleScan} placeholder="카드 코드 직접 입력 (M…)" />
          </>
        )}

        <Link href="/admin/login" className="absolute bottom-3 right-4 text-xs text-muted-foreground/40 hover:text-muted-foreground">
          관리자
        </Link>
      </div>
    );
  }

  // 로그인 후: 대여하기 화면 가운데에 책 바코드 안내
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-[2vh] w-full max-w-2xl mx-auto">
      <div className="rounded-[1.5rem] bg-primary/10 p-[clamp(1rem,3.5vw,2rem)]">
        <ScanBarcode className="size-[clamp(4rem,14vw,7.5rem)] text-primary" />
      </div>
      <div className="text-center space-y-[0.8vh]">
        <p className="text-[clamp(1.1rem,3vw,1.6rem)] font-semibold text-muted-foreground">
          <span className="text-primary">{memberName}</span> 안녕하세요!
        </p>
        <p className="text-[clamp(1.8rem,5.5vw,3rem)] font-bold leading-tight">빌릴 책의 바코드를 찍어주세요</p>
        {allowReturn && <p className="text-[clamp(1rem,2.6vw,1.3rem)] text-muted-foreground">반납할 책을 찍으면 반납돼요</p>}
        <p className="text-[clamp(0.85rem,2vw,1.05rem)] text-muted-foreground/70 tabular-nums">
          {remaining}초 동안 입력이 없으면 자동으로 끝나요
        </p>
      </div>

      {borrowed.length > 0 && (
        <ul className="w-full space-y-2">
          {borrowed.map((b, i) => (
            <li key={i} className="flex items-center gap-3 rounded-2xl border bg-muted/30 px-5 py-3">
              <BookOpen className="size-[clamp(1.3rem,3vw,1.7rem)] text-primary shrink-0" />
              <span className="flex-1 min-w-0 truncate text-[clamp(1.05rem,2.6vw,1.4rem)] font-semibold">{b.title}</span>
              <span className="shrink-0 text-[clamp(0.85rem,2vw,1.1rem)] text-muted-foreground">
                {formatDue(b.due_date)}까지
              </span>
            </li>
          ))}
        </ul>
      )}

      {messageArea}

      <Button
        size="lg"
        className="w-full h-[clamp(3.5rem,8vh,5rem)] text-[clamp(1.2rem,3.2vw,1.7rem)] font-bold rounded-2xl"
        onClick={() => finish(borrowed)}
      >
        <LogOut className="size-[clamp(1.3rem,3.2vw,1.8rem)] mr-2" />
        다 빌렸어요
      </Button>

      <ManualScanInput onSubmit={handleScan} placeholder="책 바코드 직접 입력" />
    </div>
  );
}
