import { Outlet, createFileRoute } from "@tanstack/react-router";
import { requireAdminSession } from "@/lib/admin-access";

export const Route = createFileRoute("/admin")({
  ssr: false,
  component: AdminLayout,
  beforeLoad: async ({ location }) => {
    const path = location.pathname;
    if (path === "/admin/login") return;
    await requireAdminSession();
  },
});

function AdminLayout() {
  return <Outlet />;
}
