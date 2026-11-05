"use client";

// AR 퀴즈 통과 체크 (학원 모드 + ar_enabled === 'on' 전용). 선생님이 눌러 ar_results 에 기록한다. 젤리와 연결하지 않는다.
// - ArPassButton: 대출 1건에 대한 통과 체크/취소 버튼 (반별 현황·반납 화면 공용)
// - ReturnArPass: 반납 화면 결과 영역에 끼우는 상자. 학원+AR 이 아니면 아무것도 그리지 않는다(반납 화면은 그대로).

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, GraduationCap, Loader2, Undo2 } from "lucide-react";
import { getPublicSettings } from "@/app/actions/settings";
import {
  cancelArPass,
  getReturnedRentalForAr,
  recordArPass,
  type ArPassRecord,
  type ArReturnTarget,
} from "@/app/actions/academy";
import { isAcademy, isFlagOn } from "@/lib/site-mode";
import { cn } from "@/lib/utils";

function pts(n: number): string {
  return `${Number(n).toFixed(1)}pt`;
}

export function ArPassButton({
  rentalId,
  result,
  onChange,
  size = "sm",
}: {
  rentalId: string;
  result: ArPassRecord | null;
  onChange: (next: ArPassRecord | null) => void;
  size?: "sm" | "lg";
}) {
  const [isPending, startTransition] = useTransition();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [msg, setMsg] = useState<{ type: "info" | "error"; text: string } | null>(null);

  function pass() {
    setMsg(null);
    startTransition(async () => {
      const res = await recordArPass(rentalId);
      if (!res.success || !res.data) {
        setMsg({ type: "error", text: res.error || "기록에 실패했습니다." });
        return;
      }
      onChange(res.data.record);
      if (res.data.already) setMsg({ type: "info", text: "이미 통과로 기록된 책입니다." });
      else if (res.data.noPoints) setMsg({ type: "info", text: "책에 AR 포인트 정보가 없어 0pt로 기록했습니다." });
    });
  }

  function cancel() {
    if (!result) return;
    setMsg(null);
    startTransition(async () => {
      const res = await cancelArPass(result.id);
      setConfirmCancel(false);
      if (!res.success) {
        setMsg({ type: "error", text: res.error || "취소에 실패했습니다." });
        return;
      }
      onChange(null);
    });
  }

  const btnSize = size === "lg" ? "default" : "sm";

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {result ? (
        <>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border border-green-300 bg-green-50 px-2 py-0.5 font-medium text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300",
              size === "lg" ? "text-sm" : "text-xs"
            )}
          >
            <CheckCircle2 className="size-3.5" />
            AR 통과 · {pts(result.points)}
          </span>
          {confirmCancel ? (
            <>
              <Button size={btnSize} variant="destructive" className={size === "sm" ? "h-7 px-2 text-xs" : ""} disabled={isPending} onClick={cancel}>
                {isPending && <Loader2 className="size-3 mr-1 animate-spin" />}
                통과 취소
              </Button>
              <Button size={btnSize} variant="ghost" className={size === "sm" ? "h-7 px-2 text-xs" : ""} disabled={isPending} onClick={() => setConfirmCancel(false)}>
                그대로 두기
              </Button>
            </>
          ) : (
            <Button
              size={btnSize}
              variant="ghost"
              className={size === "sm" ? "h-7 px-2 text-xs text-muted-foreground" : "text-muted-foreground"}
              onClick={() => setConfirmCancel(true)}
            >
              <Undo2 className="size-3.5 mr-1" />
              취소
            </Button>
          )}
        </>
      ) : (
        <Button size={btnSize} variant="outline" className={size === "sm" ? "h-7 px-2 text-xs" : ""} disabled={isPending} onClick={pass}>
          {isPending ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <GraduationCap className="size-3.5 mr-1" />}
          {size === "lg" ? "AR 퀴즈 통과 체크" : "AR 통과"}
        </Button>
      )}
      {msg && <span className={cn("text-xs", msg.type === "error" ? "text-destructive" : "text-muted-foreground")}>{msg.text}</span>}
    </span>
  );
}

// 반납 화면에서 설정을 한 번만 읽는다 (반납할 때마다 다시 읽지 않게)
let academyArPromise: Promise<boolean> | null = null;
function loadAcademyAr(): Promise<boolean> {
  if (!academyArPromise) {
    academyArPromise = getPublicSettings()
      .then((s) => isAcademy(s.site_type) && isFlagOn(s, "ar_enabled"))
      .catch(() => {
        academyArPromise = null;
        return false;
      });
  }
  return academyArPromise;
}

/** 반납 완료 결과 안에 넣는 AR 퀴즈 통과 체크 상자. 학원 + AR 사용이 아니면 null */
export function ReturnArPass({ barcode }: { barcode: string }) {
  // 어떤 바코드에 대한 결과인지 같이 들고 있어, 다음 반납(다른 바코드)에서는 이전 결과를 그리지 않는다
  const [loaded, setLoaded] = useState<{ barcode: string; target: ArReturnTarget } | null>(null);

  useEffect(() => {
    let alive = true;
    loadAcademyAr().then(async (on) => {
      if (!alive || !on) return;
      const res = await getReturnedRentalForAr(barcode);
      if (alive && res.success && res.data) setLoaded({ barcode, target: res.data });
    });
    return () => {
      alive = false;
    };
  }, [barcode]);

  const target = loaded && loaded.barcode === barcode ? loaded.target : null;
  if (!target) return null;

  const info = [
    target.ar_level !== null ? `BL ${target.ar_level.toFixed(1)}` : "",
    target.ar_points !== null ? `${target.ar_points.toFixed(1)} pts` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-lg border bg-background p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <GraduationCap className="size-4 text-primary" />
        AR 퀴즈
      </div>
      <p className="text-xs text-muted-foreground">
        {target.user_name} 학생이 이 책의 AR 퀴즈를 통과했으면 체크하세요.
        {info && ` (${info})`}
      </p>
      <ArPassButton
        size="lg"
        rentalId={target.rental_id}
        result={target.result}
        onChange={(next) => setLoaded((l) => (l ? { ...l, target: { ...l.target, result: next } } : l))}
      />
    </div>
  );
}
