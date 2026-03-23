"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Search, Loader2, ChevronLeft, ChevronRight, Library } from "lucide-react";
import { getBooks } from "@/app/actions/books";

type BookItem = {
  id: string;
  barcode: string;
  title: string;
  author: string;
  location_group: string;
  location_detail: string;
  is_available: boolean;
};

export default function AdminBooksPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [books, setBooks] = useState<BookItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, startTransition] = useTransition();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchBooks = useCallback(() => {
    startTransition(async () => {
      const result = await getBooks({
        q: debouncedSearch || undefined,
        page,
        limit: 50,
      });
      setBooks(result.books as BookItem[]);
      setTotalPages(result.totalPages);
      setTotalCount(result.totalCount);
    });
  }, [debouncedSearch, page]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">전체 도서 목록</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Library className="size-4" />
              도서 목록
              {totalCount > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({totalCount}권)
                </span>
              )}
            </CardTitle>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="제목 또는 저자 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && books.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : books.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {debouncedSearch ? "검색 결과가 없습니다" : "등록된 도서가 없습니다"}
            </p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>바코드</TableHead>
                      <TableHead>제목</TableHead>
                      <TableHead>저자</TableHead>
                      <TableHead>서가 위치</TableHead>
                      <TableHead className="text-right">상태</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {books.map((b) => (
                      <TableRow
                        key={b.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/admin/books/${b.id}`)}
                      >
                        <TableCell className="font-mono text-xs">{b.barcode}</TableCell>
                        <TableCell className="font-medium">{b.title}</TableCell>
                        <TableCell className="text-muted-foreground">{b.author}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {b.location_group}{b.location_detail ? ` > ${b.location_detail}` : ""}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={b.is_available ? "default" : "secondary"}>
                            {b.is_available ? "대출 가능" : "대출 중"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {books.map((b) => (
                  <div
                    key={b.id}
                    className="border rounded-lg p-3 space-y-1 cursor-pointer hover:bg-muted/50 active:scale-[0.99] transition-transform"
                    onClick={() => router.push(`/admin/books/${b.id}`)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{b.title}</p>
                      <Badge variant={b.is_available ? "default" : "secondary"} className="shrink-0 text-xs">
                        {b.is_available ? "가능" : "대출 중"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{b.author}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-mono">{b.barcode}</span>
                      <span className="text-xs text-muted-foreground">
                        {b.location_group}{b.location_detail ? ` > ${b.location_detail}` : ""}
                      </span>
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
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="size-4" />
                    이전
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    다음
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
