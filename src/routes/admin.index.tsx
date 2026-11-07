import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { FileText, Download, GraduationCap, ClipboardList, Inbox } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { exportCmsJson } from "@/lib/cms/client-store";
import { useCms } from "@/lib/cms/CmsProvider";
import { adminDashboardOptions } from "@/lib/admin-dashboard";
import { CMS_PAGES } from "@/lib/cms/pages";
import { Button } from "@/components/ui/button";
import { adminMeta } from "@/lib/meta";

export const Route = createFileRoute("/admin/")({
  loader: ({ context }) => {
    return typeof window !== "undefined" ? context.queryClient.ensureQueryData(adminDashboardOptions) : undefined;
  },
  head: () => adminMeta("لوحة الإدارة", "ملخص صفحات ودورات وتسجيلات منصة سلالة.", "/admin"),
  component: AdminHome,
});

function AdminHome() {
  const { store } = useCms();
  const { data, isFetching, refetch } = useSuspenseQuery(adminDashboardOptions);

  return (
    <AdminShell
      title="نظرة عامة"
      actions={<Button variant="outline" size="sm" disabled={isFetching} onClick={() => void refetch()}>تحديث</Button>}
    >
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "صفحات الموقع", value: CMS_PAGES.length, to: "/admin/pages", icon: FileText },
              { label: "الدورات", value: data.courses, to: "/admin/courses", icon: GraduationCap },
              { label: "التسجيلات", value: data.registrations, to: "/admin/registrations", icon: ClipboardList },
              { label: "طلبات جديدة", value: data.newRegistrations, to: "/admin/registrations", icon: Inbox },
            ].map((c) => (
              <Link
                key={c.label}
                to={c.to}
                className="min-w-0 rounded-lg border border-border bg-card p-5 transition hover:border-primary/30"
              >
                <c.icon className="h-5 w-5 text-gold-dark" />
                <p className="mt-4 text-xs font-semibold text-muted-foreground">{c.label}</p>
                <p className="mt-1 truncate font-display text-xl font-bold text-forest">{c.value}</p>
              </Link>
            ))}
          </div>

          <section className="border-y border-border py-6">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-xl font-bold">أحدث التسجيلات</h2><Button asChild variant="link"><Link to="/admin/registrations">كل التسجيلات</Link></Button></div>
            <ul className="mt-4 divide-y divide-border">
              {data.recent.map((row) => <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="break-words font-semibold">{row.full_name}</p><p className="break-words text-sm text-muted-foreground">{row.course_title}</p></div><div className="text-sm text-muted-foreground"><p>{({ new: "جديد", contacted: "تم التواصل", accepted: "مقبول", closed: "مغلق" } as Record<string, string>)[row.state] ?? row.state}</p><time dateTime={row.created_at}>{new Date(row.created_at).toLocaleDateString("ar-EG")}</time></div></li>)}
            </ul>
            {!data.recent.length && <p className="py-6 text-sm text-muted-foreground">لا توجد تسجيلات حتى الآن.</p>}
            <p className="mt-4 text-sm text-muted-foreground">الدورات المنشورة: {data.publishedCourses} · المسودات: {data.courses - data.publishedCourses}</p>
          </section>
          <section className="py-2">
            <h2 className="font-display text-xl font-bold">سجل الموقع</h2>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">اسم المنصة</dt>
                <dd className="mt-1 font-semibold">{store.settings.siteName}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">الهاتف</dt>
                <dd className="mt-1 font-semibold" dir="ltr">
                  {store.settings.phone}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">الشعار</dt>
                <dd className="mt-1 leading-7 text-muted-foreground">{store.settings.tagline}</dd>
              </div>
            </dl>
            <Button className="mt-6" onClick={() => exportCmsJson(store)}>
              <Download className="h-4 w-4" /> تصدير JSON
            </Button>
          </section>

        </div>
    </AdminShell>
  );
}
