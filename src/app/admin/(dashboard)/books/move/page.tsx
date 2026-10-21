"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRightLeft, Loader2, ScanBarcode, Undo2, AlertTriangle, CheckCircle2, Camera, Volume2, VolumeX, X } from "lucide-react";
import { CameraScan } from "@/components/camera-scan";
import { ScanNoticeBanner } from "@/components/scan-notice";
import {
  getMoveShelves,
  getShelfBooks,
  getUnscannedBooks,
  moveBookToShelf,
  moveBooksToShelf,
  undoBookMove,
  type MoveResult,
  type MovedBook,
  type ShelfBook,
  type UnscannedGroup,
} from "@/app/actions/shelf-move";
import { useScannerInput } from "@/hooks/use-scanner-input";
import { useStagedScan, type PreviewResult } from "@/hooks/use-staged-scan";

type Shelf = Awaited<ReturnType<typeof getMoveShelves>>[number];
type HistoryItem = MovedBook & { key: number; undone?: boolean };

let historyKey = 0;

// 책장 선택 화면 묶음 (이름 앞부분으로 구분). 묶음 안에서는 배치도 순서 그대로
// (getMoveShelves가 위→아래, 왼쪽→오른쪽 순서로 줌: 위쪽 벽은 왼쪽부터, 옆 벽은 위에서부터)
const SHELF_SECTIONS: { title: string; prefixes: string[] }[] = [
  { title: "초등", prefixes: ["역사지식", "초등", "신착추천"] },
  { title: "청소년 · 일반", prefixes: ["청소년", "소설", "에세이", "자기계발", "취미기타"] },
  { title: "유아", prefixes: ["유아"] },
  { title: "영어", prefixes: ["영어"] },
];

function groupShelves(shelves: Shelf[]): { title: string; items: Shelf[] }[] {
  const sections = [...SHELF_SECTIONS.map((s) => ({ title: s.title, items: [] as Shelf[] })), { title: "기타", items: [] as Shelf[] }];
  for (const s of shelves) {
    const si = SHELF_SECTIONS.findIndex((sec) => sec.prefixes.some((p) => s.name.startsWith(p)));
    sections[si >= 0 ? si : SHELF_SECTIONS.length].items.push(s);
  }
  // 같은 벽(가장 많은 칸이 같은 x 또는 y)에 붙은 칸을 먼저, 떨어진 칸(예: 유아책상 앞)은 뒤로
  // 가장 많이 겹치는 좌표 [값, 칸 수]
  const mode = (vals: number[]): [number, number] => {
    const c = new Map<number, number>();
    for (const v of vals) c.set(v, (c.get(v) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1])[0] ?? [0, 0];
  };
  for (const sec of sections) {
    const [mx, nx] = mode(sec.items.map((s) => s.x));
    const [my, ny] = mode(sec.items.map((s) => s.y));
    // 옆 벽이면 x가, 위쪽 벽이면 y가 같은 칸이 많음
    const onWall = (s: Shelf) => ((nx >= ny ? s.x === mx : s.y === my) ? 0 : 1);
    sec.items = [...sec.items].sort((a, b) => onWall(a) - onWall(b));
  }
  return sections.filter((sec) => sec.items.length > 0);
}

function Cover({ src }: { src: string | null }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="w-9 h-12 object-cover rounded shrink-0 bg-muted" />
  ) : (
    <div className="w-9 h-12 rounded shrink-0 bg-muted" />
  );
}

