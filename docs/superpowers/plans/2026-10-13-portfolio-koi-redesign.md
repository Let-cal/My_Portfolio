# Portfolio "Koi hóa Rồng" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay portfolio Vite cũ bằng app Next.js 16 gồm trang công khai 7 section có cảnh 3D cá koi hóa rồng, 3 ngôn ngữ, đa vai trò, và trang admin CRUD dùng Supabase. Toàn bộ không tốn chi phí.

**Architecture:** Next.js App Router. Trang công khai `/[locale]` render tĩnh từ một object `Content` duy nhất, lấy qua `ContentRepository`: Supabase khi có env, seed JSON khi không có hoặc khi Supabase lỗi. Cảnh 3D (React Three Fiber) là một canvas cố định phía sau trang, tải lười sau khi nội dung đã hiển thị. Tiến độ cuộn được quy đổi thành `chapter` + `t` để điều khiển cá. Admin `/admin` dùng Server Actions, validate bằng các zod schema dùng chung, và gọi `updateTag('content')` sau mỗi lần ghi.

**Tech Stack:** Next.js 16.4, React 19, TypeScript strict, Tailwind CSS 4, shadcn/ui, next-intl 4, Supabase (`@supabase/supabase-js` 2, `@supabase/ssr` 0.12), three 0.186 + @react-three/fiber 9 + drei 10 + postprocessing 3, motion 14, gsap 3.15, lenis 1.3, cmdk 1, zod 4, react-hook-form 7, @dnd-kit/sortable, sonner, Vitest 5, Playwright 1.64.

**Spec:** `docs/superpowers/specs/2026-10-13-portfolio-koi-redesign-design.md` (đọc kèm). Kho sự thật cho nội dung: `C:/Users/PC/Documents/01_Personal/02_CV_Ung_tuyen/CV_English/docs/specs/2026-10-05-english-cv-design.md` §3 (dữ kiện) và §5 (quy tắc viết).

## Global Constraints

- **Không tốn chi phí:** không dùng dịch vụ, gói, font hay asset trả phí. Font lấy từ `next/font/google`.
- Next.js 16: file chặn request là `src/proxy.ts` (export default), **không phải** `middleware.ts`. Trong `next.config.ts` bật `cacheComponents: true`. Đọc dữ liệu bằng `'use cache'` + `cacheTag('content')`; sau khi ghi thì gọi `updateTag('content')`.
- Locale: `en` (mặc định), `ja`, `vi`. Route có tiền tố `/en`, `/ja`, `/vi`. Admin không có i18n và giao diện admin viết tiếng Việt.
- Vai trò: `fullstack` (mặc định) | `techlead` | `pm`. Giống koi tương ứng: `kohaku` | `showa` | `ogon`. Vai trò lưu trên URL qua `?role=`.
- Màu thương hiệu: `--brand-400: #fb923c`, `--brand-500: #f97316`. Mặc định giao diện tối. Không thay con trỏ chuột.
- Nội dung chỉ lấy từ Kho sự thật. Cấm: "3+ years", "AI Engineer", số liệu % tự bịa, chữ "Present" cho SKG, và các từ cấm sau: spearheaded, orchestrated, leveraged, synergy, synergistic, foster, transformative, seamless, seamlessly, cutting-edge, dynamic, passionate, results-driven, results-oriented, empower, game-changer, multifaceted, unwavering, thought leader, "at the intersection of", "proven track record", "deep dive".
- Không hiện số điện thoại trên trang. Email công khai: `letcal2003@gmail.com`. LinkedIn `https://www.linkedin.com/in/letcal`, GitHub `https://github.com/Let-cal`.
- Hiệu năng (Lighthouse mobile, bản production build): Performance ≥ 85, Accessibility ≥ 95, LCP ≤ 2.5s, CLS ≤ 0.1. JS tải ban đầu (chưa tính chunk 3D) ≤ 200KB gzip.
- 3D: DPR tối đa 1.5 (mobile 1.25). Bloom chỉ bật ở tier `high`. Dừng render khi tab ẩn hoặc canvas khuất màn hình.
- Commit message **không** có dòng `Co-Authored-By` hay "Generated with Claude".
- Môi trường dev là Windows + Git Bash, Node 22. Dùng `npm`.

## Review Focus

1. **Thiếu bản dịch JA/VI cho một trường:** phải hiển thị EN, không bao giờ hiện chuỗi rỗng hay `undefined`. Test ở Task 3 (`pickLocale`) và Task 13 (e2e trang `/ja`).
2. **Supabase bị tạm dừng, sai env hoặc trả lỗi:** trang vẫn render từ seed. Test ở Task 3 (`getContent` fallback).
3. **`?role=` sai giá trị hoặc locale lạ:** `?role=xyz` thì dùng `fullstack`; `/fr` thì trả 404. Test ở Task 3 (`parseRole`) và Task 13 (e2e).
4. **Không có WebGL, bật reduced-motion, hoặc mobile yếu:** hiện ảnh tĩnh, nội dung dùng đầy đủ, trang `/quick` không có canvas. Test ở Task 14 (`detectTier`, `shouldLoadScene`) và Task 18 (e2e emulate reduced motion).
5. **Admin upload file quá cỡ hoặc sai định dạng; user đã đăng nhập nhưng không phải admin cố ghi dữ liệu:** phải bị từ chối. Test ở Task 20 (`isAdminEmail`) và Task 21 (`validateUpload`).

## File Structure

```
src/
  proxy.ts                         # next-intl cho site + chặn /admin
  i18n/{routing,request,navigation}.ts
  messages/{en,ja,vi}.json         # chuỗi UI (không phải nội dung CMS)
  content/schema.ts                # zod schema + type cho Content
  content/seed.json                # nội dung seed (EN/JA/VI)
  lib/i18n-text.ts                 # pickLocale
  lib/roles.ts                     # parseRole, orderExperiences, orderSkillGroups
  lib/data/{repository,seed-repository,supabase-repository,mappers,get-content}.ts
  lib/supabase/{server,browser,service}.ts
  lib/admin/{auth,upload,resources}.ts
  app/layout.tsx, app/globals.css, app/robots.ts, app/sitemap.ts, app/manifest.ts, app/icon.svg
  app/[locale]/{layout,page}.tsx, app/[locale]/quick/page.tsx, app/[locale]/opengraph-image.tsx
  app/admin/login/page.tsx, app/admin/(panel)/{layout,page}.tsx
  app/admin/(panel)/[resource]/page.tsx, app/admin/(panel)/[resource]/[id]/page.tsx
  app/admin/(panel)/{profile,roles}/page.tsx, app/admin/actions.ts
  components/ui/*                  # shadcn
  components/site/{Header,Footer,ThemeToggle,LanguageSwitch,RoleSwitcher,CommandPalette,SmoothScroll,Reveal,RoleProvider}.tsx
  components/sections/Hero.tsx, Contact.tsx
  components/sections/experience/{Timeline,CaseStudySheet}.tsx
  components/sections/projects/{ProjectsBento,ProjectCard}.tsx
  components/sections/skills/SkillMap.tsx
  components/sections/certificates/Certificates.tsx
  components/sections/why/{WhyCarousel,WhyCard,WaveBackground}.tsx
  components/quick/QuickView.tsx
  components/admin/{ResourceTable,ResourceForm,I18nField,UploadField,SortableList}.tsx
  scene/{KoiCanvas,SceneRoot,store,tier,chapters,loading}.ts(x)
  scene/creature/{profiles,spine,textures,Creature,PointCloudMorph}.ts(x)
  scene/environment/{Water,Props,Lighting}.tsx
  scene/interactions/feed.ts
supabase/migrations/0001_init.sql
scripts/{seed-supabase,capture-fallbacks}.ts
tests/unit/*.test.ts    tests/e2e/*.spec.ts
public/cv/*.pdf  public/fallback/*.jpg  public/images/profile-portrait.png
```

