"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookDown,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { getReturnedRentals } from "@/app/actions/rentals";

type ReturnedItem = {
  id: string;
  book_title: string;
  book_barcode: string;
  borrower_name: string;
  borrower_dong_ho: string;
  returned_at: string;
  due_date: string;
  was_overdue: boolean;
  overdue_days: number;
  returned_by_name: string | null;
};

const PAGE_SIZE = 20;

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
  });
}

export default function AdminReturnsPage() {
  const [items, setItems] = useState<ReturnedItem[]>([]);
  const [isLoading, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(1);

  function load() {
    startTransition(async () => {
      const data = await getReturnedRentals(200);
      setItems(data as ReturnedItem[]);
      setLoaded(true);
    });
  }

  if (!loaded) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <BookDown className="size-6" />
          반납 내역
        </h1>
        <Card>
          <CardContent className="p-8 flex flex-col items-center gap-3">
            <Button size="lg" className="h-14 px-8 text-lg" onClick={load} disabled={isLoading}>
              {isLoading ? <Loader2 className="size-5 mr-2 animate-spin" /> : <BookDown className="size-5 mr-2" />}
              반납 내역 불러오기
            </Button>
            <p className="text-sm text-muted-foreground">최근 200건의 반납 내역을 조회합니다</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const paginated = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <BookDown className="size-6" />
          반납 내역
        </h1>
        <Badge variant="secondary" className="text-base px-3 py-1">
          {items.length}건
        </Badge>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            반납 내역이 없습니다.
          </CardContent>
        </Card>
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
                  {paginated.map((item) => (
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
            {paginated.map((item) => (
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
                    {item.returned_by_name && (
                      <span>처리: {item.returned_by_name}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