export default function ShelfMovePage() {
  const [shelves, setShelves] = useState<Shelf[] | null>(null);
  const [shelf, setShelf] = useState<string | null>(null);
  const [barcode, setBarcode] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const shelfRef = useRef(shelf);
  useEffect(() => {
    shelfRef.current = shelf;
  }, [shelf]);

  const [unscanned, setUnscanned] = useState<UnscannedGroup[] | null>(null);
  // 고른 책장에 지금 있는 책 (이동 완료)
  const [shelfBooks, setShelfBooks] = useState<{ shelf: string; books: ShelfBook[] } | null>(null);
  const [shelfQuery, setShelfQuery] = useState("");
  const loadShelfBooks = (name: string | null) => {
    if (name) getShelfBooks(name).then((books) => shelfRef.current === name && setShelfBooks({ shelf: name, books }));
  };
  const refreshCounts = () => {
    getMoveShelves().then(setShelves);
    getUnscannedBooks().then(setUnscanned);
    loadShelfBooks(shelfRef.current);
  };

  useEffect(refreshCounts, []);

  // 책장을 고르면 그 책장 책 목록을 불러오고, 바로 바코드 입력칸에 커서
  useEffect(() => {
    if (!shelf) return;
    loadShelfBooks(shelf);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [shelf]);

  const currentShelfBooks = shelfBooks && shelfBooks.shelf === shelf ? shelfBooks.books : null;
  const q = shelfQuery.trim().toLowerCase();
  const filteredShelfBooks = currentShelfBooks?.filter(
    (b) => !q || b.title.toLowerCase().includes(q) || b.barcode.toLowerCase().includes(q)
  );

  // 찍으면 책 정보만 확인해서 대기 목록에 담음 (옮기기는 [옮기기] 버튼으로)
  async function preview(code: string): Promise<PreviewResult<MoveResult>> {
    const target = shelfRef.current;
    if (!target) return { ok: false, error: "책장을 먼저 선택해주세요." };
    const res = await moveBookToShelf(code, target, true);
    if (!res.success || !res.data) return { ok: false, error: res.error ?? "책을 찾지 못했어요." };
    const r = res.data;
    return {
      ok: true,
      id: r.book.id,
      data: r,
      title: r.book.title,
      info: r.from === shelfRef.current ? `이미 ${r.from}에 있어요` : undefined,
    };
  }

  const scan = useStagedScan(preview, {
    sound: soundOn,
    addedMessage: (r) => `${r.from} → ${shelfRef.current} · 목록에 담았어요`,
  });

  // 입력칸 밖(버튼 등)에 커서가 있어도 리더기 입력을 받음. 카메라 사용 중에는 끔
  useScannerInput(scan.enqueue, !!shelf && !cameraOn);

  const ready = scan.items.filter((it) => it.state === "ready");
  const toMove = ready.filter((it) => it.data.from !== shelf);
  const errorCount = scan.items.filter((it) => it.state === "error").length;
  const movedCount = history.filter((h) => !h.undone).length;

  async function handleCommit() {
    if (!shelf || toMove.length === 0 || committing) return;
    setCommitting(true);
    const res = await moveBooksToShelf(toMove.map((it) => it.id), shelf);
    setCommitting(false);
    if (!res.success || !res.data) {
      scan.setNotice({ tone: "error", message: res.error ?? "이동에 실패했습니다." });
      return;
    }
    const moved = res.data;
    setHistory((prev) => [...moved.map((m) => ({ ...m, key: ++historyKey })), ...prev]);
    // 옮긴 책과 이미 이 책장에 있던 책은 목록에서 정리
    scan.removeIds(new Set([...moved.map((m) => m.book.id), ...ready.filter((it) => it.data.from === shelf).map((it) => it.id)]));
    scan.setNotice({ tone: "ok", message: `${moved.length}권을 ${shelf}(으)로 옮겼어요` });
    // 책장별 권수·안 찍은 책 갱신
    refreshCounts();
    inputRef.current?.focus();
  }

  async function handleUndo(item: HistoryItem) {
    const res = await undoBookMove(item.book.id, item.from);
    if (res.success) {
      setHistory((prev) => prev.map((h) => (h.key === item.key ? { ...h, undone: true } : h)));
      refreshCounts();
    }
    inputRef.current?.focus();
  }

  return (
    <div className="space-y-6 pb-24">
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
            <div className="space-y-5">
              {groupShelves(shelves).map((sec) => (
                <section key={sec.title} className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    {sec.title}
                    <span className="font-normal">{sec.items.reduce((n, s) => n + s.count, 0)}권</span>
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                    {sec.items.map((s) => (
                      <button
                        key={s.name}
                        onClick={() => { setShelf(s.name); setCameraOn(false); setShelfQuery(""); }}
                        className={`text-left rounded-lg border-2 px-3 py-2 transition-colors ${
                          shelf === s.name ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                        }`}
                      >
                        <p className="font-semibold">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.count}권</p>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. 바코드 연속 스캔 → 대기 목록 */}
      {shelf && (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-baseline gap-2 text-base">
              2. 옮길 책 바코드를 찍어 <span className="text-xl text-primary">{shelf}</span> 목록에 담으세요
            </CardTitle>
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
              <CameraScan key={shelf} onScan={scan.enqueue} onClose={() => setCameraOn(false)} />
            ) : (
              <Button variant="outline" className="h-12 w-full sm:w-auto" onClick={() => setCameraOn(true)}>
                <Camera className="size-5 mr-2" />휴대폰 카메라로 찍기
              </Button>
            )}
            <p className="text-sm text-muted-foreground">
              리더기나 카메라로 연속해서 찍으면 아래 목록에 쌓여요. 입력칸을 누르지 않아도 리더기로 찍으면 바로 들어가요.
              다 찍었으면 <b className="text-foreground">[옮기기]</b>를 누르세요.
            </p>

            {/* 대기 목록 */}
            {scan.items.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">옮길 목록 <Badge variant="secondary">{toMove.length}권</Badge></p>
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
                      <div key={it.key} className={`flex items-center gap-3 p-3 ${it.data.from === shelf ? "opacity-50" : ""}`}>
                        <Cover src={it.data.book.cover_image} />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium line-clamp-1">{it.data.book.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {it.data.from === shelf ? `이미 ${shelf}에 있어요` : <>{it.data.from} → <b className="text-foreground">{shelf}</b></>}
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
      )}

      {/* 고른 책장에 지금 있는 책 (이동 완료) */}
      {shelf && (
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              {shelf}에 있는 책
              {currentShelfBooks && <Badge variant="secondary">{currentShelfBooks.length}권</Badge>}
            </CardTitle>
            {currentShelfBooks && currentShelfBooks.length > 0 && (
              <Input
                value={shelfQuery}
                onChange={(e) => setShelfQuery(e.target.value)}
                placeholder="제목·바코드 찾기"
                className="max-w-xs"
              />
            )}
          </CardHeader>
          <CardContent>
            {!filteredShelfBooks ? (
              <div className="flex justify-center py-6"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
            ) : filteredShelfBooks.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {q ? "찾는 책이 없어요." : "아직 이 책장으로 옮긴 책이 없어요."}
              </p>
            ) : (
              <ul className="max-h-[60vh] divide-y overflow-y-auto rounded-lg border text-sm">
                {filteredShelfBooks.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 px-3 py-2">
                    <Cover src={b.cover_image} />
                    <span className="min-w-0 flex-1 line-clamp-2">{b.title}</span>
                    <span className="shrink-0 font-mono text-muted-foreground">{b.barcode}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* 옮긴 기록 (되돌리기) */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">옮긴 기록 <Badge variant="secondary">{movedCount}권</Badge></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border divide-y max-h-[50vh] overflow-y-auto">
              {history.map((h) => (
                <div key={h.key} className={`flex items-center gap-3 p-3 ${h.undone ? "opacity-50" : ""}`}>
                  <Cover src={h.book.cover_image} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium line-clamp-1">{h.book.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {h.undone ? (
                        `되돌림 · ${h.from}에 그대로`
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="size-3.5 text-green-600" />
                          {h.from} → <b className="text-foreground">{h.to}</b>
                        </span>
                      )}
                    </p>
                  </div>
                  {!h.undone && (
                    <Button size="sm" variant="ghost" onClick={() => handleUndo(h)}>
                      <Undo2 className="size-4 mr-1" />되돌리기
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 아직 안 찍은 책 (예전 책장 이름에 남은 책) */}
      {unscanned && unscanned.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              아직 안 찍은 책
              <Badge variant="secondary">{unscanned.reduce((n, g) => n + g.books.length, 0)}권</Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              지금 배치도에 없는 예전 책장 이름에 남아 있는 책이에요. 책장마다 다 찍은 뒤에도 남아 있으면 분실·다른 칸·폐기 확인이 필요해요.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {unscanned.map((g) => (
              <details key={g.group} className="rounded-lg border">
                <summary className="flex cursor-pointer items-center gap-2 p-3 font-medium">
                  {g.group || "(책장 없음)"}
                  <Badge variant="outline">{g.books.length}권</Badge>
                </summary>
                <ul className="max-h-80 divide-y overflow-y-auto border-t text-sm">
                  {g.books.map((b) => (
                    <li key={b.id} className="flex items-center gap-2 px-3 py-2">
                      <span className="min-w-0 flex-1 truncate">{b.title}</span>
                      <span className="shrink-0 font-mono text-muted-foreground">{b.barcode}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 하단 고정: 옮기기 */}
      {shelf && toMove.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:left-60">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <p className="flex-1 text-sm sm:text-base">
              <b className="text-lg">{toMove.length}권</b>을 <b className="text-primary">{shelf}</b>(으)로 옮길까요?
              {scan.busy && <span className="ml-2 text-muted-foreground">확인 중…</span>}
            </p>
            <Button className="h-12 px-6 text-base font-bold" onClick={handleCommit} disabled={committing || scan.busy}>
              {committing ? <Loader2 className="size-5 animate-spin" /> : `${toMove.length}권 옮기기`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
