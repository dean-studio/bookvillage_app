"use client";

import { useEffect, useLayoutEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Printer, Loader2, ImageIcon, Plus, Minus } from "lucide-react";
import { getNewArrivals } from "@/app/actions/new-arrivals";
import { NEW_ARRIVAL_CATEGORIES, type NewArrival } from "@/lib/new-arrivals";
import { getPublicSettings } from "@/app/actions/settings";

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

function NewArrivalsPrint() {
  const params = useSearchParams();
  const month = params.get("month") || currentYearMonth();
  const [items, setItems] = useState<NewArrival[]>([]);
  const [libName, setLibName] = useState("자람도서관");
  const [loading, setLoading] = useState(true);

  // 레이아웃 조절: 열 수 + 배율(자동/수동)
  const [cols, setCols] = useState(5);
  const [manualZoom, setManualZoom] = useState<number | null>(null); // null = 자동 맞춤

  // A4 한 장 자동 맞춤: 헤더(타이틀)는 고정, 그 아래 섹션만 축소
  const contentRef = useRef<HTMLDivElement>(null); // 카드 전체 높이 측정(.newbook-fit)
  const sectionsRef = useRef<HTMLDivElement>(null); // zoom 적용 + 섹션 높이 측정
  const [scale, setScale] = useState(1);

  useEffect(() => {
    Promise.all([getNewArrivals(month), getPublicSettings()]).then(([data, settings]) => {
      setItems(data);
      if (settings.apartment_name) {
        // "중앙힐스테이트 자람도서관" → "자람도서관" (마지막 어절, 도서관 이름만)
        const parts = settings.apartment_name.trim().split(/\s+/);
        setLibName(parts[parts.length - 1]);
      }
      setLoading(false);
    });
  }, [month]);

  // 배율 적용: 수동값이 있으면 그대로, 없으면 A4 한 장에 맞게 자동 축소
  useLayoutEffect(() => {
    if (loading || items.length === 0) return;

    // 96dpi 기준 A4 인쇄 가능 높이(297 - 위아래 여백 10mm) = 277mm
    const AVAIL_PX = (277 * 96) / 25.4;

    function apply(s: number) {
      const sections = sectionsRef.current;
      if (!sections) return;
      // zoom은 레이아웃 높이까지 실제로 축소 → 인쇄 페이지네이션이 정확.
      // 헤더(타이틀)는 고정, 섹션(그룹 타이틀+책 그리드)만 스케일한다.
      sections.style.zoom = String(s);
      setScale(s);
    }

    function fit() {
      const content = contentRef.current;
      const sections = sectionsRef.current;
      if (!content || !sections) return;
      if (manualZoom !== null) {
        apply(manualZoom);
        return;
      }
      // 원본 높이 측정: zoom을 잠깐 1로 되돌리고 잰다
      sections.style.zoom = "1";
      const naturalH = content.getBoundingClientRect().height; // 헤더+섹션+패딩 전체
      const sectionsH = sections.getBoundingClientRect().height; // 섹션만
      const fixedH = naturalH - sectionsH; // 헤더 + 상하 패딩 (스케일 안 함)
      // 섹션이 쓸 수 있는 높이 = 전체 여유 - 고정부. 넘칠 때만 축소.
      const avail = AVAIL_PX - fixedH;
      const s = sectionsH > avail ? Math.max(0.35, avail / sectionsH) : 1;
      apply(s);
    }

    fit();

    // 표지 이미지 로딩 완료 시 재측정 (캐시된 것 포함해 전부 감시)
    const imgs = Array.from(contentRef.current?.querySelectorAll("img") ?? []);
    let remaining = imgs.filter((im) => !im.complete).length;
    const onOne = () => {
      remaining -= 1;
      if (remaining <= 0) fit();
    };
    imgs.forEach((im) => {
      if (!im.complete) {
        im.addEventListener("load", onOne, { once: true });
        im.addEventListener("error", onOne, { once: true });
      }
    });

    window.addEventListener("resize", fit);
    window.addEventListener("beforeprint", fit);
    return () => {
      imgs.forEach((im) => {
        im.removeEventListener("load", onOne);
        im.removeEventListener("error", onOne);
      });
      window.removeEventListener("resize", fit);
      window.removeEventListener("beforeprint", fit);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, items, cols, manualZoom]);

  // 배율 수동 조절 (현재 배율 기준 ±5%)
  function bumpZoom(delta: number) {
    const base = manualZoom ?? scale;
    const next = Math.min(1.5, Math.max(0.35, Math.round((base + delta) * 100) / 100));
    setManualZoom(next);
  }

  const [y, m] = month.split("-");
  const monthNum = parseInt(m, 10);
  const cardW = cardWidthMm(cols);

  // 분류별 그룹 (책이 있는 분류만, NEW_ARRIVAL_CATEGORIES 순서대로)
  const groups = NEW_ARRIVAL_CATEGORIES
    .map((c) => ({ ...c, books: items.filter((it) => it.category === c.value) }))
    .filter((g) => g.books.length > 0);

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
        {/* 한 줄 권수 */}
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

        <p className="text-xs text-muted-foreground">
          한 줄 권수와 크기를 조절할 수 있어요. &quot;자동&quot;은 A4 한 장에 맞게 자동 축소합니다.
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
        <div className="flex justify-center print:block">
        <div className="newbook-page mx-auto bg-white shadow-sm print:shadow-none rounded-2xl print:rounded-none">
          <div ref={contentRef} className="newbook-fit">
          {/* 헤더 */}
          <header className="newbook-header relative mb-8">
            <div className="flex flex-col items-center text-center gap-2">
              <span className="newbook-eyebrow inline-flex items-center gap-2 text-primary font-bold tracking-[0.35em] text-xs uppercase">
                <span className="newbook-eyebrow-line" />
                New Arrivals
                <span className="newbook-eyebrow-line" />
              </span>
              <h2 className="newbook-title text-4xl font-extrabold text-neutral-900 leading-tight">
                <span className="text-primary">{monthNum}월</span> {libName} 신간도서
              </h2>
              <p className="newbook-subtitle text-sm text-neutral-400 tracking-wide">
                {y}. {String(monthNum).padStart(2, "0")} · 이달의 새로운 책 {items.length}권을 소개합니다
              </p>
            </div>
            <div className="newbook-rule mt-5 h-px w-full bg-gradient-to-r from-transparent via-neutral-200 to-transparent" />
          </header>

          {/* 분류별 섹션 (헤더 제외, 이 블록만 스케일) */}
          <div ref={sectionsRef} className="space-y-8">
            {groups.map((g) => (
              <section key={g.value} className="newbook-section break-inside-avoid">
                {/* 분류 헤더 (왼쪽 정렬) */}
                <div className="newbook-cat-head flex items-center gap-3 mb-4">
                  <span className="newbook-cat-label inline-flex items-baseline gap-1.5 text-primary font-extrabold text-lg whitespace-nowrap">
                    {g.label}
                    <span className="text-neutral-400 font-medium text-xs">{g.hint}</span>
                    <span className="text-neutral-400 font-medium text-sm">{g.books.length}권</span>
                  </span>
                  <span className="flex-1 h-px bg-gradient-to-r from-neutral-200 to-transparent" />
                </div>

                {/* 표지 그리드 (왼쪽 정렬, 카드 폭 고정) */}
                <div
                  className="newbook-grid flex flex-wrap justify-start"
                  style={{ columnGap: `${GAP_X}mm`, rowGap: "8mm" }}
                >
                  {g.books.map((it, idx) => (
                    <div
                      key={it.id}
                      className="newbook-card group flex flex-col items-center text-center"
                      style={{ width: `${cardW}mm` }}
                    >
                      <div className="newbook-cover relative aspect-[3/4] w-full">
                        {/* 번호 배지 */}
                        <span className="newbook-badge absolute -top-2 -left-2 z-10 flex size-7 items-center justify-center rounded-full bg-primary text-white text-xs font-bold shadow-md ring-2 ring-white">
                          {idx + 1}
                        </span>
                        <div className="newbook-cover-inner absolute inset-0 overflow-hidden rounded-lg bg-neutral-100 flex items-center justify-center shadow-[0_6px_16px_-6px_rgba(0,0,0,0.25)]">
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
                      {it.author && (
                        <p className="newbook-author mt-0.5 text-xs text-neutral-400 line-clamp-1">
                          {it.author}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
          </div>
        </div>
        </div>
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
