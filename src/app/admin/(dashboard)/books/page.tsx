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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Loader2, ChevronLeft, ChevronRight, Library, Check, MapPin, X, BookOpen } from "lucide-react";
import { getBooks, updateBooksLocation } from "@/app/actions/books";
import { getShelves } from "@/app/actions/shelves";

type BookItem = {
  id: string;
  barcode: string;
  title: string;
  author: string;
  cover_image: string | null;
  location_group: string;
  location_detail: string;
  is_available: boolean;
};

type ShelfOption = { id: string; name: string; type: string };

export default function AdminBooksPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [books, setBooks] = useState<BookItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, startTransition] = useTransition();

  // 일괄 선택 / 서가 위치 수정
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [shelves, setShelves] = useState<ShelfOption[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editGroup, setEditGroup] = useState("");
  const [editDetail, setEditDetail] = useState("");
  const [editError, setEditError] = useState("");
  const [isSaving, startSave] = useTransition();

  useEffect(() => {
    getShelves().then((data) => {
      setShelves(
        (data as ShelfOption[]).filter((s) => s.type !== "label")
      );
    });
  }, []);

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
    setSelectedIds(new Set());
  }, [fetchBooks]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = books.length > 0 && books.every((b) => selectedIds.has(b.id));
  function toggleSelectAll() {
    setSelectedIds((prev) => {
      if (books.every((b) => prev.has(b.id))) {
        const next = new Set(prev);
        books.forEach((b) => next.delete(b.id));
        return next;
      }
      const next = new Set(prev);
      books.forEach((b) => next.add(b.id));
      return next;
    });
  }

  function openEditDialog() {
    setEditGroup("");
    setEditDetail("");
    setEditError("");
    setEditOpen(true);
  }

  function handleBulkUpdate() {
    setEditError("");
    if (!editGroup) {
      setEditError("서가 위치를 선택해주세요.");
      return;
    }
    startSave(async () => {
      const result = await updateBooksLocation(
        Array.from(selectedIds),
        editGroup,
        editDetail
      );
      if (result.success) {
        setEditOpen(false);
        setSelectedIds(new Set());
        fetchBooks();
      } else {
        setEditError(result.error ?? "수정에 실패했습니다.");
      }
    });
  }

  const selectedCount = selectedIds.size;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">전체 도서 목록</h1>

      {/* 선택 액션 바 */}
      {selectedCount > 0 && (
        <div className="sticky top-2 z-20 flex items-center justify-between gap-3 rounded-lg border bg-primary/5 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              <X className="size-4" />
            </Button>
            <span className="text-sm font-medium">{selectedCount}권 선택됨</span>
          </div>
          <Button size="sm" onClick={openEditDialog}>
            <MapPin className="size-4 mr-1" />
            서가 위치 수정
          </Button>
        </div>
      )}

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
                      <TableHead className="w-10">
                        <button
                          onClick={toggleSelectAll}
                          className={`flex items-center justify-center size-5 rounded border-2 transition-colors ${
                            allSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"
                          }`}
                          aria-label="전체 선택"
                        >
                          {allSelected && <Check className="size-3.5" strokeWidth={3} />}
                        </button>
                      </TableHead>
                      <TableHead className="w-14">표지</TableHead>
                      <TableHead>바코드</TableHead>
                      <TableHead>제목</TableHead>
                      <TableHead>저자</TableHead>
                      <TableHead>서가 위치</TableHead>
                      <TableHead className="text-right">상태</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {books.map((b) => {
                      const checked = selectedIds.has(b.id);
                      return (
                      <TableRow
                        key={b.id}
                        className={`cursor-pointer hover:bg-muted/50 ${checked ? "bg-primary/5" : ""}`}
                        onClick={() => router.push(`/admin/books/${b.id}`)}
                      >
                        <TableCell onClick={(e) => { e.stopPropagation(); toggleSelect(b.id); }}>
                          <button
                            className={`flex items-center justify-center size-5 rounded border-2 transition-colors ${
                              checked ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"
                            }`}
                            aria-label="선택"
                          >
                            {checked && <Check className="size-3.5" strokeWidth={3} />}
                          </button>
                        </TableCell>
                        <TableCell>
                          {b.cover_image ? (
                            <img
                              src={b.cover_image}
                              alt=""
                              className="h-14 w-10 object-cover rounded border bg-muted"
                            />
                          ) : (
                            <div className="h-14 w-10 flex items-center justify-center rounded border bg-muted">
                              <BookOpen className="size-4 text-muted-foreground/40" />
                            </div>
                          )}
                        </TableCell>
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
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {books.map((b) => {
                  const checked = selectedIds.has(b.id);
                  return (
                  <div
                    key={b.id}
                    className={`flex items-center gap-3 border rounded-lg p-3 cursor-pointer hover:bg-muted/50 active:scale-[0.99] transition-transform ${checked ? "bg-primary/5 border-primary/40" : ""}`}
                    onClick={() => router.push(`/admin/books/${b.id}`)}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSelect(b.id); }}
                      className={`flex-shrink-0 flex items-center justify-center size-6 rounded border-2 transition-colors ${
                        checked ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"
                      }`}
                      aria-label="선택"
                    >
                      {checked && <Check className="size-4" strokeWidth={3} />}
                    </button>
                    {b.cover_image ? (
                      <img
                        src={b.cover_image}
                        alt=""
                        className="h-16 w-12 flex-shrink-0 object-cover rounded border bg-muted"
                      />
                    ) : (
                      <div className="h-16 w-12 flex-shrink-0 flex items-center justify-center rounded border bg-muted">
                        <BookOpen className="size-5 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-1">
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
                  </div>
                  );
                })}
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

      {/* 서가 위치 일괄 수정 다이얼로그 */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>서가 위치 일괄 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              선택한 <span className="font-semibold text-foreground">{selectedCount}권</span>의 서가 위치를 변경합니다.
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">서가 *</label>
              <Select value={editGroup} onValueChange={(v) => setEditGroup(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="서가를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {shelves.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      등록된 서가가 없습니다
                    </div>
                  ) : (
                    shelves.map((s) => (
                      <SelectItem key={s.id} value={s.name}>
                        {s.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">상세 위치 (선택)</label>
              <Input
                placeholder="예: 2번째 칸, 상단 등"
                value={editDetail}
                onChange={(e) => setEditDetail(e.target.value)}
              />
            </div>
            {editError && (
              <p className="text-sm text-destructive">{editError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={isSaving}>
              취소
            </Button>
            <Button onClick={handleBulkUpdate} disabled={isSaving}>
              {isSaving ? <Loader2 className="size-4 mr-1 animate-spin" /> : null}
              {selectedCount}권 수정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
