import { createFileRoute, Link, redirect, useBlocker } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  Laptop,
  Loader2,
  MousePointerClick,
  RotateCcw,
  Save,
  Settings2,
  Smartphone,
  Tablet,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { SectionFieldsEditor, fieldInput } from "@/components/admin/fields";
import { isAdminAuthed, savePageContent, updatePageRow } from "@/lib/cms/client-store";
import { useCms } from "@/lib/cms/CmsProvider";
import { findCmsPage } from "@/lib/cms/pages";
import { PREVIEW_PARAM, isPreviewMessage, type PreviewSectionState } from "@/lib/cms/preview";
import { resolveContent, serializeContent, type PageDef, type SectionContent } from "@/lib/cms/schema";
import { savedSectionStates } from "@/lib/cms/use-section";

export const Route = createFileRoute("/admin/pages/$pageKey")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !isAdminAuthed()) throw redirect({ to: "/admin/login" });
  },
  head: () => ({ meta: [{ title: "تحرير الصفحة | لوحة تحكم Solala" }, { name: "robots", content: "noindex" }] }),
  component: PageEditorRoute,
});

function PageEditorRoute() {
  const { pageKey } = Route.useParams();
  const page = findCmsPage(pageKey);
  if (!page) {
    return (
      <div className="grid min-h-screen place-items-center bg-muted p-6 text-center">
        <div>
          <p className="font-display text-xl font-bold text-forest">الصفحة غير موجودة</p>
          <Link to="/admin/pages" className="btn-primary mt-4">كل الصفحات</Link>
        </div>
      </div>
    );
  }
  return <PageEditor key={page.key} page={page} />;
}

type Drafts = Record<string, PreviewSectionState>;
type Device = "desktop" | "tablet" | "mobile";
const DEVICE_WIDTH: Record<Device, string> = { desktop: "100%", tablet: "820px", mobile: "390px" };

function orderedIds(drafts: Drafts) {
  return Object.entries(drafts)
    .sort((a, b) => a[1].position - b[1].position)
    .map(([id]) => id);
}

