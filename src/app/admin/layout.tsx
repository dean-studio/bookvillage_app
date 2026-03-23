import Link from "next/link";
import { LayoutDashboard, BookPlus, BookCheck, BookDown, Settings } from "lucide-react";

const adminNav = [
  { href: "/admin", label: "대시보드", icon: LayoutDashboard },
  { href: "/admin/books/new", label: "도서 등록", icon: BookPlus },
  { href: "/admin/checkout", label: "대출", icon: BookCheck },
  { href: "/admin/return", label: "반납", icon: BookDown },
  { href: "/admin/manage", label: "관리", icon: Settings },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      {/* 사이드바 (PC) / 상단 탭 (모바일) */}
      <nav className="border-b md:border-b-0 md:border-r md:w-56 bg-muted/30">
        <div className="hidden md:block px-4 py-4">
          <h2 className="font-bold text-lg">관리자</h2>
        </div>
        <ul className="flex md:flex-col overflow-x-auto md:overflow-x-visible">
          {adminNav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-muted transition-colors whitespace-nowrap"
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* 콘텐츠 영역 */}
      <main className="flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
