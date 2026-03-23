"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter, useParams } from "next/navigation";
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
  ChevronLeft,
  BookOpen,
  MapPin,
  Loader2,
  History,
  Sparkles,
} from "lucide-react";
import { getBookById, setBookFeatured, unsetBookFeatured } from "@/app/actions/books";
import { getBookRentals } from "@/app/actions/rentals";
import type { Book } from "@/types";

type BookDetail = Book & { avg_rating: number | null; review_count: number; featured_until?: string | null };
type RentalRecord = Awaited<ReturnType<typeof getBookRentals>>[number] & { user_id?: string };

export default function AdminBookDetailPage() {
  const router = useRouter();
  const params = useParams();
  const bookId = params.id as string;

  const [book, setBook] = useState<BookDetail | null>(null);
  const [rentals, setRentals] = useState<RentalRecord[]>([]);
  const [isLoading, startTransition] = useTransition();
  const [isFeaturing, startFeaturing] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const [bookData, rentalData] = await Promise.all([
        getBookById(bookId),
        getBookRentals(bookId),
      ]);
      if (bookData) setBook(bookData as BookDetail);
      setRentals(rentalData);
    });
  }, [bookId]);

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
          <CardTitle className="text-lg">도서 정보</CardTitle>
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
    </div>
  );
}
