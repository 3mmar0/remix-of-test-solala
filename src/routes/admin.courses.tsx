import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronDown,
  Clock,
  Copy,
  ExternalLink,
  FolderTree,
  GraduationCap,
  Layers,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { ImageInput, fieldInput } from "@/components/admin/fields";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { adminMeta } from "@/lib/meta";
import { isAdminAuthed } from "@/lib/cms/client-store";
import { coursesApi, makeSlug, type AdminCategory, type AdminCourse, type AdminSpecialty } from "@/lib/courses-admin";

export const Route = createFileRoute("/admin/courses")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !isAdminAuthed()) throw redirect({ to: "/admin/login" });
  },
  head: () => adminMeta("إدارة الدورات", "إدارة دورات وتخصصات وتصنيفات منصة سلالة.", "/admin/courses"),
  component: CoursesAdmin,
});

type Selection = { type: "all" } | { type: "category"; id: number } | { type: "specialty"; id: number };
type Row = { course: AdminCourse; specialty: AdminSpecialty; category: AdminCategory };
type Confirm = { title: string; description: string; action: () => Promise<void> } | null;

function errorText(e: unknown) {
  return e instanceof Error ? e.message : "حدث خطأ غير متوقع";
}

function CoursesAdmin() {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>({ type: "all" });
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "published" | "draft">("all");
  const [courseEditor, setCourseEditor] = useState<{ course?: AdminCourse; specialtyId?: number } | null>(null);
  const [categoryDialog, setCategoryDialog] = useState<{ category?: AdminCategory } | null>(null);
  const [specialtyDialog, setSpecialtyDialog] = useState<{ specialty?: AdminSpecialty; categoryId?: number } | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    try {
      const r = await coursesApi.list();
      setCategories(r.categories);
      setLoadError(null);
    } catch (e) {
      setLoadError(errorText(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const rows = useMemo<Row[]>(
    () => categories.flatMap((category) => category.specialties.flatMap((specialty) => specialty.courses.map((course) => ({ course, specialty, category })))),
    [categories],
  );
  const specialtyById = useMemo(() => {
    const map = new Map<number, { specialty: AdminSpecialty; category: AdminCategory }>();
    categories.forEach((category) => category.specialties.forEach((specialty) => map.set(specialty.id, { specialty, category })));
    return map;
  }, [categories]);

  const scoped = rows.filter((r) =>
    selection.type === "all" ? true : selection.type === "category" ? r.category.id === selection.id : r.specialty.id === selection.id,
  );
  const q = search.trim();
  const visible = scoped.filter(
    (r) =>
      (status === "all" || (status === "published" ? r.course.published : !r.course.published)) &&
      (!q || `${r.course.title} ${r.course.trainer} ${r.course.slug} ${r.course.badge}`.includes(q)),
  );
  const canReorder = selection.type === "specialty" && !q && status === "all";

  const selectedSpecialty = selection.type === "specialty" ? specialtyById.get(selection.id) : undefined;
  const selectedCategory = selection.type === "category" ? categories.find((c) => c.id === selection.id) : selectedSpecialty?.category;
  const heading =
    selection.type === "all" ? "كل الدورات" : selection.type === "category" ? (selectedCategory?.title ?? "") : (selectedSpecialty?.specialty.title ?? "");

  const run = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      toast.success(success);
      await load();
    } catch (e) {
      toast.error("تعذر تنفيذ العملية", { description: errorText(e) });
    }
  };

  const coursePayload = (r: Row, patch: Partial<AdminCourse> = {}) => ({ ...r.course, ...patch, image: (patch.image ?? r.course.image) || null, specialtyId: r.specialty.id });

  const togglePublished = async (r: Row) => {
    setBusyId(r.course.id);
    await run(() => coursesApi.updateCourse(r.course.id, coursePayload(r, { published: !r.course.published })), r.course.published ? "تم تحويل الدورة إلى مسودة" : "تم نشر الدورة");
    setBusyId(null);
  };

  const moveCourse = async (r: Row, dir: -1 | 1) => {
    const list = r.specialty.courses;
    const i = list.findIndex((c) => c.id === r.course.id);
    const other = list[i + dir];
    if (!other) return;
    setBusyId(r.course.id);
    try {
      // Normalise positions to the current visual order, then swap the two.
      const order = list.map((c) => c.id);
      [order[i], order[i + dir]] = [order[i + dir] as number, order[i] as number];
      await Promise.all(
        order.map((id, position) => {
          const course = list.find((c) => c.id === id) as AdminCourse;
          return course.position === position && id !== r.course.id && id !== other.id
            ? Promise.resolve()
            : coursesApi.updateCourse(id, { ...course, image: course.image || null, position, specialtyId: r.specialty.id });
        }),
      );
      await load();
    } catch (e) {
      toast.error("تعذر تغيير الترتيب", { description: errorText(e) });
    } finally {
      setBusyId(null);
    }
  };

  const duplicate = (r: Row) =>
    run(
      () =>
        coursesApi.createCourse({
          ...r.course,
          image: r.course.image || null,
          title: `${r.course.title} (نسخة)`,
          slug: `${r.course.slug}-copy-${Date.now().toString(36).slice(-4)}`,
          published: false,
          specialtyId: r.specialty.id,
        }),
      "تم إنشاء نسخة كمسودة",
    );

  const askDeleteCourse = (r: Row) =>
    setConfirm({
      title: `حذف «${r.course.title}»؟`,
      description: "سيتم حذف الدورة ومحاورها نهائياً. طلبات التسجيل السابقة تبقى محفوظة.",
      action: () => run(() => coursesApi.deleteCourse(r.course.id), "تم حذف الدورة"),
    });

  const askDeleteCategory = (c: AdminCategory) => {
    const count = c.specialties.reduce((n, s) => n + s.courses.length, 0);
    setConfirm({
      title: `حذف تصنيف «${c.title}»؟`,
      description: `سيتم حذف ${c.specialties.length} تخصصات و${count} دورة بداخله نهائياً.`,
      action: async () => {
        await run(() => coursesApi.deleteCategory(c.id), "تم حذف التصنيف");
        setSelection({ type: "all" });
      },
    });
  };

  const askDeleteSpecialty = (s: AdminSpecialty) =>
    setConfirm({
      title: `حذف تخصص «${s.title}»؟`,
      description: `سيتم حذف ${s.courses.length} دورة بداخله نهائياً.`,
      action: async () => {
        await run(() => coursesApi.deleteSpecialty(s.id), "تم حذف التخصص");
        setSelection({ type: "all" });
      },
    });

  const totals = {
    categories: categories.length,
    specialties: categories.reduce((n, c) => n + c.specialties.length, 0),
    courses: rows.length,
    published: rows.filter((r) => r.course.published).length,
  };

  const noSpecialties = totals.specialties === 0;

  return (
    <AdminShell
      title="الدورات والتدريبات"
      desc="رتّب التصنيفات والتخصصات، وأضف الدورات وعدّلها وانشرها من مكان واحد."
      actions={
        <button
          type="button"
          disabled={noSpecialties}
          onClick={() => setCourseEditor({ ...(selection.type === "specialty" ? { specialtyId: selection.id } : {}) })}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:bg-forest disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> دورة جديدة
        </button>
      }
    >
      {loading ? (
        <div className="grid place-items-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : loadError ? (
        <div className="rounded-3xl border border-destructive/20 bg-card p-10 text-center shadow-soft">
          <p className="font-display text-lg font-bold">تعذر تحميل الدورات</p>
          <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
          <button type="button" onClick={() => { setLoading(true); void load(); }} className="btn-primary mt-6">
            <RefreshCw className="h-4 w-4" /> إعادة المحاولة
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={FolderTree} label="التصنيفات" value={totals.categories} />
            <Stat icon={Layers} label="التخصصات" value={totals.specialties} />
            <Stat icon={BookOpen} label="الدورات" value={totals.courses} />
            <Stat icon={GraduationCap} label="المنشورة" value={totals.published} accent />
          </div>

          <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
            {/* Catalog tree */}
            <aside className="h-fit rounded-3xl border border-forest/10 bg-card p-3 shadow-soft">
              <div className="mb-2 flex items-center justify-between px-2 pt-1">
                <h2 className="font-display font-bold">هيكل الكتالوج</h2>
                <button
                  type="button"
                  onClick={() => setCategoryDialog({})}
                  className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-secondary/70"
                >
                  <Plus className="h-3.5 w-3.5" /> تصنيف
                </button>
              </div>
              <TreeButton active={selection.type === "all"} onClick={() => setSelection({ type: "all" })} label="كل الدورات" count={rows.length} />
              <div className="mt-1 space-y-1">
                {categories.map((cat) => {
                  const open = expanded[cat.id] ?? true;
                  const count = cat.specialties.reduce((n, s) => n + s.courses.length, 0);
                  return (
                    <div key={cat.id}>
                      <div className="group flex items-center">
                        <button type="button" onClick={() => setExpanded({ ...expanded, [cat.id]: !open })} className="rounded-md p-1 text-forest/40 hover:text-forest" aria-label="توسيع">
                          <ChevronDown className={`h-4 w-4 transition ${open ? "" : "rotate-90"}`} />
                        </button>
                        <TreeButton
                          active={selection.type === "category" && selection.id === cat.id}
                          onClick={() => setSelection({ type: "category", id: cat.id })}
                          label={cat.title}
                          count={count}
                          draft={!cat.published}
                          bold
                        />
                        <RowMenu onEdit={() => setCategoryDialog({ category: cat })} onDelete={() => askDeleteCategory(cat)} />
                      </div>
                      {open && (
                        <div className="ms-6 space-y-0.5 border-s border-forest/10 ps-2">
                          {cat.specialties.map((sp) => (
                            <div key={sp.id} className="group flex items-center">
                              <TreeButton
                                active={selection.type === "specialty" && selection.id === sp.id}
                                onClick={() => setSelection({ type: "specialty", id: sp.id })}
                                label={sp.title}
                                count={sp.courses.length}
                                draft={!sp.published}
                              />
                              <RowMenu onEdit={() => setSpecialtyDialog({ specialty: sp, categoryId: cat.id })} onDelete={() => askDeleteSpecialty(sp)} />
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => setSpecialtyDialog({ categoryId: cat.id })}
                            className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary/80 hover:bg-secondary/60"
                          >
                            <Plus className="h-3.5 w-3.5" /> إضافة تخصص
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {categories.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">ابدأ بإضافة أول تصنيف.</p>}
              </div>
            </aside>

            {/* Course list */}
            <section className="min-w-0 rounded-3xl border border-forest/10 bg-card shadow-soft">
              <div className="flex flex-wrap items-center gap-3 border-b border-forest/10 p-4">
                <div className="me-auto min-w-0">
                  {selection.type === "specialty" && selectedSpecialty && (
                    <p className="text-xs text-muted-foreground">{selectedSpecialty.category.title}</p>
                  )}
                  <h2 className="truncate font-display text-xl font-bold">{heading}</h2>
                </div>
                <label className="relative min-w-0 w-full sm:w-56">
                  <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-forest/35" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو المدرب…" className={`${fieldInput} w-full ps-9`} />
                </label>
                <div className="flex rounded-xl bg-muted p-1 text-xs font-semibold">
                  {([
                    ["all", "الكل"],
                    ["published", "منشورة"],
                    ["draft", "مسودات"],
                  ] as const).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setStatus(v)}
                      className={`rounded-lg px-3 py-1.5 transition ${status === v ? "bg-card text-primary shadow-sm" : "text-forest/55 hover:text-forest"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {visible.length === 0 ? (
                <div className="px-6 py-20 text-center">
                  <BookOpen className="mx-auto h-10 w-10 text-forest/20" />
                  <p className="mt-3 font-semibold">{scoped.length === 0 ? "لا توجد دورات هنا بعد" : "لا توجد نتائج مطابقة"}</p>
                  {scoped.length === 0 && !noSpecialties && (
                    <button
                      type="button"
                      onClick={() => setCourseEditor({ ...(selection.type === "specialty" ? { specialtyId: selection.id } : {}) })}
                      className="btn-primary mt-5"
                    >
                      <Plus className="h-4 w-4" /> إضافة دورة
                    </button>
                  )}
                  {noSpecialties && <p className="mt-2 text-sm text-muted-foreground">أضف تصنيفاً ثم تخصصاً داخله قبل إضافة الدورات.</p>}
                </div>
              ) : (
                <ul className="divide-y divide-forest/10">
                  {visible.map((r, index) => (
                    <li key={r.course.id} className="flex flex-wrap items-center gap-4 px-4 py-3.5 transition hover:bg-muted/40 sm:flex-nowrap">
                      <button type="button" onClick={() => setCourseEditor({ course: r.course, specialtyId: r.specialty.id })} className="flex min-w-0 flex-1 items-center gap-4 text-right">
                        <span className="grid h-14 w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary text-primary">
                          {r.course.image ? <img src={r.course.image} alt="" className="h-full w-full object-cover" /> : <GraduationCap className="h-6 w-6" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-forest">{r.course.title}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {selection.type !== "specialty" && <span className="rounded-full bg-muted px-2 py-0.5">{r.specialty.title}</span>}
                            {r.course.trainer && <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{r.course.trainer}</span>}
                            {r.course.duration && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{r.course.duration}</span>}
                            <span>{r.course.modules.length} محاور</span>
                          </span>
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center gap-1">
                        <label className="me-2 flex items-center gap-2 text-xs text-forest/65">
                          {busyId === r.course.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                          {r.course.published ? "منشورة" : "مسودة"}
                          <Switch checked={r.course.published} disabled={busyId === r.course.id} onCheckedChange={() => void togglePublished(r)} />
                        </label>
                        {canReorder && (
                          <>
                            <IconAction label="لأعلى" disabled={index === 0 || busyId !== null} onClick={() => void moveCourse(r, -1)}><ArrowUp className="h-4 w-4" /></IconAction>
                            <IconAction label="لأسفل" disabled={index === visible.length - 1 || busyId !== null} onClick={() => void moveCourse(r, 1)}><ArrowDown className="h-4 w-4" /></IconAction>
                          </>
                        )}
                        <IconAction label="تعديل" onClick={() => setCourseEditor({ course: r.course, specialtyId: r.specialty.id })}><Pencil className="h-4 w-4" /></IconAction>
                        <IconAction label="نسخ" onClick={() => void duplicate(r)}><Copy className="h-4 w-4" /></IconAction>
                        <a
                          href={`/courses/${r.category.slug}/${r.specialty.slug}/${r.course.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          title="عرض في الموقع"
                          className="rounded-lg p-2 text-forest/45 hover:bg-muted hover:text-forest"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        <IconAction label="حذف" danger onClick={() => askDeleteCourse(r)}><Trash2 className="h-4 w-4" /></IconAction>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {selection.type === "specialty" && !canReorder && visible.length > 1 && (
                <p className="border-t border-forest/10 px-4 py-2.5 text-xs text-muted-foreground">امسح البحث والفلتر لتغيير ترتيب الدورات.</p>
              )}
            </section>
          </div>
        </div>
      )}

      {courseEditor && (
        <CourseSheet
          course={courseEditor.course}
          specialtyId={courseEditor.specialtyId ?? categories[0]?.specialties[0]?.id}
          categories={categories}
          onClose={() => setCourseEditor(null)}
          onSaved={async () => {
            setCourseEditor(null);
            await load();
          }}
          onDelete={
            courseEditor.course
              ? () => {
                  const row = rows.find((x) => x.course.id === courseEditor.course?.id);
                  setCourseEditor(null);
                  if (row) askDeleteCourse(row);
                }
              : undefined
          }
        />
      )}

      {categoryDialog && (
        <CategoryDialog
          category={categoryDialog.category}
          onClose={() => setCategoryDialog(null)}
          onSaved={async () => {
            setCategoryDialog(null);
            await load();
          }}
        />
      )}

      {specialtyDialog && (
        <SpecialtyDialog
          specialty={specialtyDialog.specialty}
          categoryId={specialtyDialog.categoryId}
          categories={categories}
          onClose={() => setSpecialtyDialog(null)}
          onSaved={async () => {
            setSpecialtyDialog(null);
            await load();
          }}
        />
      )}

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader className="text-right sm:text-right">
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-start">
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const action = confirm?.action;
                setConfirm(null);
                void action?.();
              }}
            >
              نعم، احذف
            </AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}

/* ---------------- Small pieces ---------------- */

function Stat({ icon: Icon, label, value, accent }: { icon: typeof BookOpen; label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-forest/10 bg-card p-4 shadow-soft">
      <span className={`grid h-11 w-11 place-items-center rounded-xl ${accent ? "bg-gold/20 text-gold-dark" : "bg-secondary text-primary"}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="font-display text-2xl font-bold leading-none">{value.toLocaleString("ar-EG")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function TreeButton({ active, onClick, label, count, draft, bold }: { active: boolean; onClick: () => void; label: string; count: number; draft?: boolean; bold?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-right text-sm transition ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
    >
      <span className={`min-w-0 flex-1 truncate ${bold ? "font-semibold" : ""}`}>{label}</span>
      {draft && <span className={`rounded-full px-1.5 text-[10px] ${active ? "bg-primary-foreground/20" : "bg-gold/20 text-gold-dark"}`}>مخفي</span>}
      <span className={`rounded-full px-2 text-[11px] ${active ? "bg-primary-foreground/20" : "bg-muted text-forest/60"}`}>{count}</span>
    </button>
  );
}

function RowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <span className="flex shrink-0 opacity-100 transition lg:opacity-0 lg:group-hover:opacity-100 focus-within:opacity-100">
      <button type="button" onClick={onEdit} className="rounded-md p-1.5 text-forest/45 hover:bg-muted hover:text-forest" aria-label="تعديل" title="تعديل">
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={onDelete} className="rounded-md p-1.5 text-forest/45 hover:bg-destructive/10 hover:text-destructive" aria-label="حذف" title="حذف">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

function IconAction({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg p-2 transition disabled:opacity-25 ${danger ? "text-forest/45 hover:bg-destructive/10 hover:text-destructive" : "text-forest/45 hover:bg-muted hover:text-forest"}`}
    >
      {children}
    </button>
  );
}

function Field({ label, hint, children, wide }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-1.5 flex items-center justify-between text-[13px] font-semibold text-forest">
        {label}
        {hint && <span className="text-[11px] font-normal text-muted-foreground">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function useSlug(initialTitle: string, initialSlug: string) {
  const [slug, setSlug] = useState(initialSlug);
  const [touched, setTouched] = useState(Boolean(initialSlug));
  return {
    slug,
    onTitle: (title: string) => {
      if (!touched) setSlug(makeSlug(title));
    },
    onSlug: (v: string) => {
      setTouched(true);
      setSlug(makeSlug(v) || v);
    },
    reset: () => setSlug(makeSlug(initialTitle)),
  };
}

/* ---------------- Course editor ---------------- */

function CourseSheet({
  course,
  specialtyId,
  categories,
  onClose,
  onSaved,
  onDelete,
}: {
  course: AdminCourse | undefined;
  specialtyId: number | undefined;
  categories: AdminCategory[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDelete: (() => void) | undefined;
}) {
  const [form, setForm] = useState({
    title: course?.title ?? "",
    summary: course?.summary ?? "",
    trainer: course?.trainer ?? "",
    duration: course?.duration ?? "",
    badge: course?.badge ?? "",
    format: course?.format ?? "",
    image: course?.image ?? "",
    published: course?.published ?? true,
    specialtyId: specialtyId ?? 0,
  });
  const [modules, setModules] = useState<{ id: string; text: string }[]>(
    (course?.modules ?? []).map((text, i) => ({ id: `m${i}`, text })),
  );
  const slug = useSlug(course?.title ?? "", course?.slug ?? "");
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title.trim()) { toast.error("اسم الدورة مطلوب"); return; }
    if (!form.specialtyId) { toast.error("اختر التخصص"); return; }
    const finalSlug = slug.slug || makeSlug(form.title) || `course-${Date.now().toString(36)}`;
    const payload = {
      title: form.title.trim(),
      slug: finalSlug,
      summary: form.summary,
      trainer: form.trainer,
      duration: form.duration,
      badge: form.badge,
      format: form.format,
      image: form.image || null,
      published: form.published,
      modules: modules.map((m) => m.text.trim()).filter(Boolean),
      specialtyId: form.specialtyId,
    };
    setSaving(true);
    try {
      if (course) {
        // Moving to another specialty puts the course at the end of that list.
        const position = form.specialtyId === specialtyId ? course.position : 9999;
        await coursesApi.updateCourse(course.id, { ...payload, position });
        toast.success("تم حفظ الدورة");
      } else {
        await coursesApi.createCourse(payload);
        toast.success("تمت إضافة الدورة");
      }
      await onSaved();
    } catch (e) {
      toast.error("تعذر الحفظ", { description: errorText(e) });
    } finally {
      setSaving(false);
    }
  };

  const moveModule = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= modules.length) return;
    const next = [...modules];
    [next[i], next[j]] = [next[j] as (typeof modules)[number], next[i] as (typeof modules)[number]];
    setModules(next);
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="left" dir="rtl" className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <div className="border-b border-forest/10 px-6 py-4 pe-12">
          <SheetTitle className="font-display text-xl text-forest">{course ? "تعديل الدورة" : "دورة جديدة"}</SheetTitle>
          <SheetDescription>{course ? course.title : "أدخل بيانات الدورة، ويمكنك حفظها كمسودة ثم نشرها لاحقاً."}</SheetDescription>
        </div>

        <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-6 py-6">
          <FormBlock title="البيانات الأساسية">
            <Field label="اسم الدورة" wide>
              <input
                className={fieldInput}
                value={form.title}
                onChange={(e) => {
                  set("title", e.target.value);
                  slug.onTitle(e.target.value);
                }}
                placeholder="مثال: إدارة وتغذية مزارع أبقار الحليب"
              />
            </Field>
            <Field label="رابط الدورة" hint="يظهر في عنوان الصفحة" wide>
              <input dir="ltr" className={`${fieldInput} text-left`} value={slug.slug} onChange={(e) => slug.onSlug(e.target.value)} />
            </Field>
            <Field label="التخصص">
              <select className={fieldInput} value={form.specialtyId} onChange={(e) => set("specialtyId", Number(e.target.value))}>
                <option value={0} disabled>اختر التخصص…</option>
                {categories.map((cat) => (
                  <optgroup key={cat.id} label={cat.title}>
                    {cat.specialties.map((sp) => (
                      <option key={sp.id} value={sp.id}>{sp.title}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
            <div className="flex items-end">
              <label className="flex w-full items-center justify-between rounded-xl border border-forest/15 px-3.5 py-2.5">
                <span className="text-sm font-semibold">{form.published ? "منشورة للزوار" : "مسودة (مخفية)"}</span>
                <Switch checked={form.published} onCheckedChange={(v) => set("published", v)} />
              </label>
            </div>
            <Field label="ملخص الدورة" wide>
              <textarea rows={3} className={`${fieldInput} leading-7`} value={form.summary} onChange={(e) => set("summary", e.target.value)} />
            </Field>
          </FormBlock>

          <FormBlock title="التفاصيل">
            <Field label="المدرب / الاستشاري">
              <input className={fieldInput} value={form.trainer} onChange={(e) => set("trainer", e.target.value)} />
            </Field>
            <Field label="المدة">
              <input className={fieldInput} value={form.duration} onChange={(e) => set("duration", e.target.value)} placeholder="36 ساعة تدريبية (6 أسابيع)" />
            </Field>
            <Field label="الشارة">
              <input className={fieldInput} value={form.badge} onChange={(e) => set("badge", e.target.value)} placeholder="إنتاج الحليب والألبان" />
            </Field>
            <Field label="نمط التدريب">
              <input className={fieldInput} value={form.format} onChange={(e) => set("format", e.target.value)} placeholder="تدريب معتمد + حقل" />
            </Field>
            <Field label="صورة الدورة" wide>
              <ImageInput value={form.image ?? ""} onChange={(v) => set("image", v)} />
            </Field>
          </FormBlock>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display font-bold text-forest">محاور الدورة <span className="text-sm font-normal text-muted-foreground">({modules.length})</span></h3>
            </div>
            <ol className="space-y-2">
              {modules.map((m, i) => (
                <li key={m.id} className="flex items-start gap-2 rounded-xl border border-forest/10 bg-muted/30 p-2">
                  <span className="mt-2 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                  <textarea
                    rows={2}
                    className={`${fieldInput} min-w-0 flex-1 leading-6`}
                    value={m.text}
                    onChange={(e) => setModules(modules.map((x) => (x.id === m.id ? { ...x, text: e.target.value } : x)))}
                    placeholder="وصف المحور"
                  />
                  <div className="flex flex-col">
                    <IconAction label="لأعلى" disabled={i === 0} onClick={() => moveModule(i, -1)}><ArrowUp className="h-3.5 w-3.5" /></IconAction>
                    <IconAction label="لأسفل" disabled={i === modules.length - 1} onClick={() => moveModule(i, 1)}><ArrowDown className="h-3.5 w-3.5" /></IconAction>
                    <IconAction label="حذف" danger onClick={() => setModules(modules.filter((x) => x.id !== m.id))}><Trash2 className="h-3.5 w-3.5" /></IconAction>
                  </div>
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() => setModules([...modules, { id: `m${Date.now()}`, text: "" }])}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-forest/25 py-2.5 text-sm font-semibold text-primary hover:border-primary hover:bg-secondary/50"
            >
              <Plus className="h-4 w-4" /> إضافة محور
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-forest/10 bg-card px-6 py-4">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-forest disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} {course ? "حفظ التعديلات" : "إضافة الدورة"}
          </button>
          <button type="button" onClick={onClose} className="rounded-xl border border-forest/15 px-4 py-2.5 text-sm font-medium hover:bg-muted">
            إلغاء
          </button>
          {onDelete && (
            <button type="button" onClick={onDelete} className="ms-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" /> حذف الدورة
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FormBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 font-display font-bold text-forest">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

/* ---------------- Category & specialty dialogs ---------------- */

function DialogShell({ title, desc, children, footer, onClose }: { title: string; desc: string; children: ReactNode; footer: ReactNode; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent dir="rtl" className="max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-xl">
        <div className="border-b border-forest/10 px-6 py-4 pe-12 text-right">
          <DialogTitle className="font-display text-lg text-forest">{title}</DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">{children}</div>
        </div>
        <div className="flex gap-2 border-t border-forest/10 px-6 py-4">{footer}</div>
      </DialogContent>
    </Dialog>
  );
}

function SaveButtons({ saving, onSave, onClose, label }: { saving: boolean; onSave: () => void; onClose: () => void; label: string }) {
  return (
    <>
      <button type="button" disabled={saving} onClick={onSave} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-forest disabled:opacity-60">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />} {label}
      </button>
      <button type="button" onClick={onClose} className="rounded-xl border border-forest/15 px-4 py-2.5 text-sm font-medium hover:bg-muted">
        إلغاء
      </button>
    </>
  );
}

function CategoryDialog({ category, onClose, onSaved }: { category: AdminCategory | undefined; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({
    title: category?.title ?? "",
    description: category?.description ?? "",
    image: category?.image ?? "",
    published: category?.published ?? true,
  });
  const slug = useSlug(category?.title ?? "", category?.slug ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.title.trim()) { toast.error("اسم التصنيف مطلوب"); return; }
    const data = { ...form, title: form.title.trim(), image: form.image || null, slug: slug.slug || makeSlug(form.title) || `category-${Date.now().toString(36)}` };
    setSaving(true);
    try {
      if (category) await coursesApi.updateCategory(category.id, { ...data, position: category.position });
      else await coursesApi.createCategory(data);
      toast.success(category ? "تم حفظ التصنيف" : "تمت إضافة التصنيف");
      await onSaved();
    } catch (e) {
      toast.error("تعذر الحفظ", { description: errorText(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogShell
      title={category ? "تعديل التصنيف" : "تصنيف جديد"}
      desc="التصنيفات هي المجالات الرئيسية التي تظهر في صفحة الدورات."
      onClose={onClose}
      footer={<SaveButtons saving={saving} onSave={() => void save()} onClose={onClose} label={category ? "حفظ" : "إضافة"} />}
    >
      <Field label="اسم التصنيف" wide>
        <input className={fieldInput} value={form.title} onChange={(e) => { setForm({ ...form, title: e.target.value }); slug.onTitle(e.target.value); }} />
      </Field>
      <Field label="الرابط" wide>
        <input dir="ltr" className={`${fieldInput} text-left`} value={slug.slug} onChange={(e) => slug.onSlug(e.target.value)} />
      </Field>
      <Field label="الوصف" wide>
        <textarea rows={3} className={`${fieldInput} leading-7`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
      <Field label="الصورة" wide>
        <ImageInput value={form.image ?? ""} onChange={(v) => setForm({ ...form, image: v })} />
      </Field>
      <label className="flex items-center justify-between rounded-xl border border-forest/15 px-3.5 py-2.5 sm:col-span-2">
        <span className="text-sm font-semibold">{form.published ? "ظاهر للزوار" : "مخفي"}</span>
        <Switch checked={form.published} onCheckedChange={(v) => setForm({ ...form, published: v })} />
      </label>
    </DialogShell>
  );
}

function SpecialtyDialog({
  specialty,
  categoryId,
  categories,
  onClose,
  onSaved,
}: {
  specialty: AdminSpecialty | undefined;
  categoryId: number | undefined;
  categories: AdminCategory[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    categoryId: categoryId ?? categories[0]?.id ?? 0,
    title: specialty?.title ?? "",
    description: specialty?.description ?? "",
    heroTitle: specialty?.heroTitle ?? "",
    heroSubtitle: specialty?.heroSubtitle ?? "",
    image: specialty?.image ?? "",
    published: specialty?.published ?? true,
  });
  const slug = useSlug(specialty?.title ?? "", specialty?.slug ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.title.trim()) { toast.error("اسم التخصص مطلوب"); return; }
    const data = { ...form, title: form.title.trim(), image: form.image || null, slug: slug.slug || makeSlug(form.title) || `specialty-${Date.now().toString(36)}` };
    setSaving(true);
    try {
      if (specialty) {
        const position = form.categoryId === categoryId ? specialty.position : 9999;
        await coursesApi.updateSpecialty(specialty.id, { ...data, position });
      } else await coursesApi.createSpecialty(data);
      toast.success(specialty ? "تم حفظ التخصص" : "تمت إضافة التخصص");
      await onSaved();
    } catch (e) {
      toast.error("تعذر الحفظ", { description: errorText(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogShell
      title={specialty ? "تعديل التخصص" : "تخصص جديد"}
      desc="التخصص يجمع مجموعة دورات داخل تصنيف واحد، وله صفحة خاصة في الموقع."
      onClose={onClose}
      footer={<SaveButtons saving={saving} onSave={() => void save()} onClose={onClose} label={specialty ? "حفظ" : "إضافة"} />}
    >
      <Field label="التصنيف" wide>
        <select className={fieldInput} value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      </Field>
      <Field label="اسم التخصص">
        <input className={fieldInput} value={form.title} onChange={(e) => { setForm({ ...form, title: e.target.value }); slug.onTitle(e.target.value); }} />
      </Field>
      <Field label="الرابط">
        <input dir="ltr" className={`${fieldInput} text-left`} value={slug.slug} onChange={(e) => slug.onSlug(e.target.value)} />
      </Field>
      <Field label="الوصف المختصر" wide>
        <textarea rows={2} className={`${fieldInput} leading-7`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
      <Field label="عنوان صفحة التخصص" wide>
        <input className={fieldInput} value={form.heroTitle} onChange={(e) => setForm({ ...form, heroTitle: e.target.value })} />
      </Field>
      <Field label="نص صفحة التخصص" wide>
        <textarea rows={2} className={`${fieldInput} leading-7`} value={form.heroSubtitle} onChange={(e) => setForm({ ...form, heroSubtitle: e.target.value })} />
      </Field>
      <Field label="الصورة" wide>
        <ImageInput value={form.image ?? ""} onChange={(v) => setForm({ ...form, image: v })} />
      </Field>
      <label className="flex items-center justify-between rounded-xl border border-forest/15 px-3.5 py-2.5 sm:col-span-2">
        <span className="text-sm font-semibold">{form.published ? "ظاهر للزوار" : "مخفي"}</span>
        <Switch checked={form.published} onCheckedChange={(v) => setForm({ ...form, published: v })} />
      </label>
    </DialogShell>
  );
}