---

## Phase A: Nền tảng

### Task 1: Dựng khung Next.js 16 thay cho Vite

**Files:**
- Delete: `src/**` (code Vite cũ), `index.html`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `jsconfig.json`, `.eslintrc.cjs`, `package-lock.json`, `public/vite.svg`, `public/My_CV.pdf`
- Keep: `public/images/profile-portrait.png`, `public/icons/LETCAL-STUDIO.svg`, `docs/**`
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `src/app/globals.css`, `src/app/layout.tsx`, `components.json`, `vitest.config.ts`, `playwright.config.ts`, `.env.example`, `public/cv/LeTranCatLam_CV_TechLead.pdf`, `public/cv/LeTranCatLam_CV_TechnicalPM.pdf`
- Test: `tests/unit/smoke.test.ts`

**Interfaces:**
- Produces: các script npm `dev`, `build`, `start`, `lint`, `test` (vitest run), `test:e2e` (playwright), `seed` (tsx scripts/seed-supabase.ts). Alias `@/*` → `src/*`. Token CSS `--brand-400`, `--brand-500`, `--bg`, `--fg`, `--muted`, `--card`, `--border` trong `globals.css`, có biến thể `.light` (mặc định là tối). Class `dark` mặc định trên `<html>`.

- [ ] **Step 1:** Scaffold bằng `npx create-next-app@16.4.0 ../_scaffold --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack`, chép nội dung vào repo (thay các file cũ, giữ những file ở mục Keep), rồi xóa `../_scaffold`.
- [ ] **Step 2:** Cài dependencies đúng các bản trong Tech Stack, cộng thêm `tsx`, `@types/three`, `clsx`, `tailwind-merge`, `lucide-react`. Chạy `npx shadcn@4.21.4 init` (base color neutral) và add: `button sheet dialog command tabs input textarea switch label select badge tooltip separator dropdown-menu sonner form`.
- [ ] **Step 3:** `next.config.ts` bật `cacheComponents: true`, plugin `next-intl` trỏ tới `./src/i18n/request.ts`, `images.remotePatterns` cho `*.supabase.co`.
- [ ] **Step 4:** Chép 2 file CV từ `C:/Users/PC/Documents/01_Personal/02_CV_Ung_tuyen/CV_English/pdf/` vào `public/cv/`. Tạo `.env.example` gồm các biến `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL`, `NEXT_PUBLIC_SITE_URL=https://letcal.is-a.dev`.
- [ ] **Step 5:** Viết `tests/unit/smoke.test.ts`: `expect(1 + 1).toBe(2)` và assert file `public/cv/LeTranCatLam_CV_TechLead.pdf` tồn tại (`fs.existsSync`).
- [ ] **Step 6:** Chạy `npm run test && npm run lint && npm run build`. Expected: cả 3 lệnh đều pass.
- [ ] **Step 7:** Commit `chore: replace Vite app with Next.js 16 scaffold`.

### Task 2: Schema nội dung + seed (EN/JA/VI)

**Files:**
- Create: `src/content/schema.ts`, `src/content/seed.json`
- Test: `tests/unit/content-schema.test.ts`, `tests/unit/content-honesty.test.ts`

**Interfaces:**
- Produces (export từ `src/content/schema.ts`; mỗi type = `z.infer` của schema cùng tên):
  - `Locale = 'en'|'ja'|'vi'`; `RoleKey = 'fullstack'|'techlead'|'pm'`; `KoiVariety = 'kohaku'|'showa'|'ogon'`
  - `SkillGroup = 'languages'|'frameworks'|'cloud'|'ai'|'databases'|'delivery'|'testing'|'design'`
  - `CertTopic = 'language'|'pm'|'design'|'engineering'|'other'`
  - `i18nText = z.object({ en: z.string().min(1), ja: z.string().optional(), vi: z.string().optional() })`
  - `profileSchema`: `name, location, email, linkedin, github, avatarUrl: string|null, openToWork: boolean, availabilityNote: I18nText, bookingUrl: string|null, summaries: Record<RoleKey, I18nText>`. **Không có trường phone.**
  - `roleSchema`: `key, title: I18nText, koiVariety, cvFileUrl, experienceOrder: string[], skillGroupOrder: SkillGroup[]`
  - `caseStudySchema`: `problem, role, decisions, result` (đều là I18nText)
  - `experienceSchema`: `id, company, parentCompany: string|null, location, position: I18nText, start: 'YYYY-MM', end: 'YYYY-MM'|null, employmentType: 'full-time'|'internship', summary: I18nText, caseStudy: CaseStudy|null, teamSize: string|null, tech: string[], links: {label,url}[], published, sortIndex`
  - `projectSchema`: `id, title, role: I18nText, start, end, summary, caseStudy|null, tech[], demoUrl|null, repoUrls: string[], posterUrl|null, videoUrl|null, published, sortIndex`
  - `skillSchema`: `id, name, group: SkillGroup, sortIndex, experienceIds: string[], projectIds: string[]`
  - `certificateSchema`: `id, name, organization, issueDate: 'YYYY-MM-DD', credentialId|null, credentialUrl|null, fileUrl|null, topic: CertTopic, skills: string[], description: I18nText, published, sortIndex`
  - `activitySchema`: `id, name: I18nText, date, skills[], description: I18nText, sortIndex`
  - `educationSchema`: `id, school, degree: I18nText, major: I18nText, start, end, gpa: string|null, notes: I18nText|null, sortIndex`
  - `whyCardSchema`: `id, title, subtitle, tag (đều I18nText), body: I18nText, colors: [string,string] (hex), evidenceLink: string|null (dạng '#exp-<id>' | '#proj-<id>'), sortIndex`
  - `contentSchema = z.object({ profile, roles: roleSchema.array().length(3), experiences, projects, skills, certificates, activities, education, whyCards })`; type `Content`.

- [ ] **Step 1: Viết test schema và test trung thực (sẽ fail)**
  - `content-schema.test.ts`: `contentSchema.parse(seed)` không throw. Đủ 3 roles với key `fullstack/techlead/pm` và giống koi `kohaku/showa/ogon`. Có các experience id `skg-ai-agent`, `skg-flexybox-p2`, `skg-coa`, `skg-flexybox-p1`, `skg-intern`, `fpt-japan`. Cả 5 mục `skg-*` có `parentCompany === 'SKG Software (Splus)'` và `end` cụ thể như sau: ai-agent `2026-09`, p2 `2026-09`, coa `2026-03`, p1 `2025-10`, intern `2025-09`. Mọi `skill.experienceIds/projectIds` đều trỏ tới id có thật. Mọi `role.experienceOrder` chỉ chứa id có thật.
  - `content-honesty.test.ts`: `JSON.stringify(seed)` không khớp `/3\+\s*years/i`, `/AI Engineer/`, `/\bPresent\b/`, `/\d+(\.\d+)?\s?%/`, và không chứa từ cấm nào trong Global Constraints (so sánh không phân biệt hoa thường). Không khớp `/\+84|0964|09648/`.
