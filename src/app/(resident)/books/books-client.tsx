"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, BookOpen, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { getBooks } from "@/app/actions/books";
import { logSearch } from "@/app/actions/recommendations";
import type { Book } from "@/types";

export function BooksClient() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "available">("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (debouncedSearch.trim()) {
      logSearch(debouncedSearch.trim()).catch(() => {});
    }
  }, [debouncedSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["books", debouncedSearch, filter, page],
    queryFn: () =>
      getBooks({
        q: debouncedSearch || undefined,
        available: filter === "available" ? true : undefined,
        page,
        limit: 20,
      }),
    placeholderData: keepPreviousData,
  });

  const books = (data?.books ?? []) as Book[];
  const totalPages = data?.totalPages ?? 0;
  const totalCount = data?.totalCount ?? 0;

  function handleFilterChange(newFilter: "all" | "available") {
    setFilter(newFilter);
    setPage(1);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* 헤더 */}
      <header className="shrink-0 border-b bg-background px-[clamp(1rem,3vw,2rem)] py-[1.5vh]">
        <h1 className="text-[clamp(1.5rem,4vw,2.5rem)] font-bold mb-[1vh]">도서 검색</h1>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-[clamp(1.2rem,3vw,1.8rem)] text-muted-foreground" />
          <Input
            placeholder="도서명, 저자로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-[clamp(3rem,6vh,4.5rem)] pl-12 text-[clamp(1.1rem,2.5vw,1.6rem)]"
          />
        </div>
        <div className="flex items-center gap-[clamp(0.4rem,1vw,0.8rem)] mt-[1vh]">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            className="h-[clamp(2.5rem,5vh,3.5rem)] text-[clamp(1rem,2.2vw,1.4rem)] px-[clamp(1rem,2.5vw,1.5rem)]"
            onClick={() => handleFilterChange("all")}
          >
            전체
          </Button>
          <Button
            variant={filter === "available" ? "default" : "outline"}
            className="h-[clamp(2.5rem,5vh,3.5rem)] text-[clamp(1rem,2.2vw,1.4rem)] px-[clamp(1rem,2.5vw,1.5rem)]"
            onClick={() => handleFilterChange("available")}
          >
            대출 가능
          </Button>
          {totalCount > 0 && (
            <span className="ml-auto text-[clamp(0.9rem,2vw,1.3rem)] text-muted-foreground">
              {totalCount}권
            </span>
          )}
        </div>
      </header>

      {/* 도서 목록 */}
      <main className="flex-1 overflow-y-auto px-[clamp(1rem,3vw,2rem)] py-[1.5vh] space-y-[clamp(0.5rem,1vh,1rem)]">
        {isLoading ? (
          <div className="space-y-[clamp(0.5rem,1vh,1rem)] animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="rounded-lg border p-[clamp(0.8rem,2vw,1.2rem)]">
                <div className="flex gap-[clamp(0.8rem,2vw,1.2rem)]">
                  <div className="w-[clamp(4rem,10vw,6rem)] h-[clamp(5.5rem,14vw,8.5rem)] bg-muted rounded shrink-0" />
                  <div className="flex flex-col gap-2 flex-1 min-w-0">
                    <div className="h-5 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                    <div className="h-6 bg-muted rounded-full w-16 mt-1" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : books.length === 0 ? (
          <p className="text-[clamp(1.1rem,2.5vw,1.6rem)] text-muted-foreground text-center py-[10vh]">
            {debouncedSearch ? "검색 결과가 없습니다" : "등록된 도서가 없습니다"}
          </p>
        ) : (
          <>
            {isFetching && (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {books.map((book) => (
              <Card
                key={book.id}
                className="cursor-pointer active:scale-[0.98] transition-transform"
                onClick={() => router.push(`/books/${book.id}`)}
              >
                <CardContent className="flex gap-[clamp(0.8rem,2vw,1.2rem)] p-[clamp(0.8rem,2vw,1.2rem)]">
                  {book.cover_image ? (
                    <img
                      src={book.cover_image}
                      alt={book.title}
                      className="w-[clamp(4rem,10vw,6rem)] h-[clamp(5.5rem,14vw,8.5rem)] object-cover rounded shrink-0"
                    />
                  ) : (
                    <div className="w-[clamp(4rem,10vw,6rem)] h-[clamp(5.5rem,14vw,8.5rem)] bg-muted rounded shrink-0 flex items-center justify-center">
                      <BookOpen className="size-[clamp(1.5rem,4vw,2.5rem)] text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex flex-col gap-1 min-w-0">
                    <p className="text-[clamp(1.1rem,2.5vw,1.6rem)] font-semibold truncate">{book.title}</p>
                    <p className="text-[clamp(1rem,2.2vw,1.4rem)] text-muted-foreground">{book.author}</p>
                    <Badge
                      variant={book.is_available ? "default" : "secondary"}
                      className="w-fit text-[clamp(0.85rem,1.8vw,1.1rem)] px-[clamp(0.5rem,1.5vw,1rem)] py-0.5 mt-1"
                    >
                      {book.is_available ? "대출 가능" : "대출 중"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-[clamp(0.8rem,2vw,1.5rem)] pt-[1vh] pb-[0.5vh]">
                <Button
                  variant="outline"
                  className="h-[clamp(2.5rem,5vh,3.5rem)] text-[clamp(1rem,2.2vw,1.4rem)]"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="size-[clamp(1rem,2.5vw,1.5rem)]" />
                  이전
                </Button>
                <span className="text-[clamp(1rem,2.2vw,1.4rem)] text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  className="h-[clamp(2.5rem,5vh,3.5rem)] text-[clamp(1rem,2.2vw,1.4rem)]"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  다음
                  <ChevronRight className="size-[clamp(1rem,2.5vw,1.5rem)]" />
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
