import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { FileText, GraduationCap, ClipboardList, Inbox, RefreshCw, ArrowLeft, Plus, CheckCircle2, CircleDashed, Users } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminDashboardOptions } from "@/lib/admin-dashboard";
import { CMS_PAGES } from "@/lib/cms/pages";
import { Button } from "@/components/ui/button";
import { adminMeta } from "@/lib/meta";

export const Route = createFileRoute("/admin/")({
  loader: ({ context }) => typeof window !== "undefined" ? context.queryClient.ensureQueryData(adminDashboardOptions) : undefined,
  head: () => adminMeta("لوحة الإدارة", "ملخص صفحات ودورات وتسجيلات منصة سلالة.", "/admin"),
  component: AdminHome,
});

const states: Record<string, string> = { new: "جديد", contacted: "تم التواصل", accepted: "مقبول", closed: "مغلق" };

function AdminHome() {
  const { data, isFetching, refetch } = useSuspenseQuery(adminDashboardOptions);
  return (
    <AdminShell title="لوحة الإدارة" actions={<Button variant="outline" size="sm" disabled={isFetching} onClick={() => void refetch()}><RefreshCw className={`h-4 w-4 ${isFetching ? "motion-safe:animate-spin" : ""}`} />تحديث البيانات</Button>}>
      <div className="space-y-8">
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="إحصائيات المنصة">
          {[
            { label: "صفحات الموقع", value: CMS_PAGES.length, detail: "إدارة المحتوى", to: "/admin/pages", icon: FileText },
            { label: "إجمالي الدورات", value: data.courses, detail: `${data.publishedCourses} دورة منشورة`, to: "/admin/courses", icon: GraduationCap },
            { label: "التسجيلات", value: data.registrations, detail: "جميع طلبات الالتحاق", to: "/admin/registrations", icon: Users },
            { label: "طلبات جديدة", value: data.newRegistrations, detail: "بانتظار المتابعة", to: "/admin/registrations", icon: Inbox },
          ].map((item) => (
            <Link key={item.label} to={item.to} className="group min-w-0 rounded-lg border border-border bg-card p-4 transition hover:border-primary/40 sm:p-5">
              <div className="flex items-center justify-between gap-2"><span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-primary"><item.icon className="h-5 w-5" /></span><ArrowLeft className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" /></div>
              <p className="mt-5 text-sm font-medium text-muted-foreground">{item.label}</p>
              <p className="mt-2 font-display text-3xl font-bold tabular-nums sm:text-4xl">{item.value.toLocaleString("ar-EG")}</p>
              <p className="mt-3 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">{item.detail}</p>
            </Link>
          ))}
        </section>

        <section className="flex flex-wrap items-center justify-between gap-4 border-y border-border py-5">
          <h2 className="font-display text-lg font-bold">إدارة المنصة</h2>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/admin/pages"><FileText className="h-4 w-4" />تعديل صفحات الموقع</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to="/admin/courses"><Plus className="h-4 w-4" />إدارة الدورات</Link></Button>
            <Button asChild size="sm"><Link to="/admin/registrations"><ClipboardList className="h-4 w-4" />متابعة الطلبات</Link></Button>
          </div>
        </section>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_280px]">
          <section className="min-w-0">
            <div className="mb-5 flex items-center justify-between gap-3"><h2 className="font-display text-xl font-bold">أحدث التسجيلات</h2><Button asChild variant="link" size="sm"><Link to="/admin/registrations">عرض الكل<ArrowLeft className="h-4 w-4" /></Link></Button></div>
            {data.recent.length ? <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="hidden grid-cols-[minmax(0,1fr)_100px_110px] gap-4 border-b border-border bg-secondary/50 px-5 py-3 text-xs font-semibold text-muted-foreground sm:grid"><span>المتقدم / الدورة</span><span>الحالة</span><span>تاريخ التسجيل</span></div>
              <ul className="divide-y divide-border">{data.recent.map((row) => <li key={row.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_100px_110px] sm:items-center sm:gap-4 sm:px-5">
                <div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary font-semibold text-primary">{row.full_name.slice(0, 1)}</span><div className="min-w-0"><p className="break-words text-sm font-semibold">{row.full_name}</p><p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{row.course_title}</p></div></div>
                <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${row.state === "new" ? "bg-gold" : "bg-primary"}`} /><span className="text-xs font-medium">{states[row.state] ?? row.state}</span></div>
                <time className="text-xs text-muted-foreground" dateTime={row.created_at}>{new Date(row.created_at).toLocaleDateString("ar-EG")}</time>
              </li>)}</ul>
            </div> : <div className="flex min-h-56 flex-col items-center justify-center gap-3 border-y border-border text-muted-foreground"><Inbox className="h-8 w-8" /><p className="text-sm">لا توجد تسجيلات حتى الآن</p></div>}
          </section>
          <section className="border-t border-border pt-6 xl:border-s xl:border-t-0 xl:ps-8 xl:pt-0">
            <h2 className="font-display text-xl font-bold">حالة الدورات</h2>
            <dl className="mt-5 divide-y divide-border">
              <div className="flex items-center justify-between gap-3 py-4"><dt className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-5 w-5 text-primary" />منشورة</dt><dd className="text-2xl font-bold tabular-nums">{data.publishedCourses.toLocaleString("ar-EG")}</dd></div>
              <div className="flex items-center justify-between gap-3 py-4"><dt className="flex items-center gap-2 text-sm"><CircleDashed className="h-5 w-5 text-gold-dark" />مسودات</dt><dd className="text-2xl font-bold tabular-nums">{(data.courses - data.publishedCourses).toLocaleString("ar-EG")}</dd></div>
            </dl>
            <Button asChild variant="outline" className="mt-5 w-full"><Link to="/admin/courses">عرض الدورات<ArrowLeft className="h-4 w-4" /></Link></Button>
            <div className="mt-8 border-t border-border pt-5"><h3 className="flex items-center gap-2 text-sm font-semibold"><Inbox className="h-4 w-4 text-gold-dark" />طلبات بانتظار المتابعة</h3><p className="mt-3 text-3xl font-bold tabular-nums">{data.newRegistrations.toLocaleString("ar-EG")}</p><Button asChild variant="link" className="mt-2 px-0"><Link to="/admin/registrations">فتح التسجيلات<ArrowLeft className="h-4 w-4" /></Link></Button></div>
          </section>
        </div>
      </div>
    </AdminShell>
  );
}
