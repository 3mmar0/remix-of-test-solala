<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CmsController extends Controller
{
    public function show() { return response()->json(['settings' => $this->settings(), 'pages' => $this->pages(true)]); }
    public function adminIndex() { return response()->json(['settings' => $this->settings(), 'pages' => $this->pages(false)]); }

    public function updatePage(Request $request, int $id)
    {
        $page = DB::table('cms_pages')->find($id); abort_unless($page, 404);
        $data = $request->validate(['title' => ['required','string','max:255'], 'description' => ['nullable','string','max:2000'], 'heroTitle' => ['nullable','string','max:255'], 'heroSubtitle' => ['nullable','string','max:3000'], 'published' => ['required','boolean']]);
        DB::table('cms_pages')->where('id', $id)->update(['title' => $data['title'], 'description' => $data['description'] ?? '', 'hero_title' => $data['heroTitle'] ?? '', 'hero_subtitle' => $data['heroSubtitle'] ?? '', 'published' => $data['published'], 'updated_at' => now()]);
        return response()->json($this->page($id));
    }

    public function updateSection(Request $request, int $id)
    {
        $section = DB::table('cms_sections')->find($id); abort_unless($section, 404);
        $data = $request->validate(['visible' => ['required','boolean'], 'content' => ['required','array']]);
        $content = $data['content'];
        DB::table('cms_sections')->where('id', $id)->update(['visible' => $data['visible'], 'title' => $content['title'] ?? $section->title, 'subtitle' => $content['subtitle'] ?? '', 'body' => $content['body'] ?? '', 'items' => json_encode($content['items'] ?? [], JSON_UNESCAPED_UNICODE), 'content' => json_encode($content, JSON_UNESCAPED_UNICODE), 'updated_at' => now()]);
        return response()->json($this->section($id));
    }

    public function reorderSections(Request $request, int $pageId)
    {
        $page = DB::table('cms_pages')->find($pageId); abort_unless($page, 404);
        $data = $request->validate(['sectionIds' => ['required','array','min:1'], 'sectionIds.*' => ['integer']]);
        $existing = DB::table('cms_sections')->where('page_slug', $page->slug)->pluck('id')->map(fn ($id) => (int) $id)->all();
        abort_unless(count($existing) === count($data['sectionIds']) && empty(array_diff($existing, $data['sectionIds'])), 422, 'قائمة الأقسام غير مطابقة للصفحة.');
        DB::transaction(function () use ($data) { foreach ($data['sectionIds'] as $position => $sectionId) DB::table('cms_sections')->where('id', $sectionId)->update(['position' => $position, 'updated_at' => now()]); });
        return response()->json(['sections' => DB::table('cms_sections')->whereIn('id', $data['sectionIds'])->orderBy('position')->get()->map(fn ($row) => $this->serializeSection($row))->all()]);
    }

    public function updatePageContent(Request $request)
    {
        $data = $request->validate([
            'slug' => ['required', 'string', 'max:255'],
            'title' => ['nullable', 'string', 'max:255'],
            'sections' => ['required', 'array'],
            'sections.*.key' => ['required', 'string', 'max:255'],
            'sections.*.label' => ['nullable', 'string', 'max:255'],
            'sections.*.visible' => ['required', 'boolean'],
            'sections.*.position' => ['required', 'integer', 'min:0'],
            'sections.*.content' => ['required', 'array'],
        ]);
        $page = DB::table('cms_pages')->where('slug', $data['slug'])->first();
        abort_unless($page, 404, 'الصفحة غير موجودة.');
        DB::transaction(function () use ($data, $page) {
            if (!empty($data['title'])) {
                DB::table('cms_pages')->where('id', $page->id)->update(['title' => $data['title'], 'updated_at' => now()]);
            }
            $existing = DB::table('cms_sections')->where('page_slug', $page->slug)->get()->keyBy('section_key');
            foreach ($data['sections'] as $section) {
                $content = $section['content'];
                $row = [
                    'visible' => $section['visible'],
                    'position' => $section['position'],
                    'title' => (string) ($content['title'] ?? ''),
                    'subtitle' => (string) ($content['subtitle'] ?? ''),
                    'body' => (string) ($content['body'] ?? ''),
                    'items' => json_encode($content['items'] ?? [], JSON_UNESCAPED_UNICODE),
                    'content' => json_encode($content, JSON_UNESCAPED_UNICODE),
                    'updated_at' => now(),
                ];
                if (isset($existing[$section['key']])) {
                    DB::table('cms_sections')->where('id', $existing[$section['key']]->id)->update($row);
                } else {
                    DB::table('cms_sections')->insert($row + [
                        'page_slug' => $page->slug,
                        'section_key' => $section['key'],
                        'section_type' => $section['key'],
                        'created_at' => now(),
                    ]);
                }
            }
        });
        return response()->json(['ok' => true, 'page' => $this->page($page->id)]);
    }

    public function updateSettings(Request $request)
    {
        $settings = $request->validate(['siteName' => ['required','string','max:120'], 'tagline' => ['nullable','string','max:255'], 'email' => ['nullable','email'], 'phone' => ['nullable','string','max:80'], 'address' => ['nullable','string','max:500'], 'facebook' => ['nullable','string','max:500'], 'twitter' => ['nullable','string','max:500'], 'linkedin' => ['nullable','string','max:500'], 'seoDescription' => ['nullable','string','max:2000']]);
        DB::table('cms_settings')->updateOrInsert(['key' => 'site'], ['value' => json_encode($settings, JSON_UNESCAPED_UNICODE), 'updated_at' => now()]);
        return response()->json($settings);
    }

    private function settings(): array { $value = DB::table('cms_settings')->where('key', 'site')->value('value'); return $value ? json_decode($value, true) : []; }
    private function pages(bool $publishedOnly): array { $query = DB::table('cms_pages')->orderBy('slug'); if ($publishedOnly) $query->where('published', true); return $query->get()->map(fn ($page) => $this->serializePage($page))->all(); }
    private function page(int $id): array { return $this->serializePage(DB::table('cms_pages')->find($id)); }
    private function serializePage(object $page): array { return ['id' => $page->id, 'slug' => $page->slug, 'title' => $page->title, 'description' => $page->description, 'heroTitle' => $page->hero_title, 'heroSubtitle' => $page->hero_subtitle, 'published' => (bool) $page->published, 'updatedAt' => $page->updated_at, 'sections' => DB::table('cms_sections')->where('page_slug', $page->slug)->orderBy('position')->get()->map(fn ($section) => $this->serializeSection($section))->all()]; }
    private function section(int $id): array { return $this->serializeSection(DB::table('cms_sections')->find($id)); }
    private function serializeSection(object $section): array { $content = $section->content ? json_decode($section->content, true) : []; return ['id' => $section->id, 'key' => $section->section_key, 'type' => $section->section_type, 'title' => $section->title, 'visible' => (bool) $section->visible, 'position' => $section->position, 'content' => $content + ['title' => $section->title, 'subtitle' => $section->subtitle, 'body' => $section->body, 'items' => json_decode($section->items, true) ?: []], 'updatedAt' => $section->updated_at]; }
}