- [ ] **Step 2:** Chạy `npx vitest run tests/unit/content-*` → FAIL (chưa có module).
- [ ] **Step 3:** Viết `schema.ts`. Viết `seed.json` **chỉ từ Kho sự thật**:
  - SKG có 5 experience theo spec bộ CV §3.2 A–E. Mỗi mục có summary 1–2 câu và case study 4 phần, giữ đúng số liệu: ~15 API → ~10 tool; team 3→6; team tối đa 8 → 5; ~9–10 endpoint; ~300 unit test; UAT bug ~10–20; 1 tenant, 2 locker; 6 dự án trong 14 tháng; 2 dự án song song Apr–Sep 2026; mentor 3 intern.
  - FPT Japan: Mar 2024.
  - Projects: `siteplus` (Jan–May 2025, Team Lead, team 5, repo FE/MB, demo `https://site-plus-15hdsvfpr-let-cals-projects.vercel.app/`), `zodiacgems` (Jun–Oct 2024, link demo/repo lấy từ `App.jsx` cũ ở commit `1f2585f`), `meet-my-lecturer` (Jul–Nov 2023, repo). Viết lại mô tả, bỏ hết số %.
  - Skills: theo bộ CV §3.7, có liên kết `experienceIds/projectIds` hợp lý (ví dụ `Next.js` → p1, p2, intern; `C#` → coa; `Terraform` → ai-agent).
  - Certificates: 10 mục lấy từ `App.jsx` cũ. SDLC đổi thành `2023-05-16`. Topic gán theo nội dung.
  - Activities: 3 mục cũ. Education: FPT University 2021-09 → 2025-05, GPA `7.66/10`, ghi chú học bổng 50%.
  - Why cards (4 thẻ, `colors` lấy từ mảng màu card cũ trong `src/components/pages/WhyHireMe/WhyHireMeSection.jsx` ở commit `1f2585f`): (1) Làm việc trực tiếp với khách hàng Nhật bằng tiếng Nhật → `#exp-skg-flexybox-p2`; (2) Tự build trọn FlexyBox Phase 1 → `#exp-skg-flexybox-p1`; (3) Điều phối 2 dự án song song → `#exp-skg-ai-agent`; (4) UI/UX + motion → `#proj-siteplus`.
  - Roles: title, thứ tự experience và nhóm skill theo spec §6.2. `cvFileUrl` là `/cv/LeTranCatLam_CV_TechLead.pdf` (cho fullstack và techlead) hoặc `/cv/LeTranCatLam_CV_TechnicalPM.pdf` (cho pm).
  - Profile: `openToWork: true`, `availabilityNote.en = "Open to new roles from October 2026"`, `bookingUrl: null`, `avatarUrl: "/images/profile-portrait.png"`.
  - Mọi I18nText đều có đủ `en`, `ja`, `vi`. Văn phong theo bộ CV §5.
- [ ] **Step 4:** Chạy `npx vitest run tests/unit/content-*` → PASS.
- [ ] **Step 5:** Commit `feat(content): add content schema and fact-based seed in EN/JA/VI`.

### Task 3: Lớp dữ liệu, helper vai trò và i18n

**Files:**
- Create: `src/lib/i18n-text.ts`, `src/lib/roles.ts`, `src/lib/data/repository.ts`, `src/lib/data/seed-repository.ts`, `src/lib/data/supabase-repository.ts`, `src/lib/data/mappers.ts`, `src/lib/data/get-content.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/browser.ts`, `src/lib/supabase/service.ts`
- Test: `tests/unit/i18n-text.test.ts`, `tests/unit/roles.test.ts`, `tests/unit/get-content.test.ts`, `tests/unit/mappers.test.ts`

**Interfaces:**
- Consumes: các type ở Task 2.
- Produces:
  - `pickLocale(text: I18nText | null | undefined, locale: Locale): string`: trả bản dịch theo locale, nếu rỗng thì trả `en`, nếu không có text thì trả `''`.
  - `parseRole(v: string | null | undefined): RoleKey`: mặc định `'fullstack'`.
  - `orderExperiences(exps: Experience[], role: Role): Experience[]`: chỉ lấy mục `published`. Các id có trong `role.experienceOrder` đứng trước, đúng thứ tự đó. Phần còn lại xếp theo `sortIndex`.
  - `orderSkillGroups(role: Role): SkillGroup[]`: `role.skillGroupOrder` trước, sau đó các nhóm còn lại theo thứ tự khai báo ở `SkillGroup`.
  - `interface ContentRepository { getContent(): Promise<Content> }`; `class SeedRepository`; `class SupabaseRepository(client)`.
  - `mappers.ts`: `rowToProfile`, `rowToRole`, `rowToExperience`, `rowToProject`, `rowToSkill(row, links)`, `rowToCertificate`, `rowToActivity`, `rowToEducation`, `rowToWhyCard`, cộng các hàm ngược `experienceToRow`, … (mỗi bảng một cặp). Cột DB dùng snake_case, xem Task 19.
  - `loadContent(env = process.env): Promise<Content>`: không có `NEXT_PUBLIC_SUPABASE_URL` thì dùng seed. Supabase throw hoặc trả dữ liệu sai `contentSchema` thì `console.warn` rồi dùng seed.
  - `getContent(): Promise<Content>`: gồm `'use cache'`, `cacheTag('content')`, `cacheLife('max')`, gọi `loadContent()`.
  - `createServerSupabase()` (cookie-based, `@supabase/ssr`), `createBrowserSupabase()`, `createServiceSupabase()` (dùng service role, chỉ dùng trong script và server).

- [ ] **Step 1: Viết test (fail)**
  - `pickLocale({en:'Hi',ja:''},'ja') === 'Hi'`; `pickLocale({en:'Hi',vi:'Chào'},'vi') === 'Chào'`; `pickLocale(undefined,'en') === ''`.
  - `parseRole('pm') === 'pm'`; `parseRole('xyz') === 'fullstack'`; `parseRole(null) === 'fullstack'`.
  - `orderExperiences`: với role `pm` của seed, id đầu tiên là `skg-ai-agent`. Với `techlead`, id đầu tiên là `skg-flexybox-p1`. Mục `published:false` bị loại.
  - `orderSkillGroups(roles.pm)` bắt đầu bằng `['delivery','cloud','languages']` và đủ 8 nhóm, không trùng.
  - `loadContent({})` trả về dữ liệu bằng seed. `loadContent` với repository giả throw `Error('paused')` vẫn trả seed và gọi `console.warn` một lần.
  - `mappers`: round-trip `rowToExperience(experienceToRow(e))` deep-equal `e` với mỗi experience trong seed. Tương tự cho certificate và whyCard.
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Implement. `loadContent` nhận thêm tham số tùy chọn `repoFactory` để test inject được repository giả.
- [ ] **Step 4:** Chạy `npx vitest run` → PASS.
- [ ] **Step 5:** Commit `feat(data): add content repository with seed fallback and role helpers`.

