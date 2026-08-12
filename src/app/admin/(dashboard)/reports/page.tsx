"use client";

import { useState, useEffect, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileText, Loader2, Search, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { getAllBookReports } from "@/app/actions/book-reports";

type ReportRow = Awaited<ReturnType<typeof getAllBookReports>>["rows"][number];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminReportsPage() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [isLoading, startTransition] = useTransition();

  function fetchData(opts?: { page?: number; q?: string }) {
    const p = opts?.page ?? page;
    const q = opts?.q ?? query;
    startTransition(async () => {
      const data = await getAllBookReports({ query: q || undefined, page: p, pageSize: 20 });
      setRows(data.rows);
      setTotalCount(data.totalCount);
      setTotalPages(data.totalPages);
      setPage(data.page);
    });
  }

  useEffect(() => {
    fetchData({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch() {
    fetchData({ page: 1, q: query });
  }

  function goPage(p: number) {
    if (p < 1 || p > totalPages) return;
    fetchData({ page: p });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            독서록
            <Badge variant="secondary" className="ml-1">{totalCount}건</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 검색 */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="도서명, 저자, 작성자 이름, 동호수 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} disabled={isLoading} className="px-6">
              {isLoading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Search className="size-4 mr-2" />}
              검색
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {query ? "검색 결과가 없습니다." : "작성된 독서록이 없습니다."}
            </p>
          ) : (
            <>
              <div className="space-y-3">
                {rows.map((r) => (
                  <div key={r.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{r.book_title}</p>
                        {r.book_author && (
                          <p className="text-sm text-muted-foreground truncate">{r.book_author}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`size-4 ${i < r.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{r.review}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
                      <span>{r.user_name} · {r.user_dong_ho}</span>
                      <span>{formatDate(r.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goPage(page - 1)}
                    disabled={page <= 1 || isLoading}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goPage(page + 1)}
                    disabled={page >= totalPages || isLoading}
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
