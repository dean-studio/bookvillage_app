"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Newspaper,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  X,
  Link2,
  Printer,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  getNewArrivals,
  getNewArrivalMonths,
  fetchBookMeta,
  createNewArrival,
  updateNewArrival,
  reorderNewArrivals,
  deleteNewArrival,
} from "@/app/actions/new-arrivals";
import {
  NEW_ARRIVAL_CATEGORIES,
  type NewArrival,
  type NewArrivalCategory,
} from "@/lib/new-arrivals";

// 현재 KST 기준 YYYY-MM
function currentYearMonth(): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${y}년 ${parseInt(m, 10)}월`;
}

export default function AdminNewArrivalsPage() {
  const [month, setMonth] = useState(currentYearMonth());
  const [items, setItems] = useState<NewArrival[]>([]);
  const [months, setMonths] = useState<{ year_month: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // 등록/수정 다이얼로그
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NewArrival | null>(null);
  const [link, setLink] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [cover, setCover] = useState("");
  const [category, setCategory] = useState<NewArrivalCategory>("child");
  const [error, setError] = useState("");
  const [isFetching, startFetch] = useTransition();
  const [isSaving, startSave] = useTransition();
  const titleRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<NewArrival | null>(null);
  const [isDeleting, startDelete] = useTransition();

  const [isReordering, startReorder] = useTransition();

  // 분류별 그룹 (표시 순서 = NEW_ARRIVAL_CATEGORIES 순서)
  function itemsOf(cat: NewArrivalCategory): NewArrival[] {
    return items.filter((it) => it.category === cat);
  }

  // 순서 이동: 같은 분류 안에서 group 내 idx 항목을 dir(-1=앞, +1=뒤)로 스왑
  function move(cat: NewArrivalCategory, groupIdx: number, dir: -1 | 1) {
    const group = itemsOf(cat);
    const target = groupIdx + dir;
    if (target < 0 || target >= group.length) return;
    [group[groupIdx], group[target]] = [group[target], group[groupIdx]];
    // 전체 items를 분류 순서대로 재구성 (다른 분류는 그대로)
    const next: NewArrival[] = [];
    for (const c of NEW_ARRIVAL_CATEGORIES) {
      next.push(...(c.value === cat ? group : itemsOf(c.value)));
    }
    setItems(next); // 낙관적 업데이트
    startReorder(async () => {
      // 해당 분류 순서만 저장
      const result = await reorderNewArrivals(group.map((it) => it.id));
      if (!result.success) loadItems(month); // 실패 시 서버 상태로 복구
    });
  }

  function loadItems(ym: string) {
    setLoading(true);
    getNewArrivals(ym).then((data) => {
      setItems(data);
      setLoading(false);
    });
  }

  function loadMonths() {
    getNewArrivalMonths().then(setMonths);
  }

  useEffect(() => {
    loadItems(month);
    loadMonths();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectMonth(ym: string) {
    setMonth(ym);
    loadItems(ym);
  }

  function openCreate(cat?: NewArrivalCategory) {
    setEditing(null);
    setLink("");
    setTitle("");
    setAuthor("");
    setCover("");
    setCategory(cat ?? "child");
    setError("");
    setDialogOpen(true);
  }

  function openEdit(it: NewArrival) {
    setEditing(it);
    setLink(it.source_url || "");
    setTitle(it.title);
    setAuthor(it.author);
    setCover(it.cover_image || "");
    setCategory(it.category);
    setError("");
    setDialogOpen(true);
  }

  function handleFetch() {
    if (!link.trim()) {
      setError("교보문고 링크를 입력해주세요.");
      return;
    }
    setError("");
    startFetch(async () => {
      const result = await fetchBookMeta(link);
      if (!result.success || !result.data) {
        setError(result.error || "정보를 가져오지 못했습니다. 직접 입력해주세요.");
        return;
      }
      if (result.data.title) setTitle(result.data.title);
      if (result.data.image) setCover(result.data.image);
      if (result.data.author) setAuthor(result.data.author);
      // 제목이 비면 수동 입력 유도
      if (!result.data.title) titleRef.current?.focus();
    });
  }

  function handleSave() {
    if (!title.trim()) {
      setError("도서명을 입력해주세요.");
      return;
    }
    setError("");
    startSave(async () => {
      const fd = new FormData();
      fd.set("year_month", month);
      fd.set("category", category);
      fd.set("title", title);
      fd.set("author", author);
      fd.set("cover_image", cover);
      fd.set("source_url", link);
      const result = editing
        ? await updateNewArrival(editing.id, fd)
        : await createNewArrival(fd);
      if (!result.success) {
        setError(result.error || "저장에 실패했습니다.");
        return;
      }
      setDialogOpen(false);
      loadItems(month);
      loadMonths();
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startDelete(async () => {
      await deleteNewArrival(deleteTarget.id);
      setDeleteTarget(null);
      loadItems(month);
      loadMonths();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Newspaper className="size-6" />
          월별 신간도서
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={items.length === 0}
            onClick={() => window.open(`/admin/new-arrivals/print?month=${month}`, "_blank", "noopener")}
          >
            <Printer className="size-4 mr-1" />
            인쇄
          </Button>
          <Button onClick={() => openCreate()}>
            <Plus className="size-4 mr-1" />
            도서 추가
          </Button>
        </div>
      </div>

      {/* 월 선택 */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">등록 월</label>
              <Input
                type="month"
                value={month}
                onChange={(e) => e.target.value && selectMonth(e.target.value)}
                className="h-9 w-44"
              />
            </div>
          </div>
          {months.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {months.map((m) => (
                <Button
                  key={m.year_month}
                  variant={m.year_month === month ? "default" : "outline"}
                  size="sm"
                  className="h-8"
                  onClick={() => selectMonth(m.year_month)}
                >
                  {monthLabel(m.year_month)}
                  <span className="ml-1.5 opacity-80">{m.count}</span>
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {monthLabel(month)} 신간{" "}
            {items.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">({items.length}권)</span>
            )}
            {isReordering && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            분류별로 등록됩니다. 카드에 마우스를 올리면 수정·삭제·순서 이동 버튼이 나타나며, 순서는 각 분류 안에서 인쇄물에 그대로 반영됩니다.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-8">
              {NEW_ARRIVAL_CATEGORIES.map((cat) => {
                const group = itemsOf(cat.value);
                return (
                  <section key={cat.value}>
                    {/* 분류 헤더 */}
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                        <span className="inline-block size-2 rounded-full bg-primary" />
                        {cat.label}
                        <span className="text-xs font-normal text-muted-foreground">{cat.hint}</span>
                      </span>
                      <span className="text-sm text-muted-foreground">{group.length}권</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 ml-auto text-primary"
                        onClick={() => openCreate(cat.value)}
                      >
                        <Plus className="size-4 mr-1" />
                        추가
                      </Button>
                    </div>

                    {group.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => openCreate(cat.value)}
                        className="w-full py-6 rounded-lg border border-dashed border-muted-foreground/30 text-sm text-muted-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors"
                      >
                        {cat.label} 신간을 추가해보세요
                      </button>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-6">
                        {group.map((it, idx) => (
                          <div key={it.id} className="group flex flex-col">
                            {/* 표지 */}
                            <div className="relative aspect-[3/4] w-full">
                              {/* 순서 배지 */}
                              <span className="absolute -top-2 -left-2 z-20 flex size-7 items-center justify-center rounded-full bg-primary text-white text-xs font-bold shadow-md ring-2 ring-background">
                                {idx + 1}
                              </span>
                              <div className="absolute inset-0 overflow-hidden rounded-xl bg-muted shadow-sm ring-1 ring-black/5 transition-all duration-200 group-hover:shadow-lg group-hover:-translate-y-0.5 flex items-center justify-center">
                                {it.cover_image ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={it.cover_image} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <ImageIcon className="size-8 text-muted-foreground/40" />
                                )}
                              </div>

                              {/* hover 액션: 수정 / 삭제 */}
                              <div className="absolute top-1.5 right-1.5 z-20 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => openEdit(it)}
                                  className="icon-btn flex size-8 items-center justify-center rounded-full bg-background/90 backdrop-blur shadow-md ring-1 ring-black/5 hover:bg-background hover:text-primary transition-colors"
                                  title="수정"
                                >
                                  <Pencil className="size-4" />
                                </button>
                                <button
                                  onClick={() => setDeleteTarget(it)}
                                  className="icon-btn flex size-8 items-center justify-center rounded-full bg-background/90 backdrop-blur shadow-md ring-1 ring-black/5 hover:bg-destructive hover:text-white transition-colors"
                                  title="삭제"
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              </div>

                              {/* hover 순서 이동: 표지 하단 오버레이 */}
                              <div className="absolute inset-x-1.5 bottom-1.5 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => move(cat.value, idx, -1)}
                                  disabled={idx === 0 || isReordering}
                                  className="icon-btn flex-1 flex items-center justify-center h-8 rounded-lg bg-background/90 backdrop-blur shadow-md ring-1 ring-black/5 hover:bg-background disabled:opacity-30 disabled:pointer-events-none transition-colors"
                                  title="앞으로"
                                >
                                  <ChevronLeft className="size-4" />
                                </button>
                                <button
                                  onClick={() => move(cat.value, idx, 1)}
                                  disabled={idx === group.length - 1 || isReordering}
                                  className="icon-btn flex-1 flex items-center justify-center h-8 rounded-lg bg-background/90 backdrop-blur shadow-md ring-1 ring-black/5 hover:bg-background disabled:opacity-30 disabled:pointer-events-none transition-colors"
                                  title="뒤로"
                                >
                                  <ChevronRight className="size-4" />
                                </button>
                              </div>
                            </div>

                            {/* 제목 / 저자 */}
                            <p className="mt-2.5 px-0.5 text-sm font-semibold text-foreground line-clamp-2 leading-snug break-keep">
                              {it.title}
                            </p>
                            {it.author && (
                              <p className="px-0.5 text-xs text-muted-foreground line-clamp-1 mt-0.5">{it.author}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 등록/수정 다이얼로그 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {editing ? "신간 수정" : `${monthLabel(month)} 신간 추가`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* 연령 분류 */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">연령 분류</label>
              <div className="grid grid-cols-4 gap-2">
                {NEW_ARRIVAL_CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    className={`flex flex-col items-center justify-center rounded-lg border py-2 transition-colors ${
                      category === c.value
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-input text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="text-sm">{c.label}</span>
                    <span className="text-[10px] opacity-70">{c.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {!editing && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">교보문고 링크</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleFetch();
                        }
                      }}
                      placeholder="https://product.kyobobook.co.kr/detail/..."
                      className="h-11 pl-9"
                    />
                  </div>
                  <Button onClick={handleFetch} disabled={isFetching} className="h-11 shrink-0">
                    {isFetching ? <Loader2 className="size-4 animate-spin" /> : "가져오기"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  링크를 넣고 &quot;가져오기&quot;를 누르면 제목·표지를 자동으로 채웁니다. 안 되면 아래에 직접 입력하세요.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <div className="w-24 shrink-0">
                <div className="aspect-[3/4] w-full bg-muted rounded overflow-hidden flex items-center justify-center">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <ImageIcon className="size-6 text-muted-foreground/40" />
                  )}
                </div>
              </div>
              <div className="flex-1 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">도서명 *</label>
                  <Input
                    ref={titleRef}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="도서명"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">저자 (선택)</label>
                  <Input
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="저자"
                    className="h-11"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">표지 이미지 URL (선택)</label>
              <div className="relative">
                <Input
                  value={cover}
                  onChange={(e) => setCover(e.target.value)}
                  placeholder="https://..."
                  className="h-11 pr-9 text-xs"
                />
                {cover && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
                    onClick={() => setCover("")}
                  >
                    <X className="size-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11"
                onClick={() => setDialogOpen(false)}
                disabled={isSaving}
              >
                취소
              </Button>
              <Button
                className="flex-1 h-11 font-semibold"
                onClick={handleSave}
                disabled={isSaving || !title.trim()}
              >
                {isSaving ? <Loader2 className="size-4 mr-1 animate-spin" /> : null}
                {editing ? "수정" : "등록"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl">신간 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">&quot;{deleteTarget?.title}&quot;을(를) 삭제하시겠습니까?</p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-11" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              취소
            </Button>
            <Button variant="destructive" className="flex-1 h-11" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Trash2 className="size-4 mr-1" />}
              삭제
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
