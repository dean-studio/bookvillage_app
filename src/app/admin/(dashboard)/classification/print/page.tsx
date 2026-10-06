"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { getShelfPlanBooks } from "@/app/actions/classification";
import { ageGroupLabel } from "@/lib/book-classification";
import { SHELF_PLAN } from "@/lib/shelf-plan";

type Row = Awaited<ReturnType<typeof getShelfPlanBooks>>["books"][number];

// 재배치안: 책장에 넣을 책 목록 인쇄 (체크리스트, 지금 책장별로 묶음)
function ShelfPlanPrint() {
  const router = useRouter();
  const params = useSearchParams();
  const target = params.get("plan") ?? "";
  const [incomingOnly, setIncomingOnly] = useState(params.get("incoming") === "1");
  const [books, setBooks] = useState<Row[] | null>(null);
  const shelf = SHELF_PLAN.find((s) => s.name === target);

  useEffect(() => {
    getShelfPlanBooks({ target, incomingOnly, all: true }).then((r) => setBooks(r.books));
  }, [target, incomingOnly]);

  // 지금 책장별 묶음
  const groups: [string, Row[]][] = [];
  for (const b of books ?? []) {
    const last = groups[groups.length - 1];
    if (last && last[0] === b.location_group) last[1].push(b);
    else groups.push([b.location_group, [b]]);
  }
  const incoming = (books ?? []).filter((b) => b.location_group !== target).length;
  const today = new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/classification?plan=${encodeURIComponent(target)}`)}>
          <ArrowLeft className="size-4 mr-1" />목록으로
        </Button>
        <div className="inline-flex rounded-lg border p-1 gap-1">
          <Button size="sm" variant={!incomingOnly ? "default" : "ghost"} onClick={() => { setBooks(null); setIncomingOnly(false); }}>들어갈 책 전체</Button>
          <Button size="sm" variant={incomingOnly ? "default" : "ghost"} onClick={() => { setBooks(null); setIncomingOnly(true); }}>옮겨올 책만</Button>
        </div>
        <Button className="ml-auto" onClick={() => window.print()} disabled={!books || books.length === 0}>
          <Printer className="size-4 mr-1" />인쇄 / PDF 저장
        </Button>
      </div>
      <p className="text-sm text-muted-foreground print:hidden">인쇄 창에서 대상을 &quot;PDF로 저장&quot;으로 고르면 PDF 파일로 받을 수 있어요.</p>

      {!books ? (
        <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="shelf-print text-black bg-white rounded-lg border p-6 print:border-0 print:p-0">
          <header className="flex items-end justify-between gap-4 border-b-2 border-black pb-2 mb-3">
            <div>
              <p className="text-xs">책장 재배치 · {incomingOnly ? "옮겨올 책" : "들어갈 책 전체"}</p>
              <h1 className="text-2xl font-bold leading-tight">
                {shelf?.newName ?? target} <span className="text-base font-normal">({shelf?.label} · 지금 이름 {target})</span>
              </h1>
            </div>
            <p className="text-sm text-right whitespace-nowrap">
              {books.length}권{!incomingOnly && ` · 옮겨올 책 ${incoming}권`}<br />{today}
            </p>
          </header>

          {books.length === 0 ? (
            <p className="py-8 text-center">해당하는 도서가 없습니다.</p>
          ) : (
            groups.map(([from, list]) => (
              <section key={from} className="mb-4">
                <h2 className="text-sm font-bold bg-neutral-100 px-2 py-1 border border-neutral-300">
                  {from === target ? `이미 이 책장(${from})에 있는 책` : `지금 ${from}에서 가져오기`} · {list.length}권
                </h2>
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="text-left">
                      <th className="w-6 border-b border-neutral-400 py-1">✓</th>
                      <th className="border-b border-neutral-400 py-1">제목</th>
                      <th className="w-32 border-b border-neutral-400 py-1">저자</th>
                      <th className="w-28 border-b border-neutral-400 py-1">시리즈 · 분류</th>
                      <th className="w-28 border-b border-neutral-400 py-1">바코드</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((b) => (
                      <tr key={b.id} className="break-inside-avoid">
                        <td className="border-b border-neutral-200 py-1 align-top">
                          <span className="inline-block size-3 border border-neutral-500" />
                        </td>
                        <td className="border-b border-neutral-200 py-1 pr-2 align-top">{b.title}</td>
                        <td className="border-b border-neutral-200 py-1 pr-2 align-top truncate max-w-32">{b.author}</td>
                        <td className="border-b border-neutral-200 py-1 pr-2 align-top">{b.series_name ?? ageGroupLabel(b.age_group)}</td>
                        <td className="border-b border-neutral-200 py-1 align-top font-mono">{b.barcode}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function ShelfPlanPrintPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}>
      <ShelfPlanPrint />
    </Suspense>
  );
}
