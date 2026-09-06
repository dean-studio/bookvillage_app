"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, ChevronLeft, Loader2, BookHeart } from "lucide-react";
import { getMyBookReports } from "@/app/actions/book-reports";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Seoul",
  });
}

export default function MyReportsPage() {
  const router = useRouter();
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["myBookReports"],
    queryFn: getMyBookReports,
  });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="shrink-0 border-b bg-background px-[3vw] py-[1.5vh] flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1">
          <ChevronLeft className="size-[clamp(1.3rem,3vw,1.6rem)]" />
        </button>
        <h1 className="text-[clamp(1.3rem,3vw,1.8rem)] font-bold">내 독서록</h1>
        <Badge variant="secondary" className="text-[clamp(0.85rem,1.8vw,1.05rem)]">
          {reports.length}편
        </Badge>
      </header>

      <main className="flex-1 overflow-y-auto px-[3vw] py-[1.5vh] space-y-[1vh]">
        {isLoading && reports.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <BookHeart className="size-[clamp(2.5rem,6vw,3.5rem)] text-muted-foreground/40" />
            <p className="text-[clamp(1.1rem,2.5vw,1.4rem)] text-muted-foreground">
              아직 작성한 독서록이 없어요
            </p>
            <button
              onClick={() => router.push("/mypage/returned")}
              className="text-[clamp(0.95rem,2vw,1.2rem)] text-primary font-medium underline underline-offset-4"
            >
              반납한 책에 독서록 쓰러 가기
            </button>
          </div>
        ) : (
          reports.map((report) => (
            <Card key={report.id}>
              <CardContent className="p-[clamp(0.75rem,1.5vw,1.25rem)] space-y-[0.8vh]">
                <div
                  className="flex gap-[clamp(0.6rem,1.5vw,1rem)] cursor-pointer"
                  onClick={() => router.push(`/books/${report.book_id}`)}
                >
                  {report.book_cover_image ? (
                    <img
                      src={report.book_cover_image}
                      alt={report.book_title}
                      className="w-[clamp(3.5rem,8vw,5rem)] h-[clamp(5rem,11vw,7rem)] object-cover rounded shrink-0"
                    />
                  ) : (
                    <div className="w-[clamp(3.5rem,8vw,5rem)] h-[clamp(5rem,11vw,7rem)] bg-muted rounded shrink-0 flex items-center justify-center">
                      <BookOpen className="size-[clamp(1.5rem,3.5vw,2rem)] text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex flex-col gap-[0.3vh] min-w-0 flex-1">
                    <p className="text-[clamp(1.05rem,2.3vw,1.3rem)] font-semibold leading-tight line-clamp-2">
                      {report.book_title}
                    </p>
                    <div className="flex items-center gap-1 text-[clamp(1rem,2.3vw,1.35rem)] leading-none text-yellow-500">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span key={star} className={report.rating >= star ? "" : "text-muted-foreground/30"}>
                          {report.rating >= star ? "★" : "☆"}
                        </span>
                      ))}
                    </div>
                    <span className="text-[clamp(0.8rem,1.7vw,0.95rem)] text-muted-foreground mt-auto">
                      {formatDate(report.created_at)}
                    </span>
                  </div>
                </div>
                <p className="text-[clamp(0.95rem,2vw,1.2rem)] leading-relaxed whitespace-pre-wrap text-foreground/90 border-t pt-2.5">
                  {report.review}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}
