import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Layers, LayoutDashboard, LockKeyhole } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { isAdminAuthed } from "@/lib/cms/client-store";
import { useCms } from "@/lib/cms/CmsProvider";
import { CMS_PAGES } from "@/lib/cms/pages";
import { CONTENT_VERSION } from "@/lib/cms/schema";
import { adminMeta } from "@/lib/meta";

export const Route = createFileRoute("/admin/pages/")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !isAdminAuthed()) throw redirect({ to: "/admin/login" });
  },
  head: () => adminMeta("صفحات الموقع", "إدارة صفحات وأقسام منصة سلالة.", "/admin/pages"),
  component: AdminPages,
});

function AdminPages() {
  const { store } = useCms();
  return (
    <AdminShell title="صفحات الموقع" desc="اختر صفحة لتراها كما يراها الزائر، ثم اضغط على أي قسم لتعديل نصوصه وصوره ومشاهدة التغيير فوراً.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link to="/admin" className="flex flex-col rounded-2xl border border-border bg-card p-5 transition hover:border-primary/30">
          <LayoutDashboard className="h-6 w-6 text-primary" />
          <h2 className="mt-4 font-display text-lg font-bold">لوحة الإدارة</h2>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><LockKeyhole className="h-4 w-4" /> صفحة خاصة · تتطلب تسجيل الدخول</p>
          <span dir="ltr" className="mt-5 text-sm text-muted-foreground">/admin</span>
          <span className="mt-4 flex items-center gap-2 text-sm font-semibold text-primary">فتح لوحة الإدارة <ArrowLeft className="h-4 w-4" /></span>
        </Link>
        {CMS_PAGES.map((page) => {
          const edited = page.sections.filter((s) => {
            const row = store.sections.find((x) => x.key === s.id);
            return (row?.content as { _v?: number } | undefined)?._v === CONTENT_VERSION;
          }).length;
          const row = store.pages.find((p) => p.slug === page.slug);
          return (
            <div key={page.key} className="group relative flex flex-col rounded-2xl border border-forest/10 bg-card p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-gold/60">
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary">
                  <Layers className="h-5 w-5" />
                </span>
                <a href={page.slug} target="_blank" rel="noreferrer" title="فتح الصفحة" className="relative z-10 rounded-lg p-1.5 text-forest/40 hover:bg-muted hover:text-forest">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
              <h2 className="mt-4 font-display text-lg font-bold text-forest">{page.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{page.sections.length} أقسام قابلة للتعديل</p>
              <div className="mt-5 flex items-center justify-between border-t border-forest/10 pt-3 text-xs">
                <span dir="ltr" className="text-muted-foreground">{page.slug}</span>
                <span className="flex items-center gap-2">
                  {row && !row.published && <span className="rounded-full bg-gold/20 px-2 py-0.5 text-gold-dark">غير منشورة</span>}
                  {edited > 0 && <span className="rounded-full bg-secondary px-2 py-0.5 text-primary">معدّلة</span>}
                </span>
              </div>
              <Link
                to="/admin/pages/$pageKey"
                params={{ pageKey: page.key }}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-forest"
              >
                تحرير مع المعاينة المباشرة <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>
          );
        })}
      </div>
    </AdminShell>
  );
}
