"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Candy, ChevronLeft } from "lucide-react";
import { getMyJelly, getMyJellyHistory } from "@/app/actions/jelly";
import { useQuery } from "@tanstack/react-query";

type JellyHistoryItem = {
  id: string;
  amount: number;
  reason: string;
  description: string | null;
  book_title: string | null;
  created_at: string;
};

function jellyReasonLabel(reason: string): string {
  switch (reason) {
    case "checkout": return "도서 대출";
    case "return": return "도서 반납";
    case "report": return "독서록 작성";
    case "quiz": return "퀴즈 정답";
    case "admin_give": return "관리자 지급";
    case "admin_deduct": return "관리자 차감";
    default: return reason;
  }
}

async function fetchJellyData() {
  const [jelly, hist] = await Promise.all([getMyJelly(), getMyJellyHistory()]);
  return {
    balance: jelly.balance,
    totalEarned: jelly.total_earned,
    history: hist as JellyHistoryItem[],
  };
}

export default function MyJellyPage() {
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["myJelly"],
    queryFn: fetchJellyData,
  });

  const balance = data?.balance ?? 0;
  const totalEarned = data?.totalEarned ?? 0;
  const history = data?.history ?? [];

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b bg-background px-[3vw] py-[1.5vh] flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1">
            <ChevronLeft className="size-[clamp(1.3rem,3vw,1.6rem)]" />
          </button>
          <h1 className="text-[clamp(1.3rem,3vw,1.8rem)] font-bold">내 젤리</h1>
        </header>
        <main className="flex-1 overflow-y-auto px-[3vw] py-[1.5vh] space-y-[1.5vh] animate-pulse">
          <div className="rounded-lg border p-[clamp(1rem,2vw,1.5rem)]">
            <div className="h-4 bg-muted rounded w-16 mb-2" />
            <div className="h-10 bg-muted rounded w-24" />
          </div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-lg border p-[clamp(0.75rem,1.5vw,1.25rem)]">
              <div className="flex items-center justify-between">
                <div className="space-y-2 flex-1">
                  <div className="h-5 bg-muted rounded w-24" />
                  <div className="h-3 bg-muted rounded w-32" />
                </div>
                <div className="h-6 bg-muted rounded w-10" />
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
        <h1 className="text-[clamp(1.3rem,3vw,1.8rem)] font-bold">내 젤리</h1>
      </header>

      <main className="flex-1 overflow-y-auto px-[3vw] py-[1.5vh] space-y-[1.5vh]">
        <Card className="border-yellow-400/50 bg-yellow-50/50 dark:bg-yellow-950/20">
          <CardContent className="p-[clamp(1rem,2vw,1.5rem)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[clamp(0.9rem,2vw,1.1rem)] text-muted-foreground">보유 젤리</p>
                <p className="text-[clamp(2rem,5vw,3rem)] font-bold text-yellow-600">
                  {balance.toLocaleString()}
                </p>
              </div>
              <Candy className="size-[clamp(2.5rem,5vw,3.5rem)] text-yellow-500" />
            </div>
            <p className="text-[clamp(0.8rem,1.7vw,0.95rem)] text-muted-foreground mt-1">
              총 획득: {totalEarned.toLocaleString()} 젤리
            </p>
          </CardContent>
        </Card>

        <div className="rounded-lg bg-muted/50 p-[clamp(0.8rem,1.5vw,1.2rem)]">
          <p className="text-[clamp(0.9rem,2vw,1.1rem)] font-medium mb-2">젤리 획득 방법</p>
          <div className="space-y-1.5 text-[clamp(0.8rem,1.7vw,0.95rem)] text-muted-foreground">
            <p>도서 대출 +5 / 반납 +5 / 독서록 작성 +10 / 퀴즈 정답 +3</p>
          </div>
        </div>

        <p className="text-[clamp(1rem,2.2vw,1.3rem)] font-semibold px-1">이력</p>
        {history.length === 0 ? (
          <p className="text-[clamp(1rem,2.2vw,1.3rem)] text-muted-foreground text-center py-12">
            젤리 이력이 없습니다
          </p>
        ) : (
          history.map((h) => (
            <Card key={h.id}>
              <CardContent className="p-[clamp(0.75rem,1.5vw,1.25rem)]">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[clamp(1rem,2.2vw,1.3rem)] font-medium">
                      {jellyReasonLabel(h.reason)}
                    </p>
                    {h.book_title && (
                      <p className="text-[clamp(0.85rem,1.8vw,1rem)] text-muted-foreground truncate">{h.book_title}</p>
                    )}
                    {h.description && (
                      <p className="text-[clamp(0.85rem,1.8vw,1rem)] text-muted-foreground truncate">{h.description}</p>
                    )}
                    <p className="text-[clamp(0.75rem,1.6vw,0.9rem)] text-muted-foreground mt-0.5">
                      {new Date(h.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "short", day: "numeric", hour: "numeric", minute: "numeric" })}
                    </p>
                  </div>
                  <span className={`text-[clamp(1.2rem,2.8vw,1.6rem)] font-bold shrink-0 ml-3 ${h.amount > 0 ? "text-yellow-600" : "text-destructive"}`}>
                    {h.amount > 0 ? "+" : ""}{h.amount}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}
