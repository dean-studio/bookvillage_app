"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Layers, Loader2, Search, ChevronDown, ChevronRight } from "lucide-react";
import { getSeriesList, type SeriesRow } from "@/app/actions/series";
import { cn } from "@/lib/utils";

const AGE_LABELS: Record<string, string> = {
  age_0_3: "유아 0~3",
  age_4_7: "유아 4~7",
  infant_set: "유아 전집",
  elem_1_2: "초등 1~2",
  elem_3_4: "초등 3~4",
  elem_5_6: "초등 5~6",
  elem_all: "초등 전학년",
  teen: "청소년",
  adult: "성인",
  english: "영어",
};

type SortKey = "popular" | "missing" | "name";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "popular", label: "인기순" },
  { key: "missing", label: "빠진 권 많은 순" },
  { key: "name", label: "이름순" },
];

// [1,2,3,5,7,8] → "1~3, 5, 7~8"
function ranges(nums: number[]): string {
  const out: string[] = [];
  for (let i = 0; i < nums.length; ) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    out.push(i === j ? `${nums[i]}` : `${nums[i]}~${nums[j]}`);
    i = j + 1;
  }
  return out.join(", ");
}

export default function SeriesPage() {
  const [list, setList] = useState<SeriesRow[] | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("popular");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    getSeriesList().then(setList);
  }, []);

  // 인기 순위는 정렬·검색과 상관없이 대출 많은 순으로 고정
  const rankOf = useMemo(() => new Map((list ?? []).map((s, i) => [s.key, i + 1])), [list]);

  const shown = useMemo(() => {
    if (!list) return [];
    const q = search.replace(/\s+/g, "").toLowerCase();
    let rows = list.filter(
      (s) =>
        (!onlyMissing || s.missing.length > 0) &&
        (!q || `${s.name}${s.publisher ?? ""}${s.shelves.join("")}`.replace(/\s+/g, "").toLowerCase().includes(q))
    );
    if (sort === "missing") rows = [...rows].sort((a, b) => b.missing.length - a.missing.length || b.loans - a.loans);
    if (sort === "name") rows = [...rows].sort((a, b) => a.name.localeCompare(b.name, "ko"));
    return rows;
  }, [list, search, sort, onlyMissing]);

  const missingCount = list?.filter((s) => s.missing.length > 0).length ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Layers className="size-6" />
        시리즈 목록
      </h1>

      <Card>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            지금 있는 책으로 시리즈별 마지막 권과 빠진 권을 보여줘요. 인기는 지금까지 대출된 횟수예요.
            시리즈 이름이 없는 책은 제목 뒤 번호로 묶어서 가끔 다른 책이 섞일 수 있어요.
          </p>
          {list && (
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary">시리즈 {list.length}개</Badge>
              <Badge variant="secondary">책 {list.reduce((n, s) => n + s.books.length, 0).toLocaleString()}권</Badge>
              <Badge variant="secondary">빠진 권 있는 시리즈 {missingCount}개</Badge>
            </div>
          )}
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="시리즈, 출판사, 책장 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 text-base"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSort(s.key)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  sort === s.key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                {s.label}
              </button>
            ))}
            <label className="ml-1 flex items-center gap-1.5 text-sm cursor-pointer">
              <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} className="size-4" />
              빠진 권 있는 것만
            </label>
          </div>
        </CardContent>
      </Card>

      {!list ? (
        <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : shown.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">{search ? "검색 결과가 없습니다." : "시리즈가 없어요."}</p>
      ) : (
        <div className="rounded-lg border divide-y bg-background">
          <div className="hidden md:grid grid-cols-[3rem_1fr_6rem_6rem_12rem_7rem] gap-3 px-3 py-2 text-sm font-medium text-muted-foreground bg-muted/40">
            <span className="text-center">인기</span>
            <span>시리즈</span>
            <span className="text-center">마지막 권</span>
            <span className="text-center">가진 책</span>
            <span>빠진 권</span>
            <span className="text-right">대출</span>
          </div>
          {shown.map((s) => {
            const open = openKey === s.key;
            const last = s.volumes[s.volumes.length - 1];
            return (
              <div key={s.key}>
                <button
                  type="button"
                  onClick={() => setOpenKey(open ? null : s.key)}
                  className="w-full text-left grid grid-cols-[2.5rem_1fr] md:grid-cols-[3rem_1fr_6rem_6rem_12rem_7rem] gap-x-3 gap-y-1 px-3 py-3 hover:bg-muted/50 items-center"
                >
                  <span className="row-span-2 md:row-span-1 text-center font-bold text-muted-foreground">{rankOf.get(s.key)}</span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 font-medium">
                      {open ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
                      <span className="truncate">{s.name}</span>
                    </span>
                    <span className="block text-sm text-muted-foreground truncate">
                      {[s.publisher, s.age_group ? AGE_LABELS[s.age_group] ?? s.age_group : null, s.shelves.slice(0, 2).join(", ")]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  {/* 모바일: 한 줄 요약 */}
                  <span className="md:hidden col-start-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                    <span>{last ? `${last}권까지` : "번호 없음"} · {s.books.length}권</span>
                    <MissingText s={s} />
                    <span className="text-muted-foreground">대출 {s.loans}회{s.rented > 0 && ` · 지금 ${s.rented}권`}</span>
                  </span>
                  <span className="hidden md:block text-center">{last ? `${last}권` : "-"}</span>
                  <span className="hidden md:block text-center">
                    {s.books.length}권
                    {s.duplicates.length > 0 && <span className="block text-xs text-muted-foreground">2부: {ranges(s.duplicates)}</span>}
                  </span>
                  <span className="hidden md:block text-sm"><MissingText s={s} /></span>
                  <span className="hidden md:block text-right text-sm">
                    <span className="font-medium">{s.loans}회</span>
                    <span className="block text-xs text-muted-foreground">
                      {s.borrowers}명{s.rented > 0 && ` · 지금 ${s.rented}권`}
                    </span>
                  </span>
                </button>
                {open && (
                  <div className="bg-muted/30 px-3 py-2 md:pl-16">
                    <p className="text-sm text-muted-foreground py-1">가진 권: {s.volumes.length > 0 ? ranges(s.volumes) : "번호 없음"}</p>
                    <ul className="divide-y">
                      {s.books.map((b) => (
                        <li key={b.id} className="flex items-center gap-3 py-2 text-sm">
                          <span className="w-10 shrink-0 text-center text-muted-foreground">{b.volume ?? "-"}</span>
                          <Link href={`/admin/books/${b.id}`} className="min-w-0 flex-1 truncate hover:underline">
                            {b.title}
                          </Link>
                          <span className="hidden sm:block shrink-0 text-muted-foreground">
                            {b.shelf}
                            {b.detail && ` ${b.detail}`}
                          </span>
                          {b.rented && <Badge variant="outline" className="shrink-0">대출 중</Badge>}
                          <span className="w-12 shrink-0 text-right text-muted-foreground">{b.loans}회</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MissingText({ s }: { s: SeriesRow }) {
  if (s.missing.length === 0) return <span className="text-muted-foreground">빠진 권 없음</span>;
  return (
    <span className={cn(s.missing.length <= 5 ? "text-amber-700 dark:text-amber-400 font-medium" : "text-muted-foreground")}>
      {s.missing.length}권 빠짐
      {s.missing.length <= 10 ? ` (${ranges(s.missing)})` : " (일부만 보유)"}
    </span>
  );
}
