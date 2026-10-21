"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Archive, Loader2, ScanBarcode, Undo2, AlertTriangle, Camera, Volume2, VolumeX, Search, X } from "lucide-react";
import { CameraScan } from "@/components/camera-scan";
import { ScanNoticeBanner } from "@/components/scan-notice";
import {
  previewDisposal,
  disposeBooks,
  getDisposedBooks,
  cancelDisposal,
  type DisposedBook,
  type DisposalPreview,
} from "@/app/actions/disposal";
import { useScannerInput } from "@/hooks/use-scanner-input";
import { useStagedScan, type PreviewResult } from "@/hooks/use-staged-scan";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "numeric", day: "numeric" });
}

function Cover({ src }: { src: string | null }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="w-9 h-12 object-cover rounded shrink-0 bg-muted" />
  ) : (
    <div className="w-9 h-12 rounded shrink-0 bg-muted" />
  );
}

// 찍으면 폐기할 수 있는 책인지 확인만 해서 대기 목록에 담음 (폐기는 [폐기하기] 버튼으로)
async function preview(code: string): Promise<PreviewResult<DisposalPreview>> {
  const res = await previewDisposal(code);
  if (!res.success || !res.data) return { ok: false, error: res.error ?? "책을 찾지 못했어요." };
  const p = res.data;
  return {
    ok: true,
    id: p.book.book_id,
    data: p,
    title: p.book.title,
    info: p.status === "already" ? "이미 폐기된 책이에요" : undefined,
  };
}