### Task 4: i18n routing, proxy, layout, theme, header/footer

**Files:**
- Create: `src/i18n/routing.ts`, `src/i18n/request.ts`, `src/i18n/navigation.ts`, `src/proxy.ts`, `src/messages/en.json`, `src/messages/ja.json`, `src/messages/vi.json`, `src/app/[locale]/layout.tsx`, `src/app/[locale]/page.tsx` (khung trống gồm 7 `<section>`), `src/components/site/{Header,Footer,ThemeToggle,LanguageSwitch,RoleProvider}.tsx`
- Test: `tests/unit/messages.test.ts`

**Interfaces:**
- Produces:
  - `routing = defineRouting({ locales: ['en','ja','vi'], defaultLocale: 'en', localePrefix: 'always' })`.
  - `proxy.ts`: request bắt đầu bằng `/admin` thì đi qua `adminGuard(request)` (implement ở Task 20; ở task này chỉ là stub `NextResponse.next()`). Còn lại đi qua `createMiddleware(routing)`. Matcher: `'/((?!api|_next|_vercel|.*\\..*).*)'`.
  - ID của 7 section, dùng chung cho anchor, ⌘K và scene: `SECTION_IDS = ['hero','experience','projects','skills','certificates','why','contact'] as const` export từ `src/components/site/sections.ts`.
  - `RoleProvider` (client): context `{ role: RoleKey; setRole(r) }`, đồng bộ với `?role=` bằng `router.replace` (không scroll). `useRole()`.
  - Theme: class `dark` hoặc `light` trên `<html>`, mặc định `dark`, lưu `localStorage['theme']`. Có script inline chạy trước khi paint để tránh nháy giao diện. `useTheme()` trả `{theme, setTheme}`.
  - Font: `Inter` (body) + `Space Grotesk` (heading) qua `next/font/google`, subset `latin`, `vietnamese`. Với `ja` dùng thêm `Noto Sans JP`.
- [ ] **Step 1:** Viết test (fail): 3 file messages có **cùng tập key** (so sánh key lồng nhau), không có giá trị rỗng.
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Implement. Header gồm logo LETCAL, link tới 7 section, `LanguageSwitch` (giữ `?role=` và hash), `ThemeToggle`, gợi ý `⌘K`. Footer gồm © năm hiện tại và các link. Layout gọi `setRequestLocale` và `generateStaticParams`; locale không hợp lệ thì `notFound()`.
- [ ] **Step 4:** Chạy `npx vitest run && npm run build` → PASS. `npm run dev`, mở `/` thì redirect sang `/en`; mở `/fr` thì ra 404.
- [ ] **Step 5:** Commit `feat(i18n): add locale routing, proxy, theme and site chrome`.

## Phase B: Các section (HTML + motion, chưa có 3D)

Quy ước chung cho Phase B: section là Server Component, nhận `content` + `locale`. Phần tương tác tách thành client component nhỏ. Mọi chữ nhìn thấy được đều qua `pickLocale` (nội dung) hoặc `useTranslations` (UI). Hiệu ứng xuất hiện dùng `<Reveal>` (Task 12) nên Phase B chưa cần animation khi cuộn.

### Task 5: Hero (Ao nước, phần HTML)

**Files:** Create `src/components/sections/Hero.tsx`, `src/components/site/RoleSwitcher.tsx`. Modify `src/app/[locale]/page.tsx`. Test `tests/unit/hero.test.tsx` (Vitest + @testing-library/react, jsdom).

**Interfaces:** Consumes `useRole`, `pickLocale`, `Content`. Produces `<Hero content locale />`. `RoleSwitcher` là nhóm 3 nút `role="radiogroup"`, mỗi nút có chấm màu theo giống koi (`kohaku #e4571e/#f4eee7`, `showa #111/#e4571e`, `ogon #e0a84e`).

- [ ] **Step 1:** Test (fail): render với role `pm` thì thấy chức danh `Software Engineer · Technical Project Manager` (EN) và summary của pm. Có badge Open to work khi `openToWork: true` và không có khi `false`. Có 3 CTA với tên `Download CV`, `Contact`, `60-second view`. Href của CV là `/cv/LeTranCatLam_CV_TechnicalPM.pdf`.
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Implement. H1 là tên (đây là phần tử LCP). Ảnh chân dung dùng `next/image` với `priority={false}`, có `sizes`. Bên phải Hero chừa vùng trống cho cá bơi (phần mặt nước), có `data-water-zone`.
- [ ] **Step 4:** Chạy → PASS. Commit `feat(hero): add hero with role switcher and CTAs`.

### Task 6: Experience dạng dòng sông + case study + Education

**Files:** Create `src/components/sections/experience/{Timeline,CaseStudySheet}.tsx`. Test `tests/unit/timeline.test.tsx`.

**Interfaces:** Consumes `orderExperiences`, `useRole`. Produces element có `id="exp-<id>"` cho mỗi mục (dùng cho evidence link và skill map). Mục SKG được nhóm dưới tiêu đề công ty "SKG Software (Splus) · Aug 2025 – Sep 2026" kèm 2 dòng chức danh (Intern, Software Engineer). Education là mục cuối, có nhãn "Education".

- [ ] **Step 1:** Test (fail): với role `pm`, mục `skg-ai-agent` có thứ tự DOM trước `skg-flexybox-p1`. Ngày tháng hiển thị dạng `Apr 2026 – Sep 2026` (EN) và `2026年4月 – 2026年9月` (JA). Bấm vào một mục thì mở Sheet có 4 tiêu đề Problem/Role/Decisions/Result. Nhấn Esc thì đóng. Có mục Education chứa `FPT University`.
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Implement. Hàm format ngày `formatPeriod(start, end, locale)` đặt ở `src/lib/format.ts` (`end === null` thì in `messages.common.present`). Rê chuột vào một mục thì các mục khác `opacity-50`. Đường "dòng sông" là một SVG path dọc phía sau timeline. Thay đổi thứ tự khi đổi vai trò có animation `layout` của motion.
- [ ] **Step 4:** PASS. Commit `feat(experience): add river timeline with case study sheet`.

### Task 7: Projects (bento + video khi rê chuột)

**Files:** Create `src/components/sections/projects/{ProjectsBento,ProjectCard}.tsx`. Test `tests/unit/project-card.test.tsx`.

**Interfaces:** Produces element có `id="proj-<id>"`. `ProjectCard` có video thì render `<video muted playsInline loop preload="none" poster=…>`. Desktop: play khi `pointerenter`, pause khi `pointerleave`. Mobile: play khi card nằm ≥ 60% trong viewport (IntersectionObserver).

- [ ] **Step 1:** Test (fail): project không có `videoUrl` thì không có thẻ `<video>` và hiện poster hoặc placeholder gradient. Có `videoUrl` thì video có `preload="none"` và `muted`. Bấm card thì mở `CaseStudySheet` (tái sử dụng từ Task 6). Có link Demo/Code khi có URL.
- [ ] **Step 2:** FAIL → **Step 3:** implement. Bento: card đầu chiếm 2 cột trên desktop. → **Step 4:** PASS. Commit `feat(projects): add bento grid with hover video previews`.

### Task 8: Bản đồ kỹ năng có bằng chứng

