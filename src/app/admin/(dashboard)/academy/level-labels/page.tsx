"use client";

// 학원 모드 전용: 책등에 붙이는 AR 레벨 라벨 인쇄 (A4, 한 줄 8개 × 7줄 = 56개).
// 라벨 1개 = 24×36mm: 위 색 띠(레벨대별 색) + AR 레벨 크게 + 아래 칸(제목 짧게 / 바코드 / 없음) + 아래 색 띠.
// 화면 미리보기도 mm 단위라 인쇄와 같은 크기로 보인다. 인쇄 규칙은 이 화면 안의 <style> 에만 둔다(다른 인쇄 화면 영향 없음).

import { useEffect, useRef, useState, useTransition } from "react";
import JsBarcode from "jsbarcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2, Printer, Search, Tags, Trash2 } from "lucide-react";
import { getShelves } from "@/app/actions/shelves";
import { getBooksForLevelLabels, type LevelLabelBook } from "@/app/actions/academy";
import { AR_LEVEL_BANDS, arLevelBand } from "@/lib/ar";
import { AcademyGate } from "../academy-gate";

type BottomMode = "title" | "barcode" | "none";

function LabelBarcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format: "CODE128",
        width: 1,
        height: 28,
        margin: 0,
        displayValue: false,
      });
    } catch {
      // 바코드로 만들 수 없는 값 — 번호 글자만 보인다
    }
  }, [value]);
  return <svg ref={ref} className="ll-barcode" />;
}

function LevelLabel({ book, bottom }: { book: LevelLabelBook; bottom: BottomMode }) {
  const band = arLevelBand(book.ar_level) ?? AR_LEVEL_BANDS[AR_LEVEL_BANDS.length - 1];
  return (
    <div className="level-label" style={{ borderColor: band.color }}>
      <div className="ll-band" style={{ background: band.color, color: band.text }}>
        AR
      </div>
      <div className="ll-level">{book.ar_level.toFixed(1)}</div>
      {bottom === "title" && <div className="ll-title">{book.title}</div>}
      {bottom === "barcode" && (
        <div className="ll-code">
          <LabelBarcode value={book.barcode} />
          <span>{book.barcode}</span>
        </div>
      )}
      {bottom === "none" && <div className="ll-spacer" />}
      <div className="ll-band ll-band-bottom" style={{ background: band.color }} />
    </div>
  );
}

const LABEL_CSS = `
.level-label-grid { display: flex; flex-wrap: wrap; gap: 1mm; }
.level-label {
  flex: 0 0 24mm; width: 24mm; height: 36mm; box-sizing: border-box; overflow: hidden;
  display: flex; flex-direction: column; align-items: stretch;
  background: #fff; color: #111827; border: 0.6mm solid #999;
  break-inside: avoid; page-break-inside: avoid;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.level-label .ll-band { height: 6mm; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; font-size: 8pt; font-weight: 700; letter-spacing: 0.5mm; }
.level-label .ll-band-bottom { height: 3mm; margin-top: auto; }
.level-label .ll-level { text-align: center; font-size: 20pt; font-weight: 800; line-height: 1; padding: 2mm 0 1.5mm; font-variant-numeric: tabular-nums; }
.level-label .ll-title {
  padding: 0 1.2mm; font-size: 6.5pt; line-height: 1.25; text-align: center; word-break: break-all;
  display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;
}
.level-label .ll-code { display: flex; flex-direction: column; align-items: center; padding: 0 0.8mm; gap: 0.3mm; }
.level-label .ll-code svg { width: 100%; height: 8mm; }
.level-label .ll-code span { font-size: 5.5pt; font-family: ui-monospace, monospace; line-height: 1; }
.level-label .ll-spacer { flex: 1 1 auto; }
.level-label.ll-blank { border: 0.3mm dashed #d1d5db; background: transparent; }
@media print {
  .level-label-grid { gap: 1mm !important; }
  .level-label.ll-blank { visibility: hidden; }
}
`;

