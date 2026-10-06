"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CameraOff, AlertTriangle, Info } from "lucide-react";
import { moveBookToShelf, type MoveResult } from "@/app/actions/shelf-move";

type Pending =
  | { kind: "loading"; barcode: string }
  | { kind: "book"; barcode: string; result: MoveResult }
  | { kind: "error"; barcode: string; error: string };

type Scanner = { pause: (v?: boolean) => void; resume: () => void; stop: () => Promise<void> };

const SAME_CODE_MS = 3000; // 같은 책을 연달아 인식하지 않도록

// 휴대폰 카메라 연속 스캔: 인식 → 책 정보 확인 → [확인] 누르면 이동 → 다음 책
export function CameraMove({
  shelf,
  onMoved,
  onClose,
}: {
  shelf: string;
  onMoved: (result: MoveResult) => void;
  onClose: () => void;
}) {
  const scannerRef = useRef<Scanner | null>(null);
  const busyRef = useRef(false);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const [pending, setPending] = useState<Pending | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (cancelled) return;
        const scanner = new Html5Qrcode("move-camera", {
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
    setPending({ kind: "loading", barcode: code });
    const res = await moveBookToShelf(code, shelf, true);
    setPending(
      res.success && res.data
        ? { kind: "book", barcode: code, result: res.data }
        : { kind: "error", barcode: code, error: res.error ?? "책을 찾지 못했어요." }
    );
  }

  function next() {
    setPending(null);
    lastRef.current.at = Date.now();
    busyRef.current = false;
    try {
      scannerRef.current?.resume();
    } catch {
      /* 이미 실행 중 */
    }
  }

  async function confirmMove() {
    if (pending?.kind !== "book") return;
    setConfirming(true);
    const res = await moveBookToShelf(pending.barcode, shelf);
    setConfirming(false);
    if (res.success && res.data) {
      onMoved(res.data);
      next();
    } else {
      setPending({ kind: "error", barcode: pending.barcode, error: res.error ?? "이동에 실패했습니다." });
    }
  }

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
          <div id="move-camera" className="w-full min-h-[260px]" />

          {/* 인식된 책 확인 */}
          {pending && (
            <div className="absolute inset-0 bg-black/70 flex items-end sm:items-center justify-center p-3">
              <div className="w-full max-w-md rounded-2xl bg-background p-4 space-y-3 shadow-xl">
                {pending.kind === "loading" && (
                  <div className="flex items-center justify-center gap-2 py-6">
                    <Loader2 className="size-6 animate-spin text-primary" />
                    <span className="font-mono">{pending.barcode}</span>
                  </div>
                )}

                {pending.kind === "error" && (
                  <>
                    <p className="flex items-center gap-2 text-destructive font-semibold">
                      <AlertTriangle className="size-5 shrink-0" />{pending.error}
                    </p>
                    <Button className="w-full h-12 text-base" onClick={next}>다시 찍기</Button>
                  </>
                )}

                {pending.kind === "book" && (
                  <>
                    <div className="flex gap-3">
                      {pending.result.book.cover_image ? (
                        <img src={pending.result.book.cover_image} alt="" className="w-14 h-20 object-cover rounded shrink-0 bg-muted" />
                      ) : (
                        <div className="w-14 h-20 rounded shrink-0 bg-muted" />
                      )}
                      <div className="min-w-0">
                        <p className="font-bold line-clamp-2">{pending.result.book.title}</p>
                        <p className="text-sm mt-1">
                          {pending.result.from} → <b className="text-primary">{pending.result.to}</b>
                        </p>
                        {pending.result.planTarget && pending.result.planTarget !== shelf && (
                          <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1 mt-1">
                            <AlertTriangle className="size-3.5" />재배치안 자리는 {pending.result.planTarget}이에요
                          </p>
                        )}
                      </div>
                    </div>
                    {pending.result.status === "already" ? (
                      <>
                        <p className="text-sm text-muted-foreground flex items-center gap-1"><Info className="size-4" />이미 {shelf}에 있어요</p>
                        <Button className="w-full h-12 text-base" onClick={next}>다음 책</Button>
                      </>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="outline" className="h-14 px-5" onClick={next} disabled={confirming}>건너뛰기</Button>
                        <Button className="flex-1 h-14 text-lg font-bold" onClick={confirmMove} disabled={confirming}>
                          {confirming && <Loader2 className="size-5 mr-2 animate-spin" />}
                          확인 · {shelf}(으)로 이동
                        </Button>
                      </div>
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
