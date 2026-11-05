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
import { ArBadge } from "@/components/ar-fields";
import { AR_INTERESTS, AR_LEVEL_RANGES } from "@/lib/ar";
import { getPublicSettings } from "@/app/actions/settings";
import { getMyArReading } from "@/app/actions/academy";
import { isAcademy, isFlagOn } from "@/lib/site-mode";

type SortValue = "recent" | "title_asc" | "title_desc" | "ar_asc" | "ar_desc";

export function BooksClient() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<SortValue>("title_asc");
  const [page, setPage] = useState(1);

  // AR 레벨 필터: 설정 ar_enabled === 'on' 일 때만 보이고 서버로 보낸다. 꺼져 있으면 기존 검색과 같음
  // (설정은 마이페이지·대출 화면과 같은 react-query 캐시 ["publicSettings"] 를 함께 쓴다 → 서버 호출 1번 그대로)
  const { data: publicSettings } = useQuery({
    queryKey: ["publicSettings"],
    queryFn: getPublicSettings,
    staleTime: 1000 * 60 * 10,
  });
  const arEnabled = isFlagOn(publicSettings, "ar_enabled");
  // 학원 모드 + AR 사용일 때만: 내 레벨(ZPD) 읽기 → "내 레벨 책" 칩. 아니면 서버 호출 없음
  const academyAr = arEnabled && isAcademy(publicSettings?.site_type);
  const { data: arReading } = useQuery({
    queryKey: ["myArReading"],
    queryFn: getMyArReading,
    enabled: academyAr,
    staleTime: 1000 * 60,
  });
  const myZpd = academyAr && arReading && (arReading.zpd_low !== null || arReading.zpd_high !== null) ? arReading : null;
  const [myLevel, setMyLevel] = useState(false);
  const myLevelOn = myLevel && !!myZpd;
  const [arRange, setArRange] = useState("");
  const [arInterest, setArInterest] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  // "내 레벨 책"을 켜기 전의 "대출 가능만" 상태. 끌 때 되돌린다 (켜 둔 동안 직접 바꾸면 그 값을 그대로 둔다)
  const availableBeforeMyLevel = useRef<boolean | null>(null);
  const restoredRef = useRef(false);

  // "내 레벨 책" 켜기/끄기: 켜면 "대출 가능만"도 켜진 상태로 보이게, 끄면 원래대로
  function setMyLevelChip(on: boolean) {
    if (on && !myLevelOn) {
      availableBeforeMyLevel.current = availableOnly;
      setAvailableOnly(true);
    } else if (!on && myLevelOn && availableBeforeMyLevel.current !== null) {
      setAvailableOnly(availableBeforeMyLevel.current);
    }
    if (!on) availableBeforeMyLevel.current = null;
    setMyLevel(on);
  }

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
  const range = arEnabled && !myLevelOn ? AR_LEVEL_RANGES.find((r) => r.key === arRange) : undefined;
  const hasArFilter = arEnabled && (!!range || !!arInterest || availableOnly || myLevelOn);
  // AR 모드에서 영어로만 된 검색어는 단어 단위로 찾는다 (예: "magic tree"). 한글은 기존 느슨한 매칭 그대로
  const englishQuery = /^[\x20-\x7E]+$/.test(debouncedSearch.trim());

  const { data, isLoading, isFetching } = useQuery({
    queryKey: arEnabled
      ? ["books", debouncedSearch, sort, page, "ar", arRange, arInterest, availableOnly, ...(myLevelOn ? ["my", myZpd?.zpd_low, myZpd?.zpd_high] : [])]
      : ["books", debouncedSearch, sort, page],
    queryFn: () =>
      arEnabled
        ? getBooks({
            q: debouncedSearch || undefined,
            sort,
            page,
            limit: 20,
            // "내 레벨 책": 내 ZPD 범위 (+ 켤 때 "대출 가능만"도 같이 켜짐)
            arMin: myLevelOn ? (myZpd?.zpd_low ?? undefined) : range?.min,
            arMax: myLevelOn ? (myZpd?.zpd_high ?? undefined) : range?.max,
            arInterest: arInterest || undefined,
            available: availableOnly ? true : undefined,
            wordSearch: englishQuery ? true : undefined,
          })
        : getBooks({
            q: debouncedSearch || undefined,
            sort: sort === "ar_asc" || sort === "ar_desc" ? "title_asc" : sort,
            page,
            limit: 20,
          }),
    placeholderData: keepPreviousData,
    enabled: hasQuery || hasArFilter,
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
            {arEnabled && <option value="ar_asc">레벨 낮은순</option>}
            {arEnabled && <option value="ar_desc">레벨 높은순</option>}
          </select>
        </div>
        {/* AR 레벨 필터 (ar_enabled 일 때만) */}
        {arEnabled && (
          <div className="mt-[1vh] space-y-2">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <span className="shrink-0 self-center text-[clamp(0.85rem,1.9vw,1.15rem)] font-semibold text-muted-foreground">레벨</span>
              {myZpd && (
                <button
                  onClick={() => { setMyLevelChip(!myLevelOn); setArRange(""); setPage(1); }}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-[clamp(0.85rem,1.9vw,1.15rem)] font-semibold transition-colors ${
                    myLevelOn ? "border-sky-600 bg-sky-600 text-white" : "border-sky-400 text-sky-700 dark:text-sky-300 active:bg-muted"
                  }`}
                >
                  내 레벨 책 ({myZpd.zpd_low === null ? "?" : myZpd.zpd_low.toFixed(1)}~{myZpd.zpd_high === null ? "?" : myZpd.zpd_high.toFixed(1)})
                </button>
              )}
              {AR_LEVEL_RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => { setArRange(arRange === r.key ? "" : r.key); setMyLevelChip(false); setPage(1); }}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-[clamp(0.85rem,1.9vw,1.15rem)] transition-colors ${
                    arRange === r.key ? "border-primary bg-primary text-primary-foreground" : "active:bg-muted"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {AR_INTERESTS.map((i) => (
                <button
                  key={i}
                  onClick={() => { setArInterest(arInterest === i ? "" : i); setPage(1); }}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-[clamp(0.85rem,1.9vw,1.15rem)] transition-colors ${
                    arInterest === i ? "border-primary bg-primary text-primary-foreground" : "active:bg-muted"
                  }`}
                >
                  {i}
                </button>
              ))}
              <button
                onClick={() => { setAvailableOnly(!availableOnly); availableBeforeMyLevel.current = null; setPage(1); }}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[clamp(0.85rem,1.9vw,1.15rem)] transition-colors ${
                  availableOnly ? "border-primary bg-primary text-primary-foreground" : "active:bg-muted"
                }`}
              >
                대출 가능만
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 도서 목록 */}
      <main className="flex-1 overflow-y-auto px-[clamp(1rem,3vw,2rem)] py-[1.5vh] space-y-[clamp(0.5rem,1vh,1rem)]">
        {!hasQuery && !hasArFilter ? (
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
            {debouncedSearch || hasArFilter ? "검색 결과가 없습니다" : "등록된 도서가 없습니다"}
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
                    {arEnabled && <ArBadge book={book} />}
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