**Files:** Create `src/components/sections/skills/SkillMap.tsx`, `src/lib/skills.ts`. Test `tests/unit/skills.test.ts`, `tests/unit/skill-map.test.tsx`.

**Interfaces:** `evidenceFor(skillId, content): { experiences: Experience[]; projects: Project[] }` trong `src/lib/skills.ts`. Khi chọn một skill, set `data-highlight="true"` lên các phần tử `#exp-*`/`#proj-*` liên quan (qua context `HighlightProvider`, không thao tác DOM trực tiếp).

- [ ] **Step 1:** Test (fail): `evidenceFor('terraform', seed)` gồm `skg-ai-agent`. Nhóm skill hiển thị theo `orderSkillGroups(role)`. Bấm `Next.js` thì panel bằng chứng liệt kê tên các experience liên quan. Không có phần tử nào dạng `progressbar`.
- [ ] **Step 2–4:** FAIL → implement → PASS. Commit `feat(skills): add evidence-linked skill map`.

### Task 9: Certificates + Activities

**Files:** Create `src/components/sections/certificates/Certificates.tsx`. Test `tests/unit/certificates.test.tsx`.

- [ ] **Step 1:** Test (fail): có 2 tab Certificates/Activities. Bộ lọc topic `All, Language, PM, UX/Design, Engineering, Other`; chọn `Language` thì chỉ còn JLPT N3. Link xác thực mở tab mới (`target="_blank" rel="noopener noreferrer"`). Không render certificate có `published:false`.
- [ ] **Step 2–4:** FAIL → implement (card dạng "đèn lồng": viền cam, glow nhẹ khi hover) → PASS. Commit `feat(certificates): add filterable certificates and activities`.

### Task 10: Why Hire Me (viết lại, giữ hình thức cũ)

**Files:** Create `src/components/sections/why/{WhyCarousel,WhyCard,WaveBackground}.tsx`. Test `tests/unit/why.test.tsx`.

**Interfaces:** Bám hình thức card cũ ở `src/components/pages/WhyHireMe/WhyCardList.jsx` + `WhyHireMeSection.css` (commit `1f2585f`): nền gradient 2 màu + 2 lớp sóng SVG, nghiêng tối đa ±8° theo chuột (tắt ở màn ≤ 640px), sóng dịch ±20px khi hover. Carousel: kéo bằng `motion` (`drag="x"`, `dragMomentum`), có snap, nút prev/next tròn 50px viền cam, hỗ trợ phím ←/→ khi focus.

- [ ] **Step 1:** Test (fail): render đủ 4 card từ seed, theo đúng `sortIndex`. Mỗi card có link "See evidence" trỏ tới `evidenceLink`. Nhấn nút next thì card active tăng 1. Nhấn ArrowRight khi carousel đang focus cũng vậy.
- [ ] **Step 2–4:** FAIL → implement → PASS. Commit `feat(why): rebuild Why Hire Me carousel on new stack`.

### Task 11: Contact

**Files:** Create `src/components/sections/Contact.tsx`. Test `tests/unit/contact.test.tsx`.

- [ ] **Step 1:** Test (fail): nút copy email gọi `navigator.clipboard.writeText('letcal2003@gmail.com')` rồi hiện toast `Copied`. Nút đặt lịch chỉ có khi `bookingUrl` khác null. Link CV đúng theo vai trò. Không có chuỗi khớp `/\+84|0964/`.
- [ ] **Step 2–4:** FAIL → implement (khối CTA ở giữa, có `id="contact-core"` để rồng bay vòng quanh ở Task 17) → PASS. Commit `feat(contact): add contact section`.

### Task 12: ⌘K, smooth scroll, Reveal

**Files:** Create `src/components/site/{CommandPalette,SmoothScroll,Reveal}.tsx`. Test `tests/unit/command-palette.test.tsx`.

**Interfaces:** `CommandPalette` mở bằng `Meta+K` hoặc `Ctrl+K`, hoặc khi phát event `window.dispatchEvent(new Event('open-command'))`. Các nhóm lệnh: Go to (7 section), Role (3), Language (3), Theme (2), Actions (Download CV, Copy email, 60-second view). `SmoothScroll` khởi tạo Lenis và nối với `gsap.ticker` + `ScrollTrigger.update`; tắt khi `prefers-reduced-motion`. `Reveal` (client) fade/translate 24px khi vào viewport, dùng `motion` `whileInView` với `once: true`; khi reduced-motion thì không animate.

- [ ] **Step 1:** Test (fail): nhấn Ctrl+K thì dialog mở. Gõ "proj" thì còn lệnh "Projects". Chọn "日本語" thì gọi `router.replace` với locale `ja`. Esc thì đóng.
- [ ] **Step 2–4:** FAIL → implement → PASS. Commit `feat(site): add command palette, smooth scroll and reveal`.

### Task 13: Chế độ xem nhanh `/[locale]/quick` + e2e trang công khai

**Files:** Create `src/app/[locale]/quick/page.tsx`, `src/components/quick/QuickView.tsx`, `tests/e2e/public.spec.ts`. Modify `playwright.config.ts` (webServer: `npm run build && npm run start -- -p 3100`).

**Interfaces:** QuickView là 1 trang A4 (`@media print` không có header/nav), gồm tên, chức danh theo `?role=`, summary, 4 experience đầu theo vai trò (mỗi mục 1 dòng), các nhóm skill, 4 chứng chỉ chính, education, liên hệ, nút Download CV và nút Print. Không import bất kỳ thứ gì từ `src/scene`.

- [ ] **Step 1:** Viết e2e (fail):
  - `/en` có đủ 7 section `#hero … #contact`; `/ja` và `/vi` render H1 tên và không có chuỗi `undefined`.
  - `/en?role=pm` có chức danh PM. Bấm RoleSwitcher sang Tech Lead thì URL chứa `role=techlead`.
  - `/en?role=xyz` hiện chức danh Full-stack.
  - `/fr` trả 404.
  - Ctrl+K mở palette.
  - `/en/quick` không có `canvas` và có nút Print.
- [ ] **Step 2:** Chạy `npm run test:e2e` → FAIL ở phần quick.
- [ ] **Step 3:** Implement QuickView.
- [ ] **Step 4:** `npm run test:e2e` → PASS. Commit `feat(quick): add printable 60-second recruiter view and public e2e`.

## Phase C: Cảnh 3D

### Task 14: Hạ tầng scene: tier, thời điểm tải, chapter, store

**Files:** Create `src/scene/{tier,loading,chapters,store}.ts`, `src/scene/KoiCanvas.tsx`. Modify `src/app/[locale]/page.tsx` để mount `<KoiCanvas />`. Test `tests/unit/scene-logic.test.ts`.

