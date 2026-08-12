"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft,
  BookOpen,
  MapPin,
  Loader2,
  History,
  Sparkles,
  Pencil,
  Camera,
  X,
} from "lucide-react";
import { getBookById, setBookFeatured, unsetBookFeatured, updateBook } from "@/app/actions/books";
import { getBookRentals } from "@/app/actions/rentals";
import { getShelves } from "@/app/actions/shelves";
import { uploadBookCoverImage } from "@/lib/storage";
import type { Book } from "@/types";

type BookDetail = Book & { avg_rating: number | null; review_count: number; featured_until?: string | null; created_by_name?: string | null };
type RentalRecord = Awaited<ReturnType<typeof getBookRentals>>[number] & { user_id?: string };

export default function AdminBookDetailPage() {
  const router = useRouter();
  const params = useParams();
  const bookId = params.id as string;

  const [book, setBook] = useState<BookDetail | null>(null);
  const [rentals, setRentals] = useState<RentalRecord[]>([]);
  const [isLoading, startTransition] = useTransition();
  const [isFeaturing, startFeaturing] = useTransition();

  // 수정 다이얼로그
  const [editOpen, setEditOpen] = useState(false);
  const [ef, setEf] = useState({ title: "", author: "", publisher: "", location_group: "", location_detail: "", description: "", cover_image: "" });
  const [shelfNames, setShelfNames] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [editError, setEditError] = useState("");
  const [isSaving, startSave] = useTransition();
  const editFileRef = useRef<HTMLInputElement>(null);

  function loadBook() {
    startTransition(async () => {
      const [bookData, rentalData] = await Promise.all([
        getBookById(bookId),
        getBookRentals(bookId),
      ]);
      if (bookData) setBook(bookData as BookDetail);
      setRentals(rentalData);
    });
  }

  useEffect(() => {
    loadBook();
    getShelves().then((data) => {
      setShelfNames((data as { name: string; type: string }[]).filter((s) => s.type !== "label").map((s) => s.name));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  function openEdit() {
    if (!book) return;
    setEf({
      title: book.title || "",
      author: book.author || "",
      publisher: book.publisher || "",
      location_group: book.location_group || "",
      location_detail: book.location_detail || "",
      description: book.description || "",
      cover_image: book.cover_image || "",
    });
    setEditError("");
    setEditOpen(true);
  }

  async function handleEditUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadBookCoverImage(file);
      if (url) setEf((p) => ({ ...p, cover_image: url }));
      else setEditError("이미지 업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
      if (editFileRef.current) editFileRef.current.value = "";
    }
  }

  function handleSaveEdit() {
    if (!ef.title.trim()) { setEditError("도서명을 입력해주세요."); return; }
    setEditError("");
    startSave(async () => {
      const fd = new FormData();
      fd.set("title", ef.title);
      fd.set("author", ef.author);
      fd.set("publisher", ef.publisher);
      fd.set("location_group", ef.location_group);
      fd.set("location_detail", ef.location_detail);
      fd.set("description", ef.description);
      fd.set("cover_image", ef.cover_image);
      const result = await updateBook(bookId, fd);
      if (!result.success) { setEditError(result.error || "수정에 실패했습니다."); return; }
      setEditOpen(false);
      loadBook();
    });
  }

  if (isLoading && !book) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ChevronLeft className="size-4 mr-1" />
          뒤로
        </Button>
        <p className="text-center text-muted-foreground py-8">도서를 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 상단 네비 */}
      <Button variant="ghost" onClick={() => router.back()}>
        <ChevronLeft className="size-4 mr-1" />
        뒤로
      </Button>

      {/* 도서 정보 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">도서 정보</CardTitle>
            <Button variant="outline" size="sm" onClick={openEdit}>
              <Pencil className="size-4 mr-1" />
              정보 수정
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            {book.cover_image ? (
              <img
                src={book.cover_image}
                alt={book.title}
                className="w-24 h-36 object-cover rounded shrink-0"
              />
            ) : (
              <div className="w-24 h-36 bg-muted rounded shrink-0 flex items-center justify-center">
                <BookOpen className="size-8 text-muted-foreground" />
              </div>
            )}
            <div className="space-y-1.5 min-w-0">
              <h2 className="text-xl font-bold">{book.title}</h2>
              <p className="text-muted-foreground">{book.author}</p>
              {book.publisher && (
                <p className="text-sm text-muted-foreground">출판사: {book.publisher}</p>
              )}
              <Badge variant={book.is_available ? "default" : "secondary"}>
                {book.is_available ? "대출 가능" : "대출 중"}
              </Badge>
              {book.avg_rating !== null && (
                <p className="text-sm">
                  {"★".repeat(Math.round(book.avg_rating))}{" "}
                  <span className="text-muted-foreground">
                    {book.avg_rating.toFixed(1)} ({book.review_count}개 리뷰)
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* 상세 정보 그리드 */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">바코드</p>
              <p className="font-mono">{book.barcode}</p>
            </div>
            {book.isbn && (
              <div>
                <p className="text-muted-foreground">ISBN</p>
                <p className="font-mono">{book.isbn}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground flex items-center gap-1">
                <MapPin className="size-3" />
                서가 위치
              </p>
              <p className="font-semibold">
                {book.location_group}{book.location_detail ? ` > ${book.location_detail}` : ""}
              </p>
            </div>
            {book.created_at && (
              <div>
                <p className="text-muted-foreground">등록일</p>
                <p>
                  {new Date(book.created_at).toLocaleDateString("ko-KR")}
                </p>
              </div>
            )}
            {book.created_by_name && (
              <div>
                <p className="text-muted-foreground">등록자</p>
                <p className="font-medium">{book.created_by_name}</p>
              </div>
            )}
          </div>

          {book.description && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">설명</p>
              <p className="text-sm">{book.description}</p>
            </div>
          )}

          {/* 신작 지정 */}
          <div className="flex items-center gap-2 pt-2 border-t">
            {book.featured_until && new Date(book.featured_until) >= new Date(new Date().toISOString().split('T')[0]) ? (
              <>
                <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                  <Sparkles className="size-3 mr-1" />
                  신작 지정 (~{new Date(book.featured_until).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })})
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isFeaturing}
                  onClick={() => {
                    startFeaturing(async () => {
                      const result = await unsetBookFeatured(bookId);
                      if (result.success) setBook((prev) => prev ? { ...prev, featured_until: null } : prev);
                    });
                  }}
                >
                  {isFeaturing ? <Loader2 className="size-3 animate-spin" /> : "해제"}
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={isFeaturing}
                onClick={() => {
                  startFeaturing(async () => {
                    const result = await setBookFeatured(bookId);
                    if (result.success) {
                      const until = new Date();
                      until.setDate(until.getDate() + 14);
                      setBook((prev) => prev ? { ...prev, featured_until: until.toISOString().split('T')[0] } : prev);
                    }
                  });
                }}
              >
                {isFeaturing ? <Loader2 className="size-3 mr-1 animate-spin" /> : <Sparkles className="size-3 mr-1" />}
                신작 지정
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 대출 이력 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4" />
            대출 이력
            <span className="text-sm font-normal text-muted-foreground">
              ({rentals.length}건)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rentals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              대출 이력이 없습니다.
            </p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>대출자</TableHead>
                      <TableHead>동/호수</TableHead>
                      <TableHead>대출일</TableHead>
                      <TableHead>반납예정일</TableHead>
                      <TableHead className="text-right">반납일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rentals.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell
                          className="font-medium text-primary cursor-pointer hover:underline"
                          onClick={() => r.user_id && router.push(`/admin/residents/${r.user_id}`)}
                        >
                          {r.user.name} ({r.user.dong_ho})
                        </TableCell>
                        <TableCell className="text-muted-foreground">{r.user.dong_ho}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(r.rented_at).toLocaleDateString("ko-KR")}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(r.due_date).toLocaleDateString("ko-KR")}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.returned_at ? (
                            new Date(r.returned_at).toLocaleDateString("ko-KR")
                          ) : (
                            <Badge variant="secondary">대출 중</Badge>
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
                  <div key={r.id} className="border rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span
                        className="text-sm font-medium text-primary cursor-pointer hover:underline"
                        onClick={() => r.user_id && router.push(`/admin/residents/${r.user_id}`)}
                      >
                        {r.user.name} ({r.user.dong_ho})
                      </span>
                      {r.returned_at ? (
                        <span className="text-xs text-muted-foreground">
                          반납: {new Date(r.returned_at).toLocaleDateString("ko-KR")}
                        </span>
                      ) : (
                        <Badge variant="secondary" className="text-xs">대출 중</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {r.user.dong_ho} · {new Date(r.rented_at).toLocaleDateString("ko-KR")} ~ {new Date(r.due_date).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 도서 정보 수정 다이얼로그 */}
      <input ref={editFileRef} type="file" accept="image/*" className="hidden" onChange={handleEditUpload} />
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">도서 정보 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-4">
              {/* 표지 */}
              <div className="flex flex-col items-center gap-2 shrink-0">
                {ef.cover_image ? (
                  <div className="relative">
                    <img src={ef.cover_image} alt="" className="w-24 h-32 object-cover rounded border" />
                    <button type="button" className="absolute -top-2 -right-2 bg-background border rounded-full p-0.5" onClick={() => setEf((p) => ({ ...p, cover_image: "" }))}>
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => editFileRef.current?.click()} disabled={isUploading}
                    className="w-24 h-32 rounded border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 hover:border-primary/50 transition-colors">
                    {isUploading ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : (<><Camera className="size-5 text-muted-foreground" /><span className="text-[10px] text-muted-foreground">표지</span></>)}
                  </button>
                )}
                {ef.cover_image && (
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => editFileRef.current?.click()} disabled={isUploading}>변경</Button>
                )}
              </div>
              {/* 기본 정보 */}
              <div className="flex-1 space-y-2.5 min-w-0">
                <div className="space-y-1">
                  <label className="text-sm font-medium">도서명 *</label>
                  <Input value={ef.title} onChange={(e) => setEf((p) => ({ ...p, title: e.target.value }))} className="h-10" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">저자</label>
                  <Input value={ef.author} onChange={(e) => setEf((p) => ({ ...p, author: e.target.value }))} className="h-10" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">출판사</label>
                  <Input value={ef.publisher} onChange={(e) => setEf((p) => ({ ...p, publisher: e.target.value }))} className="h-10" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">서가</label>
                <select
                  value={ef.location_group}
                  onChange={(e) => setEf((p) => ({ ...p, location_group: e.target.value }))}
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">선택 안 함</option>
                  {shelfNames.map((n) => <option key={n} value={n}>{n}</option>)}
                  {ef.location_group && !shelfNames.includes(ef.location_group) && (
                    <option value={ef.location_group}>{ef.location_group}</option>
                  )}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">상세 위치</label>
                <Input value={ef.location_detail} onChange={(e) => setEf((p) => ({ ...p, location_detail: e.target.value }))} className="h-10" placeholder="예: A-3" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">설명</label>
              <textarea value={ef.description} onChange={(e) => setEf((p) => ({ ...p, description: e.target.value }))} className="w-full min-h-24 rounded-md border bg-background px-3 py-2 text-sm" />
            </div>

            {editError && <p className="text-sm text-destructive">{editError}</p>}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-11" onClick={() => setEditOpen(false)} disabled={isSaving}>취소</Button>
              <Button className="flex-1 h-11 font-semibold" onClick={handleSaveEdit} disabled={isSaving || !ef.title.trim()}>
                {isSaving ? <Loader2 className="size-4 mr-1 animate-spin" /> : null}저장
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