function LevelLabelsView() {
  const [shelves, setShelves] = useState<{ name: string; count: number }[]>([]);
  const [shelf, setShelf] = useState("");
  const [minLevel, setMinLevel] = useState("");
  const [maxLevel, setMaxLevel] = useState("");
  const [bottom, setBottom] = useState<BottomMode>("title");
  const [skip, setSkip] = useState("0");
  const [books, setBooks] = useState<LevelLabelBook[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, startLoading] = useTransition();

  useEffect(() => {
    getShelves()
      .then((list) => setShelves(list.filter((s) => s.type === "shelf").map((s) => ({ name: s.name, count: s.book_count }))))
      .catch(() => {});
  }, []);

  function pickBand(min: number, max?: number) {
    setMinLevel(String(min));
    setMaxLevel(max === undefined ? "" : String(max));
  }

  function load() {
    setError("");
    const min = minLevel.trim() === "" ? undefined : Number(minLevel);
    const max = maxLevel.trim() === "" ? undefined : Number(maxLevel);
    if ((min !== undefined && !Number.isFinite(min)) || (max !== undefined && !Number.isFinite(max))) {
      setError("레벨은 숫자로 입력해 주세요.");
      return;
    }
    if (min !== undefined && max !== undefined && min > max) {
      setError("레벨 범위를 확인해 주세요 (아래 값이 위 값보다 큽니다).");
      return;
    }
    startLoading(async () => {
      const res = await getBooksForLevelLabels({ shelf: shelf || undefined, min, max });
      if (!res.success || !res.data) {
        setError(res.error || "책 목록을 불러오지 못했습니다.");
        setBooks(null);
        return;
      }
      setBooks(res.data.books);
      setTruncated(res.data.truncated);
    });
  }

  const skipCount = Math.min(Math.max(parseInt(skip, 10) || 0, 0), 55);
  const hasLabels = !!books && books.length > 0;

  return (
    <div className="space-y-6">
      <style>{LABEL_CSS}</style>

      <div className="flex items-center justify-between gap-2 print:hidden">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Tags className="size-6" />
          레벨 라벨 인쇄
        </h1>
        {hasLabels && (
          <Button onClick={() => window.print()}>
            <Printer className="size-4 mr-1" />
            인쇄
          </Button>
        )}
      </div>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="text-base">책등용 AR 레벨 라벨</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            AR 레벨이 입력된 책만 나옵니다. 인쇄하면 라벨 1개가 24×36mm 크기로, A4 한 장에 56개(8개 × 7줄)씩 나옵니다.
            레벨대마다 색 띠가 달라 책장에서 레벨을 한눈에 볼 수 있습니다.
          </p>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">책장</label>
              <select className="h-10 min-w-48 rounded-md border bg-background px-2 text-sm" value={shelf} onChange={(e) => setShelf(e.target.value)}>
                <option value="">전체 책장</option>
                {shelves.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} ({s.count}권)
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">레벨 범위</label>
              <div className="flex items-center gap-1.5">
                <Input className="h-10 w-20" inputMode="decimal" placeholder="0.0" value={minLevel} onChange={(e) => setMinLevel(e.target.value)} />
                <span className="text-muted-foreground">~</span>
                <Input className="h-10 w-20" inputMode="decimal" placeholder="13.9" value={maxLevel} onChange={(e) => setMaxLevel(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">라벨 아래 칸</label>
              <div className="flex gap-1">
                {(
                  [
                    ["title", "제목"],
                    ["barcode", "바코드"],
                    ["none", "없음"],
                  ] as const
                ).map(([v, label]) => (
                  <Button key={v} size="sm" className="h-10" variant={bottom === v ? "default" : "outline"} onClick={() => setBottom(v)}>
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">앞에서 비울 칸</label>
              <Input className="h-10 w-20" inputMode="numeric" value={skip} onChange={(e) => setSkip(e.target.value.replace(/[^0-9]/g, ""))} />
            </div>
            <Button className="h-10" onClick={load} disabled={isLoading}>
              {isLoading ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Search className="size-4 mr-1" />}
              불러오기
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-1">레벨대 고르기</span>
            {AR_LEVEL_BANDS.map((b) => (
              <button
                key={b.key}
                onClick={() => pickBand(b.min, b.max)}
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs hover:bg-muted"
              >
                <span className="inline-block size-3 rounded-sm border" style={{ background: b.color }} />
                {b.label}
              </button>
            ))}
            <button
              onClick={() => {
                setMinLevel("");
                setMaxLevel("");
              }}
              className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              전체 레벨
            </button>
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="size-4" />
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {books && (
        <div className="space-y-3">
          <div className="flex items-center justify-between print:hidden">
            <div>
              <p className="text-sm text-muted-foreground">
                {books.length}권{truncated && " (2,000권까지만 불러왔습니다. 책장이나 레벨 범위를 좁혀 주세요)"}
              </p>
              {books.length > 0 && <p className="text-xs text-muted-foreground">테두리선을 따라 잘라 책등 아래쪽에 붙이세요. 레벨 낮은 순 → 제목 순입니다.</p>}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setBooks(null)}>
              <Trash2 className="size-4 mr-1" />
              비우기
            </Button>
          </div>
          {books.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground print:hidden">조건에 맞는 AR 레벨 책이 없습니다.</p>
          ) : (
            <div className="level-label-grid">
              {Array.from({ length: skipCount }).map((_, i) => (
                <div key={`blank-${i}`} className="level-label ll-blank" />
              ))}
              {books.map((b) => (
                <LevelLabel key={b.id} book={b} bottom={bottom} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AcademyLevelLabelsPage() {
  return (
    <AcademyGate>
      <LevelLabelsView />
    </AcademyGate>
  );
}
