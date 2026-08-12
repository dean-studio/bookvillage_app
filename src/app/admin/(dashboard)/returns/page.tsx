"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BookDown,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import { getReturnedRentals } from "@/app/actions/rentals";

type ReturnedItem = {
  id: string;
  book_title: string;
  book_barcode: string;
  borrower_name: string;
  borrower_dong_ho: string;
  returned_at: string | null;
  due_date: string;
  was_overdue: boolean;
  overdue_days: number;
  returned_by_name: string | null;
};

const PAGE_SIZE = 20;

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul", month: "short", day: "numeric", hour: "numeric", minute: "numeric",
  });
}
function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "short", day: "numeric" });
}

export default function AdminReturnsPage() {
  const [items, setItems] = useState<ReturnedItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [isLoading, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [query, setQuery] = useState("");

  function load(p = 1, opts?: { start?: string; end?: string; q?: string }) {
    startTransition(async () => {
      const result = await getReturnedRentals({
        startDate: (opts?.start ?? startDate) || undefined,
        endDate: (opts?.end ?? endDate) || undefined,
        query: (opts?.q ?? query) || undefined,
        page: p,
        pageSize: PAGE_SIZE,
      });
      setItems(result.rows as ReturnedItem[]);
      setTotalCount(result.totalCount);
      setTotalPages(Math.max(1, result.totalPages));
      setPage(result.page);
      setLoaded(true);
    });
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetFilter() {
    setStartDate(""); setEndDate(""); setQuery("");
    load(1, { start: "", end: "", q: "" });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <BookDown className="size-6" />
          반납 내역
        </h1>
        {loaded && (
          <Badge variant="secondary" className="text-base px-3 py-1">{totalCount}건</Badge>
        )}
      </div>

      {/* 필터 */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">반납일 시작</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 w-40" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">반납일 종료</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 w-40" />
            </div>
            <Button variant="outline" size="sm" onClick={() => load(1)}>조회</Button>
            <Button variant="ghost" size="sm" onClick={resetFilter}>전체 보기</Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="대여자 이름 / 동호수 / 도서명 / 바코드 검색"
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

      {isLoading && !loaded ? (
        <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">반납 내역이 없습니다.</CardContent></Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">도서명</th>
                    <th className="text-left p-3 font-medium w-28">바코드</th>
                    <th className="text-left p-3 font-medium w-32">대출자</th>
                    <th className="text-left p-3 font-medium w-36">반납 일시</th>
                    <th className="text-left p-3 font-medium w-24">반납기한</th>
                    <th className="text-left p-3 font-medium w-20">상태</th>
                    <th className="text-left p-3 font-medium w-24">처리자</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-medium truncate max-w-[250px]">{item.book_title}</td>
                      <td className="p-3 text-muted-foreground font-mono text-xs">{item.book_barcode}</td>
                      <td className="p-3">
                        <div>{item.borrower_name}</div>
                        <div className="text-xs text-muted-foreground">{item.borrower_dong_ho}</div>
                      </td>
                      <td className="p-3 text-muted-foreground">{formatDate(item.returned_at)}</td>
                      <td className="p-3 text-muted-foreground">{formatShortDate(item.due_date)}</td>
                      <td className="p-3">
                        {item.was_overdue ? (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="size-3 mr-1" />
                            {item.overdue_days}일 연체
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">정상</Badge>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">{item.returned_by_name ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {items.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{item.book_title}</p>
                      <p className="text-sm text-muted-foreground">{item.borrower_name} ({item.borrower_dong_ho})</p>
                    </div>
                    {item.was_overdue ? (
                      <Badge variant="destructive" className="shrink-0 text-xs">
                        <AlertTriangle className="size-3 mr-1" />
                        {item.overdue_days}일 연체
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="shrink-0 text-xs">정상</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>반납: {formatDate(item.returned_at)}</span>
                    {item.returned_by_name && <span>처리: {item.returned_by_name}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || isLoading} onClick={() => load(page - 1)}>
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages || isLoading} onClick={() => load(page + 1)}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
