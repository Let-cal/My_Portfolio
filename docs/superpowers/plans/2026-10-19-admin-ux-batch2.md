# Admin UX Batch 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make creating and editing content fast and unambiguous: clear required markers and Vietnamese error messages per field with an error summary (2a), then a modern admin shell and faster lists (2b).

**Architecture:** A pure validation layer (`src/lib/admin/validation.ts`) turns Zod issues into per-field Vietnamese messages using the existing `FieldSpec` labels. `FieldsForm` uses it as its resolver and renders every field through one `FieldShell` (label, required marker, hint, error, ARIA wiring) plus an `ErrorSummary`. Server actions return field-level errors in the same shape.

**Tech Stack:** Next.js 16, React 19, react-hook-form 7, Zod 4, Tailwind v4, shadcn/radix, motion/react, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-19-admin-ux-design.md` (§4 Đợt 2) and `docs/superpowers/specs/2026-10-19-admin-audit.md` (§1, §3, §4, §6, §8).

## Global Constraints

- Zero cost; no new paid services; new dependencies small and justified.
- `contentSchema` stays the source of truth; admin only maps its issues to messages. No schema changes.
- Writes: server action → `requireAdmin()` → Supabase (RLS) → `updateTag('content')`.
- Session or params reads sit inside `<Suspense>`; `createServerSupabase` already awaits `connection()`.
- UI copy in Vietnamese. Owner's process rule: at most one polish round; the rest becomes issues.
- Commits have no attribution lines.

## Validation UX rules (from GOV.UK Design System, WCAG 3.3.1/3.3.3, UX guidelines)

- Required fields: label ends with a red `*` plus visually hidden "(bắt buộc)"; the form starts with "Mục có * là bắt buộc". Optional translated languages say "Không bắt buộc, trống thì trang dùng bản EN".
- First validation on submit (`mode: "onSubmit"`), then re-validate on change so a fixed field clears at once.
- Failed submit: an error summary at the top of the form ("Có N mục cần sửa"), `role="alert"`, focused, each item a link that focuses its field. Inline errors stay.
- Each inline error sits under its own input (for i18n: under the failing language box), red border, `aria-invalid`, `aria-describedby`.
- Messages say what to do, using the field label: "Nhập tên chứng chỉ", "Ngày cấp phải có dạng ngày/tháng/năm", "Link xác minh phải là đường dẫn đầy đủ, bắt đầu bằng https://".
- Server errors that belong to a field (duplicate ID, schema failure on the server) appear on that field and in the summary, not only in a toast.

## Review Focus

1. Nested errors (`caseStudy.result.en`, `stat.label.en`, `links.1.url`, `colors.0`, `summaries.pm.en`) must land on the visible input that holds the value, not on a hidden parent.
2. A nullable field left blank (credential URL, end month, GPA) must not be reported as an error.
3. After a failed submit, fixing every field must clear the summary without another submit.
4. The duplicate-ID error from the server must point at the ID field.
5. Switching single-language mode must never hide an error: a JA error while viewing EN shows a badge on the JA tab.

---

## Batch 2a — Forms (PR "feat(admin): clear validation and faster forms")

### Task 1: Vietnamese messages from Zod issues

**Files:**
- Create: `src/lib/admin/validation.ts`
- Test: `tests/unit/admin-validation.test.ts`

**Interfaces:**
- Produces:
  - `type FieldError = { path: string; field: string; locale?: "en" | "ja" | "vi"; message: string }`. `path` is the full RHF path (e.g. `caseStudy.result.en`); `field` is the top-level `FieldSpec.name`, or the dotted name for profile summaries.
  - `isRequired(f: FieldSpec): boolean`: false for `nullable`, `upload`, `boolean`, `tags`, `links`, `relations`, `order`, `skills`, `caseStudy`, `stat`, `virtual`; true otherwise.
  - `describeIssues(issues: readonly { path: PropertyKey[]; code: string; message: string; format?: string }[], fields: FieldSpec[]): FieldError[]`: one entry per path, in field order.
  - `adminResolver(schema: ZodObject, fields: FieldSpec[]): Resolver<Record<string, unknown>>`: runs `schema.safeParse`; on failure returns RHF errors keyed by `path` with the Vietnamese message; on success returns the parsed values.

- [ ] **Step 1: Write the failing tests** (`admin-validation.test.ts`, using `certificateSchema`, `projectSchema` and `whyCardSchema` with `resources[...].fields`). Each case asserts the exact message:
  - Empty certificate gives `id`: "Nhập ID", `name`: "Nhập tên chứng chỉ", `organization`: "Nhập tổ chức cấp", `issueDate`: "Chọn ngày cấp", `description.en`: "Nhập mô tả (EN)". `credentialUrl: null` is **not** reported.
  - `id: "AWS SAA"` gives "ID chỉ gồm chữ thường không dấu, số và dấu gạch ngang (ví dụ: aws-saa)".
  - `credentialUrl: "abc"` gives "Link xác minh phải là đường dẫn đầy đủ, bắt đầu bằng https://".
  - A project with `caseStudy.result.en = ""` gives path `caseStudy.result.en` and message "Nhập Kết quả của case study (EN)".
  - `links: [{ label: "", url: "x" }]` gives `links.0.label` "Nhập nhãn liên kết" and `links.0.url` "URL của liên kết phải bắt đầu bằng https://".
  - A why card `evidenceLink: "x"` gives "Chọn một kinh nghiệm hoặc dự án làm bằng chứng"; `colors.0: "red"` gives "Màu phải có dạng #RRGGBB".
  - `start: "2026"` gives "Chọn tháng bắt đầu".
  - `isRequired` is true for `name`, false for `credentialUrl`, `published`, `skills`, `caseStudy`.
  - `describeIssues` returns entries in the form's field order.
- [ ] **Step 2: Run** `npx vitest run tests/unit/admin-validation.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement.**
  - Message rules: build them by `FieldSpec.kind` and the issue code (`too_small`/`invalid_type` → "Nhập …" or "Chọn …"; `invalid_format`/regex → format message per kind).
  - Labels come from `FieldSpec.label` with explanatory parentheticals stripped and the first letter lowercased.
  - Case-study part labels: Vấn đề, Vai trò, Quyết định, Kết quả.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): explain validation errors per field in Vietnamese`.

### Task 2: Field shell, error summary and server field errors

**Files:**
- Create: `src/components/admin/FieldShell.tsx`, `src/components/admin/ErrorSummary.tsx`
- Modify: `src/components/admin/ResourceForm.tsx` (use `adminResolver`, wrap every field in `FieldShell`, give inputs stable ids `field-<path>`, render `ErrorSummary` above the fields, map server `fieldErrors` with `setError`), `src/components/admin/I18nField.tsx` (per-locale error, `aria-invalid`, ids `field-<name>.<locale>`, optional-language note), `src/app/admin/actions.ts` (`ActionResult` gains `fieldErrors?: Record<string, string>`; `saveResource`, `saveProfile` and `saveRole` return schema issues through `describeIssues`, and a duplicate ID as `{ id: "ID \"x\" đã được dùng, chọn ID khác" }`)
- Test: `tests/unit/admin-form-validation.test.tsx`, extend `tests/unit/admin-actions.test.ts`

**Interfaces:**
- Consumes: `adminResolver`, `describeIssues`, `isRequired` (Task 1).
- Produces:
  - `FieldShell({ id, label, required, hint, error, children })`. It renders the label (with `*` + sr-only "(bắt buộc)"), the hint, and the error `<p id="<id>-error" role="alert">`. It passes `aria-invalid` and `aria-describedby` to its child through `useFieldA11y()` context.
  - `ErrorSummary({ errors: FieldError[], focusKey: number })`. It focuses itself whenever `focusKey` changes. Each link calls `document.getElementById("field-" + path)?.focus()` and scrolls it into view (smooth unless reduced motion).

- [ ] **Step 1: Write the failing tests.**
  - `admin-form-validation.test.tsx` renders `ResourceForm` for `certificates` with `emptyItem`:
    - "Mục có * là bắt buộc" is shown, and the label "Tên chứng chỉ" contains "*".
    - Click "Lưu" and the summary heading "Có 5 mục cần sửa" gets focus. The links read "Nhập ID", "Nhập tên chứng chỉ" and so on. `saveResource` is not called.
    - The input `#field-name` has `aria-invalid="true"`, and its error text is linked through `aria-describedby`.
    - Clicking the "Nhập tên chứng chỉ" link focuses `#field-name`.
    - Typing a name removes that line from the summary at once; it now says "Có 4 mục cần sửa".
    - When the server returns `{ ok: false, error: "x", fieldErrors: { id: "ID \"ielts\" đã được dùng, chọn ID khác" } }`, that message shows under the ID input and in the summary.
  - `admin-actions.test.ts`:
    - `saveResource` returns `fieldErrors.id` for a duplicate new ID.
    - It returns `fieldErrors["description.en"] = "Nhập mô tả (EN)"` for an empty description.
