"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LogOut, LayoutDashboard, BookPlus, BookCheck, BookDown, Settings, Trash2, AlertTriangle, Library, Users, Trophy, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminSignOut } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

type NavItem = { type?: "link"; href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean } | { type: "divider" };

const navItems: NavItem[] = [
  { href: "/admin", label: "대시보드", icon: LayoutDashboard, exact: true },
  { type: "divider" },
  { href: "/admin/residents", label: "주민 목록", icon: Users },
  { href: "/admin/rankings", label: "랭킹", icon: Trophy },
  { type: "divider" },
  { href: "/admin/books", label: "전체 도서", icon: Library, exact: true },
  { href: "/admin/rentals", label: "대여중 도서", icon: BookCheck, exact: true },
  { href: "/admin/books/new", label: "도서 등록", icon: BookPlus },
  { href: "/admin/checkout", label: "대출", icon: BookCheck },
  { type: "divider" },
  { href: "/admin/return", label: "반납", icon: BookDown },
  { href: "/admin/returns", label: "반납 내역", icon: ClipboardCheck },
  { type: "divider" },
  { href: "/admin/overdue", label: "연체 내역", icon: AlertTriangle },
  { href: "/admin/deletions", label: "도서 삭제내역", icon: Trash2 },
  { type: "divider" },
  { href: "/admin/manage", label: "관리", icon: Settings },
];

// 서재 관리 페이지에서는 데스크톱에서도 사이드바를 접음
const COLLAPSED_PATHS = ["/admin/books/new"];

export function AdminSidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const forceCollapsed = COLLAPSED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  // 페이지 이동 시 드로어 닫기
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const navContent = (
    <>
      <ul className="flex-1 py-2">
        {navItems.map((item, i) => {
          if (item.type === "divider") {
            return <li key={`div-${i}`} className="my-1 mx-4 border-t" />;
          }
          const isActive = item.exact ? pathname === item.href : (pathname === item.href || pathname.startsWith(item.href + "/"));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 text-base transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted"
                )}
              >
                <item.icon className="size-5" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="border-t p-4">
        <form action={adminSignOut}>
          <button
            type="submit"
            className="flex items-center gap-2 text-base text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <LogOut className="size-5" />
            로그아웃
          </button>
        </form>
      </div>
    </>
  );

  return (
    <>
      {/* 햄버거 바: 모바일 항상 + 데스크톱에서 forceCollapsed일 때 (좁은 아이콘 바) */}
      <div
        className={cn(
          "flex items-center justify-between border-b p-3",
          forceCollapsed
            ? "flex md:w-12 md:shrink-0 md:flex-col md:items-center md:justify-start md:border-b-0 md:border-r md:p-2 md:pt-4"
            : "flex md:hidden"
        )}
      >
        <h2 className={cn("font-bold text-lg", forceCollapsed && "md:hidden")}>관리자</h2>
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
          <Menu className="size-5" />
        </Button>
      </div>

      {/* 오버레이 드로어 */}
      {open && (
        <div
          className={cn(
            "fixed inset-0 z-50",
            forceCollapsed ? "" : "md:hidden"
          )}
        >
          <div
            className="absolute inset-0 bg-black/40 animate-in fade-in duration-200"
            onClick={() => setOpen(false)}
          />
          <nav className="absolute left-0 top-0 bottom-0 w-64 bg-background border-r flex flex-col animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-bold text-lg">관리자</h2>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="size-5" />
              </Button>
            </div>
            {navContent}
          </nav>
        </div>
      )}

      {/* 데스크톱 고정 사이드바: forceCollapsed가 아닐 때만 */}
      {!forceCollapsed && (
        <nav className="hidden md:flex md:flex-col md:w-60 border-r bg-muted/30 shrink-0">
          <div className="flex items-center justify-between px-4 py-4">
            <h2 className="font-bold text-lg">관리자</h2>
            <form action={adminSignOut}>
              <button
                type="submit"
                className="flex items-center gap-1.5 text-base text-muted-foreground hover:text-foreground transition-colors"
              >
                <LogOut className="size-4" />
                로그아웃
              </button>
            </form>
          </div>
          <ul className="flex-1">
            {navItems.map((item, i) => {
              if (item.type === "divider") {
                return <li key={`div-${i}`} className="my-1 mx-4 border-t" />;
              }
              const isActive = item.exact ? pathname === item.href : (pathname === item.href || pathname.startsWith(item.href + "/"));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 px-4 py-3 text-base transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted"
                    )}
                  >
                    <item.icon className="size-5" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </>
  );
}
