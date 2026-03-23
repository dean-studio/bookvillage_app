import { BottomNav } from "@/components/bottom-nav";
import { AutoLogout } from "@/components/auto-logout";
import { QueryProvider } from "@/components/query-provider";

export default function ResidentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <div className="flex h-dvh flex-col">
        <AutoLogout />
        <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
        <BottomNav />
      </div>
    </QueryProvider>
  );
}
