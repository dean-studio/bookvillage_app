import { AdminSidebar } from "./admin-sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <AdminSidebar />
      <main className="flex-1 p-5 md:p-8 overflow-auto text-base md:text-lg admin-content">{children}</main>
    </div>
  );
}
