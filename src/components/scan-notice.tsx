"use client";

import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { ScanNotice } from "@/hooks/use-staged-scan";

// 방금 찍은 결과를 크게 (화면을 멀리서 봐도 알 수 있게)
export function ScanNoticeBanner({ notice }: { notice: ScanNotice }) {
  const style =
    notice.tone === "ok"
      ? "border-green-500 bg-green-50 dark:bg-green-950/40"
      : notice.tone === "info"
        ? "border-sky-400 bg-sky-50 dark:bg-sky-950/40"
        : "border-destructive bg-destructive/10";
  return (
    <div className={`flex items-center gap-3 rounded-xl border-2 p-4 ${style}`}>
      {notice.tone === "ok" ? (
        <CheckCircle2 className="size-8 text-green-600 shrink-0" />
      ) : notice.tone === "info" ? (
        <Info className="size-8 text-sky-600 shrink-0" />
      ) : (
        <AlertTriangle className="size-8 text-destructive shrink-0" />
      )}
      <div className="min-w-0">
        {notice.title && <p className="text-lg font-bold line-clamp-1">{notice.title}</p>}
        <p className={notice.tone === "error" ? "text-lg font-bold text-destructive" : "text-base"}>{notice.message}</p>
      </div>
    </div>
  );
}
