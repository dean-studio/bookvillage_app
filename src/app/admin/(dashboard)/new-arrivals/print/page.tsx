"use client";

import { useEffect, useLayoutEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Printer, Loader2, ImageIcon, Plus, Minus } from "lucide-react";
import { getNewArrivals } from "@/app/actions/new-arrivals";
import { NEW_ARRIVAL_CATEGORIES, type NewArrival } from "@/lib/new-arrivals";
import { getPublicSettings } from "@/app/actions/settings";
import { QrCodeSvg } from "@/components/qr-code";

function currentYearMonth(): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// 콘텐츠 폭 = 200mm - 좌우 패딩 8mm*2 = 184mm, 가로 간격 6mm
const CONTENT_W = 184;
const GAP_X = 6;
// 열 수에 따른 표지 카드 폭(mm)
function cardWidthMm(cols: number): number {
  return (CONTENT_W - (cols - 1) * GAP_X) / cols;
}

type Layout = "list" | "grid";

// A4 인쇄 가능 높이 277mm(위아래 여백 10mm) 중 반올림 오차로 넘치지 않게 3mm 남긴다
const MM = 96 / 25.4;
const AVAIL_PX = 274 * MM;
const PAD_PX = 20 * MM; // .newbook-fit 위아래 패딩 10mm씩
const ROW_GAP_PX = 8 * MM; // 표지형 줄 간격
const MIN_ZOOM = 0.35;
// 표지형 자동: 한 줄 권수가 폭을 정하므로 너무 줄이면 가운데 좁은 기둥이 된다 → 이보다 작아지면 장을 늘린다
const GRID_AUTO_MIN = 0.7;

// 목록형 양옆 표지: 제목 표가 우선. 양쪽 한 줄씩 6권, 표 높이에 맞춘 폭으로 원래 비율(안 잘림)대로 놓는다.
const SIDE_PER = 6; // 한쪽 표지 수 기본값
const SIDE_GAP = 4; // mm
const COVER_RATIO = 1.45; // 표지 세로/가로 추정
const TABLE_FONT = 13; // 표 글자 크기 기본값(px)

// 표 한 줄 높이 추정(mm) = 위아래 여백 3.2mm + 줄 높이(글자 px × 1.375 × 0.2646mm)
function rowHeightMm(fontPx: number): number {
  return 3.2 + fontPx * 0.364;
}

// 기본 표지 폭(mm): 표 높이(책 권수 + 헤더) 안에 n장이 들어가는 폭보다 15% 크게, 18~32mm
function sideCoverWidth(rowCount: number, n: number, fontPx: number): number {
  const tableH = rowCount * rowHeightMm(fontPx) + 10;
  const w = ((tableH - (n - 1) * SIDE_GAP) / n / COVER_RATIO) * 1.15;
  return Math.round(Math.min(32, Math.max(18, w)));
}

function SideCovers({ covers, width }: { covers: string[]; width: number }) {
  return (
    <div className="newbook-side flex shrink-0 flex-col justify-between" style={{ width: `${width}mm`, gap: `${SIDE_GAP}mm` }}>
      {covers.map((src, i) => (
        <div key={i} className="overflow-hidden rounded-md bg-neutral-100 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.3)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="block h-auto w-full" />
        </div>
      ))}
    </div>
  );
}

