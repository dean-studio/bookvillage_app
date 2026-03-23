"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertTriangle,
  ChevronLeft,
  Candy,
} from "lucide-react";
import { getMyRentals, getMyNotifications, markNotificationsRead } from "@/app/actions/rentals";
import { useQuery } from "@tanstack/react-query";

type NotificationItem = {
  id: string;
  book_title: string;
  due_date: string;
  status: "upcoming" | "due_today" | "overdue";
  days: number;
};

type PastRental = {
  id: string;
  book: { id: string; title: string; author: string; cover_image: string | null };
  has_report: boolean;
};

async function fetchNotificationsData() {
  const [notifResult, rentals] = await Promise.all([
    getMyNotifications(),
    getMyRentals(),
  ]);
  if (notifResult.unread_count > 0) {
    markNotificationsRead().catch(() => {});
  }
  return {
    notifications: notifResult.notifications as NotificationItem[],
    unreportedBooks: (rentals.past_rentals as PastRental[]).filter((r) => !r.has_report),
  };
}

export default function MyNotificationsPage() {
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["myNotifications"],
    queryFn: fetchNotificationsData,
  });

  const notifications = data?.notifications ?? [];
  const unreportedBooks = data?.unreportedBooks ?? [];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="shrink-0 border-b bg-background px-[3vw] py-[1.5vh] flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1">
          <ChevronLeft className="size-[clamp(1.3rem,3vw,1.6rem)]" />
        </button>
        <h1 className="text-[clamp(1.3rem,3vw,1.8rem)] font-bold">알림</h1>
      </header>

      <main className="flex-1 overflow-y-auto px-[3vw] py-[1.5vh] space-y-[1vh]">
        {isLoading ? (
          <div className="space-y-[1vh] animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-lg border p-[clamp(0.75rem,1.5vw,1.25rem)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="h-5 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </div>
                  <div className="h-6 bg-muted rounded-full w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 && unreportedBooks.length === 0 ? (
          <p className="text-[clamp(1.1rem,2.5vw,1.4rem)] text-muted-foreground text-center py-16">
            알림이 없습니다
          </p>
        ) : (
          <>
            {notifications.map((n) => (
              <Card
                key={n.id}
                className={
                  n.status === "overdue"
                    ? "border-destructive/50 bg-destructive/5"
                    : n.status === "due_today"
                      ? "border-orange-400/50 bg-orange-50/50 dark:bg-orange-950/20"
                      : ""
                }
              >
                <CardContent className="p-[clamp(0.75rem,1.5vw,1.25rem)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[clamp(1.1rem,2.5vw,1.4rem)] font-semibold truncate">{n.book_title}</p>
                      <p className="text-[clamp(0.9rem,2vw,1.1rem)] text-muted-foreground mt-1">
                        반납 예정일: {n.due_date}
                      </p>
                    </div>
                    <Badge
                      variant={n.status === "overdue" ? "destructive" : n.status === "due_today" ? "default" : "secondary"}
                      className="text-[clamp(0.85rem,1.8vw,1.1rem)] px-3 py-1 shrink-0"
                    >
                      {n.status === "overdue" ? (
                        <><AlertTriangle className="size-3.5 mr-1" />{n.days}일 연체</>
                      ) : n.status === "due_today" ? "오늘 반납" : `D-${n.days}`}
                    </Badge>
                  </div>
                  <p className="text-[clamp(0.85rem,1.8vw,1rem)] text-muted-foreground mt-2">
                    {n.status === "overdue"
                      ? "연체 중입니다. 빠른 반납 부탁드립니다."
                      : n.status === "due_today"
                        ? "오늘이 반납일입니다. 잊지 마세요!"
                        : `반납까지 ${n.days}일 남았습니다.`}
                  </p>
                </CardContent>
              </Card>
            ))}

            {unreportedBooks.length > 0 && (
              <>
                {notifications.length > 0 && <div className="border-t my-1" />}
                {unreportedBooks.map((rental) => (
                  <Card
                    key={`report-${rental.id}`}
                    className="border-yellow-400/50 bg-yellow-50/50 dark:bg-yellow-950/20 cursor-pointer active:scale-[0.98] transition-transform"
                    onClick={() => router.push("/mypage/returned")}
                  >
                    <CardContent className="p-[clamp(0.75rem,1.5vw,1.25rem)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[clamp(1rem,2.2vw,1.3rem)] font-semibold truncate">{rental.book.title}</p>
                          <p className="text-[clamp(0.85rem,1.8vw,1rem)] text-muted-foreground mt-1">
                            독서록을 써보세요! 감상을 나누고 젤리도 받아가세요
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 bg-yellow-100 dark:bg-yellow-900/50 rounded-full px-2.5 py-1">
                          <Candy className="size-[clamp(0.85rem,1.8vw,1rem)] text-yellow-600" />
                          <span className="text-[clamp(0.8rem,1.7vw,0.95rem)] font-bold text-yellow-600">+10</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
