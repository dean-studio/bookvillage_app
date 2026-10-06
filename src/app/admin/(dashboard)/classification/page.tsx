"use client";

import { useCallback, useEffect, useState, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Tags, Search, CheckCircle2, CircleDashed, GraduationCap, BookOpen, MoveRight, LayoutList, Map as MapIcon } from "lucide-react";
import { PlanView, PlanBookList } from "./plan-view";
import {
  getClassificationSummary,
  getClassifiedBooks,
  getShelfOverview,
  renameSeries,
  setBookAgeGroup,
  setSeriesAgeGroup,
  setBookSubCategory,
} from "@/app/actions/classification";
import {
  AGE_GROUPS,
  CLASSIFICATION_SOURCES,
  SUB_CATEGORIES_BY_AGE,
  ageGroupLabel,
  isSubCategoryOf,
  needsMove,
  subCategoryLabel,
} from "@/lib/book-classification";

type Summary = NonNullable<Awaited<ReturnType<typeof getClassificationSummary>>>;
type BookRow = Awaited<ReturnType<typeof getClassifiedBooks>>["books"][number];
type ShelfOverview = NonNullable<Awaited<ReturnType<typeof getShelfOverview>>>;

// 목록 필터: ?age=elem_1_2 | ?age=age_0_3&sub=picture | ?age=infant_set&series=이름 | ?age=none(미분류) | ?age=all(전체 도서) | ?grade=3
function filterTitle(
  age: string | null,
  sub: string | null,
  series: string | null,
  grade: number | null,
  shelf: string | null,
  moves: boolean
): string {
  if (moves) return shelf ? `${shelf} 책장 · 옮겨야 할 책` : "옮겨야 할 책 (전체)";
  if (shelf) return age ? `${shelf} 책장 · ${ageGroupLabel(age === "none" ? null : age)}` : `${shelf} 책장`;
  if (grade) return `교과연계 ${grade}학년`;
  if (series) return age === "infant_set" ? `유아 전집 · ${series}` : `시리즈 · ${series}`;
  if (age === "none") return "미분류 도서";
  if (age === "all") return "전체 도서";
  if (sub === "none") return `${ageGroupLabel(age)} · 하위 분류 없음`;
  const subLabel = subCategoryLabel(sub);
  return subLabel ? `${ageGroupLabel(age)} · ${subLabel}` : ageGroupLabel(age);
}