**Interfaces:**
- `detectTier(i: { webgl: boolean; reducedMotion: boolean; isMobile: boolean; cores: number }): 'high'|'low'|'off'`: không có WebGL hoặc reduced-motion thì `off`; mobile hoặc `cores ≤ 4` thì `low`; còn lại `high`.
- `shouldDowngrade(fps: number[]): boolean`: cần ≥ 60 mẫu và trung bình < 40.
- `shouldLoadScene(i: { tier; isMobile; interacted: boolean; idleMs: number; pageLoaded: boolean }): boolean`: `off` thì luôn false; desktop thì `pageLoaded`; mobile thì `interacted || idleMs ≥ 3000`.
- `getChapterProgress(scrollY: number, sectionTops: number[], viewportH: number): { chapter: number; t: number }`: chapter là section có top ≤ `scrollY + viewportH*0.5` lớn nhất; `t` ∈ [0,1] là tiến độ trong chapter đó, có clamp.
- `transformState(chapter: number, t: number): { morph: number; scatter: number }`: chapter < 5 thì `{0,0}`. Chapter 5: `t ≤ 0.35` thì `{0,0}`; `0.35 < t < 0.65` thì `scatter = sin(π·(t-0.35)/0.3)` và `morph = (t-0.35)/0.3`; `t ≥ 0.65` thì `{1,0}`. Chapter 6 thì `{1,0}`.
- `store.ts`: store nhỏ dùng `useSyncExternalStore` (không thêm thư viện), state `{ chapter, t, pointer: {x,y}|null, theme, role, tier, foods: Food[] }`, gồm `subscribe/getState/setState`.
- `KoiCanvas` (client): dùng `detectTier` + `shouldLoadScene`. Trước khi tải xong thì hiện `<img src="/fallback/koi-{night|day}.jpg">` (`aria-hidden`, `position: fixed`, `inset: 0`, `object-fit: cover`, `opacity: 0.6`). Tải `SceneRoot` bằng `dynamic(() => import('./SceneRoot'), { ssr: false })`. Khi `tier === 'off'` thì giữ ảnh tĩnh, đổi sang `dragon-*.jpg` khi chapter ≥ 5. Canvas là `position: fixed`, `inset: 0`, `z-index: -1`, `pointer-events: none`. Pointer lấy từ `window` (pointermove) và chỉ ghi vào store khi con trỏ nằm trên `[data-water-zone]` hoặc ở chapter 0.

- [ ] **Step 1:** Test (fail) cho từng hàm, dùng đúng các giá trị ở trên. Ví dụ: `transformState(5,0.5).scatter ≈ 1` (sai số 1e-6) và `.morph ≈ 0.5`; `getChapterProgress(0,[0,800,1600],800)` = `{chapter:0, t:0}`; `shouldDowngrade(Array(60).fill(30)) === true`; `shouldDowngrade(Array(30).fill(10)) === false`.
- [ ] **Step 2–4:** FAIL → implement (`SceneRoot` tạm render `<Canvas>` rỗng, `dpr={[1, tier==='high'?1.5:1.25]}`, `frameloop` chuyển `"never"` khi `document.hidden`) → PASS. Commit `feat(scene): add tiering, lazy loading and chapter progress`.

### Task 15: Sinh vật dựng bằng code (koi ↔ rồng)

**Files:** Create `src/scene/creature/{profiles,spine,textures}.ts`, `src/scene/creature/Creature.tsx`. Test `tests/unit/creature-math.test.ts`.

**Interfaces:**
- `koiRadius(u)`, `dragonRadius(u)`: công thức theo prototype `koi-tech-styles-v2.html` (koi nhân 1.25). Cả hai > 0 với u ∈ [0,1].
- `bodyLength(morph) = lerp(1.7, 6.2, morph)`.
- `type Vec3 = { x: number; y: number; z: number }` (export từ `spine.ts`, tương thích `THREE.Vector3`).
- `followChain(points: Vec3[], head: Vec3, segLen: number): void`: kéo xích, giữ khoảng cách đều.
- `steer(head, heading, target, morph): { head, heading }`: góc quay tối đa 0.06 rad/frame, tốc độ `clamp(dist·0.035, 0.006, 0.035)·(1+0.8·morph)`.
- `buildFrames(points): { T, S, U }[]`: dùng UP=(0,1,0), cùng hướng với prototype.
- `makeKoiTexture(variety: KoiVariety): CanvasTexture`, `makeCircuitTexture(): CanvasTexture`: vẽ trên canvas, random có seed (`mulberry32(42)`) để kết quả ổn định.
- `<Creature />`: N=110, M=28 ở tier high, N=72, M=18 ở tier low. Có vây ngực, đuôi, gai, sừng (scale theo `morph`), râu (Line), mắt. Material: `MeshStandardMaterial` với map là texture koi, emissiveMap là mạch điện (`emissive #ff7a2a`, cường độ `0.8 + 0.35·sin(t·2.2) + 0.4·morph`). Màu chuyển dần sang vàng `#e0a84e` theo `morph`. Đổi vai trò thì crossfade texture trong 600ms.
- [ ] **Step 1:** Test (fail): `koiRadius(0) < koiRadius(0.3)`; `dragonRadius` giảm dần trên [0.1, 1]; `followChain` giữ khoảng cách giữa các điểm = `segLen ± 1e-6`; `steer` không quay quá 0.06 rad; `makeKoiTexture` gọi 2 lần cùng variety cho ra cùng dữ liệu pixel (môi trường test dùng `canvas` mock của jsdom; nếu jsdom không hỗ trợ canvas thì tách hàm `koiPatchLayout(variety)` trả về danh sách hình và test hàm đó).
- [ ] **Step 2–4:** FAIL → implement → PASS. Kiểm tra bằng mắt: `npm run dev`, cá bơi theo chuột ở Hero. Commit `feat(scene): add procedural koi/dragon creature`.

### Task 16: Môi trường: mặt nước, chương, ngày/đêm

**Files:** Create `src/scene/environment/{Water,Props,Lighting}.tsx`, `src/scene/interactions/feed.ts`. Modify `src/scene/SceneRoot.tsx`. Test `tests/unit/feed.test.ts`.

**Interfaces:**
- `Water`: plane dùng shader. Gợn sóng lấy từ một uniform mảng 12 ripple `{x, z, t0}` (từ đuôi cá, từ con trỏ, từ mồi). Đêm thì mặt gương tối `#0a1014` có lưới mờ. Ngày thì nước trong `#7fb8c9`, ánh caustics nhẹ.
- `Props`: lá sen (chapter 2), dải thác bằng shader trên plane dọc (chapter 3), đèn lồng (instanced, chapter 4), cổng (chapter 5). Mỗi prop fade theo khoảng cách tới chapter của nó.
- `Lighting`: hemisphere + directional + point light cam bám theo đầu cá. Bản ngày/đêm đổi cường độ và màu. Tier high có `<EffectComposer><Bloom luminanceThreshold={0.85} intensity={0.55}/></EffectComposer>`.
- Camera theo chapter: bảng `CHAPTER_CAMERA: { pos: [x,y,z]; look: [x,y,z] }[7]` đặt trong `src/scene/chapters.ts`, nội suy theo `t`. Giá trị do người build chọn, miễn là chapter 0 nhìn mặt ao từ trên chéo xuống như prototype.
- `feed.ts`: `type Food = { id: number; x: number; z: number; t0: number }`; `addFood(foods: Food[], p: {x:number; z:number}, now: number): Food[]` giữ tối đa 5 viên (bỏ viên cũ nhất); `nearestFood(foods, head)`; `eatFood(foods, head, radius = 0.15)`. Bấm trên `[data-water-zone]` thì raycast xuống mặt nước rồi `addFood`. Khi có mồi, cá lái về viên gần nhất trước con trỏ.
- [ ] **Step 1:** Test (fail): thêm 6 viên thì còn 5, viên đầu tiên bị bỏ; `eatFood` xóa viên nằm trong bán kính 0.15.
- [ ] **Step 2–4:** FAIL → implement → PASS. Kiểm tra bằng mắt: cuộn qua từng section thì camera và prop đổi; bấm nút theme thì ao đổi ngày/đêm. Commit `feat(scene): add water, chapter props, lighting and feeding`.

