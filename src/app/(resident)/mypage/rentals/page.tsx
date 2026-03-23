"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  BookOpen,
  AlertTriangle,
  ChevronLeft,
} from "lucide-react";
import { getMyRentals } from "@/app/actions/rentals";
import { useQuery } from "@tanstack/react-query";

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

export default function MyRentalsPage() {
  const router = useRouter();

  const { data: rentals = [], isLoading } = useQuery({
    queryKey: ["myRentals"],
    queryFn: async () => {
      const data = await getMyRentals();
      return data.active_rentals as ActiveRental[];
    },
  });

  const overdueCount = rentals.filter((r) => r.is_overdue).length;

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
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
