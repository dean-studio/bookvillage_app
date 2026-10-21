"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CameraOff, AlertTriangle, CheckCircle2, Info } from "lucide-react";

export type CameraScanOutcome = { tone: "ok" | "info" | "error"; title?: string; message: string };

type Scanner = { pause: (v?: boolean) => void; resume: () => void; stop: () => Promise<void> };

const SAME_CODE_MS = 3000; // 같은 책을 연달아 인식하지 않도록
const RESULT_MS = 900; // 성공 결과를 잠깐 보여주고 다음 책

// 휴대폰 카메라 연속 스캔: 인식하면 바로 onScan 처리 → 결과 잠깐 표시 → 다음 책.
// 실패는 직접 확인하고 넘어가도록 멈춘다.
export function CameraScan({
  onScan,
  onClose,
}: {
  onScan: (code: string) => Promise<CameraScanOutcome>;
  onClose: () => void;
}) {
  const elId = useRef(`camera-scan-${Math.random().toString(36).slice(2)}`).current;
  const scannerRef = useRef<Scanner | null>(null);
  const busyRef = useRef(false);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const onScanRef = useRef(onScan);
  const [shown, setShown] = useState<{ barcode: string; outcome: CameraScanOutcome | null } | null>(null);
  const [cameraError, setCameraError] = useState(false);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (cancelled) return;
        const scanner = new Html5Qrcode(elId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
          ],
          verbose: false,
        });
        scannerRef.current = scanner as unknown as Scanner;
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (vw: number, vh: number) => {
              const width = Math.floor(Math.min(vw * 0.9, 480));
              return { width, height: Math.floor(Math.min(vh * 0.5, Math.max(width * 0.45, 110))) };
            },
          },
          (code: string) => handleDecode(code),
          () => {}
        );
      } catch {
        if (!cancelled) setCameraError(true);
      }
    })();
    return () => {
      cancelled = true;
      scannerRef.current?.stop().catch(() => {});
      scannerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDecode(code: string) {
    const now = Date.now();
    if (busyRef.current) return;
    if (code === lastRef.current.code && now - lastRef.current.at < SAME_CODE_MS) return;
    busyRef.current = true;
    lastRef.current = { code, at: now };
    scannerRef.current?.pause(true);
    navigator.vibrate?.(60);
    setShown({ barcode: code, outcome: null });
    const outcome = await onScanRef.current(code);
    setShown({ barcode: code, outcome });
    if (outcome.tone !== "error") setTimeout(next, RESULT_MS);
  }

  function next() {
    setShown(null);
    lastRef.current.at = Date.now();
    busyRef.current = false;
    try {
      scannerRef.current?.resume();
    } catch {
      /* 이미 실행 중 */
    }
  }

  const outcome = shown?.outcome ?? null;

  return (
    <div className="rounded-xl border overflow-hidden bg-black">
      {cameraError ? (
        <div className="bg-background p-6 text-center space-y-3">
          <CameraOff className="size-10 mx-auto text-muted-foreground" />
          <p className="font-semibold">카메라를 켤 수 없어요</p>
          <p className="text-sm text-muted-foreground">브라우저 주소창의 카메라 권한을 허용한 뒤 다시 시도하세요. (https 주소에서만 동작해요)</p>
          <Button variant="outline" onClick={onClose}>닫기</Button>
        </div>
      ) : (
        <div className="relative">
          <div id={elId} className="w-full min-h-[260px]" />

          {shown && (
            <div className="absolute inset-0 bg-black/70 flex items-end sm:items-center justify-center p-3">
              <div className="w-full max-w-md rounded-2xl bg-background p-4 space-y-3 shadow-xl">
                {!outcome ? (
                  <div className="flex items-center justify-center gap-2 py-6">
                    <Loader2 className="size-6 animate-spin text-primary" />
                    <span className="font-mono">{shown.barcode}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-2">
                      {outcome.tone === "ok" ? (
                        <CheckCircle2 className="size-6 text-green-600 shrink-0" />
                      ) : outcome.tone === "info" ? (
                        <Info className="size-6 text-sky-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="size-6 text-destructive shrink-0" />
                      )}
                      <div className="min-w-0">
                        {outcome.title && <p className="font-bold line-clamp-2">{outcome.title}</p>}
                        <p className={outcome.tone === "error" ? "text-destructive font-semibold" : "text-sm"}>{outcome.message}</p>
                      </div>
                    </div>
                    {outcome.tone === "error" && (
                      <Button className="w-full h-12 text-base" onClick={next}>다음 책 찍기</Button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          <div className="absolute top-2 right-2">
            <Button size="sm" variant="secondary" onClick={onClose}>카메라 끄기</Button>
          </div>
        </div>
      )}
    </div>
  );
}