### Task 17: Khoảnh khắc hóa rồng + rồng hộ vệ

**Files:** Create `src/scene/creature/PointCloudMorph.tsx`. Modify `Creature.tsx`, `SceneRoot.tsx`.

**Interfaces:** Lấy `transformState(chapter, t)` từ Task 14. Khi `scatter > 0` thì ẩn mesh và hiện `Points` dùng chung geometry thân (có attribute `aRand`), shader dịch vị trí `aRand·scatter·1.6`, có tia quét. Khi `chapter === 6` thì target của đầu rồng là quỹ đạo elip quanh vị trí `#contact-core` đã chiếu xuống mặt phẳng (cập nhật khi resize). Cuộn ngược lên thì đảo ngược toàn bộ.
- [ ] **Step 1:** Thêm test vào `scene-logic.test.ts` cho `orbitTarget(center, time, radius): Vec3`: khoảng cách tới center bằng `radius` (elip: x theo radius, z theo radius·0.6).
- [ ] **Step 2–4:** FAIL → implement → PASS. Kiểm tra bằng mắt: cuộn tới Why Hire Me thì cá tan thành điểm rồi ghép thành rồng; ở Contact rồng bay vòng quanh CTA. Commit `feat(scene): add point-cloud transformation and guardian dragon`.

### Task 18: Ảnh fallback + tối ưu hiệu năng

**Files:** Create `scripts/capture-fallbacks.ts`, `public/fallback/{koi-night,koi-day,dragon-night,dragon-day}.jpg`, `tests/e2e/motion.spec.ts`.

**Interfaces:** Scene đọc query `?capture=koi|dragon&theme=night|day`. Khi có query này thì ẩn HTML, cố định cá ở giữa và tắt animation. Script dùng Playwright mở 4 URL, chụp viewport 1600×900 dạng JPEG quality 78, lưu vào `public/fallback/`.
- [ ] **Step 1:** e2e (fail): với `page.emulateMedia({ reducedMotion: 'reduce' })`, `/en` không có `canvas` và có `img[src*="/fallback/"]`. Viewport 390×844 (mobile) thì chưa có `canvas` trước khi có tương tác.
- [ ] **Step 2:** Chạy `npx tsx scripts/capture-fallbacks.ts` để tạo 4 ảnh. Mỗi ảnh phải < 180KB.
- [ ] **Step 3:** Chạy `npm run build && npm run start -- -p 3100`, rồi `npx lighthouse@12 http://localhost:3100/en --form-factor=mobile --only-categories=performance,accessibility --output=json --output-path=./lighthouse.json --chrome-flags="--headless"`. Expected: Performance ≥ 85, Accessibility ≥ 95, LCP ≤ 2500ms, CLS ≤ 0.1. Nếu không đạt thì sửa (giảm N/M ở tier low, hoãn tải lâu hơn, nén ảnh) cho tới khi đạt. Nếu tier low trên mobile vẫn không đạt thì tắt canvas trên mobile, chỉ dùng ảnh (đúng quy tắc trong spec §7.5).
- [ ] **Step 4:** `npm run test:e2e` → PASS. Thêm `lighthouse.json` vào `.gitignore`. Commit `perf(scene): add static fallbacks and meet mobile performance budget`.

## Phase D: Backend + Admin

### Task 19: Migration Supabase + script seed

**Files:** Create `supabase/migrations/0001_init.sql`, `scripts/seed-supabase.ts`. Modify `src/lib/data/supabase-repository.ts` (nếu cần, để khớp tên cột).

**Interfaces:**
- Bảng (khóa chính `id text`, trừ `profile` chỉ có 1 dòng với `id = 'me'`): `profile`, `roles` (pk `key`), `experiences`, `projects`, `skills`, `skill_links (skill_id, experience_id null, project_id null)`, `certificates`, `activities`, `education`, `why_cards`. Cột snake_case khớp với `mappers.ts`. Trường I18nText kiểu `jsonb`. Có `created_at`, `updated_at` (trigger tự cập nhật).
- RLS bật cho mọi bảng. Policy `select` cho `anon`: `published = true` ở các bảng có cột `published`, các bảng còn lại `true`. Bảng `app_admins(email text primary key)` (RLS bật, không có policy cho anon) và hàm `is_admin()` `security definer` trả `exists(select 1 from app_admins where lower(email) = lower(auth.jwt() ->> 'email'))`. Policy `insert/update/delete` cho `authenticated`: `is_admin()`. README hướng dẫn `insert into app_admins values ('<email>')`.
- Storage: bucket `media` và `files` (public read). Ghi chỉ cho `is_admin()`.
- `seed-supabase.ts`: đọc `src/content/seed.json`, validate bằng `contentSchema`, upsert theo `id` qua `createServiceSupabase()`, in ra số dòng của từng bảng.
- [ ] **Step 1:** Mở rộng `tests/unit/mappers.test.ts`: mọi key do `*ToRow` tạo ra đều có trong danh sách cột của bảng tương ứng. Danh sách cột export từ `src/lib/data/columns.ts` và **chính file đó** được dùng khi sinh SQL (giữ một nguồn duy nhất). Test fail.
- [ ] **Step 2–4:** FAIL → implement `columns.ts` + SQL + script → PASS. Commit `feat(db): add Supabase schema, RLS and seed script`.

### Task 20: Đăng nhập admin + chặn route

**Files:** Create `src/lib/admin/auth.ts`, `src/app/admin/login/page.tsx`. Modify `src/proxy.ts` (thay stub `adminGuard`). Test `tests/unit/admin-auth.test.ts`, `tests/e2e/admin.spec.ts`.

**Interfaces:**
- `isAdminEmail(email: string | null | undefined, adminEmail: string | undefined): boolean`: so sánh không phân biệt hoa thường, sau khi trim. Thiếu một trong hai giá trị thì trả `false`.
- `adminGuard(req)`: tạo Supabase client từ cookie và lấy user. `/admin/login` luôn cho qua. Route khác mà chưa đăng nhập hoặc không phải admin thì redirect `/admin/login?next=<path>`.
- `requireAdmin(): Promise<{ email: string }>`: dùng trong mọi server action; không phải admin thì throw `Error('FORBIDDEN')`.
- Trang login: form email + mật khẩu, gọi `supabase.auth.signInWithPassword`. Đăng nhập thành công thì về `next` hoặc `/admin`. Chưa cấu hình env thì hiện thông báo "Chưa cấu hình Supabase, xem README".
- [ ] **Step 1:** Test (fail): `isAdminEmail(' A@x.com ','a@x.com') === true`; `isAdminEmail('b@x.com','a@x.com') === false`; `isAdminEmail('a@x.com', undefined) === false`. E2E: `/admin` redirect về `/admin/login`.
- [ ] **Step 2–4:** FAIL → implement → PASS. Commit `feat(admin): add admin login and route guard`.

### Task 21: CRUD admin dạng cấu hình

