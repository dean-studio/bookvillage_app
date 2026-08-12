"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { Loader2, BookOpen, Search, X, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { getActiveRentals, updateGuestRental } from "@/app/actions/rentals";

type ActiveRental = Awaited<ReturnType<typeof getActiveRentals>>[number];

function formatDongHo(raw: string): string {
  const m = raw.trim().match(/^(\d+)\s*-\s*(\d+)$/);
  if (m) return `${m[1]}동 ${m[2]}호`;
  return raw.trim();
}

function getDDayBadge(dDay: number) {
  if (dDay < 0) {
    return <Badge variant="destructive">{Math.abs(dDay)}일 연체</Badge>;
  }
  if (dDay === 0) {
    return <Badge variant="destructive">오늘 마감</Badge>;
  }
  if (dDay <= 3) {
    return <Badge className="bg-amber-500 hover:bg-amber-600">D-{dDay}</Badge>;
  }
  return <Badge variant="outline">D-{dDay}</Badge>;
}

export default function AdminRentalsPage() {
  const router = useRouter();
  const [rentals, setRentals] = useState<ActiveRental[]>([]);
  const [isLoading, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);

  // 기본값: 전체보기 (날짜 필터 없음)
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [query, setQuery] = useState("");

  function fetchData(opts?: { start?: string; end?: string; q?: string }) {
    startTransition(async () => {
      const data = await getActiveRentals({
        startDate: (opts?.start ?? startDate) || undefined,
        endDate: (opts?.end ?? endDate) || undefined,
        query: (opts?.q ?? query) || undefined,
      });
      setRentals(data);
      setLoaded(true);
    });
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showAll() {
    setStartDate("");
    setEndDate("");
    fetchData({ start: "", end: "" });
  }

  // 게스트 대출 수정
  const [editTarget, setEditTarget] = useState<ActiveRental | null>(null);
  const [editName, setEditName] = useState("");
  const [editDongHo, setEditDongHo] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRentedAt, setEditRentedAt] = useState("");
  const [editError, setEditError] = useState("");
  const [isSaving, startSaving] = useTransition();

  function openEdit(r: ActiveRental) {
    setEditTarget(r);
    setEditName(r.user.name);
    setEditDongHo(r.user.dong_ho);
    setEditPhone(r.user.phone_number ?? "");
    setEditRentedAt((r.rented_at ?? "").slice(0, 10));
    setEditError("");
  }

  function handleSaveEdit() {
    if (!editTarget) return;
    setEditError("");
    startSaving(async () => {
      const fd = new FormData();
      fd.set("rental_id", editTarget.id);
      fd.set("name", editName.trim());
      fd.set("dong_ho", formatDongHo(editDongHo));
      fd.set("phone_number", editPhone.replace(/\D/g, ""));
      fd.set("rented_at", editRentedAt);
      const res = await updateGuestRental(fd);
      if (!res.success) {
        setEditError(res.error || "수정에 실패했습니다.");
        return;
      }
      setEditTarget(null);
      fetchData();
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">대여중 도서</h1>

      {/* 필터 */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">대출일 시작</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 w-40" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">대출일 종료</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 w-40" />
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchData()}>조회</Button>
            <Button variant="ghost" size="sm" onClick={showAll}>전체 보기</Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="대여자 이름 / 동호수 / 도서명 / 바코드 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") fetchData(); }}
              className="pl-9 h-9"
            />
            {query && (
              <button onClick={() => { setQuery(""); fetchData({ q: "" }); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-1">
                <X className="size-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="size-4" />
            현재 대출 중
            {loaded && (
              <span className="text-sm font-normal text-muted-foreground">
                ({rentals.length}건)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && !loaded ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : rentals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              현재 대출 중인 도서가 없습니다.
            </p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>도서명</TableHead>
                      <TableHead>바코드</TableHead>
                      <TableHead>대출자</TableHead>
                      <TableHead>동/호수</TableHead>
                      <TableHead>대출일</TableHead>
                      <TableHead>반납예정일</TableHead>
                      <TableHead className="text-right">D-Day</TableHead>
                      <TableHead className="text-right">수정</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rentals.map((r) => (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/admin/books/${r.book.id}`)}
                      >
                        <TableCell className="font-medium">{r.book.title}</TableCell>
                        <TableCell className="font-mono text-xs">{r.book.barcode}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5">
                            {r.user.name}
                            {r.user.is_guest && (
                              <Badge variant="outline" className="border-amber-400 text-amber-600 text-[0.65rem] px-1.5 py-0">게스트</Badge>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{r.user.dong_ho}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(r.rented_at).toLocaleDateString("ko-KR")}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(r.due_date).toLocaleDateString("ko-KR")}
                        </TableCell>
                        <TableCell className="text-right">
                          {getDDayBadge(r.d_day)}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.user.is_guest ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEdit(r);
                              }}
                            >
                              <Pencil className="size-3.5 mr-1" />
                              수정
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {rentals.map((r) => (
                  <div
                    key={r.id}
                    className="border rounded-lg p-3 space-y-1.5 cursor-pointer hover:bg-muted/50 active:scale-[0.99] transition-transform"
                    onClick={() => router.push(`/admin/books/${r.book.id}`)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{r.book.title}</p>
                        <p className="text-xs text-muted-foreground font-mono">{r.book.barcode}</p>
                      </div>
                      {getDDayBadge(r.d_day)}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        {r.user.name} · {r.user.dong_ho}
                        {r.user.is_guest && (
                          <Badge variant="outline" className="border-amber-400 text-amber-600 text-[0.6rem] px-1 py-0">게스트</Badge>
                        )}
                      </span>
                      <span>~{new Date(r.due_date).toLocaleDateString("ko-KR")}</span>
                    </div>
                    {r.user.is_guest && (
                      <div className="pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(r);
                          }}
                        >
                          <Pencil className="size-3.5 mr-1" />
                          대출 정보 수정
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 게스트 대출 수정 다이얼로그 */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4" />
              비회원 대출 정보 수정
            </DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-medium">{editTarget.book.title}</p>
                <p className="text-xs text-muted-foreground font-mono">{editTarget.book.barcode}</p>
              </div>
              {editError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-2.5">
                  <X className="size-4 shrink-0" />
                  {editError}
                </div>
              )}
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">동/호수</label>
                  <Input
                    placeholder="예: 101-211"
                    value={editDongHo}
                    onChange={(e) => setEditDongHo(e.target.value)}
                    onBlur={() => setEditDongHo((v) => formatDongHo(v))}
                    className="h-11"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">이름</label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-11" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">전화번호</label>
                  <Input
                    inputMode="numeric"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    className="h-11 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">대출일</label>
                  <Input type="date" value={editRentedAt} onChange={(e) => setEditRentedAt(e.target.value)} className="h-11" />
                  <p className="text-xs text-muted-foreground">대출일 변경 시 반납예정일이 자동으로 다시 계산됩니다.</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={isSaving}>
              취소
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