function NewArrivalsPrint() {
  const params = useSearchParams();
  const month = params.get("month") || currentYearMonth();
  const [items, setItems] = useState<NewArrival[]>([]);
  const [libName, setLibName] = useState("자람도서관");
  const [loading, setLoading] = useState(true);

  // 레이아웃 조절: 목록형/표지형, 열 수(표지형) + 배율(자동/수동)
  const [layout, setLayout] = useState<Layout>("list");
  const [cols, setCols] = useState(5);
  const [sidePer, setSidePer] = useState(SIDE_PER); // 목록형 한쪽 표지 수
  const [tableFont, setTableFont] = useState(TABLE_FONT); // 목록형 표 글자 크기(px)
  const [manualSideW, setManualSideW] = useState<number | null>(null); // 목록형 표지 폭(mm), null = 자동
  const [manualZoom, setManualZoom] = useState<number | null>(null); // null = 자동 맞춤

  // 도서관 바로가기 QR (상단)
  const [showQr, setShowQr] = useState(true);
  const [siteUrl, setSiteUrl] = useState("");

  useEffect(() => {
    Promise.all([getNewArrivals(month), getPublicSettings()]).then(([data, settings]) => {
      setItems(data);
      if (settings.apartment_name) {
        // "중앙힐스테이트 자람도서관" → "자람도서관" (마지막 어절, 도서관 이름만)
        const parts = settings.apartment_name.trim().split(/\s+/);
        setLibName(parts[parts.length - 1]);
      }
      setSiteUrl(window.location.origin);
      setLoading(false);
    });
  }, [month]);

  // A4 맞춤: 헤더(타이틀·QR)는 고정, 그 아래만 축소. 표지형은 넘치면 줄 단위로 페이지를 나눈다.
  const headerRef = useRef<HTMLElement>(null); // 1쪽 헤더 높이 측정
  const measureRef = useRef<HTMLDivElement>(null); // 축소 안 한 원래 크기 측정용(화면 밖, 안 보임)
  const [scale, setScale] = useState(1);
  const [pageStarts, setPageStarts] = useState<number[]>([0]); // 표지형: 각 쪽 첫 책 번호

  useLayoutEffect(() => {
    if (loading || items.length === 0) return;

    function fit() {
      const header = headerRef.current;
      const measure = measureRef.current;
      if (!header || !measure) return;
      const mb = parseFloat(getComputedStyle(header).marginBottom) || 0;
      const fixed1 = header.getBoundingClientRect().height + mb + PAD_PX; // 1쪽 고정부
      const top = measure.getBoundingClientRect().top;
      const totalH = measure.getBoundingClientRect().height;
      if (totalH === 0) return;

      if (layout === "list") {
        const avail = AVAIL_PX - fixed1;
        const s = manualZoom ?? (totalH > avail ? Math.max(MIN_ZOOM, avail / totalH) : 1);
        setScale(s);
        setPageStarts([0]);
        return;
      }

      // 표지형: 줄마다 높이(원래 크기) 재기
      const cards = Array.from(measure.querySelectorAll<HTMLElement>("[data-card]"));
      if (cards.length === 0) return;
      const rows: { top: number; bottom: number }[] = [];
      cards.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const ri = Math.floor(i / cols);
        if (!rows[ri]) rows[ri] = { top: r.top - top, bottom: r.bottom - top };
        else rows[ri].bottom = Math.max(rows[ri].bottom, r.bottom - top);
      });
      const legendH = rows[0].top; // 범례 + 여백
      const rowH = rows.map((r) => r.bottom - r.top);

      // 배율 s에서 줄 단위로 쪽 나누기 → 각 쪽 첫 책 번호
      const paginate = (s: number) => {
        const starts = [0];
        let avail = (AVAIL_PX - fixed1) / s - legendH;
        let used = 0;
        rowH.forEach((h, ri) => {
          const need = (used > 0 ? ROW_GAP_PX : 0) + h;
          if (used > 0 && used + need > avail) {
            starts.push(ri * cols);
            avail = (AVAIL_PX - PAD_PX) / s;
            used = h;
          } else used += need;
        });
        return starts;
      };

      let s = manualZoom ?? 1;
      if (manualZoom === null) {
        // 가장 적은 장수에서 가장 크게: 1장에 GRID_AUTO_MIN 이상으로 들어가면 1장, 아니면 2장, 3장 …
        for (let p = 1; p <= rowH.length; p++) {
          if (paginate(1).length <= p) { s = 1; break; }
          if (paginate(GRID_AUTO_MIN).length > p) continue;
          let lo = GRID_AUTO_MIN, hi = 1;
          for (let k = 0; k < 18; k++) {
            const mid = (lo + hi) / 2;
            if (paginate(mid).length <= p) lo = mid; else hi = mid;
          }
          s = Math.floor(lo * 1000) / 1000;
          break;
        }
      }
      setScale(s);
      setPageStarts(paginate(s));
    }

    fit();

    // 표지 이미지 로딩 완료 시 재측정
    const imgs = Array.from(measureRef.current?.querySelectorAll("img") ?? []);
    const onLoad = () => fit();
    imgs.forEach((im) => {
      if (!im.complete) {
        im.addEventListener("load", onLoad, { once: true });
        im.addEventListener("error", onLoad, { once: true });
      }
    });
    document.fonts?.ready.then(fit);
    window.addEventListener("resize", fit);
    return () => {
      imgs.forEach((im) => {
        im.removeEventListener("load", onLoad);
        im.removeEventListener("error", onLoad);
      });
      window.removeEventListener("resize", fit);
    };
  }, [loading, items, layout, cols, sidePer, manualSideW, tableFont, manualZoom, showQr, siteUrl]);

  // 배율 수동 조절 (현재 배율 기준 ±5%)
  function bumpZoom(delta: number) {
    const base = manualZoom ?? scale;
    const next = Math.min(1.5, Math.max(MIN_ZOOM, Math.round((base + delta) * 100) / 100));
    setManualZoom(next);
  }

  const [, m] = month.split("-");
  const monthNum = parseInt(m, 10);
  const cardW = cardWidthMm(cols);

  // 분류별 그룹 (책이 있는 분류만, NEW_ARRIVAL_CATEGORIES 순서대로) → 범례용
  const groups = NEW_ARRIVAL_CATEGORIES
    .map((c) => ({ ...c, books: items.filter((it) => it.category === c.value) }))
    .filter((g) => g.books.length > 0);

  // 한 흐름으로 쭉 나열: 분류 순서대로 이어붙이고, 색상만 분류별로 다르게 한다
  const flatBooks = groups.flatMap((g) =>
    g.books.map((book) => ({ book, color: g.color, label: g.label }))
  );

  // 목록형: 책 한 권 = 한 줄 + 양옆 표지
  const hasAuthor = items.some((it) => it.author);
  // 양옆 표지: 한쪽 sidePer권씩 목록 순서대로 고르게 → 앞쪽(유아·어린이) 왼쪽, 뒤쪽(청소년·성인) 오른쪽
  const covers = [...new Set(flatBooks.map(({ book }) => book.cover_image).filter((c): c is string => !!c))];
  const pickN = Math.min(sidePer * 2, covers.length);
  const picked = Array.from({ length: pickN }, (_, i) => covers[Math.floor((i * covers.length) / pickN)]);
  const leftCovers = picked.slice(0, Math.ceil(pickN / 2));
  const rightCovers = picked.slice(Math.ceil(pickN / 2));
  const sideW = manualSideW ?? sideCoverWidth(items.length, Math.max(1, leftCovers.length), tableFont);

  // 쪽 나누기 (목록형은 한 쪽)
  const pages = (layout === "grid" ? pageStarts : [0]).map((start, i, arr) => ({
    offset: start,
    books: flatBooks.slice(start, arr[i + 1] ?? flatBooks.length),
  }));

  // 헤더: 제목 + 도서관 바로가기 QR
  const headerBlock = (
    <header ref={headerRef} className="newbook-header relative mb-8">
      <div className={`flex items-center gap-[6mm] ${showQr && siteUrl ? "justify-between" : "justify-center"}`}>
        <div className={`flex min-w-0 flex-col gap-2 ${showQr && siteUrl ? "items-start text-left" : "items-center text-center"}`}>
          <span className="newbook-eyebrow inline-flex items-center gap-2 text-primary font-bold tracking-[0.35em] text-xs uppercase">
            <span className="newbook-eyebrow-line" />
            New Arrivals
            <span className="newbook-eyebrow-line" />
          </span>
          <h2 className="newbook-title text-4xl font-extrabold text-neutral-900 leading-tight break-keep">
            <span className="text-primary">{monthNum}월</span> {libName} 신간도서
          </h2>
          {showQr && siteUrl && (
            <p className="mt-1 text-[15px] font-semibold leading-snug text-neutral-700 break-keep">
              오른쪽 QR을 휴대폰 카메라로 찍어 <span className="text-primary">로그인</span>하면,
              <br />
              읽고 싶은 책이 지금 <span className="text-primary">대여 가능한지</span> 바로 확인할 수 있어요.
            </p>
          )}
        </div>
        {showQr && siteUrl && (
          <div className="flex shrink-0 flex-col items-center gap-1.5">
            <div className="newbook-badge rounded-xl border-2 border-primary bg-white p-[1.5mm]">
              <QrCodeSvg value={siteUrl} className="size-[34mm]" />
            </div>
            <span className="newbook-badge rounded-full bg-primary px-3 py-0.5 text-xs font-bold text-primary-foreground">
              도서관 바로가기
            </span>          </div>
        )}
      </div>
      <div className="newbook-rule mt-5 h-px w-full bg-gradient-to-r from-transparent via-neutral-200 to-transparent" />
    </header>
  );

  // 목록형 표 + 양옆 표지
  const listBlock = (
    <div className="flex items-stretch gap-[4mm]">
      {leftCovers.length > 0 && <SideCovers covers={leftCovers} width={sideW} />}
      <div className="min-w-0 flex-1">
        <table className="newbook-table h-full w-full border-collapse leading-snug" style={{ fontSize: `${tableFont}px` }}>
          <thead>
            <tr className="bg-neutral-800 text-white">
              <th className="w-[17mm] py-2 font-bold tracking-[0.3em]">분류</th>
              <th className="py-2 font-bold tracking-[0.3em]">책 제목</th>
              {hasAuthor && <th className="w-[24mm] py-2 font-bold tracking-[0.3em]">저자</th>}
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.value} className="border-t-2 border-neutral-700" style={{ backgroundColor: `${g.color}0f` }}>
              {g.books.map((r, i) => (
                <tr key={r.id} className="border-b border-dashed border-neutral-300 last:border-b-0">
                  {i === 0 && (
                    <td
                      rowSpan={g.books.length}
                      className="whitespace-nowrap border-r border-neutral-300 px-2 pt-2 text-center align-top text-[1.08em] font-extrabold"
                      style={{ color: g.color }}
                    >
                      {g.label}
                    </td>
                  )}
                  <td className="px-3 py-[1.6mm] font-semibold text-neutral-800 break-keep">{r.title}</td>
                  {hasAuthor && (
                    <td className="border-l border-neutral-300 px-1.5 text-center text-[0.85em] text-neutral-500 break-keep">
                      {r.author}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      {rightCovers.length > 0 && <SideCovers covers={rightCovers} width={sideW} />}
    </div>
  );

  // 분류 색상 범례 (표지형 1쪽)
  const legendBlock = (
    <div className="newbook-legend flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mb-6">
      {groups.map((g) => (
        <span key={g.value} className="inline-flex items-baseline gap-1.5 text-sm font-bold text-neutral-700 whitespace-nowrap">
          <span className="newbook-badge inline-block size-3 self-center rounded-full" style={{ backgroundColor: g.color }} />
          {g.label}
          <span className="text-neutral-400 font-medium text-xs">{g.hint}</span>
          <span className="text-neutral-400 font-medium text-xs">{g.books.length}권</span>
        </span>
      ))}
    </div>
  );

  // 표지 그리드 (분류 구분 없이 순서대로, 색상으로만 구분)
  // 폭 고정: 축소(zoom)하면 안쪽 폭이 넓어져 한 줄 권수가 늘어나므로, 고른 권수 그대로 줄어들게 한다
  const gridBlock = (books: typeof flatBooks, offset: number, measure: boolean) => (
    <div
      className="newbook-grid mx-auto flex flex-wrap justify-start"
      style={{ width: `${CONTENT_W}mm`, columnGap: `${GAP_X}mm`, rowGap: `${ROW_GAP_PX}px` }}
    >
      {books.map(({ book: it, color }, i) => (
        <div
          key={it.id}
          data-card={measure ? "" : undefined}
          className="newbook-card group flex flex-col items-center text-center break-inside-avoid"
          style={{ width: `${cardW}mm` }}
        >
          <div className="newbook-cover relative aspect-[3/4] w-full">
            {/* 번호 배지 (분류 색상) */}
            <span
              className="newbook-badge absolute -top-2 -left-2 z-10 flex size-7 items-center justify-center rounded-full text-white text-xs font-bold shadow-md ring-2 ring-white"
              style={{ backgroundColor: color }}
            >
              {offset + i + 1}
            </span>
            <div
              className="newbook-cover-inner newbook-badge absolute inset-0 overflow-hidden rounded-lg bg-neutral-100 flex items-center justify-center shadow-[0_6px_16px_-6px_rgba(0,0,0,0.25)]"
              style={{ border: `2px solid ${color}` }}
            >
              {it.cover_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.cover_image} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="size-8 text-neutral-300" />
              )}
            </div>
          </div>
          <p className="newbook-name mt-3 px-1 text-sm font-semibold text-neutral-800 leading-snug break-keep line-clamp-2">
            {it.title}
          </p>
          {it.author && <p className="newbook-author mt-0.5 text-xs text-neutral-400 line-clamp-1">{it.author}</p>}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* 컨트롤 (인쇄 시 숨김) */}
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold">신간도서 인쇄 미리보기</h1>
        <Button onClick={() => window.print()} disabled={loading || items.length === 0}>
          <Printer className="size-4 mr-1" />
          인쇄
        </Button>
      </div>

      {/* 레이아웃 조절 (인쇄 시 숨김) */}
      <div className="print:hidden flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
        {/* 레이아웃 */}
        <div className="flex items-center rounded-md border bg-background p-0.5">
          {(
            [
              ["list", "목록형"],
              ["grid", "표지형"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              className={`h-7 rounded px-3 font-medium ${layout === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setLayout(v)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 한쪽 표지 수 (목록형) */}
        {layout === "list" && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">표지 수</span>
            <div className="flex items-center rounded-md border bg-background">
              <button
                className="icon-btn size-8 flex items-center justify-center hover:text-primary disabled:opacity-30"
                onClick={() => setSidePer((n) => Math.max(0, n - 1))}
                disabled={sidePer <= 0}
              >
                <Minus className="size-4" />
              </button>
              <span className="w-16 text-center font-semibold tabular-nums">양쪽 {sidePer}권</span>
              <button
                className="icon-btn size-8 flex items-center justify-center hover:text-primary disabled:opacity-30"
                onClick={() => setSidePer((n) => Math.min(12, n + 1))}
                disabled={sidePer >= 12}
              >
                <Plus className="size-4" />
              </button>
            </div>
          </div>
        )}

        {/* 표 글자 크기 (목록형) */}
        {layout === "list" && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">글자 크기</span>
            <div className="flex items-center rounded-md border bg-background">
              <button
                className="icon-btn size-8 flex items-center justify-center hover:text-primary disabled:opacity-30"
                onClick={() => setTableFont((n) => Math.max(10, n - 1))}
                disabled={tableFont <= 10}
              >
                <Minus className="size-4" />
              </button>
              <span className="w-12 text-center font-semibold tabular-nums">{tableFont}px</span>
              <button
                className="icon-btn size-8 flex items-center justify-center hover:text-primary disabled:opacity-30"
                onClick={() => setTableFont((n) => Math.min(22, n + 1))}
                disabled={tableFont >= 22}
              >
                <Plus className="size-4" />
              </button>
            </div>
          </div>
        )}

        {/* 표지 크기 (목록형) */}
        {layout === "list" && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">표지 크기</span>
            <div className="flex items-center rounded-md border bg-background">
              <button
                className="icon-btn size-8 flex items-center justify-center hover:text-primary disabled:opacity-30"
                onClick={() => setManualSideW(Math.max(14, sideW - 2))}
                disabled={sideW <= 14}
              >
                <Minus className="size-4" />
              </button>
              <span className="w-14 text-center font-semibold tabular-nums">{sideW}mm</span>
              <button
                className="icon-btn size-8 flex items-center justify-center hover:text-primary disabled:opacity-30"
                onClick={() => setManualSideW(Math.min(40, sideW + 2))}
                disabled={sideW >= 40}
              >
                <Plus className="size-4" />
              </button>
            </div>
            {manualSideW !== null ? (
              <button className="text-primary underline underline-offset-2" onClick={() => setManualSideW(null)}>
                자동
              </button>
            ) : (
              <span className="text-xs text-muted-foreground">자동</span>
            )}
          </div>
        )}

        {/* 한 줄 권수 (표지형) */}
        {layout === "grid" && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">한 줄</span>
          <div className="flex items-center rounded-md border bg-background">
            <button
              className="icon-btn size-8 flex items-center justify-center hover:text-primary disabled:opacity-30"
              onClick={() => setCols((c) => Math.max(2, c - 1))}
              disabled={cols <= 2}
            >
              <Minus className="size-4" />
            </button>
            <span className="w-10 text-center font-semibold tabular-nums">{cols}권</span>
            <button
              className="icon-btn size-8 flex items-center justify-center hover:text-primary disabled:opacity-30"
              onClick={() => setCols((c) => Math.min(8, c + 1))}
              disabled={cols >= 8}
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>
        )}

        {/* 배율 */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">크기</span>
          <div className="flex items-center rounded-md border bg-background">
            <button
              className="icon-btn size-8 flex items-center justify-center hover:text-primary disabled:opacity-30"
              onClick={() => bumpZoom(-0.05)}
            >
              <Minus className="size-4" />
            </button>
            <span className="w-14 text-center font-semibold tabular-nums">{Math.round(scale * 100)}%</span>
            <button
              className="icon-btn size-8 flex items-center justify-center hover:text-primary disabled:opacity-30"
              onClick={() => bumpZoom(0.05)}
            >
              <Plus className="size-4" />
            </button>
          </div>
          {manualZoom !== null ? (
            <button className="text-primary underline underline-offset-2" onClick={() => setManualZoom(null)}>
              자동맞춤
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">자동</span>
          )}
        </div>

        {layout === "grid" && pages.length > 1 && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">A4 {pages.length}장</span>
        )}

        {/* 도서관 바로가기 QR */}
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" className="size-4 accent-primary" checked={showQr} onChange={(e) => setShowQr(e.target.checked)} />
          <span className="text-muted-foreground">바로가기 QR</span>
        </label>

        <p className="text-xs text-muted-foreground">
          {layout === "list"
            ? "표지 크기는 표지 수와 책 권수에 맞춰 자동으로 정해져요. \"자동\"은 A4 한 장에 맞게 자동 축소합니다."
            : "\"자동\"은 A4에 맞게 줄이고, 많이 작아지면 줄 단위로 다음 장에 이어 인쇄합니다. 한 장에 담으려면 한 줄 권수를 늘리세요."}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-muted-foreground py-16 print:hidden">
          이 달에 등록된 신간이 없습니다.
        </p>
      ) : (
        <>
          {/* 원래 크기 측정용 (화면 밖, 안 보임) */}
          <div
            ref={measureRef}
            aria-hidden
            className="pointer-events-none invisible fixed left-[-10000px] top-0 print:hidden"
            style={{ width: `${CONTENT_W}mm` }}
          >
            {layout === "list" ? listBlock : (
              <>
                {legendBlock}
                {gridBlock(flatBooks, 0, true)}
              </>
            )}
          </div>

          <div className="flex flex-col items-center gap-6 print:block">
            {pages.map((chunk, pi) => (
              <div
                key={pi}
                className="newbook-page mx-auto bg-white shadow-sm print:shadow-none rounded-2xl print:rounded-none"
              >
                <div className="newbook-fit">
                  {pi === 0 && headerBlock}
                  {/* 헤더 제외, 이 블록만 축소 */}
                  <div style={{ zoom: scale }}>
                    {layout === "list" ? listBlock : (
                      <>
                        {pi === 0 && legendBlock}
                        {gridBlock(chunk.books, chunk.offset, false)}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function NewArrivalsPrintPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}>
      <NewArrivalsPrint />
    </Suspense>
  );
}
