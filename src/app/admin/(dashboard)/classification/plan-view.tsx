"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MoveRight, CheckCircle2, Printer } from "lucide-react";
import Link from "next/link";
import { getShelfPlan, getShelfPlanBooks } from "@/app/actions/classification";
import { ageGroupLabel, subCategoryLabel } from "@/lib/book-classification";
import { SHELF_PLAN, UNPLACED, type PlanZone } from "@/lib/shelf-plan";

type Plan = NonNullable<Awaited<ReturnType<typeof getShelfPlan>>>;
type PlanBookRow = Awaited<ReturnType<typeof getShelfPlanBooks>>["books"][number];

// 기존 배치도 색과 맞춤
const ZONE_COLOR: Record<PlanZone, string> = {
  history: "#8b5cf6",
  teen: "#f59e0b",
  adult: "#06b6d4",
  elemhi: "#15803d",
  elem: "#22c55e",
  elemlo: "#65a30d",
  set: "#db2777",
  kid: "#ec4899",
  baby: "#f97316",
  eng: "#ef4444",
  spare: "#78716c",
};

const COLS = 27;
const ROWS = 18;
const CELL = 56; // 2칸 책장에 "초등단행본A" 같은 이름이 한 줄에 들어가는 크기

function labelText(name: string) {
  // "icon:coffee:독서책상1" → "독서책상1"
  return name.startsWith("icon:") ? name.split(":").slice(2).join(":") : name.replace(/^-+$/, "");
}

