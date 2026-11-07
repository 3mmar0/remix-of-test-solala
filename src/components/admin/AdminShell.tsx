import { Link, useRouterState } from "@tanstack/react-router";
import {
  FileText,
  LayoutDashboard,
  LogOut,
  GraduationCap,
  ClipboardList,
  Settings2,
  Sprout,
  Menu,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { logoutAdmin } from "@/lib/cms/client-store";
import { useCms } from "@/lib/cms/CmsProvider";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";

const NAV: { to: "/admin" | "/admin/pages" | "/admin/courses" | "/admin/registrations" | "/admin/settings"; label: string; icon: typeof FileText; exact?: boolean }[] = [
  { to: "/admin", label: "نظرة عامة", icon: LayoutDashboard, exact: true },
  { to: "/admin/pages", label: "صفحات الموقع", icon: FileText },
  { to: "/admin/courses", label: "الدورات", icon: GraduationCap },
  { to: "/admin/registrations", label: "التسجيلات", icon: ClipboardList },
  { to: "/admin/settings", label: "إعدادات الموقع", icon: Settings2 },
];

export function AdminShell({ children, title, desc, actions }: { children: ReactNode; title: string; desc?: string; actions?: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { saving, lastSaveMode } = useCms();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div dir="rtl" className="admin-shell min-h-screen bg-muted text-forest">
      <Toaster position="top-center" richColors />
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-forest px-4 py-3 text-forest-foreground lg:hidden">
        <Link to="/admin" className="flex items-center gap-2 font-display font-bold"><Sprout className="h-5 w-5 text-gold" /> Solala Admin</Link>
        <Button variant="ghost" size="icon" aria-label={menuOpen ? "إغلاق القائمة" : "فتح القائمة"} aria-expanded={menuOpen} aria-controls="admin-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</Button>
      </div>
      <div className="mx-auto grid min-h-screen max-w-[1400px] lg:grid-cols-[260px_minmax(0,1fr)]">
        <main className="order-2 min-w-0 px-4 py-6 sm:px-8 lg:py-10">
          <header className="sticky top-14 z-30 -mt-6 mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-forest/10 bg-muted py-6 lg:top-0 lg:-mt-10">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide text-gold-dark">سجل التحرير · Solala</p>
              <h1 className="mt-1 break-words font-display text-2xl font-bold sm:text-3xl md:text-4xl">{title}</h1>
              {desc && <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">{desc}</p>}
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {actions}
              {saving ? <span className="text-primary">جاري الحفظ...</span> : null}
              {lastSaveMode === "server" && <span className="rounded-full bg-secondary px-3 py-1 text-primary">محفوظ على الخادم</span>}
            </div>
          </header>
          {children}
        </main>

        <aside id="admin-navigation" className={`${menuOpen ? "block" : "hidden"} order-1 border-b border-border bg-forest text-forest-foreground lg:block lg:border-b-0 lg:border-e lg:border-forest-foreground/20`}>
          <div className="flex flex-col px-4 py-4 sm:px-5 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:py-6">
            <Link to="/admin" className="mb-8 hidden items-center gap-3 px-2 lg:flex">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/20 text-gold">
                <Sprout className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-lg font-bold">Solala Admin</p>
                <p className="text-xs opacity-70">إدارة محتوى المنصة</p>
              </div>
            </Link>

            <nav className="flex flex-1 flex-col gap-1">
              {NAV.map(({ to, label, icon: Icon, exact }) => {
                const active = exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setMenuOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                      active ? "bg-gold/20 text-gold" : "opacity-80 hover:bg-forest-foreground/5 hover:opacity-100"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-6 space-y-2 border-t border-forest-foreground/10 pt-4">
              <Link to="/" className="block rounded-xl px-3 py-2 text-sm opacity-80 hover:bg-forest-foreground/5">
                عرض الموقع
              </Link>
              <Button
                variant="ghost"
                type="button"
                className="w-full justify-start text-sm opacity-80 hover:bg-forest-foreground/5 hover:text-forest-foreground"
                onClick={async () => {
                  await logoutAdmin();
                  window.location.href = "/admin/login";
                }}
              >
                <LogOut className="h-4 w-4" /> تسجيل الخروج
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function AdminField({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-forest">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const adminInput =
  "w-full rounded-xl border border-input bg-card px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
