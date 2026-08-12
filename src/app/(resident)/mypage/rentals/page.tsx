"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  BookOpen,
  AlertTriangle,
  ChevronLeft,
  X,
  Loader2,
} from "lucide-react";
import { getMyRentals, cancelMyRental } from "@/app/actions/rentals";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type ActiveRental = {
  id: string;
  book: { id: string; title: string; author: string; cover_image: string | null };
  rented_at: string;
  due_date: string;
  is_overdue: boolean;
  remaining_days: number;
};

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ko-KR", { month: "short", day: "numeric", timeZone: "Asia/Seoul" });
}

function kstDateStr(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

// 대여 당일이면 취소 가능
function isCancelable(rentedAt: string): boolean {
  return kstDateStr(rentedAt) === new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

export default function MyRentalsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmTarget, setConfirmTarget] = useState<ActiveRental | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  const { data: rentals = [], isLoading } = useQuery({
    queryKey: ["myRentals"],
    queryFn: async () => {
      const data = await getMyRentals();
      return data.active_rentals as ActiveRental[];
    },
  });

  const overdueCount = rentals.filter((r) => r.is_overdue).length;

  const handleCancel = () => {
    if (!confirmTarget) return;
    setErrorMsg("");
    startTransition(async () => {
      const res = await cancelMyRental(confirmTarget.id);
      if (res.success) {
        setConfirmTarget(null);
        await queryClient.invalidateQueries({ queryKey: ["myRentals"] });
        await queryClient.invalidateQueries({ queryKey: ["mypage"] });
      } else {
        setErrorMsg(res.error ?? "대여 취소에 실패했습니다.");
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b bg-background px-[3vw] py-[1.5vh] flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1">
            <ChevronLeft className="size-[clamp(1.3rem,3vw,1.6rem)]" />
          </button>
          <h1 className="text-[clamp(1.3rem,3vw,1.8rem)] font-bold">대여중 도서</h1>
        </header>
        <main className="flex-1 overflow-y-auto px-[3vw] py-[1.5vh] space-y-[1vh] animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-lg border p-[clamp(0.75rem,1.5vw,1.25rem)]">
              <div className="flex gap-[clamp(0.6rem,1.5vw,1rem)]">
                <div className="w-[clamp(3.5rem,8vw,5rem)] h-[clamp(5rem,11vw,7rem)] bg-muted rounded shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-3 bg-muted rounded w-1/3 mt-auto" />
                  <div className="h-6 bg-muted rounded-full w-16" />
                </div>
              </div>
            </div>
          ))}
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="shrink-0 border-b bg-background px-[3vw] py-[1.5vh] flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1">
          <ChevronLeft className="size-[clamp(1.3rem,3vw,1.6rem)]" />
        </button>
        <h1 className="text-[clamp(1.3rem,3vw,1.8rem)] font-bold">대여중 도서</h1>
        <Badge variant="secondary" className="text-[clamp(0.85rem,1.8vw,1.05rem)]">
          {rentals.length}권
        </Badge>
      </header>

      <main className="flex-1 overflow-y-auto px-[3vw] py-[1.5vh] space-y-[1vh]">
        {rentals.length === 0 ? (
          <p className="text-[clamp(1.1rem,2.5vw,1.4rem)] text-muted-foreground text-center py-16">
            대출 중인 도서가 없습니다
          </p>
        ) : (
          <>
            {overdueCount > 0 && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 flex items-center gap-2">
                <AlertTriangle className="size-[clamp(1.1rem,2.5vw,1.4rem)] text-destructive shrink-0" />
                <p className="text-[clamp(0.95rem,2vw,1.2rem)] text-destructive font-medium">
                  연체 도서 {overdueCount}권이 있습니다. 빠른 반납 부탁드립니다.
                </p>
              </div>
            )}
            {rentals.map((rental) => (
              <Card
                key={rental.id}
                className="cursor-pointer active:scale-[0.98] transition-transform"
                onClick={() => router.push(`/books/${rental.book.id}`)}
              >
                <CardContent className="p-[clamp(0.75rem,1.5vw,1.25rem)]">
                  <div className="flex gap-[clamp(0.6rem,1.5vw,1rem)]">
                    {rental.book.cover_image ? (
                      <img src={rental.book.cover_image} alt={rental.book.title} className="w-[clamp(3.5rem,8vw,5rem)] h-[clamp(5rem,11vw,7rem)] object-cover rounded shrink-0" />
                    ) : (
                      <div className="w-[clamp(3.5rem,8vw,5rem)] h-[clamp(5rem,11vw,7rem)] bg-muted rounded shrink-0 flex items-center justify-center">
                        <BookOpen className="size-[clamp(1.5rem,3.5vw,2rem)] text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex flex-col gap-[0.3vh] min-w-0 flex-1">
                      <p className="text-[clamp(1.05rem,2.3vw,1.3rem)] font-semibold leading-tight line-clamp-2">{rental.book.title}</p>
                      <p className="text-[clamp(0.9rem,2vw,1.1rem)] text-muted-foreground truncate">{rental.book.author}</p>
                      <p className="text-[clamp(0.8rem,1.7vw,0.95rem)] text-muted-foreground mt-auto">
                        대출일: {formatShortDate(rental.rented_at)}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge
                          variant={rental.is_overdue ? "destructive" : rental.remaining_days <= 3 ? "default" : "secondary"}
                          className="text-[clamp(0.8rem,1.7vw,1rem)] px-2.5 py-0.5"
                        >
                          {rental.is_overdue ? (
                            <><AlertTriangle className="size-3 mr-1" />{Math.abs(rental.remaining_days)}일 연체</>
                          ) : rental.remaining_days === 0 ? "오늘 반납" : `D-${rental.remaining_days}`}
                        </Badge>
                        <span className={`text-[clamp(0.8rem,1.7vw,0.95rem)] ${rental.is_overdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                          {formatShortDate(rental.due_date)} 까지
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* 대여 당일이면 취소 버튼 */}
                  {isCancelable(rental.rented_at) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setErrorMsg(""); setConfirmTarget(rental); }}
                      className="mt-[clamp(0.6rem,1.2vh,1rem)] w-full flex items-center justify-center gap-1.5 rounded-lg border border-destructive/40 text-destructive py-[clamp(0.6rem,1.2vh,0.9rem)] text-[clamp(0.9rem,2vw,1.15rem)] font-medium active:bg-destructive/10 transition-colors"
                    >
                      <X className="size-[clamp(1rem,2.2vw,1.3rem)]" />
                      대여 취소
                    </button>
                  )}
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </main>

      {/* 대여 취소 확인 다이얼로그 */}
      {confirmTarget && (
        <div
          className="fixed inset-0 z-[160] bg-black/50 flex items-end sm:items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !isPending) setConfirmTarget(null); }}
        >
          <div className="w-full max-w-md rounded-2xl bg-background p-[clamp(1.2rem,4vw,2rem)] space-y-[clamp(0.8rem,2vh,1.2rem)]">
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-full bg-destructive/10 p-2.5">
                <AlertTriangle className="size-[clamp(1.4rem,3vw,1.8rem)] text-destructive" />
              </div>
              <div className="min-w-0">
                <h2 className="text-[clamp(1.2rem,3vw,1.6rem)] font-bold">대여를 취소할까요?</h2>
                <p className="text-[clamp(0.9rem,2vw,1.15rem)] text-muted-foreground mt-1 line-clamp-2">
                  「{confirmTarget.book.title}」
                </p>
              </div>
            </div>
            <p className="text-[clamp(0.85rem,1.9vw,1.1rem)] text-muted-foreground leading-relaxed">
              대여 기록이 삭제되고 대출 시 받은 젤리는 회수됩니다. 이 작업은 되돌릴 수 없습니다.
            </p>
            {errorMsg && (
              <p className="text-[clamp(0.85rem,1.9vw,1.1rem)] text-destructive font-medium">{errorMsg}</p>
            )}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1 h-[clamp(3rem,6vh,3.8rem)] text-[clamp(1rem,2.2vw,1.3rem)]"
                disabled={isPending}
                onClick={() => setConfirmTarget(null)}
              >
                닫기
              </Button>
              <Button
                variant="destructive"
                className="flex-1 h-[clamp(3rem,6vh,3.8rem)] text-[clamp(1rem,2.2vw,1.3rem)]"
                disabled={isPending}
                onClick={handleCancel}
              >
                {isPending ? <Loader2 className="size-5 animate-spin" /> : "대여 취소"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
