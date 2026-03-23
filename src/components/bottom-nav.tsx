"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, User, Store } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/books", label: "도서", icon: BookOpen },
  { href: "/market", label: "장터", icon: Store },
  { href: "/mypage", label: "내 서재", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-10 border-t bg-background">
      <ul className="flex">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-3 text-sm transition-colors",
                  isActive
                    ? "text-primary font-semibold"
                    : "text-muted-foreground"
                )}
              >
                <item.icon className="size-6" />
                <span className="text-base">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
