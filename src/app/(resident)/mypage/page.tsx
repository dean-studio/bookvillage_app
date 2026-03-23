"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  Bell,
  Candy,
  ChevronRight,
  Clock,
  FileText,
} from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { getMyPageData } from "@/app/actions/mypage";
import { useQuery } from "@tanstack/react-query";

export default function MyPage() {
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["mypage"],
    queryFn: getMyPageData,
  });

  const userName = data?.userName ?? "";
  const dongHo = data?.dongHo ?? "";
  const activeCount = data?.activeCount ?? 0;
  const overdueCount = data?.overdueCount ?? 0;
  const pastCount = data?.pastCount ?? 0;
  const unreportedCount = data?.unreportedCount ?? 0;
  const unreadNotif = data?.unreadNotif ?? 0;
  const notifCount = data?.notifCount ?? 0;
  const jellyBalance = data?.jellyBalance ?? 0;

  if (isLoading && !data) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden animate-pulse">
        {/* Header skeleton */}
        <header className="shrink-0 border-b bg-background px-[3vw] py-[2vh]">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-[clamp(1.5rem,3.5vw,2.2rem)] w-24 bg-muted rounded" />
              <div className="h-[clamp(1rem,2.2vw,1.3rem)] w-20 bg-muted rounded" />
            </div>
            <div className="flex items-center gap-3">
              <div className="size-[clamp(1.3rem,3vw,1.6rem)] bg-muted rounded-full" />
              <div className="h-[clamp(1.8rem,3.5vw,2.2rem)] w-20 bg-muted rounded-full" />
            </div>
          </div>
        </header>
        {/* Menu skeleton */}
        <div className="flex-1">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-[clamp(0.8rem,2vw,1.2rem)] px-[3vw] py-[clamp(1.2rem,2.5vh,1.8rem)] border-b">
              <div className="size-[clamp(1.3rem,3vw,1.6rem)] bg-muted rounded" />
              <div className="flex-1 h-[clamp(1.1rem,2.5vw,1.4rem)] bg-muted rounded w-28" />
              <div className="h-[clamp(1rem,2vw,1.2rem)] w-10 bg-muted rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const menuItems = [
    {
      href: "/mypage/rentals",
      icon: Clock,
      label: "대여중 도서",
      badge: activeCount > 0 ? `${activeCount}권` : undefined,
      badgeVariant: overdueCount > 0 ? "destructive" as const : "default" as const,
      sub: overdueCount > 0 ? `연체 ${overdueCount}권` : undefined,
      subColor: "text-destructive",
    },
    {
      href: "/mypage/returned",
      icon: CheckCircle2,
      label: "반납완료 도서",
      badge: pastCount > 0 ? `${pastCount}권` : undefined,
      badgeVariant: "secondary" as const,
    },
    {
      href: "/mypage/returned",
      icon: FileText,
      label: "독서록 쓰기",
      badge: unreportedCount > 0 ? `${unreportedCount}권` : undefined,
      badgeVariant: "default" as const,
      badgeClass: unreportedCount > 0 ? "bg-yellow-500 text-white" : "",
    },
    {
      href: "/mypage/notifications",
      icon: Bell,
      label: "알림",
      badge: unreadNotif > 0 ? `${unreadNotif}` : notifCount > 0 ? `${notifCount}` : undefined,
      badgeVariant: unreadNotif > 0 ? "destructive" as const : "secondary" as const,
    },
    {
      href: "/mypage/jelly",
      icon: Candy,
      label: "내 젤리",
      badge: `${jellyBalance.toLocaleString()}`,
      badgeVariant: "outline" as const,
      badgeClass: "border-yellow-500 text-yellow-600 font-bold",
    },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b bg-background px-[3vw] py-[2vh]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[clamp(1.5rem,3.5vw,2.2rem)] font-bold">{userName}</h1>
            <p className="text-[clamp(1rem,2.2vw,1.3rem)] text-muted-foreground mt-0.5">
              {dongHo}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* 알림 */}
            <button
              onClick={() => router.push("/mypage/notifications")}
              className="relative p-1"
            >
              <Bell className="size-[clamp(1.3rem,3vw,1.6rem)] text-muted-foreground" />
              {unreadNotif > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[clamp(0.65rem,1.3vw,0.8rem)] font-bold rounded-full min-w-[clamp(1.1rem,2.2vw,1.4rem)] h-[clamp(1.1rem,2.2vw,1.4rem)] flex items-center justify-center px-1">
                  {unreadNotif}
                </span>
              )}
            </button>
            {/* 젤리 잔액 */}
            <div className="flex items-center gap-1.5 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-400/50 rounded-full px-[clamp(0.7rem,1.5vw,1rem)] py-[clamp(0.3rem,0.8vh,0.5rem)]">
              <Candy className="size-[clamp(1rem,2.2vw,1.3rem)] text-yellow-500" />
              <span className="text-[clamp(1rem,2.2vw,1.3rem)] font-bold text-yellow-600">
                {jellyBalance.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {/* 연체 경고 */}
        {overdueCount > 0 && (
          <div className="mx-[3vw] mt-[1.5vh] rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 flex items-center gap-2">
            <AlertTriangle className="size-[clamp(1.1rem,2.5vw,1.4rem)] text-destructive shrink-0" />
            <p className="text-[clamp(0.95rem,2vw,1.2rem)] text-destructive font-medium">
              연체 도서 {overdueCount}권이 있습니다
            </p>
          </div>
        )}

        {/* 메뉴 리스트 */}
        <nav className="mt-[1vh]">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => router.push(item.href)}
              className="w-full flex items-center gap-[clamp(0.8rem,2vw,1.2rem)] px-[3vw] py-[clamp(1.2rem,2.5vh,1.8rem)] border-b hover:bg-muted/50 active:bg-muted transition-colors text-left"
            >
              <item.icon className="size-[clamp(1.3rem,3vw,1.6rem)] text-muted-foreground shrink-0" />
              <span className="text-[clamp(1.1rem,2.5vw,1.4rem)] font-medium flex-1">
                {item.label}
                {item.sub && (
                  <span className={`text-[clamp(0.85rem,1.8vw,1rem)] ml-2 ${item.subColor}`}>
                    {item.sub}
                  </span>
                )}
              </span>
              {item.badge && (
                <Badge
                  variant={item.badgeVariant}
                  className={`text-[clamp(0.85rem,1.8vw,1.05rem)] px-2.5 py-0.5 ${"badgeClass" in item ? item.badgeClass : ""}`}
                >
                  {item.badge}
                </Badge>
              )}
              <ChevronRight className="size-[clamp(1.1rem,2.5vw,1.4rem)] text-muted-foreground shrink-0" />
            </button>
          ))}
        </nav>

        {/* 로그아웃 */}
        <div className="px-[3vw] pt-[3vh]">
          <button
            onClick={async () => { await signOut(); }}
            className="w-full flex items-center gap-[clamp(0.8rem,2vw,1.2rem)] px-[clamp(0.5rem,1vw,0.8rem)] py-[clamp(1rem,2vh,1.5rem)] text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="size-[clamp(1.2rem,2.5vw,1.5rem)]" />
            <span className="text-[clamp(1rem,2.2vw,1.3rem)]">로그아웃</span>
          </button>
        </div>
      </main>
    </div>
  );
}
