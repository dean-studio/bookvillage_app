"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { QrCode, Loader2, AlertCircle } from "lucide-react";
import { useScannerInput } from "@/hooks/use-scanner-input";
import { signInByCard } from "@/app/actions/member-cards";
import { ManualScanInput } from "@/components/manual-scan-input";

// QR 회원카드 로그인: 리더기로 카드를 찍으면 바로 로그인
export function CardLogin({ logoUrl, apartmentName }: { logoUrl: string; apartmentName: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  async function handleScan(raw: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const result = await signInByCard(raw);
    if (result.success) {
      router.push("/rent");
      return;
    }
    setError(result.error ?? "로그인에 실패했습니다.");
    busyRef.current = false;
    setBusy(false);
  }

  useScannerInput(handleScan);

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-[4vh] px-6">
      <Link href="/" className="active:opacity-70">
        <img src={logoUrl || "/logo.png"} alt={apartmentName || "도서관"} className="max-h-20 object-contain" />
      </Link>

      <div className="rounded-[2rem] bg-primary/10 p-[clamp(1.5rem,5vw,3rem)]">
        <QrCode className="size-[clamp(6rem,22vw,11rem)] text-primary" />
      </div>

      <div className="text-center space-y-[1vh]">
        <p className="text-[clamp(1.8rem,5.5vw,3rem)] font-bold leading-tight">회원카드를 찍어주세요</p>
        <p className="text-[clamp(1rem,2.8vw,1.4rem)] text-muted-foreground">
          QR 코드를 리더기에 대면 바로 로그인돼요
        </p>
      </div>

      <div className="min-h-[4rem] flex items-center justify-center">
        {busy ? (
          <Loader2 className="size-10 animate-spin text-primary" />
        ) : error ? (
          <div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-5 py-3 text-[clamp(1rem,2.6vw,1.3rem)] font-semibold text-destructive">
            <AlertCircle className="size-6 shrink-0" />
            {error}
          </div>
        ) : null}
      </div>

      <ManualScanInput onSubmit={handleScan} placeholder="카드 코드 직접 입력 (M…)" />
    </div>
  );
}
