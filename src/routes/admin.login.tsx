import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { Sprout } from "lucide-react";
import { loginAdmin } from "@/lib/cms/client-store";
import { adminInput } from "@/components/admin/AdminShell";
import { adminMeta } from "@/lib/meta";

export const Route = createFileRoute("/admin/login")({
  head: () => adminMeta("دخول الإدارة", "تسجيل الدخول الآمن إلى إدارة منصة سلالة.", "/admin/login"),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@solalaa.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await loginAdmin(email, password);
      navigate({ to: "/admin" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-forest px-4">
      <div className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-gold/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-10 h-80 w-80 rounded-full bg-primary-light/30 blur-3xl" />
      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-md rounded-3xl border border-white/10 bg-white/95 p-8 shadow-soft backdrop-blur"
      >
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-gold">
            <Sprout className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold text-forest">دخول لوحة الإدارة</h1>
            <p className="text-sm text-muted-foreground">إدارة إعدادات ومحتوى Solala</p>
          </div>
        </div>
        <label className="mb-4 block">
          <span className="mb-1.5 block text-sm font-medium text-forest">البريد الإلكتروني</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={adminInput} dir="ltr" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-forest">كلمة المرور</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={adminInput}
            placeholder="أدخل كلمة مرور الإدارة"
            autoFocus
          />
        </label>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <button type="submit" className="btn-primary mt-6 w-full justify-center" disabled={loading}>
          {loading ? "جاري التحقق..." : "دخول"}
        </button>
        <p className="mt-4 text-center text-xs text-muted-foreground">الدخول محمي عبر خادم Solala API.</p>
      </form>
    </div>
  );
}