- [ ] **Step 2: Run** `npx vitest run tests/unit/admin-form-validation.test.tsx tests/unit/admin-actions.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Set `noValidate` on the form.
  - Use `mode: "onSubmit"` with `reValidateMode: "onChange"`.
  - `focusKey` increments on every failed submit.
- [ ] **Step 4: Run** the same command, plus `npx vitest run tests/unit/resource-form-skills.test.tsx tests/unit/admin-resources.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): required markers, inline errors and an error summary`.

### Task 3: Save bar, unsaved guard and form sections

**Files:**
- Create: `src/components/admin/SaveBar.tsx`, `src/components/admin/FormSections.tsx`
- Modify: `ResourceForm.tsx`, and `src/lib/admin/resources.ts` (add optional `sections?: { id: string; title: string; fields: string[] }[]` to `Resource`, set for `experiences` and `projects`: Thông tin · Nội dung · Case study · Liên kết & skills · Hiển thị)
- Test: `tests/unit/admin-save-bar.test.tsx`

**Interfaces:**
- Produces:
  - `SaveBar({ dirty: boolean; pending: boolean; errorCount: number; onCancel(): void })`. It is fixed at the viewport bottom (inside the main column) and shows one of three states: "Có thay đổi chưa lưu", "N lỗi · Xem", or "Đã lưu ✓" for 2 s after a save. Ctrl/⌘+S submits the form.
  - `useUnsavedGuard(dirty: boolean)`: `beforeunload`, and confirmation on in-admin link clicks.
  - `FormSections({ sections, errorsByField })`: a sticky table of contents on ≥1024px, with an error count per section.

- [ ] **Step 1: Write the failing tests:**
  - Editing a field shows "Có thay đổi chưa lưu".
  - Ctrl+S calls `onSave`.
  - `beforeunload` is prevented while dirty and not after saving.
  - With sections, each section heading renders in order; a section containing an invalid field shows its error count.
- [ ] **Step 2: Run** `npx vitest run tests/unit/admin-save-bar.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the test file and the Task 2 tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): sticky save bar, unsaved-changes guard and form sections`.

### Task 4: Translation editing modes

**Files:**
- Modify: `src/components/admin/I18nField.tsx`, `ResourceForm.tsx` (form-level language switch "Cả 3 / EN / JA / VI", stored in `localStorage["admin.locales"]`, read in an effect)
- Test: `tests/unit/i18n-field.test.tsx`

- [ ] **Step 1: Write the failing tests:**
  - In "JA" mode, only JA inputs render. The EN text shows above each one as read-only reference.
  - A JA error while in "EN" mode shows a red dot on the "JA" switch button, labelled "JA có lỗi".
  - Textareas grow with content (`field-sizing: content` class present, min 3 rows).
  - A "Chép từ EN" button fills an empty JA/VI box from EN.
- [ ] **Step 2: Run** `npx vitest run tests/unit/i18n-field.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the test file. Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): edit translations one language at a time`.

### Task 5: Smarter inputs (ID, tags, evidence link) and role tabs

**Files:**
- Create: `src/lib/admin/slug.ts`, `src/components/admin/EvidencePicker.tsx`
- Modify: `ResourceForm.tsx`, `resources.ts` (why card `evidenceLink` kind `evidence`; `tech` and `repoUrls` render as chips via `TagCombobox`, with `tech` suggesting skill names), `src/components/admin/SingletonForms.tsx` + `src/app/admin/(panel)/roles/page.tsx` (tabs per role, one form at a time)
- Test: `tests/unit/admin-slug.test.ts`, `tests/unit/evidence-picker.test.tsx`

**Interfaces:**
- Produces:
  - `slugify(text: string): string`: Vietnamese accents removed, `đ` becomes `d`, kebab-case, at most 48 chars.
  - New items fill `id` from the first text field (name/title/company/school) until the user edits `id`. A live "ID đã được dùng" error appears using the list's existing ids (passed in `Options.existingIds`).
  - `EvidencePicker` is a select grouped "Kinh nghiệm" / "Dự án" whose values are `#exp-<id>` / `#proj-<id>`; hidden items are marked "(đang ẩn)".