**Files:** Create `src/lib/admin/{resources,upload}.ts`, `src/app/admin/actions.ts`, `src/app/admin/(panel)/{layout,page}.tsx`, `src/app/admin/(panel)/[resource]/page.tsx`, `src/app/admin/(panel)/[resource]/[id]/page.tsx`, `src/components/admin/{ResourceTable,ResourceForm,I18nField,UploadField,SortableList}.tsx`. Test `tests/unit/admin-upload.test.ts`, `tests/unit/admin-resources.test.ts`.

**Interfaces:**
- `ResourceKey = 'experiences'|'projects'|'skills'|'certificates'|'activities'|'education'|'why_cards'`.
- `resources: Record<ResourceKey, { label: string; table: string; schema: ZodObject; listColumns: string[]; i18nFields: string[]; uploads?: { field: string; kind: UploadKind }[]; hasPublished: boolean }>`. Label viết tiếng Việt.
- `UploadKind = 'image'|'video'|'pdf'`; `validateUpload(f: { size: number; type: string }, kind: UploadKind): { ok: true } | { ok: false; reason: string }`. Giới hạn: image ≤ 5MB (`image/jpeg|png|webp|avif`); video ≤ 8MB (`video/mp4|webm`); pdf ≤ 10MB (`application/pdf`).
- Server actions (mọi action đều `requireAdmin()` trước, gọi `updateTag('content')` sau khi ghi): `saveResource(key, data)`, `deleteResource(key, id)`, `reorderResource(key, ids: string[])`, `togglePublished(key, id, value)`, `uploadFile(kind, file) → { url }`, `saveSkillLinks(skillId, { experienceIds, projectIds })`.
- `ResourceForm`: react-hook-form + `zodResolver(resources[key].schema)`. Trường i18n hiện 3 tab EN/JA/VI và đánh dấu tab còn thiếu bản dịch. `SortableList` dùng `@dnd-kit/sortable`. Xóa phải qua Dialog xác nhận. Lưu thành công thì hiện toast bằng sonner.
- [ ] **Step 1:** Test (fail): video 9MB bị từ chối; `image/gif` bị từ chối; pdf 1MB thì ok. Với mọi `ResourceKey`, `resources[key].schema` parse được phần tử đầu tiên của mảng seed tương ứng. Mỗi `i18nFields` là một key có trong schema.
- [ ] **Step 2–4:** FAIL → implement → PASS. Kiểm tra bằng mắt (khi đã có Supabase): sửa một certificate thì trang `/en` cập nhật sau khi reload. Commit `feat(admin): add config-driven CRUD with uploads and ordering`.

### Task 22: Dashboard, Profile, Roles

**Files:** Create `src/app/admin/(panel)/profile/page.tsx`, `src/app/admin/(panel)/roles/page.tsx`. Modify `src/app/admin/(panel)/page.tsx`, `src/app/admin/actions.ts`.

**Interfaces:** `saveProfile(data: Profile)`, `saveRole(data: Role)` (cả hai `requireAdmin` + `updateTag`). Dashboard có số lượng mỗi bảng, switch Open to work (gọi `saveProfile` với một trường), link "Xem trang". Trang Roles: sửa title, upload CV (pdf), sắp thứ tự experience bằng kéo thả, sắp thứ tự nhóm skill.
- [ ] **Step 1:** Thêm test vào `admin-resources.test.ts`: `profileSchema` từ chối object có trường `phone` (schema dùng `.strict()`).
- [ ] **Step 2–4:** FAIL → implement → PASS. Commit `feat(admin): add dashboard, profile and roles editors`.

## Phase E: Nhận diện, tài liệu, nghiệm thu

### Task 23: SEO và nhận diện

**Files:** Create `src/app/[locale]/opengraph-image.tsx`, `src/app/icon.svg` (cá koi tối giản màu cam), `src/app/manifest.ts`, `src/app/robots.ts`, `src/app/sitemap.ts`. Modify `src/app/[locale]/layout.tsx` (`generateMetadata`, JSON-LD). Test `tests/unit/metadata.test.ts`.

**Interfaces:**
- Title: `en` "Le Tran Cat Lam · Software Engineer Portfolio"; `ja` "レ・チャン・カット・ラム · ソフトウェアエンジニア ポートフォリオ"; `vi` "Lê Trần Cát Lâm · Portfolio Kỹ sư Phần mềm". `metadataBase = NEXT_PUBLIC_SITE_URL`. Có `alternates.languages` cho 3 locale. Ảnh OG 1200×630 gồm tên, chức danh của role mặc định, chữ "Portfolio", hình cá koi, nền tối, viền cam.
- JSON-LD `Person`: name, jobTitle, url, sameAs [LinkedIn, GitHub], `knowsLanguage` [vi, en, ja].
- `sitemap.ts`: `/en`, `/ja`, `/vi`, `/en/quick`, `/ja/quick`, `/vi/quick`. `robots.ts`: cho phép `/`, chặn `/admin`.
- [ ] **Step 1:** Test (fail): gọi `generateMetadata({ params: Promise.resolve({ locale: 'ja' }) })` thì title đúng như trên. `robots()` có `disallow: '/admin'`. `sitemap()` có 6 URL.
- [ ] **Step 2–4:** FAIL → implement → PASS. Commit `feat(seo): add metadata, OG image, sitemap and JSON-LD`.

### Task 24: README + nghiệm thu cuối

**Files:** Modify `README.md`.

- [ ] **Step 1:** Viết README (tiếng Việt) gồm: chạy local; tạo project Supabase free; chạy SQL migration; thêm email admin vào `app_admins`; tạo user admin trong Supabase Auth; điền `.env.local`; `npm run seed`; thêm env trên Vercel; gắn domain `letcal.is-a.dev` (Vercel → Domains, tắt redirect `www`); bật lại Supabase khi bị tạm dừng; thay model glTF sau này (interface `Creature`).
- [ ] **Step 2:** Chạy `npm run lint && npx tsc --noEmit && npx vitest run && npm run test:e2e && npm run build`. Expected: tất cả pass.
- [ ] **Step 3:** Chạy lại Lighthouse như ở Task 18, ghi kết quả (Performance, Accessibility, LCP, CLS) vào cuối README.
- [ ] **Step 4:** Grep toàn bộ `src/` và `seed.json` bằng các regex trung thực ở Task 2. Expected: 0 kết quả.
- [ ] **Step 5:** Commit `docs: add setup and operations README`. **Không push.** Báo chủ dự án để duyệt bản dịch và quyết định push/merge.

---

## Việc ngoài code (chủ dự án đồng ý cho Claude làm qua Claude in Chrome, 2026-10-13)

- **O1: Đổi tên project Vercel** đang deploy `my-portfolio-mauve-psi-28.vercel.app` thành `letcal` (Settings → General → Project Name), kiểm tra `letcal.vercel.app` mở được.
- **O2: Đăng ký `letcal.is-a.dev`:** fork `is-a-dev/register`, tạo `domains/letcal.json` đúng format trong docs hiện hành của is-a.dev (owner = GitHub `Let-cal` + email, record `CNAME: cname.vercel-dns.com`), mở PR có mô tả ngắn và link tới site đang chạy. Sau khi PR được merge thì thêm domain trong Vercel → Domains.
