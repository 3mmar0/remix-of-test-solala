import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminField, AdminShell, adminInput } from "@/components/admin/AdminShell";
import { isAdminAuthed } from "@/lib/cms/client-store";
import { useCms } from "@/lib/cms/CmsProvider";
import type { SiteSettings } from "@/lib/cms/types";
import { adminMeta } from "@/lib/meta";

export const Route = createFileRoute("/admin/settings")({
  head: () => adminMeta("إعدادات الموقع", "إدارة بيانات وهوية وتواصل منصة سلالة.", "/admin/settings"),
  beforeLoad: () => {
    if (typeof window !== "undefined" && !isAdminAuthed()) {
      throw redirect({ to: "/admin/login" });
    }
  },
  component: AdminSettings,
});

function AdminSettings() {
  const { store, updateSettings, saving } = useCms();
  const [form, setForm] = useState<SiteSettings>(store.settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm(store.settings);
  }, [store.settings]);

  const set = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  };

  return (
    <AdminShell title="إعدادات الموقع" desc="بيانات التواصل والهوية الظاهرة في التذييل ووسوم SEO الافتراضية.">
      <form
        className="space-y-6 rounded-3xl border border-forest/10 bg-white p-6 shadow-soft md:p-8"
        onSubmit={async (e) => {
          e.preventDefault();
          await updateSettings(form);
          setSaved(true);
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <AdminField label="اسم الموقع">
            <input className={adminInput} value={form.siteName} onChange={(e) => set("siteName", e.target.value)} />
          </AdminField>
          <AdminField label="الشعار / Tagline">
            <input className={adminInput} value={form.tagline} onChange={(e) => set("tagline", e.target.value)} />
          </AdminField>
          <AdminField label="البريد الإلكتروني">
            <input className={adminInput} dir="ltr" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </AdminField>
          <AdminField label="الهاتف">
            <input className={adminInput} dir="ltr" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </AdminField>
          <AdminField label="العنوان">
            <input className={adminInput} value={form.address} onChange={(e) => set("address", e.target.value)} />
          </AdminField>
          <AdminField label="وصف SEO الافتراضي">
            <input className={adminInput} value={form.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} />
          </AdminField>
          <AdminField label="Facebook">
            <input className={adminInput} dir="ltr" value={form.facebook} onChange={(e) => set("facebook", e.target.value)} />
          </AdminField>
          <AdminField label="X / Twitter">
            <input className={adminInput} dir="ltr" value={form.twitter} onChange={(e) => set("twitter", e.target.value)} />
          </AdminField>
          <AdminField label="LinkedIn">
            <input className={adminInput} dir="ltr" value={form.linkedin} onChange={(e) => set("linkedin", e.target.value)} />
          </AdminField>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
          </button>
          {saved && <span className="text-sm text-primary">تم الحفظ</span>}
        </div>
      </form>
    </AdminShell>
  );
}
