"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Megaphone } from "lucide-react";
import { getNotices, type Notice } from "@/app/actions/notices";

const DISMISSED_KEY = "dismissed_notice_id";

export function NoticePopup() {
  const router = useRouter();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    getNotices()
      .then((list) => {
        const latest = list[0];
        if (!latest) return;
        let dismissed: string | null = null;
        try { dismissed = localStorage.getItem(DISMISSED_KEY); } catch {}
        // 이미 닫은 공지(같은 id)면 안 보임. 새 공지면 다시 보임.
        if (dismissed === latest.id) return;
        setNotice(latest);
        // 다음 tick에 애니메이션용 visible
        setTimeout(() => setVisible(true), 50);
      })
      .catch(() => {});
  }, []);

  function close() {
    if (notice) {
      try { localStorage.setItem(DISMISSED_KEY, notice.id); } catch {}
    }
    setVisible(false);
    setTimeout(() => setNotice(null), 300);
  }

  function goDetail() {
    if (!notice) return;
    try { localStorage.setItem(DISMISSED_KEY, notice.id); } catch {}
    router.push(`/mypage/notices?id=${notice.id}`);
    setVisible(false);
    setTimeout(() => setNotice(null), 300);
  }

  if (!notice) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center pointer-events-none">
      {/* 배경 딤 */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 pointer-events-auto ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={close}
      />
      {/* 바텀시트 */}
      <div
        className={`relative w-full max-w-lg bg-background rounded-t-3xl shadow-2xl pointer-events-auto transition-transform duration-300 ${visible ? "translate-y-0" : "translate-y-full"}`}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <Megaphone className="size-[clamp(1.2rem,3vw,1.5rem)] text-primary" />
            <span className="text-[clamp(1rem,2.5vw,1.3rem)] font-bold">공지사항</span>
          </div>
          <button onClick={close} className="p-2 -mr-2 rounded-full active:bg-muted" aria-label="닫기">
            <X className="size-6" />
          </button>
        </div>

        <button onClick={goDetail} className="w-full text-left px-5 pb-3 active:opacity-70">
          {notice.image_url && (
            <img src={notice.image_url} alt="" className="w-full max-h-[45vh] object-contain rounded-xl mb-3 bg-muted" />
          )}
          <p className="text-[clamp(1.2rem,3vw,1.6rem)] font-bold line-clamp-2">{notice.title}</p>
          {notice.content && (
            <p className="text-[clamp(0.95rem,2.2vw,1.15rem)] text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap">
              {notice.content}
            </p>
          )}
          <p className="text-[clamp(0.9rem,2vw,1.1rem)] text-primary font-medium mt-2">자세히 보기 &rsaquo;</p>
        </button>

        <div className="px-5 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            onClick={close}
            className="w-full h-12 rounded-xl border text-[clamp(1rem,2.3vw,1.25rem)] font-medium active:bg-muted transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
