"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, CalendarRange, Search, X, ChevronLeft, ChevronRight, BookMarked, Users, BookCheck } from "lucide-react";
import { getRentalsByPeriod } from "@/app/actions/rentals";

type Row = Awaited<ReturnType<typeof getRentalsByPeriod>>["rows"][number];
type Status = "all" | "active" | "returned";

const PAGE_SIZE = 20;

function todayKST(): string {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })).toISOString().slice(0, 10);
}

// n개월 전 날짜 (YYYY-MM-DD, KST)
function monthsAgoKST(months: number): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

function fmt(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "short",
    day: "numeric",
  });
}

export default function RentalsByPeriodPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [activeCount, setActiveCount] = useState(0);
  const [returnedCount, setReturnedCount] = useState(0);
  const [uniqueUsers, setUniqueUsers] = useState(0);
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [isLoading, startTransition] = useTransition();

  // 기본: 최근 3개월
  const [startDate, setStartDate] = useState(monthsAgoKST(3));
  const [endDate, setEndDate] = useState(todayKST());
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("all");

  function load(
    p = 1,
    opts?: { start?: string; end?: string; q?: string; st?: Status }
  ) {
    startTransition(async () => {
      const result = await getRentalsByPeriod({
        startDate: (opts?.start ?? startDate) || undefined,
        endDate: (opts?.end ?? endDate) || undefined,
        query: (opts?.q ?? query) || undefined,
        status: opts?.st ?? status,
        page: p,
        pageSize: PAGE_SIZE,
      });
      setRows(result.rows);
      setTotalCount(result.totalCount);
      setTotalPages(Math.max(1, result.totalPages));
      setActiveCount(result.activeCount);
      setReturnedCount(result.returnedCount);
      setUniqueUsers(result.uniqueUsers);
      setPage(result.page);
      setLoaded(true);
    });
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyStatus(st: Status) {
    setStatus(st);
    load(1, { st });
  }

  function setPreset(months: number) {
    const s = monthsAgoKST(months);
    const e = todayKST();
    setStartDate(s);
    setEndDate(e);
    load(1, { start: s, end: e });
  }

  const statusTabs: { key: Status; label: string; count?: number }[] = [
    { key: "all", label: "전체", count: activeCount + returnedCount },
    { key: "active", label: "대여중", count: activeCount },
    { key: "returned", label: "반납완료", count: returnedCount },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <CalendarRange className="size-6" />
        기간별 대여 도서
      </h1>

      {/* 필터 */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">대출일 시작</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 w-40" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">대출일 종료</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 w-40" />
            </div>
            <Button variant="outline" size="sm" onClick={() => load(1)}>조회</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" className="h-8" onClick={() => setPreset(1)}>최근 1개월</Button>
            <Button variant="ghost" size="sm" className="h-8" onClick={() => setPreset(3)}>최근 3개월</Button>
            <Button variant="ghost" size="sm" className="h-8" onClick={() => setPreset(6)}>최근 6개월</Button>
            <Button variant="ghost" size="sm" className="h-8" onClick={() => setPreset(12)}>최근 1년</Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="도서명 / 바코드 / 대여자 이름 / 동호수 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") load(1); }}
              className="pl-9 h-9"
            />
            {query && (
              <button onClick={() => { setQuery(""); load(1, { q: "" }); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-1">
                <X className="size-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 요약 통계 */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-5 flex flex-col items-center text-center gap-1">
            <BookMarked className="size-6 text-primary" />
            <p className="text-2xl md:text-3xl font-bold">{loaded ? activeCount + returnedCount : "-"}</p>
            <p className="text-xs md:text-sm text-muted-foreground">대여 권수</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 flex flex-col items-center text-center gap-1">
            <Users className="size-6 text-emerald-500" />
            <p className="text-2xl md:text-3xl font-bold">{loaded ? uniqueUsers : "-"}</p>
            <p className="text-xs md:text-sm text-muted-foreground">이용자 수</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 flex flex-col items-center text-center gap-1">
            <BookCheck className="size-6 text-blue-500" />
            <p className="text-2xl md:text-3xl font-bold">{loaded ? returnedCount : "-"}</p>
            <p className="text-xs md:text-sm text-muted-foreground">반납 권수</p>
          </CardContent>
        </Card>
      </div>

      {/* 상태 탭 */}
      <div className="flex flex-wrap gap-2">
        {statusTabs.map((t) => (
          <Button
            key={t.key}
            variant={status === t.key ? "default" : "outline"}
            size="sm"
            onClick={() => applyStatus(t.key)}
          >
            {t.label}
            {loaded && <span className="ml-1.5 opacity-80">{t.count}</span>}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            대여 내역
            {loaded && (
              <span className="text-sm font-normal text-muted-foreground">
                ({totalCount}건)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && !loaded ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              해당 기간에 대여된 도서가 없습니다.
            </p>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>도서명</TableHead>
                      <TableHead>바코드</TableHead>
                      <TableHead>대여자</TableHead>
                      <TableHead>동/호수</TableHead>
                      <TableHead>대출일</TableHead>
                      <TableHead>반납예정</TableHead>
                      <TableHead>반납일</TableHead>
                      <TableHead className="text-right">상태</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/admin/books/${r.book_id}`)}
                      >
                        <TableCell className="font-medium">{r.book_title}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{r.book_barcode}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5">
                            {r.borrower_name}
                            {r.is_guest && (
                              <Badge variant="outline" className="border-amber-400 text-amber-600 text-[0.65rem] px-1.5 py-0">게스트</Badge>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{r.borrower_dong_ho}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{fmt(r.rented_at)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{fmt(r.due_date)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{fmt(r.returned_at)}</TableCell>
                        <TableCell className="text-right">
                          {r.returned_at ? (
                            <Badge variant="outline">반납완료</Badge>
                          ) : (
                            <Badge className="bg-primary">대여중</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile */}
              <div className="md:hidden space-y-2">
                {rows.map((r) => (
                  <div
                    key={r.id}
                    className="border rounded-lg p-3 space-y-1.5 cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/admin/books/${r.book_id}`)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.book_title}</p>
                        <p className="text-xs text-muted-foreground font-mono">{r.book_barcode}</p>
                      </div>
                      {r.returned_at ? (
                        <Badge variant="outline" className="shrink-0">반납완료</Badge>
                      ) : (
                        <Badge className="bg-primary shrink-0">대여중</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p className="inline-flex items-center gap-1.5">
                        {r.borrower_name} · {r.borrower_dong_ho}
                        {r.is_guest && (
                          <Badge variant="outline" className="border-amber-400 text-amber-600 text-[0.6rem] px-1 py-0">게스트</Badge>
                        )}
                      </p>
                      <p>대출 {fmt(r.rented_at)} · 예정 {fmt(r.due_date)}{r.returned_at ? ` · 반납 ${fmt(r.returned_at)}` : ""}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || isLoading}
                    onClick={() => load(page - 1)}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || isLoading}
                    onClick={() => load(page + 1)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
