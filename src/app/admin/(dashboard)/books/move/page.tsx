"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRightLeft, Loader2, ScanBarcode, Undo2, AlertTriangle, CheckCircle2, Info, Camera } from "lucide-react";
import { CameraMove } from "./camera-move";
import { getMoveShelves, moveBookToShelf, undoBookMove, type MoveResult } from "@/app/actions/shelf-move";

type Shelf = Awaited<ReturnType<typeof getMoveShelves>>[number];
type LogItem =
  | { key: number; ok: true; result: MoveResult; undone?: boolean }
  | { key: number; ok: false; barcode: string; error: string };

let logKey = 0;

export default function ShelfMovePage() {
  const [shelves, setShelves] = useState<Shelf[] | null>(null);
  const [shelf, setShelf] = useState<string | null>(null);
  const [barcode, setBarcode] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<LogItem[]>([]);
  const [cameraOn, setCameraOn] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getMoveShelves().then(setShelves);
  }, []);

  // 책장을 고르면 바로 바코드 입력칸에 커서
  useEffect(() => {
    if (shelf) setTimeout(() => inputRef.current?.focus(), 50);
  }, [shelf]);

  const selected = shelves?.find((s) => s.name === shelf) ?? null;
  const movedCount = log.filter((l) => l.ok && l.result.status === "moved" && !l.undone).length;

  async function handleScan() {
    const code = barcode.trim();
    if (!code || !shelf || busy) return;
    setBarcode("");
    setBusy(true);
    const res = await moveBookToShelf(code, shelf);
    setBusy(false);
    setLog((prev) => [
      res.success && res.data
        ? { key: ++logKey, ok: true, result: res.data }
        : { key: ++logKey, ok: false, barcode: code, error: res.error ?? "이동 실패" },
      ...prev,
    ]);
    inputRef.current?.focus();
  }

  function handleCameraMoved(result: MoveResult) {
    setLog((prev) => [{ key: ++logKey, ok: true, result }, ...prev]);
  }

  async function handleUndo(item: Extract<LogItem, { ok: true }>) {
    const res = await undoBookMove(item.result.book.id, item.result.from);
    if (res.success) setLog((prev) => prev.map((l) => (l.key === item.key ? { ...item, undone: true } : l)));
    inputRef.current?.focus();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <ArrowRightLeft className="size-6" />
        책장 이동
      </h1>

      {/* 1. 책장 선택 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. 옮길 책장을 고르세요</CardTitle>
        </CardHeader>
        <CardContent>
          {!shelves ? (
            <div className="flex justify-center py-6"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {shelves.map((s) => (
                <button
                  key={s.name}
                  onClick={() => { setShelf(s.name); setCameraOn(false); }}
                  className={`text-left rounded-lg border-2 px-3 py-2 transition-colors ${
                    shelf === s.name ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                  }`}
                >
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.count}권{s.planName && s.planName !== s.name ? ` · 새 이름 ${s.planName}` : ""}
                  </p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. 바코드 연속 스캔 */}
      {shelf && (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-baseline gap-2 text-base">
              2. 책 바코드를 찍으면 <span className="text-xl text-primary">{shelf}</span>(으)로 옮겨져요
              {selected?.planLabel && <span className="text-sm font-normal text-muted-foreground">재배치안: {selected.planName} · {selected.planLabel}</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="flex gap-2 max-w-xl"
              onSubmit={(e) => {
                e.preventDefault();
                handleScan();
              }}
            >
              <Input
                ref={inputRef}
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="바코드 스캔 / 입력 후 Enter"
                className="h-14 text-xl font-mono"
                autoComplete="off"
              />
              <Button type="submit" className="h-14 px-6" disabled={!barcode.trim() || busy}>
                {busy ? <Loader2 className="size-5 animate-spin" /> : <ScanBarcode className="size-5" />}
              </Button>
            </form>
            {cameraOn ? (
              <CameraMove key={shelf} shelf={shelf} onMoved={handleCameraMoved} onClose={() => setCameraOn(false)} />
            ) : (
              <Button variant="outline" className="h-12 w-full sm:w-auto" onClick={() => setCameraOn(true)}>
                <Camera className="size-5 mr-2" />휴대폰 카메라로 찍기
              </Button>
            )}
            <p className="text-sm text-muted-foreground">
              리더기나 카메라로 연속해서 찍으면 돼요. 이번에 <b className="text-foreground">{movedCount}권</b> 옮겼어요.
            </p>

            {log.length > 0 && (
              <div className="rounded-lg border divide-y">
                {log.map((item) =>
                  item.ok ? (
                    <div key={item.key} className={`flex items-center gap-3 p-3 ${item.undone ? "opacity-50" : ""}`}>
                      {item.result.book.cover_image ? (
                        <img src={item.result.book.cover_image} alt="" className="w-9 h-12 object-cover rounded shrink-0 bg-muted" />
                      ) : (
                        <div className="w-9 h-12 rounded shrink-0 bg-muted" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium line-clamp-1">{item.result.book.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.result.status === "already" ? (
                            <span className="inline-flex items-center gap-1"><Info className="size-3.5" />이미 {item.result.to}에 있어요</span>
                          ) : item.undone ? (
                            `되돌림 · ${item.result.from}에 그대로`
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <CheckCircle2 className="size-3.5 text-green-600" />
                              {item.result.from} → <b className="text-foreground">{item.result.to}</b>
                            </span>
                          )}
                        </p>
                        {/* 재배치안 자리와 다르면 알려주기 (이동은 그대로 진행) */}
                        {item.result.planTarget && item.result.planTarget !== item.result.to && !item.undone && (
                          <p className="text-xs text-amber-700 dark:text-amber-400 inline-flex items-center gap-1 mt-0.5">
                            <AlertTriangle className="size-3.5" />재배치안 자리는 {item.result.planTarget}이에요
                          </p>
                        )}
                      </div>
                      {item.result.status === "moved" && !item.undone && (
                        <Button size="sm" variant="ghost" onClick={() => handleUndo(item)}>
                          <Undo2 className="size-4 mr-1" />되돌리기
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div key={item.key} className="flex items-center gap-3 p-3 bg-destructive/5">
                      <AlertTriangle className="size-5 text-destructive shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-destructive">{item.error}</p>
                      </div>
                      <Badge variant="outline" className="font-mono">{item.barcode}</Badge>
                    </div>
                  )
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