// 재배치안 배치도: 책장을 누르면 그 책장에 넣을 책 목록으로
export function PlanView({ onOpen }: { onOpen: (q: string) => void }) {
  const [plan, setPlan] = useState<Plan | null>(null);

  useEffect(() => {
    getShelfPlan().then(setPlan);
  }, []);

  if (!plan) {
    return <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>;
  }

  const byName = new Map(plan.shelves.map((s) => [s.name, s]));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground flex items-center gap-1.5"><MoveRight className="size-4" />다른 책장에서 옮겨올 책</p>
          <p className="text-2xl font-bold mt-1">{plan.totalIncoming.toLocaleString()}권</p>
          <p className="text-xs text-muted-foreground mt-1">책장을 누르면 그 책장에 넣을 책과 지금 위치가 나와요.</p>
        </div>
        <button onClick={() => onOpen(`plan=${encodeURIComponent(UNPLACED)}`)} className="text-left rounded-xl border border-dashed p-4 hover:bg-muted/50">
          <p className="text-sm text-muted-foreground">미분류 (자리 미정)</p>
          <p className="text-2xl font-bold mt-1">{plan.unplaced.toLocaleString()}권</p>
          <p className="text-xs text-muted-foreground mt-1">옮기면서 분류하면 자리가 정해져요.</p>
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-background p-3">
        <div
          className="grid gap-[3px] w-max"
          style={{ gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`, gridTemplateRows: `repeat(${ROWS}, ${CELL}px)` }}
        >
          {plan.layout.map((l) => {
            const area = {
              gridColumn: `${l.position_x + 1} / span ${l.width}`,
              gridRow: `${l.position_y + 1} / span ${l.height}`,
            };
            const p = byName.get(l.name);
            if (l.type !== "shelf" || !p) {
              return (
                <div
                  key={l.id}
                  style={area}
                  className="rounded-lg border border-dashed bg-muted/40 flex items-center justify-center text-xs text-muted-foreground text-center px-1"
                >
                  {labelText(l.name)}
                </div>
              );
            }
            const color = ZONE_COLOR[p.zone];
            const fill = p.capacity ? p.total / p.capacity : 0;
            const fillClass = fill > 1 ? "text-red-600" : fill > 0.9 ? "text-amber-600" : "";
            // 칸 모양별 표시: 큰 칸은 전부, 낮은 칸(1줄)·좁은 칸(1열)은 이름과 권수만 (전체 정보는 마우스를 올리면)
            const full = l.width >= 2 && l.height >= 2;
            const thin = l.width < 2;
            return (
              <button
                key={l.id}
                style={{ ...area, borderColor: color, backgroundColor: `${color}14` }}
                onClick={() => onOpen(`plan=${encodeURIComponent(p.name)}`)}
                className="min-w-0 overflow-hidden rounded-lg border-2 px-1 py-1 flex flex-col items-center justify-center gap-0.5 text-center leading-tight hover:brightness-95 hover:shadow-md transition"
                title={`${p.newName} (${p.label})\n들어갈 책 ${p.total}권 / 용량 ${p.capacity}권\n옮겨올 책 ${p.incoming}권\n지금 이름 ${p.name}`}
              >
                <span
                  className={`max-w-full font-bold ${thin ? "text-[11px] break-all" : "truncate"} ${
                    !thin && p.newName.length > 6 ? "text-[12px]" : !thin ? "text-[14px]" : ""
                  }`}
                  style={{ color }}
                >
                  {p.newName}
                </span>
                {full && <span className="max-w-full truncate text-[11px] text-muted-foreground">{p.label}</span>}
                <span className={`whitespace-nowrap tabular-nums font-semibold ${thin ? "text-[10px]" : "text-[11px]"} ${fillClass}`}>
                  {thin ? p.total : `${p.total}/${p.capacity}권`}
                  {fill > 1 && " ⚠"}
                  {!full && !thin && p.incoming > 0 && <span className="text-amber-600 font-normal"> · +{p.incoming}</span>}
                </span>
                {full && p.incoming > 0 && <span className="whitespace-nowrap text-[10px] text-amber-600">옮겨옴 +{p.incoming}</span>}
                {full && <span className="max-w-full truncate whitespace-nowrap text-[10px] text-muted-foreground/80">지금 {p.name}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        책장 칸: 새 이름 · 들어갈 분류 · 들어갈 권수/용량(<span className="text-amber-600">90% 넘음</span>, <span className="text-red-600">넘침 ⚠</span>) · 옮겨올 권수 · 지금 이름.
        용량은 2026-10-06 현장 사진(칸 폭·단 수) 기준 추정이에요. 새 이름은 초안이고, 실제 이름 변경은 책을 다 옮긴 뒤에 해요.
      </p>
    </div>
  );
}

// 새 책장에 넣을 책 목록 (지금 위치별로 묶어서)
export function PlanBookList({ target }: { target: string }) {
  const shelf = SHELF_PLAN.find((s) => s.name === target);
  const [books, setBooks] = useState<PlanBookRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [incomingOnly, setIncomingOnly] = useState(false);
  const [isLoading, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      const res = await getShelfPlanBooks({ target, incomingOnly, page });
      setBooks(res.books);
      setTotal(res.total);
      setPageSize(res.pageSize);
    });
  }, [target, incomingOnly, page]);

  useEffect(() => {
    load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const isUnplaced = target === UNPLACED;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-baseline gap-2 text-base">
          {isUnplaced ? (
            "미분류 (자리 미정)"
          ) : (
            <>
              <span className="text-xl">{shelf?.newName ?? target}</span>
              <span className="text-sm font-normal text-muted-foreground">{shelf?.label} · 지금 이름 {target}</span>
            </>
          )}
          <Badge variant="secondary">{total.toLocaleString()}권</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isUnplaced && (
          <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border p-1 gap-1">
            <Button size="sm" variant={!incomingOnly ? "default" : "ghost"} onClick={() => { setPage(1); setIncomingOnly(false); }}>
              들어갈 책 전체
            </Button>
            <Button size="sm" variant={incomingOnly ? "default" : "ghost"} onClick={() => { setPage(1); setIncomingOnly(true); }}>
              다른 책장에서 옮겨올 책만
            </Button>
          </div>
          <Link
            href={`/admin/classification/print?plan=${encodeURIComponent(target)}${incomingOnly ? "&incoming=1" : ""}`}
            className="ml-auto inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            <Printer className="size-4 mr-1" />인쇄 / PDF
          </Link>
          </div>
        )}

        {isLoading && books.length === 0 ? (
          <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>
        ) : books.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">해당하는 도서가 없습니다.</p>
        ) : (
          <div className={`rounded-lg border divide-y ${isLoading ? "opacity-60" : ""}`}>
            {books.map((b, i) => {
              const here = b.location_group === target;
              const newHeader = i === 0 || books[i - 1].location_group !== b.location_group;
              return (
                <div key={b.id}>
                  {newHeader && (
                    <div className="bg-muted/50 px-3 py-1.5 text-sm font-semibold flex items-center gap-2">
                      {here ? <CheckCircle2 className="size-4 text-green-600" /> : <MoveRight className="size-4 text-amber-600" />}
                      지금 {b.location_group}{here ? " (이미 이 책장)" : "에서 가져오기"}
                    </div>
                  )}
                  <div className="flex items-center gap-3 p-3">
                    {b.cover_image ? (
                      <img src={b.cover_image} alt="" className="w-9 h-12 object-cover rounded shrink-0 bg-muted" />
                    ) : (
                      <div className="w-9 h-12 rounded shrink-0 bg-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <a href={`/admin/books/${b.id}`} className="font-medium hover:underline line-clamp-1">{b.title}</a>
                      <p className="text-sm text-muted-foreground truncate">
                        {b.author} · <span className="font-mono">{b.barcode}</span>
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <Badge variant="outline" className="text-xs">{ageGroupLabel(b.age_group)}</Badge>
                        {subCategoryLabel(b.sub_category) && <Badge variant="outline" className="text-xs">{subCategoryLabel(b.sub_category)}</Badge>}
                        {b.series_name && <Badge variant="secondary" className="text-xs">{b.series_name}</Badge>}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded px-2 py-1 text-xs font-semibold ${
                        here
                          ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      }`}
                    >
                      현재 {b.location_group}{b.location_detail ? ` ${b.location_detail}` : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" size="sm" disabled={page <= 1 || isLoading} onClick={() => setPage((p) => p - 1)}>이전</Button>
            <span className="text-sm text-muted-foreground">{page} / {pages}</span>
            <Button variant="outline" size="sm" disabled={page >= pages || isLoading} onClick={() => setPage((p) => p + 1)}>다음</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
