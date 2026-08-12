"use client";

import { useState, useEffect, useRef } from "react";
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
  const [sort, setSort] = useState<"recent" | "title_asc" | "title_desc">("title_asc");
  const [page, setPage] = useState(1);
  const restoredRef = useRef(false);

  // 마운트 후 URL ?q= 에서 검색어 복원 (SSR/CSR 초기값 불일치 방지)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q") ?? "";
    if (q) {
      setSearch(q);
      setDebouncedSearch(q);
    }
    restoredRef.current = true;
  }, []);

  useEffect(() => {
    // 검색어를 URL에 반영 (뒤로가기 시 복원) — 복원 완료 후에만
    if (restoredRef.current) {
      const params = new URLSearchParams(window.location.search);
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
      else params.delete("q");
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const hasQuery = debouncedSearch.trim().length > 0;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["books", debouncedSearch, sort, page],
    queryFn: () =>
      getBooks({
        q: debouncedSearch || undefined,
        sort,
        page,
        limit: 20,
      }),
    placeholderData: keepPreviousData,
    enabled: hasQuery,
  });

  const books = (data?.books ?? []) as Book[];
  const totalPages = data?.totalPages ?? 0;
  const totalCount = data?.totalCount ?? 0;

  // 검색 로그는 결과가 도착한 뒤에 기록 (getBooks 서버액션 큐를 막지 않도록)
  const loggedRef = useRef<string>("");
  useEffect(() => {
    const q = debouncedSearch.trim();
    if (data && q && q.length >= 2 && loggedRef.current !== q) {
      loggedRef.current = q;
      logSearch(q).catch(() => {});
    }
  }, [data, debouncedSearch]);

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
        {/* 검색 권수(왼쪽) + 정렬 필터(오른쪽) */}
        <div className="flex items-center justify-between mt-[1vh]">
          <span className="text-[clamp(0.9rem,2vw,1.3rem)] text-muted-foreground">
            {totalCount > 0 ? `총 ${totalCount}권` : " "}
          </span>
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value as typeof sort); setPage(1); }}
            className="h-[clamp(2.5rem,5vh,3.5rem)] rounded-md border bg-background px-3 text-[clamp(0.95rem,2.1vw,1.3rem)]"
          >
            <option value="title_asc">가나다순</option>
            <option value="title_desc">가나다 역순</option>
            <option value="recent">최신순</option>
          </select>
        </div>
      </header>

      {/* 도서 목록 */}
      <main className="flex-1 overflow-y-auto px-[clamp(1rem,3vw,2rem)] py-[1.5vh] space-y-[clamp(0.5rem,1vh,1rem)]">
        {!hasQuery ? (
          <div className="flex flex-col items-center justify-center py-[12vh] gap-4 text-muted-foreground px-6">
            <Search className="size-[clamp(3rem,8vw,4.5rem)] opacity-30" />
            <p className="text-[clamp(1.2rem,3vw,1.8rem)] font-semibold text-foreground text-center">
              도서명을 검색해 주세요
            </p>
            <p className="text-[clamp(0.95rem,2.2vw,1.3rem)] text-center leading-relaxed">
              찾으시는 책의 제목이나 저자를 입력하세요.<br />
              예) <span className="text-primary font-medium">전천당</span>, <span className="text-primary font-medium">설민석 한국사</span>, <span className="text-primary font-medium">강아지똥</span>
            </p>
            {/* 예시 칩: 누르면 바로 검색 */}
            <div className="flex flex-wrap justify-center gap-2 mt-1">
              {["전천당", "설민석", "그리스로마신화", "why"].map((ex) => (
                <button
                  key={ex}
                  onClick={() => setSearch(ex)}
                  className="rounded-full border px-4 py-2 text-[clamp(0.9rem,2vw,1.2rem)] active:bg-muted transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : isLoading ? (
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