export default function DisposalPage() {
  const [list, setList] = useState<DisposedBook[] | null>(null);
  const [barcode, setBarcode] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [search, setSearch] = useState("");
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getDisposedBooks().then(setList);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const scan = useStagedScan(preview, {
    sound: soundOn,
    addedMessage: (p) => `${p.book.shelf} · 폐기 목록에 담았어요`,
  });

  // 입력칸 밖(버튼 등)에 커서가 있어도 리더기 입력을 받음. 카메라 사용 중에는 끔
  useScannerInput(scan.enqueue, !cameraOn);

  const ready = scan.items.filter((it) => it.state === "ready");
  const toDispose = ready.filter((it) => it.data.status === "ready");
  const errorCount = scan.items.filter((it) => it.state === "error").length;

  async function handleCommit() {
    if (toDispose.length === 0 || committing) return;
    setCommitting(true);
    const res = await disposeBooks(toDispose.map((it) => it.id));
    setCommitting(false);
    if (!res.success || !res.data) {
      scan.setNotice({ tone: "error", message: res.error ?? "폐기 처리에 실패했습니다." });
      return;
    }
    const { disposed, skipped } = res.data;
    setList((prev) => [...disposed, ...(prev ?? []).filter((b) => !disposed.some((d) => d.book_id === b.book_id))]);
    // 폐기한 책과 이미 폐기돼 있던 책은 목록에서 정리 (건너뛴 책은 남겨둠)
    scan.removeIds(new Set([...disposed.map((d) => d.book_id), ...ready.filter((it) => it.data.status === "already").map((it) => it.id)]));
    scan.setNotice(
      skipped.length > 0
        ? { tone: "error", message: `${disposed.length}권 폐기, ${skipped.length}권은 못 했어요: ${skipped.map((s) => `${s.title}(${s.reason})`).join(", ")}` }
        : { tone: "ok", message: `${disposed.length}권을 폐기했어요. 아래 폐기 목록에서 취소할 수 있어요.` }
    );
    inputRef.current?.focus();
  }

  async function handleCancel(bookId: string) {
    setCancelingId(bookId);
    const res = await cancelDisposal(bookId);
    setCancelingId(null);
    if (!res.success) {
      scan.setNotice({ tone: "error", message: res.error ?? "폐기 취소에 실패했습니다." });
      return;
    }
    const book = list?.find((b) => b.book_id === bookId);
    setList((prev) => (prev ?? []).filter((b) => b.book_id !== bookId));
    scan.setNotice({ tone: "info", title: book?.title, message: `폐기를 취소했어요. ${book?.shelf ?? "원래 책장"}(으)로 돌아갔어요.` });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!list || !q) return list ?? [];
    return list.filter((b) => b.title.toLowerCase().includes(q) || b.barcode.toLowerCase().includes(q) || b.shelf.toLowerCase().includes(q));
  }, [list, search]);

  return (
    <div className="space-y-6 pb-24">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Archive className="size-6" />
        폐기 도서
      </h1>

      <Card className="border-primary/50">
        <CardHeader>
          <CardTitle className="text-base">폐기할 책 바코드를 찍어 목록에 담으세요</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex gap-2 max-w-xl"
            onSubmit={(e) => {
              e.preventDefault();
              const code = barcode;
              setBarcode("");
              void scan.enqueue(code);
              inputRef.current?.focus();
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
            <Button type="submit" className="h-14 px-6" disabled={!barcode.trim()}>
              {scan.busy ? <Loader2 className="size-5 animate-spin" /> : <ScanBarcode className="size-5" />}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-14 px-4"
              onClick={() => setSoundOn((v) => !v)}
              title={soundOn ? "소리 끄기" : "소리 켜기"}
            >
              {soundOn ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
            </Button>
          </form>

          {scan.notice && <ScanNoticeBanner notice={scan.notice} />}

          {cameraOn ? (
            <CameraScan onScan={scan.enqueue} onClose={() => setCameraOn(false)} />
          ) : (
            <Button variant="outline" className="h-12 w-full sm:w-auto" onClick={() => setCameraOn(true)}>
              <Camera className="size-5 mr-2" />휴대폰 카메라로 찍기
            </Button>
          )}
          <p className="text-sm text-muted-foreground">
            리더기나 카메라로 연속해서 찍으면 아래 목록에 쌓여요. 다 찍었으면 <b className="text-foreground">[폐기하기]</b>를 누르세요.
            폐기한 책은 책장과 도서 목록에서 빠지고, 잘못 폐기했으면 폐기 목록에서 취소하면 원래 책장으로 돌아가요.
          </p>

          {/* 대기 목록 */}
          {scan.items.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">폐기할 목록 <Badge variant="secondary">{toDispose.length}권</Badge></p>
                {errorCount > 0 && (
                  <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={scan.clearErrors}>
                    오류 {errorCount}건 지우기
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="ml-auto text-muted-foreground" onClick={scan.clear} disabled={committing}>
                  목록 비우기
                </Button>
              </div>
              <div className="rounded-lg border divide-y max-h-[50vh] overflow-y-auto">
                {scan.items.map((it) =>
                  it.state === "loading" ? (
                    <div key={it.key} className="flex items-center gap-3 p-3">
                      <Loader2 className="size-5 animate-spin text-muted-foreground shrink-0" />
                      <span className="font-mono text-sm text-muted-foreground">{it.barcode}</span>
                    </div>
                  ) : it.state === "error" ? (
                    <div key={it.key} className="flex items-center gap-3 p-3 bg-destructive/5">
                      <AlertTriangle className="size-5 text-destructive shrink-0" />
                      <p className="min-w-0 flex-1 text-sm text-destructive">{it.error}</p>
                      <Button size="icon-sm" variant="ghost" onClick={() => scan.remove(it.key)} aria-label="빼기"><X className="size-4" /></Button>
                    </div>
                  ) : (
                    <div key={it.key} className={`flex items-center gap-3 p-3 ${it.data.status === "already" ? "opacity-50" : ""}`}>
                      <Cover src={it.data.book.cover_image} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium line-clamp-1">{it.data.book.title}</p>
                        <p className="text-sm text-muted-foreground">
                          <span className="font-mono">{it.data.book.barcode}</span> · {it.data.status === "already" ? "이미 폐기된 책이에요" : it.data.book.shelf}
                        </p>
                      </div>
                      <Button size="icon-sm" variant="ghost" onClick={() => scan.remove(it.key)} aria-label="목록에서 빼기"><X className="size-4" /></Button>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            폐기 목록
            {list && <Badge variant="secondary">{list.length}권</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="제목, 바코드, 책장 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 text-base"
            />
          </div>

          {!list ? (
            <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{search ? "검색 결과가 없습니다." : "폐기한 책이 없어요."}</p>
          ) : (
            <div className="rounded-lg border divide-y">
              {filtered.map((b) => (
                <div key={b.book_id} className="flex items-center gap-3 p-3">
                  <Cover src={b.cover_image} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium line-clamp-1">{b.title}</p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-mono">{b.barcode}</span> · 원래 책장 {b.shelf} · {formatDate(b.disposed_at)}
                      {b.disposed_by ? ` · ${b.disposed_by}` : ""}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleCancel(b.book_id)} disabled={cancelingId === b.book_id}>
                    {cancelingId === b.book_id ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4 mr-1" />}
                    폐기 취소
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 하단 고정: 폐기하기 */}
      {toDispose.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:left-60">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <p className="flex-1 text-sm sm:text-base">
              <b className="text-lg">{toDispose.length}권</b>을 폐기할까요?
              {scan.busy && <span className="ml-2 text-muted-foreground">확인 중…</span>}
            </p>
            <Button variant="destructive" className="h-12 px-6 text-base font-bold" onClick={handleCommit} disabled={committing || scan.busy}>
              {committing ? <Loader2 className="size-5 animate-spin" /> : `${toDispose.length}권 폐기하기`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