function PageEditor({ page }: { page: PageDef }) {
  const { store, loading, refresh } = useCms();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [drafts, setDrafts] = useState<Drafts | null>(null);
  const [baseline, setBaseline] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [panel, setPanel] = useState<"sections" | "settings">("sections");
  const [device, setDevice] = useState<Device>("desktop");
  const [saving, setSaving] = useState(false);
  const [frameReady, setFrameReady] = useState(false);

  const defs = useMemo(() => Object.fromEntries(page.sections.map((d) => [d.id, d])), [page]);
  const defaults = useMemo(
    () => Object.fromEntries(page.sections.map((d) => [d.id, resolveContent(d) as SectionContent])),
    [page],
  );

  // Load the saved state once the site content has arrived.
  const resetFromStore = useCallback(() => {
    const saved = savedSectionStates(store, page);
    // Normalise positions to 0..n-1.
    const normalised: Drafts = {};
    orderedIds(saved).forEach((id, position) => {
      normalised[id] = { ...(saved[id] as PreviewSectionState), position };
    });
    setDrafts(normalised);
    setBaseline(JSON.stringify(normalised));
  }, [store, page]);

  useEffect(() => {
    if (!loading && drafts === null) resetFromStore();
  }, [loading, drafts, resetFromStore]);

  const dirty = drafts !== null && JSON.stringify(drafts) !== baseline;

  /* ---------- Live preview messaging ---------- */
  const post = useCallback((message: object) => {
    iframeRef.current?.contentWindow?.postMessage({ source: "solala-cms", ...message }, window.location.origin);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return;
      if (!isPreviewMessage(event.data)) return;
      if (event.data.type === "ready") setFrameReady(true);
      if (event.data.type === "select") {
        setActive(event.data.id);
        setPanel("sections");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (frameReady && drafts) post({ type: "draft", sections: drafts });
  }, [frameReady, drafts, post]);

  useEffect(() => {
    if (frameReady) post({ type: "focus", id: active, scroll: true });
  }, [frameReady, active, post]);

  /* ---------- Editing ---------- */
  const patch = (id: string, next: Partial<PreviewSectionState>) =>
    setDrafts((d) => (d ? { ...d, [id]: { ...(d[id] as PreviewSectionState), ...next } } : d));

  const move = (id: string, dir: -1 | 1) => {
    if (!drafts) return;
    const ids = orderedIds(drafts);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j] as string, ids[i] as string];
    const next: Drafts = {};
    ids.forEach((sid, position) => (next[sid] = { ...(drafts[sid] as PreviewSectionState), position }));
    setDrafts(next);
  };

  const save = useCallback(async () => {
    if (!drafts || saving) return;
    setSaving(true);
    try {
      const ids = orderedIds(drafts);
      const result = await savePageContent(
        {
          slug: page.slug,
          title: page.title,
          sections: ids.map((id, position) => ({
            key: id,
            label: defs[id]?.label ?? id,
            visible: (drafts[id] as PreviewSectionState).visible,
            position,
            content: serializeContent((drafts[id] as PreviewSectionState).content),
          })),
        },
        store.sections,
      );
      if (result.skipped.length) {
        toast.warning("تم حفظ جزء من التعديلات فقط", {
          description: `الأقسام التالية تحتاج تحديث الخادم قبل حفظها: ${result.skipped.join("، ")}`,
          duration: 10000,
        });
        await refresh();
      } else {
        setBaseline(JSON.stringify(drafts));
        toast.success("تم الحفظ — التعديلات ظاهرة الآن للزوار");
        await refresh();
      }
    } catch (e) {
      toast.error("تعذر الحفظ", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  }, [drafts, saving, page, defs, store.sections, refresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  useBlocker({
    shouldBlockFn: () => dirty && !window.confirm("لديك تعديلات غير محفوظة. هل تريد المغادرة دون حفظ؟"),
    enableBeforeUnload: dirty,
  });

  const ids = drafts ? orderedIds(drafts) : [];
  const activeDef = active ? defs[active] : undefined;
  const activeDraft = active && drafts ? drafts[active] : undefined;

  return (
    <div className="flex min-h-dvh flex-col bg-muted text-forest lg:h-dvh lg:min-h-0">
      <Toaster position="top-center" richColors />
      {/* Top bar */}
      <header className="flex flex-wrap items-center gap-3 border-b border-forest/10 bg-card px-4 py-2.5">
        <Link to="/admin/pages" className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-forest/70 hover:bg-muted hover:text-forest">
          <ChevronRight className="h-4 w-4" /> الصفحات
        </Link>
        <div className="min-w-0">
          <h1 className="truncate font-display text-lg font-bold leading-tight">{page.title}</h1>
          <p className="text-xs text-muted-foreground" dir="ltr">{page.slug}</p>
        </div>

        <div className="mx-auto flex items-center rounded-xl bg-muted p-1">
          {([
            ["desktop", Laptop, "حاسوب"],
            ["tablet", Tablet, "جهاز لوحي"],
            ["mobile", Smartphone, "جوال"],
          ] as const).map(([d, Icon, label]) => (
            <Button
              variant="ghost"
              size="icon"
              key={d}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={device === d}
              onClick={() => setDevice(d)}
              className={`rounded-lg px-3 py-1.5 transition ${device === d ? "bg-card text-primary shadow-sm" : "text-forest/50 hover:text-forest"}`}
            >
              <Icon className="h-4 w-4" />
            </Button>
          ))}
        </div>

        <div className="ms-auto flex flex-wrap items-center gap-2">
          {dirty ? (
            <span className="hidden items-center gap-1.5 rounded-full bg-gold/20 px-3 py-1 text-xs font-semibold text-gold-dark sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-gold-dark" /> تعديلات غير محفوظة
            </span>
          ) : drafts ? (
            <span className="hidden rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary sm:inline-flex">محفوظ</span>
          ) : null}
          <a
            href={page.slug}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg p-2 text-forest/60 hover:bg-muted hover:text-forest"
            title="فتح الصفحة في نافذة جديدة"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => resetFromStore()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-forest/15 px-3 py-2 text-sm font-medium text-forest/80 hover:bg-muted disabled:opacity-40"
          >
            <Undo2 className="h-4 w-4" /> تراجع
          </button>
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => void save()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-forest disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            حفظ ونشر
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[400px_minmax(0,1fr)]">
        {/* Side panel */}
        <aside className="flex min-h-0 max-h-[65dvh] flex-col border-forest/10 bg-card lg:max-h-none lg:border-e">
          {!drafts ? (
            <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : activeDef && activeDraft ? (
            <>
              <div className="flex items-center gap-2 border-b border-forest/10 px-3 py-3">
                <button type="button" onClick={() => setActive(null)} className="rounded-lg p-1.5 text-forest/60 hover:bg-muted" aria-label="رجوع لقائمة الأقسام">
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-gold-dark">تحرير القسم</p>
                  <h2 className="truncate font-display font-bold">{activeDef.label}</h2>
                </div>
                <label className="flex items-center gap-2 text-xs text-forest/70">
                  {activeDraft.visible ? "ظاهر" : "مخفي"}
                  <Switch checked={activeDraft.visible} onCheckedChange={(v) => patch(activeDef.id, { visible: v })} />
                </label>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                {activeDef.description && <p className="mb-4 rounded-xl bg-secondary/60 px-3 py-2 text-xs leading-6 text-primary">{activeDef.description}</p>}
                <SectionFieldsEditor
                  fields={activeDef.fields}
                  value={activeDraft.content}
                  defaults={defaults[activeDef.id] ?? {}}
                  onChange={(content) => patch(activeDef.id, { content })}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("استرجاع كل محتوى هذا القسم إلى النص الأصلي؟")) patch(activeDef.id, { content: defaults[activeDef.id] ?? {} });
                  }}
                  className="mt-6 inline-flex items-center gap-1.5 text-xs text-forest/50 hover:text-destructive"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> استرجاع القسم للمحتوى الأصلي
                </button>
              </div>
            </>
          ) : panel === "settings" ? (
            <PageSettingsPanel page={page} onBack={() => setPanel("sections")} />
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-forest/10 px-4 py-3">
                <div>
                  <h2 className="font-display font-bold">أقسام الصفحة</h2>
                  <p className="text-xs text-muted-foreground">{ids.length} أقسام · اضغط على أي قسم لتحريره</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPanel("settings")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-forest/15 px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  <Settings2 className="h-3.5 w-3.5" /> إعدادات الصفحة
                </button>
              </div>
              <ol className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
                {ids.map((id, index) => {
                  const def = defs[id];
                  const state = drafts[id] as PreviewSectionState;
                  if (!def) return null;
                  return (
                    <li
                      key={id}
                      onMouseEnter={() => frameReady && post({ type: "focus", id, scroll: false })}
                      className={`group flex items-center gap-2 rounded-xl border p-2 transition ${state.visible ? "border-forest/10 bg-card hover:border-primary/40" : "border-dashed border-forest/15 bg-muted/50"}`}
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-bold text-primary">{index + 1}</span>
                      <button type="button" onClick={() => setActive(id)} className="min-w-0 flex-1 text-right">
                        <span className={`block truncate text-sm font-semibold ${state.visible ? "" : "text-forest/45 line-through"}`}>{def.label}</span>
                        {def.description && <span className="block truncate text-[11px] text-muted-foreground">{def.description}</span>}
                      </button>
                      <div className="flex shrink-0 items-center opacity-70 transition group-hover:opacity-100">
                        <SmallBtn label={state.visible ? "إخفاء" : "إظهار"} onClick={() => patch(id, { visible: !state.visible })}>
                          {state.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        </SmallBtn>
                        <SmallBtn label="لأعلى" disabled={index === 0} onClick={() => move(id, -1)}><ArrowUp className="h-3.5 w-3.5" /></SmallBtn>
                        <SmallBtn label="لأسفل" disabled={index === ids.length - 1} onClick={() => move(id, 1)}><ArrowDown className="h-3.5 w-3.5" /></SmallBtn>
                        <SmallBtn label="تحرير" onClick={() => setActive(id)}><ChevronLeft className="h-4 w-4" /></SmallBtn>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <p className="flex items-center gap-2 border-t border-forest/10 px-4 py-3 text-[11px] text-muted-foreground">
                <MousePointerClick className="h-3.5 w-3.5" /> يمكنك أيضاً الضغط على أي قسم داخل المعاينة لفتحه.
              </p>
            </>
          )}
        </aside>

        {/* Live preview */}
        <section className="relative h-[70dvh] min-w-0 overflow-auto bg-muted p-3 lg:h-auto lg:min-h-0">
          <div
            className="mx-auto h-full overflow-hidden rounded-xl border border-forest/10 bg-background shadow-soft transition-[width] duration-300"
            style={{ width: DEVICE_WIDTH[device], maxWidth: "100%" }}
          >
            <iframe
              ref={iframeRef}
              title={`معاينة ${page.title}`}
              src={`${page.slug}?${PREVIEW_PARAM}=1`}
              className="h-full w-full"
              onLoad={() => setFrameReady(false)}
            />
          </div>
          {!frameReady && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm text-muted-foreground shadow-soft">
                <Loader2 className="h-4 w-4 animate-spin" /> جاري تحميل المعاينة…
              </span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SmallBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-md p-1.5 text-forest/50 transition hover:bg-muted hover:text-forest disabled:opacity-25"
    >
      {children}
    </button>
  );
}

function PageSettingsPanel({ page, onBack }: { page: PageDef; onBack: () => void }) {
  const { store, refresh } = useCms();
  const row = store.pages.find((p) => p.slug === page.slug);
  const [form, setForm] = useState({
    title: row?.title || page.title,
    description: row?.description || "",
    published: row?.published ?? true,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!row?.id) return;
    setSaving(true);
    try {
      await updatePageRow({
        id: row.id,
        title: form.title,
        description: form.description,
        heroTitle: row.heroTitle ?? "",
        heroSubtitle: row.heroSubtitle ?? "",
        published: form.published,
      });
      toast.success("تم حفظ إعدادات الصفحة");
      await refresh();
    } catch (e) {
      toast.error("تعذر الحفظ", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 border-b border-forest/10 px-3 py-3">
        <button type="button" onClick={onBack} className="rounded-lg p-1.5 text-forest/60 hover:bg-muted" aria-label="رجوع">
          <ChevronRight className="h-5 w-5" />
        </button>
        <h2 className="font-display font-bold">إعدادات الصفحة</h2>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        {!row?.id ? (
          <p className="rounded-xl bg-gold/15 p-3 text-sm leading-7 text-gold-dark">
            هذه الصفحة غير مسجلة بعد على الخادم. احفظ أي تعديل على أقسامها أولاً، ثم عد لهذه الإعدادات.
          </p>
        ) : null}
        <div>
          <span className="mb-1.5 block text-[13px] font-semibold">اسم الصفحة</span>
          <input className={fieldInput} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div>
          <span className="mb-1.5 block text-[13px] font-semibold">وصف الصفحة لمحركات البحث</span>
          <textarea rows={4} className={`${fieldInput} leading-7`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <label className="flex items-center justify-between rounded-xl border border-forest/10 p-3">
          <span>
            <span className="block text-sm font-semibold">منشورة</span>
            <span className="text-xs text-muted-foreground">عند الإيقاف يظهر للزوار المحتوى الأصلي لهذه الصفحة.</span>
          </span>
          <Switch checked={form.published} onCheckedChange={(v) => setForm({ ...form, published: v })} />
        </label>
        <button
          type="button"
          disabled={!row?.id || saving}
          onClick={() => void save()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-forest disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ الإعدادات
        </button>
      </div>
    </>
  );
}
