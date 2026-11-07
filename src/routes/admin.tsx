import { ClientOnly, Outlet, createFileRoute } from "@tanstack/react-router";
import { requireAdminSession } from "@/lib/admin-access";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;
    const path = location.pathname;
    if (path === "/admin/login") return;
    await requireAdminSession();
  },
});

function AdminLayout() {
  return <ClientOnly fallback={<div className="min-h-screen bg-muted" />}><Outlet /></ClientOnly>;
}