function SummaryView({ summary, onOpen }: { summary: Summary; onOpen: (q: string) => void }) {
  const pct = summary.total ? Math.round((summary.classified / summary.total) * 100) : 0;
  return (
    <div className="space-y-6">
      {/* 진행 현황 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button onClick={() => onOpen("age=all")} className="text-left rounded-xl border p-5 hover:bg-muted/50 transition-colors">
          <p className="text-sm text-muted-foreground flex items-center gap-1.5"><BookOpen className="size-4" />전체 도서</p>
          <p className="text-3xl font-bold mt-1">{summary.total.toLocaleString()}권</p>
        </button>
        <div className="rounded-xl border p-5 border-primary/40 bg-primary/5">
          <p className="text-sm text-muted-foreground flex items-center gap-1.5"><CheckCircle2 className="size-4 text-primary" />분류 완료</p>
          <p className="text-3xl font-bold mt-1 text-primary">{summary.classified.toLocaleString()}권</p>
          <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{pct}% 완료</p>
        </div>
        <button onClick={() => onOpen("age=none")} className="text-left rounded-xl border p-5 hover:bg-muted/50 transition-colors">
          <p className="text-sm text-muted-foreground flex items-center gap-1.5"><CircleDashed className="size-4" />미분류</p>
          <p className="text-3xl font-bold mt-1">{summary.unclassified.toLocaleString()}권</p>
          <p className="text-xs text-muted-foreground mt-1">클릭해서 직접 분류하기</p>
        </button>
      </div>

      {/* 연령 분류 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Tags className="size-4" />연령 분류</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {summary.byAge.map((g) => {
              const subs = summary.bySub[g.value];
              const isSet = g.value === "infant_set";
              return (
                <div
                  key={g.value}
                  className={`rounded-xl border hover:border-primary/50 transition-colors ${
                    isSet ? "col-span-2 md:col-span-4" : subs ? "col-span-2" : ""
                  }`}
                >
                  <button onClick={() => onOpen(`age=${g.value}`)} className="w-full text-left p-4 hover:bg-primary/5 rounded-xl">
                    <p className="font-semibold">{g.label}</p>
                    <p className="text-2xl font-bold mt-1">{g.count.toLocaleString()}<span className="text-sm font-normal text-muted-foreground ml-1">권</span></p>
                  </button>
                  {/* 유아 전집: 시리즈별 */}
                  {isSet && summary.series.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-4 pb-4">
                      {summary.series.map((sr) => (
                        <button
                          key={sr.name}
                          onClick={() => onOpen(`age=infant_set&series=${encodeURIComponent(sr.name)}`)}
                          className="rounded-full border px-3 py-1 text-sm hover:bg-primary/10 hover:border-primary/40"
                        >
                          {sr.name} <b>{sr.count}</b>
                        </button>
                      ))}
                    </div>
                  )}
                  {/* 유아 하위 분류 */}
                  {subs && (
                    <div className="flex flex-wrap gap-1.5 px-4 pb-4">
                      {subs.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => onOpen(`age=${g.value}&sub=${c.value}`)}
                          className="rounded-full border px-3 py-1 text-sm hover:bg-primary/10 hover:border-primary/40"
                        >
                          {c.label} <b>{c.count}</b>
                        </button>
                      ))}
                      <button
                        onClick={() => onOpen(`age=${g.value}&sub=none`)}
                        className="rounded-full border border-dashed px-3 py-1 text-sm text-muted-foreground hover:bg-muted"
                      >
                        하위 분류 없음 <b>{g.count - subs.reduce((n, c) => n + c.count, 0)}</b>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 초등 등 시리즈 */}
      {summary.otherSeries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><BookOpen className="size-4" />시리즈 (5권 이상)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {summary.otherSeries.map((sr) => (
                <button
                  key={sr.name}
                  onClick={() => onOpen(`series=${encodeURIComponent(sr.name)}`)}
                  className="rounded-full border px-3 py-1 text-sm hover:bg-primary/10 hover:border-primary/40"
                >
                  {sr.name} <b>{sr.count}</b>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 교과연계 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><GraduationCap className="size-4" />교과서 수록·연계 도서 (필독)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {summary.byGrade.map((g) => (
              <button
                key={g.grade}
                onClick={() => onOpen(`grade=${g.grade}`)}
                className="text-left rounded-xl border p-4 hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                <p className="font-semibold">{g.grade}학년</p>
                <p className="text-2xl font-bold mt-1">{g.count.toLocaleString()}<span className="text-sm font-normal text-muted-foreground ml-1">권</span></p>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">교보문고 &apos;교과서수록/연계도서&apos; 학년별 목록과 ISBN이 일치하는 도서입니다. 한 책이 여러 학년에 속할 수 있어요.</p>
        </CardContent>
      </Card>
    </div>
  );
}

// 책장별 보기: 현재 책장마다 분류별 권수, 옮겨야 할 책 강조
function ShelfView({ onOpen }: { onOpen: (q: string) => void }) {
  const [data, setData] = useState<ShelfOverview | null>(null);

  useEffect(() => {
    getShelfOverview().then(setData);
  }, []);

  if (!data) {
    return <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>;
  }

  const bases = [...new Set(data.shelves.map((s) => s.base))];

  return (
    <div className="space-y-6">
      <button
        onClick={() => onOpen("moves=1")}
        className="w-full text-left rounded-xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-5 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
      >
        <p className="text-sm text-muted-foreground flex items-center gap-1.5"><MoveRight className="size-4 text-amber-600" />다른 책장으로 옮겨야 할 책</p>
        <p className="text-3xl font-bold mt-1 text-amber-700 dark:text-amber-400">{data.totalMoves.toLocaleString()}권</p>
        <p className="text-xs text-muted-foreground mt-1">분류가 지금 꽂힌 책장과 맞지 않는 책이에요. 눌러서 전체 목록 보기</p>
      </button>

      {bases.map((base) => (
        <Card key={base}>
          <CardHeader>
            <CardTitle className="text-base">{base}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.shelves.filter((s) => s.base === base).map((s) => (
              <div key={s.name} className="rounded-lg border p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => onOpen(`shelf=${encodeURIComponent(s.name)}`)} className="font-semibold hover:underline">
                    {s.name}
                  </button>
                  <span className="text-sm text-muted-foreground">{s.total.toLocaleString()}권</span>
                  {s.moves > 0 && (
                    <button
                      onClick={() => onOpen(`shelf=${encodeURIComponent(s.name)}&moves=1`)}
                      className="ml-auto rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-3 py-1 text-sm font-medium hover:bg-amber-200"
                    >
                      옮길 책 {s.moves}권
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {s.byAge.map((a) => (
                    <button
                      key={a.age}
                      onClick={() => onOpen(`shelf=${encodeURIComponent(s.name)}&age=${a.age}`)}
                      className={`rounded-full border px-3 py-1 text-sm ${
                        a.move
                          ? "border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 hover:bg-amber-100"
                          : a.age === "none"
                            ? "border-dashed text-muted-foreground hover:bg-muted"
                            : "hover:bg-primary/10 hover:border-primary/40"
                      }`}
                    >
                      {a.move && "→ "}{ageGroupLabel(a.age === "none" ? null : a.age)} <b>{a.count}</b>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function BookListView({
  age,
  sub,
  series,
  grade,
  shelf,
  moves,
}: {
  age: string | null;
  sub: string | null;
  series: string | null;
  grade: number | null;
  shelf: string | null;
  moves: boolean;
}) {
  const router = useRouter();
  const [seriesName, setSeriesName] = useState(series ?? "");
  const [renameMsg, setRenameMsg] = useState<string | null>(null);
  const [seriesAge, setSeriesAge] = useState("");
  const [seriesAgeMsg, setSeriesAgeMsg] = useState<string | null>(null);
  const [books, setBooks] = useState<BookRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [isLoading, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(() => {
    startTransition(async () => {
      const res = await getClassifiedBooks({
        shelf: shelf ?? undefined,
        moves,
        age: age === "all" ? undefined : age ?? undefined,
        sub: sub ?? undefined,
        series: series ?? undefined,
        grade: grade ?? undefined,
        q: query,
        page,
      });
      setBooks(res.books);
      setTotal(res.total);
      setPageSize(res.pageSize);
    });
  }, [age, sub, series, grade, shelf, moves, query, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeAge(book: BookRow, value: string) {
    setSavingId(book.id);
    const result = await setBookAgeGroup(book.id, value || null);
    setSavingId(null);
    if (result.success) {
      const keepSub = !!book.sub_category && isSubCategoryOf(value, book.sub_category);
      setBooks((prev) =>
        prev.map((b) =>
          b.id === book.id
            ? { ...b, age_group: value || null, sub_category: keepSub ? b.sub_category : null, classification_source: value ? "manual" : null }
            : b
        )
      );
    }
  }

  // 전집 이름 변경: 같은 이름으로 바꾸면 오타로 갈라진 전집이 합쳐짐
  async function handleRename() {
    if (!series || !seriesName.trim() || seriesName.trim() === series) return;
    setRenameMsg(null);
    const result = await renameSeries(series, seriesName);
    if (!result.success) {
      setRenameMsg(result.error ?? "이름 변경 실패");
      return;
    }
    const ageParam = age ? `age=${age}&` : "";
    router.replace(`/admin/classification?${ageParam}series=${encodeURIComponent(seriesName.trim())}`);
  }

  // 전집·시리즈 전체 분류 변경 → 바뀐 분류 목록으로 이동
  async function handleSeriesAge() {
    if (!series || !seriesAge) return;
    setSeriesAgeMsg(null);
    const result = await setSeriesAgeGroup(series, seriesAge);
    if (!result.success) {
      setSeriesAgeMsg(result.error ?? "분류 변경 실패");
      return;
    }
    router.replace(`/admin/classification?age=${seriesAge}&series=${encodeURIComponent(series)}`);
  }

  async function changeSub(book: BookRow, value: string) {
    setSavingId(book.id);
    const result = await setBookSubCategory(book.id, value || null);
    setSavingId(null);
    if (result.success) {
      setBooks((prev) => prev.map((b) => (b.id === book.id ? { ...b, sub_category: value || null, classification_source: "manual" } : b)));
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {filterTitle(age, sub, series, grade, shelf, moves)}
          <Badge variant="secondary">{total.toLocaleString()}권</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {series && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
            <span className="text-sm text-muted-foreground">{age === "infant_set" ? "전집 이름" : "시리즈 이름"}</span>
            <Input className="max-w-xs h-9" value={seriesName} maxLength={100} onChange={(e) => setSeriesName(e.target.value)} />
            <Button size="sm" variant="outline" onClick={handleRename} disabled={!seriesName.trim() || seriesName.trim() === series}>
              이름 변경
            </Button>
            <span className="text-xs text-muted-foreground">다른 전집·시리즈와 같은 이름으로 바꾸면 하나로 합쳐져요.</span>
            {renameMsg && <span className="text-sm text-destructive">{renameMsg}</span>}
            <div className="basis-full h-0" />
            <span className="text-sm text-muted-foreground">전체 분류 바꾸기</span>
            <select
              value={seriesAge}
              onChange={(e) => setSeriesAge(e.target.value)}
              className="h-9 rounded-md border px-2 text-sm bg-background"
            >
              <option value="">분류 선택</option>
              {AGE_GROUPS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={handleSeriesAge} disabled={!seriesAge}>
              {total}권 모두 변경
            </Button>
            <span className="text-xs text-muted-foreground">예: 실물을 보니 초등 책이면 &quot;초등 전학년&quot;으로</span>
            {seriesAgeMsg && <span className="text-sm text-destructive">{seriesAgeMsg}</span>}
          </div>
        )}
        <form
          className="flex gap-2 max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQuery(q);
          }}
        >
          <Input placeholder="제목, 저자, 바코드 검색" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button type="submit" variant="outline"><Search className="size-4" /></Button>
        </form>

        {isLoading && books.length === 0 ? (
          <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>
        ) : books.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">해당하는 도서가 없습니다.</p>
        ) : (
          <div className={`divide-y rounded-lg border ${isLoading ? "opacity-60" : ""}`}>
            {books.map((b) => (
              <div key={b.id} className="flex items-center gap-3 p-3">
                {b.cover_image ? (
                  <img src={b.cover_image} alt="" className="w-10 h-14 object-cover rounded shrink-0 bg-muted" />
                ) : (
                  <div className="w-10 h-14 rounded shrink-0 bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <a href={`/admin/books/${b.id}`} className="font-medium hover:underline line-clamp-1">{b.title}</a>
                  <p className="text-sm text-muted-foreground truncate">
                    {b.author} · <span className="font-mono">{b.barcode}</span>
                  </p>
                  <p className="text-sm mt-0.5">
                    <span className="text-muted-foreground">현재 </span>
                    <b>{b.location_group}{b.location_detail ? ` ${b.location_detail}` : ""}</b>
                    {needsMove(b.location_group, b.age_group) && (
                      <span className="ml-2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-1.5 py-0.5 text-xs font-semibold">
                        → {ageGroupLabel(b.age_group)} 칸으로 이동
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {b.series_name && !series && <Badge variant="secondary" className="text-xs">{b.series_name}</Badge>}
                    {(b.textbook_grades ?? []).map((g: number) => (
                      <Badge key={g} variant="outline" className="text-xs">교과연계 {g}학년</Badge>
                    ))}
                    {b.classification_source && (
                      <span className="text-xs text-muted-foreground">출처: {CLASSIFICATION_SOURCES[b.classification_source] ?? b.classification_source}</span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 flex flex-col sm:flex-row items-end sm:items-center gap-2">
                  {savingId === b.id && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                  {b.age_group && SUB_CATEGORIES_BY_AGE[b.age_group] && (
                    <select
                      value={b.sub_category ?? ""}
                      onChange={(e) => changeSub(b, e.target.value)}
                      disabled={savingId === b.id}
                      className={`h-10 rounded-md border px-2 text-sm bg-background ${b.sub_category ? "" : "text-muted-foreground"}`}
                    >
                      <option value="">하위 분류 없음</option>
                      {SUB_CATEGORIES_BY_AGE[b.age_group].map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  )}
                  <select
                    value={b.age_group ?? ""}
                    onChange={(e) => changeAge(b, e.target.value)}
                    disabled={savingId === b.id}
                    className={`h-10 rounded-md border px-2 text-sm bg-background ${b.age_group ? "" : "text-muted-foreground"}`}
                  >
                    <option value="">미분류</option>
                    {AGE_GROUPS.map((g) => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" size="sm" disabled={page <= 1 || isLoading} onClick={() => setPage((p) => p - 1)}>이전</Button>
            <span className="text-sm text-muted-foreground">{page} / {pages}</span>
            <Button variant="outline" size="sm" disabled={page >= pages || isLoading} onClick={() => setPage((p) => p + 1)}>다음</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ClassificationPage() {
  const router = useRouter();
  const params = useSearchParams();
  const age = params.get("age");
  const sub = params.get("sub");
  const series = params.get("series");
  const shelf = params.get("shelf");
  const moves = params.get("moves") === "1";
  const planTarget = params.get("plan");
  const viewParam = params.get("view");
  const view = viewParam === "shelf" || viewParam === "plan" ? viewParam : "class";
  const gradeParam = parseInt(params.get("grade") ?? "", 10);
  const grade = gradeParam >= 1 && gradeParam <= 6 ? gradeParam : null;
  const isList = !!age || !!grade || !!series || !!shelf || moves;

  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    if (!isList && view === "class") getClassificationSummary().then(setSummary);
  }, [isList, view]);

  // 목록에서 돌아갈 곳: 들어온 탭으로
  const backHref = planTarget
    ? "/admin/classification?view=plan"
    : shelf || moves
      ? "/admin/classification?view=shelf"
      : "/admin/classification";
  const backLabel = planTarget ? "재배치안" : shelf || moves ? "책장별 보기" : "분류 현황";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {(isList || planTarget) && (
          <Button variant="ghost" size="sm" onClick={() => router.push(backHref)}>
            <ArrowLeft className="size-4 mr-1" />
            {backLabel}
          </Button>
        )}
        <h1 className="text-2xl font-bold flex items-center gap-2"><Tags className="size-6" />분류 도서</h1>
      </div>

      {!isList && !planTarget && (
        <div className="inline-flex flex-wrap rounded-lg border p-1 gap-1">
          <Button size="sm" variant={view === "class" ? "default" : "ghost"} onClick={() => router.push("/admin/classification")}>
            <Tags className="size-4 mr-1" />분류별
          </Button>
          <Button size="sm" variant={view === "shelf" ? "default" : "ghost"} onClick={() => router.push("/admin/classification?view=shelf")}>
            <LayoutList className="size-4 mr-1" />책장별 (현재)
          </Button>
          <Button size="sm" variant={view === "plan" ? "default" : "ghost"} onClick={() => router.push("/admin/classification?view=plan")}>
            <MapIcon className="size-4 mr-1" />재배치안
          </Button>
        </div>
      )}

      {planTarget ? (
        <PlanBookList key={planTarget} target={planTarget} />
      ) : isList ? (
        <BookListView
          key={`${age}-${sub}-${series}-${grade}-${shelf}-${moves}`}
          age={age}
          sub={sub}
          series={series}
          grade={grade}
          shelf={shelf}
          moves={moves}
        />
      ) : view === "shelf" ? (
        <ShelfView onOpen={(q) => router.push(`/admin/classification?${q}`)} />
      ) : view === "plan" ? (
        <PlanView onOpen={(q) => router.push(`/admin/classification?${q}`)} />
      ) : !summary ? (
        <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <SummaryView summary={summary} onOpen={(q) => router.push(`/admin/classification?${q}`)} />
      )}
    </div>
  );
}

export default function ClassificationPageWrapper() {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}>
      <ClassificationPage />
    </Suspense>
  );
}
