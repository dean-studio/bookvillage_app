"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Megaphone } from "lucide-react";
import { getNotices, markNoticesRead, type Notice } from "@/app/actions/notices";
import { useQuery } from "@tanstack/react-query";

async function fetchNotices() {
  const notices = await getNotices();
  markNoticesRead().catch(() => {}); // 진입 시 읽음 처리
  return notices;
}

export default function MyNoticesPage() {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);

  // ?id=xxx 로 진입하면 해당 공지 자동 펼침
  useEffect(() => {
    if (typeof window !== "undefined") {
      const id = new URLSearchParams(window.location.search).get("id");
      if (id) setOpenId(id);
    }
  }, []);

  const { data: notices = [], isLoading } = useQuery<Notice[]>({
    queryKey: ["notices"],
    queryFn: fetchNotices,
  });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="shrink-0 border-b bg-background px-[3vw] py-[1.5vh] flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1">
          <ChevronLeft className="size-[clamp(1.3rem,3vw,1.6rem)]" />
        </button>
        <h1 className="text-[clamp(1.3rem,3vw,1.8rem)] font-bold">공지사항</h1>
      </header>

      <main className="flex-1 overflow-y-auto px-[3vw] py-[1.5vh] space-y-[1.2vh]">
        {isLoading ? (
          <div className="space-y-[1.2vh] animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-xl border p-[clamp(1rem,2vw,1.5rem)]">
                <div className="h-5 bg-muted rounded w-2/3 mb-2" />
                <div className="h-4 bg-muted rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : notices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <Megaphone className="size-[clamp(3rem,8vw,4rem)] opacity-30" />
            <p className="text-[clamp(1rem,2.5vw,1.3rem)]">등록된 공지사항이 없습니다</p>
          </div>
        ) : (
          notices.map((n) => {
            const isOpen = openId === n.id;
            return (
              <div key={n.id} className="rounded-xl border overflow-hidden">
                <button
                  onClick={() => setOpenId(isOpen ? null : n.id)}
                  className="w-full text-left px-[clamp(1rem,2.5vw,1.5rem)] py-[clamp(0.9rem,2vh,1.3rem)] active:bg-muted/50 transition-colors"
                >
                  <p className="text-[clamp(1.1rem,2.6vw,1.4rem)] font-semibold">{n.title}</p>
                  <p className="text-[clamp(0.85rem,1.8vw,1.05rem)] text-muted-foreground mt-0.5">
                    {new Date(n.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
                  </p>
                </button>
                {isOpen && (
                  <div className="px-[clamp(1rem,2.5vw,1.5rem)] pb-[clamp(1rem,2.5vw,1.5rem)] space-y-3 border-t pt-3">
                    {n.image_url && (
                      <img src={n.image_url} alt="" className="w-full rounded-lg object-contain bg-muted" />
                    )}
                    {n.content && (
                      <p className="text-[clamp(1rem,2.3vw,1.25rem)] whitespace-pre-wrap leading-relaxed">
                        {n.content}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