- [ ] **Step 1: Write the failing tests:**
  - `slugify("Chứng chỉ AWS Đám mây (2026)")` returns `"chung-chi-aws-dam-may-2026"`.
  - On a new certificate, typing the name "IELTS 7.0" sets the ID to `ielts-7-0`; typing in ID then stops the sync; entering an existing id shows "ID đã được dùng".
  - `EvidencePicker` lists both groups, and choosing "SitePlus" sets `#proj-siteplus`.
  - The roles page renders three tabs, and switching tabs keeps unsaved edits per role.
- [ ] **Step 2: Run** `npx vitest run tests/unit/admin-slug.test.ts tests/unit/evidence-picker.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the full suite `npx vitest run`, lint, `tsc`, and `npx playwright test tests/e2e/admin.spec.ts --workers=1`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): auto IDs, chips, evidence picker and role tabs`. Final review, push, PR with a preview checklist (create a test certificate with empty fields and confirm messages; fix them; save; delete the test item).

## Batch 2b — Shell and lists (outline; detailed when 2a merges)

- **Sidebar and navigation:**
  - Icon sidebar with the active item highlighted and "Nội dung / Cấu hình" groups; collapsible on desktop, drawer on mobile; account menu.
  - Light/dark toggle using the site tokens; skeletons.
  - Admin ⌘K: jump to any item, create, open the public site.
- **Lists:**
  - Search, status filters, readable columns ("04/2026 – nay", skill count, translation, visibility), duplicate item.
  - Prev/next item navigation inside the editor (J/K).
- **Dashboard:**
  - "Sửa gần nhất" shows type + name + link, and ignores reorders.
  - Quick-create row.
- **Matrix:** "+ Thêm skill" row; compact rotated column headers.
- **Motion:** 150–250 ms transitions with `motion/react` (save bar, summary, list filtering, drawer menu), respecting reduced motion.
