"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, MapPin, BookOpen, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { getBooks, getBookById } from "@/app/actions/books";
import type { Book } from "@/types";

type BookDetail = Book & { avg_rating: number | null; review_count: number };

export default function BooksPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "available">("all");
  const [books, setBooks] = useState<Book[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, startTransition] = useTransition();
  const [selectedBook, setSelectedBook] = useState<BookDetail | null>(null);
  const [isDetailLoading, startDetailTransition] = useTransition();

  // Debounce search
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
        available: filter === "available" ? true : undefined,
        page,
        limit: 20,
      });
      setBooks(result.books as Book[]);
      setTotalPages(result.totalPages);
      setTotalCount(result.totalCount);
    });
  }, [debouncedSearch, filter, page]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  function handleFilterChange(newFilter: "all" | "available") {
    setFilter(newFilter);
    setPage(1);
  }

  function handleBookClick(bookId: string) {
    startDetailTransition(async () => {
      const detail = await getBookById(bookId);
      if (detail) {
        setSelectedBook(detail as BookDetail);
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 border-b bg-background px-6 py-4">
        <h1 className="text-2xl font-bold mb-4">도서 검색</h1>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-6 text-muted-foreground" />
          <Input
            placeholder="도서명, 저자로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-14 pl-12 text-xl"
          />
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            className="h-12 text-lg px-5"
            onClick={() => handleFilterChange("all")}
          >
            전체
          </Button>
          <Button
            variant={filter === "available" ? "default" : "outline"}
            className="h-12 text-lg px-5"
            onClick={() => handleFilterChange("available")}
          >
            대출 가능
          </Button>
          {totalCount > 0 && (
            <span className="ml-auto text-base text-muted-foreground">
              {totalCount}권
            </span>
          )}
        </div>
      </header>

      {/* 도서 목록 */}
      <main className="flex-1 px-6 py-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : books.length === 0 ? (
          <p className="text-xl text-muted-foreground text-center py-20">
            {debouncedSearch ? "검색 결과가 없습니다" : "등록된 도서가 없습니다"}
          </p>
        ) : (
          <>
            {books.map((book) => (
              <Card
                key={book.id}
                className="cursor-pointer active:scale-[0.98] transition-transform"
                onClick={() => handleBookClick(book.id)}
              >
                <CardContent className="flex gap-4 p-4">
                  {book.cover_image ? (
                    <img
                      src={book.cover_image}
                      alt={book.title}
                      className="w-20 h-28 object-cover rounded shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-28 bg-muted rounded shrink-0 flex items-center justify-center">
                      <BookOpen className="size-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex flex-col gap-1 min-w-0">
                    <p className="text-xl font-semibold truncate">{book.title}</p>
                    <p className="text-lg text-muted-foreground">{book.author}</p>
                    <Badge
                      variant={book.is_available ? "default" : "secondary"}
                      className="w-fit text-base px-3 py-1 mt-1"
                    >
                      {book.is_available ? "대출 가능" : "대출 중"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 pt-4 pb-2">
                <Button
                  variant="outline"
                  className="h-12 text-lg"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="size-5" />
                  이전
                </Button>
                <span className="text-lg text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  className="h-12 text-lg"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  다음
                  <ChevronRight className="size-5" />
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      {/* 상세 로딩 오버레이 */}
      {isDetailLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50">
          <Loader2 className="size-10 animate-spin text-primary" />
        </div>
      )}

      {/* 도서 상세 모달 */}
      <Dialog
        open={!!selectedBook}
        onOpenChange={(open) => !open && setSelectedBook(null)}
      >
        {selectedBook && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl">
                {selectedBook.title}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {selectedBook.cover_image ? (
                <img
                  src={selectedBook.cover_image}
                  alt={selectedBook.title}
                  className="w-full h-48 object-contain rounded bg-muted"
                />
              ) : (
                <div className="w-full h-48 bg-muted rounded flex items-center justify-center">
                  <BookOpen className="size-16 text-muted-foreground" />
                </div>
              )}
              <div className="space-y-2">
                <p className="text-xl">
                  <span className="text-muted-foreground">저자:</span>{" "}
                  {selectedBook.author}
                </p>
                {selectedBook.publisher && (
                  <p className="text-lg text-muted-foreground">
                    출판사: {selectedBook.publisher}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-xl text-muted-foreground">상태:</span>
                  <Badge
                    variant={selectedBook.is_available ? "default" : "secondary"}
                    className="text-base px-3 py-1"
                  >
                    {selectedBook.is_available ? "대출 가능" : "대출 중"}
                  </Badge>
                </div>
                {selectedBook.avg_rating !== null && (
                  <p className="text-lg">
                    평점: {"★".repeat(Math.round(selectedBook.avg_rating))}{" "}
                    <span className="text-muted-foreground">
                      {selectedBook.avg_rating.toFixed(1)} ({selectedBook.review_count}개 리뷰)
                    </span>
                  </p>
                )}
              </div>

              {selectedBook.description && (
                <p className="text-base text-muted-foreground">
                  {selectedBook.description}
                </p>
              )}

              {/* 서가 위치 안내 */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="size-5 text-primary" />
                  <span className="text-lg font-semibold">서가 위치</span>
                </div>
                <p className="text-xl">{selectedBook.location_group}</p>
                <p className="text-3xl font-bold text-primary mt-1">
                  {selectedBook.location_detail}
                </p>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
