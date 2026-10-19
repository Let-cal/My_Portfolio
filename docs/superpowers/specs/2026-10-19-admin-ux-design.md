# Spec: Nâng cấp trang admin (quan hệ, sức khỏe nội dung, sửa nhanh, an toàn, xem trước, thư viện file, giao diện)

- Ngày: 2026-10-19
- Chủ sở hữu: Lê Trần Cát Lâm (Let-cal)
- Repo: `github.com/Let-cal/My_Portfolio`, nhánh làm việc `feat/admin-ux` (mỗi đợt một PR vào `main`)
- Nền tảng hiện có: admin ở `/admin` (PR #6). Gồm `src/lib/admin/resources.ts` (cấu hình 7 danh sách), `src/components/admin/*`, server actions ở `src/app/admin/actions.ts`, Supabase có RLS, `updateTag('content')` sau mỗi lần ghi.
- Mockup đã duyệt: `../.superpowers/brainstorm/1228-1792396289/content/admin-overview.html`
- Ký hiệu: **[Chủ dự án]** là quyết định của chủ dự án; **[Claude]** là lựa chọn của Claude, chủ dự án có thể đổi.

## 1. Ý định và lý do

Admin hiện tại dùng được, nhưng sửa nội dung tốn thời gian và dễ bỏ sót. Ví dụ, muốn biết skill nào gắn với project nào, phải mở từng skill. Không có cách nào nhìn ra skill đã hiện cho nhà tuyển dụng nhưng chưa có bằng chứng: dữ liệu thật hiện có **12/67 skill** như vậy, gồm Framer Motion, GSAP, Sass/SCSS, MUI, MongoDB, Jest, React Testing Library, Playwright…

**Mục tiêu của chủ dự án:**
- Sửa portfolio nhanh.
- Không bỏ sót nội dung thiếu hoặc lệch.
- Không phải mở từng mục để kiểm tra.
- Admin là một phần của sản phẩm, cũng thể hiện tay nghề UI/UX. **[Chủ dự án]**

Chỉ có một người dùng là chủ dự án. Ưu tiên tốc độ thao tác và độ an toàn khi sửa.

## 2. Mục tiêu, không phải mục tiêu, phản mục tiêu

**Mục tiêu.** Chủ dự án chọn đủ 7 nhóm A–G. Thứ tự ưu tiên: A và B trước. **[Chủ dự án]**

**Không phải mục tiêu:**
- Nhiều người dùng, phân quyền, quy trình duyệt bài.
- Cộng tác thời gian thực.
- Dịch máy bằng AI. Lý do: tốn phí API, trái nguyên tắc chi phí 0 đồng. **[Claude]**
- Đổi schema nội dung công khai: các trường của `contentSchema` giữ nguyên.

**Phản mục tiêu.** Nếu xảy ra một trong các điều sau thì coi như thất bại, dù tính năng có chạy:
- Trang công khai chậm hơn, hoặc lộ nội dung đang ẩn.
- Có thao tác ghi bỏ qua RLS.
- Mất dữ liệu mà không khôi phục được.
- Thêm dịch vụ trả phí.
- Lặp đi lặp lại các vòng đánh bóng: mỗi đợt chỉ sửa tối đa 1 vòng cho phần không phải chức năng, phần còn lại ghi thành issue. **[Chủ dự án]**

## 3. Ràng buộc

- Stack giữ nguyên: Next.js 16 (Cache Components; mọi chỗ đọc session hoặc params đều nằm trong `<Suspense>`), Supabase (Postgres + Auth + Storage), Tailwind v4, shadcn/radix có sẵn trong `src/components/ui`, `motion/react`, `@dnd-kit`, `cmdk`, `sonner`.
- Mọi thao tác ghi đi qua server action có `requireAdmin()`, rồi `updateTag('content')`. RLS vẫn là lớp chặn cuối.
- Thay đổi DB:
  - Thêm migration mới trong `supabase/migrations/`, không sửa migration cũ.
  - Nếu đổi bảng nội dung thì cập nhật `columns.ts` và chạy `npm run db:schema`.
  - Bảng phụ không phải nội dung (ví dụ lịch sử phiên bản) viết thẳng vào migration, đồng thời thêm vào phần cố định của `schema-sql.ts` để `supabase/schema.sql` vẫn phản ánh trạng thái thật.
- Upload đi thẳng từ trình duyệt lên Storage, vì Vercel giới hạn body 4,5 MB.
- Không thêm dependency trả phí.
- Dependency mới phải nhỏ và có lý do.
- Chi phí: 0 đồng. Phải nằm trong giới hạn gói Free của Supabase (500 MB DB, 1 GB storage).
- Quy trình:
  - Mỗi đợt là một PR. CI xanh (lint, types, unit, e2e, build, bảo mật).
  - Commit không có dòng attribution.
  - Chủ dự án thử trên bản preview trước khi merge.

## 4. Thiết kế theo đợt

### Đợt 1: A (quan hệ & bằng chứng) + B (sức khỏe nội dung)

**A1. Ma trận Skills × Bằng chứng** (`/admin/skills`, chế độ mặc định "Ma trận", có nút chuyển sang "Danh sách" là màn hiện tại).

Bố cục:
- **Hàng:** skill, gom theo nhóm theo thứ tự `SKILL_GROUPS`, trong nhóm theo `sortIndex`. Mỗi nhóm có hàng tiêu đề kèm số lượng.
- **Cột:** các kinh nghiệm theo `sortIndex`, rồi các project. Có vạch ngăn và nhãn "Kinh nghiệm" / "Dự án". Cột cuối là tổng số bằng chứng của skill. Hàng cuối là tổng số skill của mỗi cột.
- **Ô:** bấm để gắn hoặc bỏ gắn.
  - Cập nhật lạc quan (optimistic). Lỗi thì hoàn lại và hiện toast.
  - Phím: ô focus được, mũi tên di chuyển, Space/Enter để bật tắt. Có `role="grid"` và `aria-checked`.

Bộ lọc:
- Ô tìm theo tên skill.
- Nút "Chưa có bằng chứng (n)".
- Chọn nhóm.
- Ẩn hoặc hiện cột project đang ẩn.
- Dashboard truyền bộ lọc qua query string, ví dụ `?filter=orphan`.

Hàng skill chưa có bằng chứng được tô nền cảnh báo.

Ghi dữ liệu: server action mới `setSkillLink(skillId, target: { experienceId } | { projectId }, linked: boolean)`. Action này insert hoặc delete đúng một dòng `skill_links` (đã có unique `nulls not distinct`).

Trên màn hình hẹp (< 768px), ma trận cuộn ngang. Cột tên skill dính bên trái (sticky), hàng tiêu đề dính trên cùng.

**A2. Chiều ngược lại trong form.**
- Form kinh nghiệm và form dự án có thêm field ảo "Skills dùng ở đây": ô chọn nhiều có tìm kiếm, nhóm theo `skill_group`, hiện thành chip.
- Field ảo không thuộc schema của item. Khi lưu, action `saveResource` nhận thêm `skillIds` và đồng bộ `skill_links`: xóa các link của item này không còn trong danh sách, thêm các link mới.
- Item mới: tạo item trước rồi mới ghi link, trong cùng action.
- Test "form sửa mọi field của schema" phải bỏ qua field ảo. Field ảo đánh dấu bằng `virtual: true` trong `FieldSpec`.

**A3. Skill của chứng chỉ và hoạt động.**
- Field `tags` của `certificates.skills` và `activities.skills` thành ô nhập có gợi ý từ tên trong bảng Skills (combobox).
- Vẫn cho gõ tự do, vì nhiều kỹ năng mềm của chứng chỉ không có trong bảng Skills.
- Dữ liệu vẫn là `text[]`, không đổi schema. **[Claude]**

**B. Sức khỏe nội dung.**

Viết một hàm thuần `checkContentHealth(content: AdminContent): HealthIssue[]` trong `src/lib/admin/health.ts`. `AdminContent` là toàn bộ nội dung kể cả mục đang ẩn. Test bằng seed.

Kiểu dữ liệu: `HealthIssue = { id, severity: 'error' | 'warning' | 'info', kind, message (VI), href, count? }`.

Các kiểm tra:

| kind | Điều kiện | severity | href |
|---|---|---|---|
| `orphan-skill` | skill không có experienceIds lẫn projectIds | warning | `/admin/skills?filter=orphan` |
| `missing-translation` | mỗi trường i18n (kể cả lồng trong caseStudy, stat.label, summaries, role.title) có `en` khác rỗng nhưng `ja` hoặc `vi` rỗng; gom theo item | warning | trang sửa item, thêm `#field` nếu được |
| `broken-evidence` | `whyCard.evidenceLink` trỏ tới `#exp-x`/`#proj-x` không tồn tại hoặc đang ẩn | error | trang sửa why card |
| `missing-cv` | role có `cvFileUrl` rỗng | error | `/admin/roles` |
| `stale-order` | `role.experienceOrder` chứa id không tồn tại | warning | `/admin/roles` |
| `hidden-items` | có mục `published = false` (đếm theo loại) | info | danh sách tương ứng |
| `link-to-hidden` | skill chỉ có bằng chứng là mục đang ẩn, nên trên trang công khai coi như không có | warning | ma trận đã lọc |
| `empty-case-study` | experience hoặc project có case study nhưng thiếu nội dung EN của một phần | warning | trang sửa |

Dashboard `/admin`:
- Thẻ số liệu: Open to work (switch như hiện tại), % bản dịch đầy đủ, số mục đang ẩn, "Sửa gần nhất" (tên mục và thời gian, lấy theo `updated_at` lớn nhất trên các bảng).
- Danh sách "Cần chú ý", sắp theo severity. Mỗi dòng là một link. Nếu không có vấn đề nào thì hiện trạng thái "Mọi thứ ổn".
- Đếm số lượng theo bảng như hiện tại.

Sidebar: mục "Tổng quan" có badge số vấn đề `error + warning`.

### Đợt 2: C (sửa nhanh) + G (giao diện & chuyển động)

**C1. Danh sách.**
- Ô tìm kiếm, lọc nhanh trong trình duyệt (dữ liệu nhỏ).
- Chip trạng thái mỗi dòng: Hiện/Ẩn, thiếu bản dịch, số skill (với project và kinh nghiệm), "chưa có bằng chứng" (với skill).
- Lọc theo trạng thái.
- Dòng skill trong chế độ danh sách hiện số bằng chứng.

**C2. Sửa trong ngăn bên phải.**
- Bấm một dòng thì mở `Sheet` bên phải (rộng khoảng 640px trên desktop, toàn màn hình trên mobile) chứa form hiện tại. URL đổi thành `/admin/<resource>?edit=<id>` để dùng được nút Back và chia sẻ link.
- Route `/admin/<resource>/<id>` vẫn giữ, để mở thẳng và làm fallback.

**C3. Phím tắt.**
- `⌘/Ctrl+S` lưu.
- `Esc` đóng ngăn, hỏi xác nhận nếu chưa lưu.
- `J`/`K` chuyển mục khi ngăn đang mở; nếu form đang có thay đổi chưa lưu thì hỏi trước.
- `⌘/Ctrl+K` mở palette của admin: nhảy tới mọi mục của mọi loại, tạo mới, mở trang công khai.
- `N` tạo mới trên trang danh sách.
- Phím tắt không chạy khi đang gõ trong ô input, trừ ⌘S.

**C4. ID tự sinh.**
- Khi tạo mới, ID tự điền từ tên hoặc tiêu đề (bỏ dấu tiếng Việt, kebab-case) cho tới khi người dùng tự sửa ô ID.
- Báo trùng ID ngay khi gõ (so với danh sách đang có).

**C5. Nhân bản mục.**
- Nút "Nhân bản" tạo bản sao: ID thêm `-copy`, `published = false`, xếp cuối danh sách. Với skill thì chép luôn các link.

**C6. Cảnh báo chưa lưu.**
- `beforeunload`, và hỏi khi đóng ngăn hoặc chuyển trang trong admin.

**G. Giao diện và chuyển động.**
- Admin dùng token màu của site.
- Có nút Dark/Light, dùng lại `ThemeToggle` và store theme hiện có; mặc định theo hệ thống.
- Sidebar có icon (lucide hoặc bộ `src/components/site/icons.tsx`), thu gọn được trên desktop, thành menu ngăn kéo trên mobile.
- Khi tải dữ liệu dùng skeleton thay cho chữ "Đang tải…".
- Chuyển động dùng `motion/react`, ngắn (150–250 ms):
  - Ngăn trượt vào.
  - Dòng danh sách dùng layout animation khi kéo thả hoặc khi lọc.
  - Ô ma trận có hiệu ứng scale nhẹ khi bật.
  - Nút lưu chuyển trạng thái "Đã lưu ✓".
- Tôn trọng tùy chọn reduced-motion của hệ thống. Admin không dùng nút Motion của site. **[Claude]**
- Trên mobile (390px), mọi màn dùng được: ma trận cuộn ngang với cột dính, form một cột.

### Đợt 3: D (an toàn khi sửa)

**D1. Bảng `private.content_versions`** (migration mới).
- Cột:
  - `id bigint identity`
  - `table_name text`
  - `item_key text` (giá trị `id`, hoặc `key` với roles, hoặc `'me'` với profile)
  - `op text check (op in ('update','delete'))`
  - `old_row jsonb`
  - `changed_by text` (email lấy từ `auth.jwt()`)
  - `changed_at timestamptz default now()`
- Trigger `after update or delete` trên 10 bảng nội dung ghi lại `old_row`. Riêng `skill_links` chỉ ghi khi delete: link không có id riêng nên `item_key = skill_id`, và lưu cả dòng.
- Phân quyền:
  - Schema `private` không lộ qua Data API.
  - Đọc và khôi phục qua hàm `security definer` trong schema `public`: `admin_list_versions(table_name, item_key)` và `admin_restore_version(version_id)`.
  - Cả hai kiểm tra `private.is_admin()` trước, nếu không phải admin thì raise.
  - Grant execute chỉ cho `authenticated`.
- Giữ tối đa 50 phiên bản cho mỗi item; trigger xóa bản cũ hơn.

**D2. Xóa có hoàn tác.**
- Xóa vẫn thực hiện ngay.
- Toast hiện 10 giây với nút "Hoàn tác". Bấm thì gọi `admin_restore_version` với phiên bản `delete` vừa tạo, khôi phục cả các `skill_links` bị xóa theo (cùng `changed_at`).

**D3. Báo ảnh hưởng trước khi xóa.**
- Hộp xác nhận liệt kê những gì bị ảnh hưởng: số skill link sẽ mất, why card đang trỏ tới mục này, vai trò có mục này trong `experienceOrder`.

**D4. Lịch sử.**
- Trong ngăn sửa có tab "Lịch sử": danh sách phiên bản (thời gian, người sửa).
- Bấm một phiên bản để xem diff theo trường: so `old_row` với giá trị hiện tại, chỉ hiện các trường khác nhau, trường i18n hiện theo từng ngôn ngữ.
- Nút "Khôi phục bản này".

### Đợt 4: E (xem trước & bản dịch)

**E1. Xem trước mục đang ẩn.**
- Route `/admin/preview?locale=en&target=<anchor>`: bật `draftMode()` (chỉ khi `requireAdmin()` thành công) rồi chuyển hướng tới `/<locale>#<anchor>`.
- Khi `draftMode().isEnabled`:
  - `getContent` đọc bằng session admin, không cache, nên có cả mục ẩn.
  - Trang hiện một thanh nhỏ "Đang xem trước, có cả mục ẩn · Thoát". Nút Thoát gọi route tắt draft mode.
- Người xem thường không bị ảnh hưởng: nhánh không có draft mode giữ nguyên cache.
- Builder kiểm tra cách Next 16 kết hợp `draftMode` với `'use cache'` trong `node_modules/next/dist/docs/` và chọn cách đúng. Yêu cầu bắt buộc: không làm hỏng cache công khai, và không lộ mục ẩn ra bản cache công khai.

**E2. Tiến độ dịch.**
- Mỗi item trong danh sách và trong ngăn sửa có thanh EN/JA/VI (ví dụ "JA 8/10"). Dùng chung logic đếm với kiểm tra `missing-translation`.

**E3. "Chép từ EN".**
- Mỗi trường i18n có nút nhỏ chép nội dung EN sang ô JA hoặc VI đang trống, để có bản nháp rồi sửa tay.
- Không gọi dịch máy.

**E4. Chế độ một ngôn ngữ.**
- Trong ngăn sửa có chọn "Cả 3 cột / Chỉ EN / Chỉ JA / Chỉ VI", nhớ lựa chọn bằng `localStorage`, giúp dịch nhanh theo từng ngôn ngữ.

### Đợt 5: F (thư viện file)

- Trang `/admin/media` liệt kê các object trong bucket `media` và `files`: tên, loại, dung lượng, ngày tải.
- Lưới ảnh có thumbnail; PDF và video có icon.
- Cột "Đang dùng ở" tìm URL công khai của file trong toàn bộ nội dung: `profile.avatarUrl`, `roles.cvFileUrl`, `projects.posterUrl/videoUrl`, `certificates.fileUrl`.
- File không còn dùng có nhãn "Không dùng" và nút xóa. Xóa có xác nhận; không có hoàn tác, vì Storage không lưu phiên bản.
- Hiện tổng dung lượng so với 1 GB của gói Free.
- `UploadField` có thêm nút "Chọn từ thư viện" mở hộp chọn file đã có, lọc theo loại.
- Cần thêm storage policy `select` cho admin: `bucket_id in ('media','files') and private.is_admin()`, để liệt kê được object. Đây là migration mới.
- File do site dùng sẵn trong `public/` (CV gốc, ảnh role) không thuộc Storage và không hiện ở đây. **[Claude]**

## 5. Kiểm thử và hoàn thành

Mỗi đợt có:
- **Unit test cho logic thuần:** `checkContentHealth`, đồng bộ `skill_links`, sinh ID, đếm bản dịch, tìm nơi dùng file, diff phiên bản.
- **Test server action với Supabase giả:** như `tests/unit/admin-actions.test.ts` hiện có.
- **Test trigger, hàm và policy trên database thật:**
  - Sau khi áp migration, kiểm tra bằng SQL trên project.
  - Thử bằng publishable key để chắc không gọi được các hàm admin.
  - Chạy Supabase security advisor, kết quả không có WARN mới.
- **E2E:** mỗi màn admin mới chuyển hướng về trang login khi chưa đăng nhập. CI không có tài khoản admin, nên không e2e luồng đã đăng nhập.
- **Chủ dự án thử thật trên preview** trước khi merge: theo checklist trong mô tả PR.

Một đợt được coi là xong khi:
- CI xanh.
- Chủ dự án duyệt preview.
- PR được merge và production chạy bình thường.

## 6. Để builder tự quyết

- Tên file, chia component, cách tổ chức state (ưu tiên server component + client island nhỏ).
- Chi tiết hình ảnh: khoảng cách, cỡ chữ, icon cụ thể. Nguyên tắc là gọn, dày thông tin vừa phải, đồng bộ với site.
- Cách giới hạn số phiên bản (trigger hoặc cron), miễn là nằm trong gói Free.
- Có gộp đợt 4 và đợt 5 vào một PR hay không, nếu cả hai đều nhỏ.

## 7. Quyết định sau builder check (2026-10-19)

1. **Preview dùng chung database với production** **[Claude]**.
   - Lý do không tách database: tổ chức Supabase đã dùng hết 2 project miễn phí, còn Supabase branching là tính năng trả phí. Chủ dự án đã biết preview và production dùng chung dữ liệu.
   - Vì vậy migration của đợt 3 và đợt 5 phải là **thay đổi cộng thêm**: chỉ thêm bảng, trigger, hàm, policy; không đổi hay xóa cột nội dung. Như vậy áp trước khi merge vẫn an toàn với code đang chạy trên production.
   - Migration được áp khi mở PR, để preview chạy được.
   - Mỗi migration kèm SQL rollback, ghi trong mô tả PR.
   - Checklist thử trên preview dùng một mục thử: tạo một chứng chỉ ẩn `test-item`, sửa, xóa, hoàn tác, khôi phục rồi xóa hẳn. Không thao tác phá hủy trên nội dung thật.
2. **Lịch sử và khôi phục áp dụng cho cả Profile và Roles** **[Claude]**.
   - Trang Hồ sơ và trang Vai trò có nút "Lịch sử" mở cùng component xem phiên bản và diff.
   - Diff xử lý được cả trường i18n lồng nhau, ví dụ `summaries.*`.
   - Khôi phục dùng upsert như lúc lưu.
3. **Các điểm builder tự quyết, ghi lại để thống nhất:**
   - Trigger phiên bản bỏ qua thay đổi chỉ gồm `sort_index`/`updated_at`, để kéo thả không làm đầy 50 phiên bản.
   - Lưu skill đồng bộ `skill_links` theo phần chênh lệch (diff), không xóa hết rồi chèn lại.
   - Khôi phục sau xóa gom theo giao dịch: lưu `txid_current()` vào `content_versions`, không dựa vào `changed_at`.
   - `stale-order` chỉ báo id không tồn tại. Phần thiếu đã được `roles.ts` tự nối vào cuối.
   - Bật tắt ô trong ma trận được gom lại, chỉ gọi `updateTag` một lần sau khoảng 800 ms không thao tác.
   - Nút theme trong admin phải chạy được bên ngoài provider next-intl.
